/**
 * Helpers for the Magic Initiate feat (PHB 2024).
 *
 * Magic Initiate can be taken multiple times (repeatable) and from two sources:
 *   - As an origin feat granted by a background → char.originFeatId.
 *   - As an ASI/feat choice at level 4, 8, 12, 16, 19 (or 6/14 for Fighter,
 *     10 for Rogue) → entries in char.asiChoices with type='feat'.
 *
 * Each instance lets the player pick a spell list (Cleric/Druid/Wizard),
 * 2 cantrips and 1 level-1 spell. We store those picks in
 * char.magicInitiateChoices, keyed by a stable `source` string.
 *
 * Sources keys:
 *   - 'origin'         → the background's origin feat.
 *   - 'asi-<level>'    → the ASI choice taken at character level <level>.
 *                        (Level is unique per slot in asiChoices.)
 */

import type { CharacterData } from '@/stores/character'
import { getFeatById } from '@/data/dnd5e/feats'

/** Stable source identifier for a Magic Initiate instance. */
export type MagicInitiateSource = string

/** Single (declared) Magic Initiate instance that the player must fill in. */
export interface MagicInitiateInstance {
  /** Stable source key (e.g. 'origin', 'asi-4'). */
  source: MagicInitiateSource
  /** Human-readable label for the UI ("From Background" / "From Level 4 feat"). */
  label: string
}

/**
 * Return all Magic Initiate instances active on the character, in deterministic
 * order (origin first, then ASIs by ascending level).
 */
export function getMagicInitiateInstances(char: CharacterData): MagicInitiateInstance[] {
  const out: MagicInitiateInstance[] = []

  // Origin feat from background
  if (char.originFeatId) {
    const feat = getFeatById(char.originFeatId)
    if (feat?.grantsMagicInitiate) {
      out.push({ source: 'origin', label: 'From Background' })
    }
  }

  // ASI feats — each level slot is unique
  const asis = char.asiChoices ?? []
  const sorted = [...asis].sort((a, b) => a.level - b.level)
  for (const asi of sorted) {
    if (asi.type !== 'feat' || !asi.featId) continue
    const feat = getFeatById(asi.featId)
    if (feat?.grantsMagicInitiate) {
      out.push({
        source: `asi-${asi.level}`,
        label: `From Level ${asi.level} feat`,
      })
    }
  }

  return out
}

/**
 * Return the stored choice for a given source, or undefined if the player
 * hasn't picked yet.
 */
export function getMagicInitiateChoice(char: CharacterData, source: MagicInitiateSource) {
  return (char.magicInitiateChoices ?? []).find(c => c.source === source)
}

/**
 * Set (or overwrite) the choice for a given source. If `partial` leaves the
 * choice incomplete (e.g. cantrips.length < 2), we still store it so the
 * player can come back to it.
 */
export function setMagicInitiateChoice(
  char: CharacterData,
  source: MagicInitiateSource,
  choice: { spellList: 'cleric' | 'druid' | 'wizard'; cantrips: string[]; levelOneSpell: string },
): void {
  if (!char.magicInitiateChoices) char.magicInitiateChoices = []
  const idx = char.magicInitiateChoices.findIndex(c => c.source === source)
  const next = { source, ...choice }
  if (idx >= 0) char.magicInitiateChoices[idx] = next
  else char.magicInitiateChoices.push(next)
}

/**
 * Remove the choice for a source (e.g. background changed, ASI feat replaced).
 */
export function removeMagicInitiateChoice(char: CharacterData, source: MagicInitiateSource): void {
  if (!char.magicInitiateChoices) return
  char.magicInitiateChoices = char.magicInitiateChoices.filter(c => c.source !== source)
}

/**
 * Sync magicInitiateChoices with the current set of active sources: drop any
 * stale entry whose source no longer exists. Does NOT add missing entries —
 * those are created by the UI when the player picks.
 *
 * Called e.g. when the player swaps backgrounds or replaces an ASI feat.
 */
export function syncMagicInitiateChoices(char: CharacterData): void {
  if (!char.magicInitiateChoices?.length) return
  const validSources = new Set(getMagicInitiateInstances(char).map(i => i.source))
  char.magicInitiateChoices = char.magicInitiateChoices.filter(c => validSources.has(c.source))
}

/**
 * Is a single instance fully filled in?
 */
export function isMagicInitiateInstanceComplete(
  char: CharacterData,
  source: MagicInitiateSource,
): boolean {
  const c = getMagicInitiateChoice(char, source)
  if (!c) return false
  return c.cantrips.length === 2 && !!c.levelOneSpell
}

/**
 * Any Magic Initiate instance pending? Used by levelUpGating.
 */
export function hasPendingMagicInitiate(char: CharacterData): boolean {
  const instances = getMagicInitiateInstances(char)
  return instances.some(inst => !isMagicInitiateInstanceComplete(char, inst.source))
}

/**
 * Aggregate all cantrip IDs granted by Magic Initiate (across all instances).
 * For PDF / appendix / spellbook display.
 */
export function getMagicInitiateCantripIds(char: CharacterData): string[] {
  const out: string[] = []
  for (const c of char.magicInitiateChoices ?? []) {
    for (const id of c.cantrips) {
      if (id && !out.includes(id)) out.push(id)
    }
  }
  return out
}

/**
 * Aggregate all level-1 spell IDs granted by Magic Initiate.
 */
export function getMagicInitiateLevelOneSpellIds(char: CharacterData): string[] {
  const out: string[] = []
  for (const c of char.magicInitiateChoices ?? []) {
    if (c.levelOneSpell && !out.includes(c.levelOneSpell)) {
      out.push(c.levelOneSpell)
    }
  }
  return out
}
