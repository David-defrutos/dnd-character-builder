// Documento generado el 2026-05-20-1230 — tarea #50 (gating del level-up)
//
// Devuelve la lista de decisiones pendientes que el usuario debe resolver
// para el NIVEL ACTUAL del personaje antes de poder subir al siguiente.
// La idea: en lugar de "arreglar retroactivamente" estados inconsistentes
// (subclase tardía, ASI sin elegir, hechizos faltantes), bloqueamos la
// progresión hasta que esté todo cerrado en el nivel actual.
//
// Decisiones cubiertas:
//   1. Subclase: nivel ≥ subclassLevel (3 en 2024) y `subclass === ''`.
//   2. ASI / Feat: hay un slot en `asiChoices` para nivel ≤ actual donde:
//        · type='asi'  y faltan abilities seleccionadas
//        · type='feat' y `featId === ''`
//        · type='feat' con un feat multi-opción (asiBonus.abilities.length > 1)
//          y `featAbility === undefined`
//   3. Hechizos: la clase es spellcaster y faltan cantrips o
//      (spells preparados/conocidos) por debajo del máximo.
//
// El array devuelto contiene mensajes legibles. Vacío ⇒ todo OK.

import type { CharacterData } from '@/stores/character'
import { getClasses, getCantripsKnown, getSpellsKnownCount, getRaces } from '@/data'
import { getAsiLevels } from '@/data/dnd5e/asi'
import { getFeatById } from '@/data/dnd5e/feats'
import { modifier } from '@/utils/calculations'
import {
  getMagicInitiateInstances,
  isMagicInitiateInstanceComplete,
} from '@/utils/magicInitiate'

export interface PendingDecision {
  /** Stable key for v-for / aria. */
  key: string
  /** Short label suitable for tooltips and aria-describedby. */
  message: string
}

/**
 * Returns the decisions the player still needs to resolve at the character's
 * current level. Empty list ⇒ safe to level up.
 */
