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
import { getClassEntries, getAsiChoicesForClass } from '@/utils/classEntries'

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

  // 1. Subclase faltante en cualquier clase que haya llegado a su subclassLevel.
  //    #147 M2: itera TODAS las clases (primaria + secundarias). Antes solo
  //    la primaria, lo cual permitía dejar un Wizard secundario lv.3+ sin
  //    Arcane Tradition sin que la app avisase.
  for (const entry of getClassEntries(char)) {
    const entryCls = allClasses.find(c => c.id === entry.classId)
    if (!entryCls?.subclasses?.length) continue
    const subclassLevel = entryCls.subclassLevel ?? 3
    if (entry.level < subclassLevel) continue
    if (entry.subclass) continue  // ya elegida
    out.push({
      key: `subclass-${entry.classId}`,
      message: `Choose your ${entryCls.subclassName ?? 'subclass'} for ${entryCls.name} (unlocked at level ${subclassLevel}).`,
    })
  }

  // 2. ASI / Feat checkpoints for any level ≤ current.
  //    #139 Fase 3c: iterar TODAS las clases del PJ. Para cada clase, los
  //    checkpoints se calculan con su nivel DENTRO de esa clase (no el total),
  //    y los choices se leen con getAsiChoicesForClass.
  const classEntries = getClassEntries(char)
  for (const entry of classEntries) {
    const entryCls = allClasses.find(c => c.id === entry.classId)
    if (!entryCls) continue
    const classLabel = entryCls.name  // para el mensaje al usuario
    const showLabel = classEntries.length > 1  // solo etiquetar si multiclass
    const asiLevels = getAsiLevels(entry.classId, entry.level)
    const choices = getAsiChoicesForClass(char, entry.classId)
    for (const lvl of asiLevels) {
      const tag = `${entry.classId}-${lvl}`
      const lvlMsg = showLabel ? `${classLabel} lv.${lvl}` : `level ${lvl}`
      const c = choices.find(x => x.level === lvl)
      if (!c) {
        out.push({ key: `asi-${tag}-missing`, message: `Resolve the ASI/Feat choice at ${lvlMsg}.` })
        continue
      }
      if (c.type === 'asi') {
        // Need abilities filled out: mode '2' requires 1, '1+1' requires 2 distinct.
        const abs = c.asiAbilities ?? []
        if (c.asiMode === '2' && !abs[0]) {
          out.push({ key: `asi-${tag}-empty`, message: `Pick the ability to bump at ${lvlMsg}.` })
        } else if (c.asiMode === '1+1') {
          if (abs.length < 2 || !abs[0] || !abs[1]) {
            out.push({ key: `asi-${tag}-two`, message: `Pick both abilities to bump at ${lvlMsg}.` })
          } else if (abs[0] === abs[1]) {
            out.push({ key: `asi-${tag}-dup`, message: `The two +1 bumps at ${lvlMsg} must target different abilities.` })
          }
        } else if (!c.asiMode) {
          out.push({ key: `asi-${tag}-mode`, message: `Choose +2 to one or +1 to two at ${lvlMsg}.` })
        }
      } else if (c.type === 'feat') {
        if (!c.featId) {
          out.push({ key: `feat-${tag}-missing`, message: `Choose a feat at ${lvlMsg}.` })
        } else {
          // If the chosen feat grants a multi-option ASI, the user must pick which ability.
          const feat = getFeatById(c.featId)
          if (feat?.asiBonus && feat.asiBonus.abilities.length > 1 && !c.featAbility) {
            out.push({
              key: `feat-${tag}-ability`,
              message: `Pick the +1 ability for ${feat.name} at ${lvlMsg}.`,
            })
          }
          // If the feat requires user-selected choices (Skilled, Crafter, etc.),
          // every choice must be fully resolved before leveling up — #52 fase 2.
          if (feat?.requiresChoices) {
            for (const choice of feat.requiresChoices) {
              const picked = c.featChoices?.[choice.id] ?? []
              if (picked.length < choice.count) {
                out.push({
                  key: `feat-${tag}-${choice.id}`,
                  message: `${feat.name} (${lvlMsg}): ${choice.label} — picked ${picked.length}/${choice.count}.`,
                })
              }
            }
          }
        }
      }
    }
  }

  // 3. Spellcasting: cantrips and spells known/prepared up to date.
  //
  // #139 Fase 4d (multiclass): si el PJ tiene más de una clase caster, el
  // cupo es la SUMA de los cupos por clase, no solo el de la primaria. La
  // UI (Step7Spells) ya calcula así el cupo agregado, este gating se alinea.
  //
  // Cantrips también se suman (cada clase caster tiene su propia
  // cantripsKnown). Para no atascar a PJs con MagicInitiate-only (no es
  // spellcaster por clase pero tiene cantrips), conservamos la rama
  // primaria-only cuando solo hay una clase caster.
  const casterEntries = getClassEntries(char).filter(e => {
    const c = allClasses.find(cc => cc.id === e.classId)
    return !!c?.spellcasting
  })

  if (casterEntries.length > 0) {
    // Necesitamos abilityModifiers calculados (recalculo aquí porque no
    // tenemos acceso al store en este nivel).
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

    // Cupo TOTAL: suma de todas las clases caster.
    let maxCantripsTotal = 0
    let maxSpellsTotal = 0
    let primaryCasterIsPrepared = false
    for (const e of casterEntries) {
      maxCantripsTotal += getCantripsKnown(e.classId, e.level)
      maxSpellsTotal += getSpellsKnownCount(e.classId, e.level, abilityModifiers)
      // Para la etiqueta "prepared spell" vs "known spell" tomamos la
      // primera caster (la primaria si lo es). No ideal en multiclass de
      // mixed caster types, pero coherente con la UI actual.
      const ec = allClasses.find(cc => cc.id === e.classId)
      if (ec?.spellcasting?.preparedCaster && !primaryCasterIsPrepared) {
        primaryCasterIsPrepared = true
      }
    }

    const haveCantrips = (char.cantrips ?? []).length
    if (haveCantrips < maxCantripsTotal) {
      const need = maxCantripsTotal - haveCantrips
      out.push({
        key: 'cantrips',
        message: `Choose ${need} more cantrip${need === 1 ? '' : 's'}.`,
      })
    }

    const haveSpells = (char.spellsKnown ?? []).length
    if (haveSpells < maxSpellsTotal) {
      const need = maxSpellsTotal - haveSpells
      const label = primaryCasterIsPrepared ? 'prepared spell' : 'known spell'
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
