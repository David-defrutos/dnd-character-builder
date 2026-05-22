// Documento generado el 2026-05-19-2200
// Helpers to compute and apply Ability Score Improvements / Feats
// at level-up checkpoints (PHB 2024).
//
// 2024 rules in a nutshell:
//   • Every class gets ASIs at levels 4, 8, 12, 16 and an Epic Boon at 19.
//   • Fighter gains EXTRA ASIs at levels 6 and 14.
//   • Rogue gains an EXTRA ASI at level 10.
//   • At each ASI, the player may choose to:
//       (a) take a +2 bump to one ability (max 20)
//       (b) take a +1 bump to two different abilities (each max 20)
//       (c) take any feat for which they qualify (Origin/General/Fighting Style).
//   • At level 19 (Epic Boon), the choice is constrained to Epic Boon feats.
//   • Cap: an ASI bump cannot raise an ability above 20. (Epic Boons override
//     this for one ability, up to 30, but that's tracked inside the boon itself.)

import { getClassById, type CharacterClass, type ClassFeature } from '@/data/dnd5e/classes'
import { feats as allFeats, type Feat } from '@/data/dnd5e/feats'
import type { ASIChoice, AbilityScores } from '@/stores/character'

export type AbilityKey = keyof AbilityScores

/** All ability keys in canonical sheet order. */
export const ABILITY_KEYS: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/**
 * Returns the list of character levels at which the given class earns an ASI.
 * Derived from the class features (we look for "Ability Score Improvement" and
 * for level-19 "Epic Boon" entries). Result is sorted ascending and capped by
 * `maxLevel`.
 */
export function getAsiLevels(classId: string, maxLevel: number): number[] {
  const cls = getClassById(classId)
  if (!cls) return []
  const asiLevels = new Set<number>()
  for (const feat of cls.features as ClassFeature[]) {
    if (feat.level > maxLevel) continue
    const name = feat.name.toLowerCase()
    if (name === 'ability score improvement' || name.includes('epic boon')) {
      asiLevels.add(feat.level)
    }
  }
  return [...asiLevels].sort((a, b) => a - b)
}

/** True if the given level is an Epic Boon checkpoint (always level 19). */
export function isEpicBoonLevel(level: number): boolean {
  return level === 19
}

/** Feats the player can pick at a given checkpoint level for a given class.
 *  PHB 2024 (H6 fix): los Origin feats se eligen UNA SOLA VEZ a través del
 *  background a lv.1. En los ASI normales (lv.4/8/12/16) solo se pueden
 *  elegir General feats. A lv.19 se elige un Epic Boon. */
export function eligibleFeats(level: number, _cls: CharacterClass | undefined): Feat[] {
  if (isEpicBoonLevel(level)) {
    return allFeats.filter(f => f.category === 'epic-boon')
  }
  return allFeats.filter(f => f.category === 'general')
}

/** Aggregate ASI bumps from a list of choices into a Partial<AbilityScores>.
 *  Used by Step 4 / 5 to recompute the totals each time the user changes
 *  a checkpoint choice. Includes both raw ASI bumps (asiMode '2' or '1+1')
 *  and the +1 bumps granted by chosen feats (e.g. Crossbow Expert → +1 DEX).
 *  Does NOT enforce the 20-cap by itself (the UI does that by warning when
 *  totals exceed 20). */
export function aggregateAsiBumps(choices: ASIChoice[]): Partial<AbilityScores> {
  const out: Partial<AbilityScores> = {}
  for (const c of choices) {
    if (c.type === 'asi' && c.asiAbilities) {
      if (c.asiMode === '2') {
        const k = c.asiAbilities[0]
        if (k) out[k] = (out[k] ?? 0) + 2
      } else if (c.asiMode === '1+1') {
        for (const k of c.asiAbilities) {
          if (!k) continue
          out[k] = (out[k] ?? 0) + 1
        }
      }
    } else if (c.type === 'feat' && c.featId) {
      // Feat ASI bonus: if the feat grants a +1 to an ability, apply it.
      // For single-option feats it's auto-resolved; for multi-option feats
      // the user's choice is stored on featAbility.
      const feat = allFeats.find(f => f.id === c.featId)
      if (feat?.asiBonus) {
        let chosen: AbilityKey | undefined
        if (feat.asiBonus.abilities.length === 1) {
          chosen = feat.asiBonus.abilities[0] as AbilityKey
        } else if (c.featAbility && (feat.asiBonus.abilities as readonly string[]).includes(c.featAbility)) {
          chosen = c.featAbility
        }
        if (chosen) {
          out[chosen] = (out[chosen] ?? 0) + feat.asiBonus.amount
        }
      }
    }
  }
  return out
}

/** Returns the list of feat ids granted by the player's checkpoint choices.
 *  Useful to render tags in featuresTraits and to verify uniqueness
 *  (most feats are non-repeatable). */
export function chosenFeatIds(choices: ASIChoice[]): string[] {
  return choices.filter(c => c.type === 'feat' && c.featId).map(c => c.featId!)
}

/**
 * Auto-resolves the `featAbility` field of an ASIChoice based on the chosen feat:
 *   - if the feat has no asiBonus → undefined
 *   - if the feat has exactly one option → that option (fixed)
 *   - if the feat has multiple options:
 *       · keep current selection if still valid
 *       · otherwise → undefined (user must pick)
 */
export function resolveFeatAbility(
  featId: string | undefined,
  current: AbilityKey | undefined,
): AbilityKey | undefined {
  if (!featId) return undefined
  const feat = allFeats.find(f => f.id === featId)
  if (!feat?.asiBonus) return undefined
  const opts = feat.asiBonus.abilities as readonly AbilityKey[]
  if (opts.length === 1) return opts[0]
  if (current && opts.includes(current)) return current
  return undefined
}
