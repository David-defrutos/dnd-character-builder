// #109 — Descompone cada Ability Score del personaje en sus FUENTES
// (base + species + background + ASI bumps + feat asiBonus), para
// mostrarlo en el Detailed Reference del PDF anexo.
//
// La función NO modifica el personaje. Es puramente para visualización.
//
// Ejemplo de salida para DEX 19:
//   {
//     ability: 'dex',
//     total: 19,
//     sources: [
//       { label: 'Base', value: 15 },
//       { label: 'Background (Guide)', value: 2 },
//       { label: 'ASI lv.4 (Crossbow Expert)', value: 1 },
//       { label: 'ASI lv.8 (Resilient)', value: 1 },
//     ]
//   }
//
// Nota: el "Base" es char.abilityScores antes de cualquier bonus. Los
// campos speciesBonuses/backgroundBonuses/asiBonuses del store son los
// totales pre-calculados; aquí los desglosamos volviendo a leer los
// orígenes (asiChoices, background, race).

import type { CharacterData, AbilityScores } from '@/stores/character'
import { feats as allFeats } from '@/data/dnd5e/feats'
import { getRaceById } from '@/data/dnd5e/races'
import { getBackgroundById } from '@/data/dnd5e/backgrounds'

export type AbilityKey = keyof AbilityScores

export interface AbilitySource {
  /** Descripción legible: "Base", "Background (Guide)", "ASI lv.4 (...)". */
  label: string
  /** Contribución de esta fuente al score. Suele ser +1, +2; puede ser 0. */
  value: number
}

export interface AbilityBreakdown {
  ability: AbilityKey
  total: number
  sources: AbilitySource[]
}

const ABILITY_ORDER: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/**
 * Devuelve el breakdown completo para las 6 abilities del personaje.
 * Garantiza que el total mostrado coincide con la suma de las fuentes;
 * si por cualquier motivo no cuadra (datos viejos, inconsistencias),
 * se añade una fuente "Other" con la diferencia para que la suma siempre
 * cuadre con el score real del personaje.
 */
export function computeAbilityBreakdown(char: CharacterData): AbilityBreakdown[] {
  const results: AbilityBreakdown[] = []

  // Pre-computar fuentes que NO dependen de la ability (las leemos una vez).
  const race = char.race ? getRaceById(char.race) : undefined
  const bg = char.background ? getBackgroundById(char.background) : undefined
  const bgName = bg?.name ?? char.background ?? ''
  const raceName = race?.name ?? char.race ?? ''

  for (const ab of ABILITY_ORDER) {
    const sources: AbilitySource[] = []

    // 1. BASE — el ability score "raw" que el jugador asignó en Step 4.
    //    Los bonuses se aplican ENCIMA, NO están reflejados en abilityScores.
    const base = char.abilityScores[ab] ?? 10
    sources.push({ label: 'Base', value: base })

    // 2. SPECIES — en 2024 siempre 0, pero lo mostramos si hay algo
    //    (variantes legacy o personajes antiguos pueden tener ≠0).
    const speciesV = char.speciesBonuses?.[ab] ?? 0
    if (speciesV) {
      sources.push({ label: `Species (${raceName})`, value: speciesV })
    }

    // 3. BACKGROUND — 2024: los backgrounds dan +2/+1 a dos abilities o
    //    +1/+1/+1 a tres. Mostramos cada background con su nombre.
    const bgV = char.backgroundBonuses?.[ab] ?? 0
    if (bgV) {
      sources.push({ label: `Background (${bgName})`, value: bgV })
    }

    // 4. ASI bumps — desglosados POR checkpoint, no agregados. Esto es lo
    //    que pide #109: ver el origen exacto de cada +1 o +2.
    for (const c of (char.asiChoices ?? [])) {
      if (c.type === 'asi' && c.asiAbilities) {
        if (c.asiMode === '2') {
          if (c.asiAbilities[0] === ab) {
            sources.push({ label: `ASI lv.${c.level} (+2)`, value: 2 })
          }
        } else if (c.asiMode === '1+1') {
          for (const k of c.asiAbilities) {
            if (k === ab) {
              sources.push({ label: `ASI lv.${c.level} (+1)`, value: 1 })
            }
          }
        }
      } else if (c.type === 'feat' && c.featId) {
        const feat = allFeats.find(f => f.id === c.featId)
        if (!feat?.asiBonus) continue
        let chosen: AbilityKey | undefined
        if (feat.asiBonus.abilities.length === 1) {
          chosen = feat.asiBonus.abilities[0] as AbilityKey
        } else if (c.featAbility && (feat.asiBonus.abilities as readonly string[]).includes(c.featAbility)) {
          chosen = c.featAbility as AbilityKey
        }
        if (chosen === ab) {
          sources.push({
            label: `ASI lv.${c.level} (${feat.name})`,
            value: feat.asiBonus.amount,
          })
        }
      }
    }

    // 5. TOTAL real (debe coincidir con la suma de fuentes). Si no coincide,
    //    añadimos un "Other" con la diferencia para mantener consistencia.
    const computed = sources.reduce((acc, s) => acc + s.value, 0)
    const real = base + speciesV + bgV + (char.asiBonuses?.[ab] ?? 0)
    if (computed !== real) {
      sources.push({ label: 'Other', value: real - computed })
    }

    results.push({ ability: ab, total: real, sources })
  }

  return results
}