export function pendingLevelDecisions(char: CharacterData): PendingDecision[] {
  const out: PendingDecision[] = []

  // 0. Species choices (e.g. Dragonborn → Draconic Ancestry).
  if (char.race) {
    const allRaces = getRaces(char.variant)
    const race = allRaces.find(r => r.id === char.race)
    if (race?.choices?.length) {
      for (const choice of race.choices) {
        const chosen = char.speciesChoices?.[choice.id]
        if (!chosen) {
          out.push({
            key: `species-choice-${choice.id}`,
            message: `Choose your ${choice.label} (${race.name}).`,
          })
        }
      }
    }
  }

  const allClasses = getClasses(char.variant)
  const cls = allClasses.find(c => c.id === char.className)
  if (!cls) return out // no class selected yet — earlier steps gate this

  // 1. Subclass missing once the unlock level is reached.
  const subclassLevel = cls.subclassLevel ?? 3
  if (char.level >= subclassLevel && cls.subclasses?.length && !char.subclass) {
    out.push({
      key: 'subclass',
      message: `Choose your ${cls.subclassName ?? 'subclass'} (unlocked at level ${subclassLevel}).`,
    })
  }

  // 2. ASI / Feat checkpoints for any level ≤ current.
  const asiLevels = getAsiLevels(cls.id, char.level)
  const choices = char.asiChoices ?? []
  for (const lvl of asiLevels) {
    const c = choices.find(x => x.level === lvl)
    if (!c) {
      out.push({ key: `asi-${lvl}-missing`, message: `Resolve the ASI/Feat choice at level ${lvl}.` })
      continue
    }
    if (c.type === 'asi') {
      // Need abilities filled out: mode '2' requires 1, '1+1' requires 2 distinct.
      const abs = c.asiAbilities ?? []
      if (c.asiMode === '2' && !abs[0]) {
        out.push({ key: `asi-${lvl}-empty`, message: `Pick the ability to bump at level ${lvl}.` })
      } else if (c.asiMode === '1+1') {
        if (abs.length < 2 || !abs[0] || !abs[1]) {
          out.push({ key: `asi-${lvl}-two`, message: `Pick both abilities to bump at level ${lvl}.` })
        } else if (abs[0] === abs[1]) {
          out.push({ key: `asi-${lvl}-dup`, message: `The two +1 bumps at level ${lvl} must target different abilities.` })
        }
      } else if (!c.asiMode) {
        out.push({ key: `asi-${lvl}-mode`, message: `Choose +2 to one or +1 to two at level ${lvl}.` })
      }
    } else if (c.type === 'feat') {
      if (!c.featId) {
        out.push({ key: `feat-${lvl}-missing`, message: `Choose a feat at level ${lvl}.` })
      } else {
        // If the chosen feat grants a multi-option ASI, the user must pick which ability.
        const feat = getFeatById(c.featId)
        if (feat?.asiBonus && feat.asiBonus.abilities.length > 1 && !c.featAbility) {
          out.push({
            key: `feat-${lvl}-ability`,
            message: `Pick the +1 ability for ${feat.name} at level ${lvl}.`,
          })
        }
        // If the feat requires user-selected choices (Skilled, Crafter, etc.),
        // every choice must be fully resolved before leveling up — #52 fase 2.
        if (feat?.requiresChoices) {
          for (const choice of feat.requiresChoices) {
            const picked = c.featChoices?.[choice.id] ?? []
            if (picked.length < choice.count) {
              out.push({
                key: `feat-${lvl}-${choice.id}`,
                message: `${feat.name} (lv.${lvl}): ${choice.label} — picked ${picked.length}/${choice.count}.`,
              })
            }
          }
        }
      }
    }
  }

  // 3. Spellcasting: cantrips and spells known/prepared up to date.
  if (cls.spellcasting) {
    const maxCantrips = getCantripsKnown(cls.id, char.level)
    const haveCantrips = (char.cantrips ?? []).length
    if (haveCantrips < maxCantrips) {
      out.push({
        key: 'cantrips',
        message: `Choose ${maxCantrips - haveCantrips} more cantrip${maxCantrips - haveCantrips === 1 ? '' : 's'}.`,
      })
    }

    // For known/prepared count we need ability modifiers.
    // The store exposes `abilityModifiers` but we don't have it here — recompute
    // from the raw stats + bonuses snapshot stored in the character.
    const total = (k: keyof typeof char.abilityScores) => {
      const base = char.abilityScores[k] ?? 10
      const species = char.speciesBonuses?.[k] ?? 0
      const bg = char.backgroundBonuses?.[k] ?? 0
      const asi = char.asiBonuses?.[k] ?? 0
      return base + species + bg + asi
    }
    const abilityModifiers = {
      str: modifier(total('str')),
      dex: modifier(total('dex')),
      con: modifier(total('con')),
      int: modifier(total('int')),
      wis: modifier(total('wis')),
      cha: modifier(total('cha')),
    }
    const maxSpells = getSpellsKnownCount(cls.id, char.level, abilityModifiers)
    // En toda la app los hechizos seleccionados viven en char.spellsKnown
    // (incluso para preparadores; spellsPrepared es legacy y casi no se usa).
    // Antes esta rama leía spellsPrepared para preparedCaster=true y el gating
    // bloqueaba SIEMPRE con "Choose N more prepared spells" porque ese array
    // está vacío. Bug #79: Clérigo lv1→2 quedaba atrapado sin lugar visible
    // donde escoger los hechizos faltantes (Step7 y Step9 escriben en
    // spellsKnown). Fix: leer siempre spellsKnown.
    const haveSpells = (char.spellsKnown ?? []).length
    if (haveSpells < maxSpells) {
      const need = maxSpells - haveSpells
      const label = cls.spellcasting.preparedCaster ? 'prepared spell' : 'known spell'
      out.push({
        key: 'spells',
        message: `Choose ${need} more ${label}${need === 1 ? '' : 's'}.`,
      })
    }
  }

  // 4. Magic Initiate instances (origin feat + ASI feats).
  //    Each instance needs a spell list + 2 cantrips + 1 level-1 spell.
  for (const inst of getMagicInitiateInstances(char)) {
    if (!isMagicInitiateInstanceComplete(char, inst.source)) {
      out.push({
        key: `magic-initiate-${inst.source}`,
        message: `Magic Initiate (${inst.label}): pick spell list, 2 cantrips and 1 level-1 spell.`,
      })
    }
  }

  return out
}

/** True if it's safe to level up (no pending decisions at current level). */
export function canLevelUp(char: CharacterData): boolean {
  return pendingLevelDecisions(char).length === 0
}
