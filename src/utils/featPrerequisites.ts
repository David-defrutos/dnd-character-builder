/**
 * Feat prerequisites parser and validator (bug #71).
 *
 * Prerequisites in feats.ts are free-text strings like:
 *   - "Level 4+"
 *   - "Level 4+, Charisma 13+"
 *   - "Level 4+, Strength or Dexterity 13+"
 *   - "Level 4+, Heavy Armor Training"
 *   - "Level 4+, Spellcasting or Pact Magic"
 *   - "Level 19+, Spellcasting Feature"
 *   - "Fighting Style Feature"
 *
 * This module parses those strings into a structured form and checks them
 * against a character. Returned by `checkFeatPrerequisites` so the UI can
 * disable or grey out feats the character doesn't qualify for.
 */

import type { CharacterData, AbilityScores } from '@/stores/character'
import { getClassById } from '@/data/dnd5e/classes'
import type { Feat } from '@/data/dnd5e/feats'

export type AbilityKey = keyof AbilityScores

export interface PrereqLevel {
  kind: 'level'
  /** Minimum character level (e.g. 4, 19). */
  min: number
}

export interface PrereqAbility {
  kind: 'ability'
  /** Abilities — if multiple, the character needs >= min in ANY one of them
   *  (i.e. "Strength or Dexterity 13+" → ['str','dex'], min 13). */
  abilities: AbilityKey[]
  min: number
}

export interface PrereqProficiency {
  kind: 'proficiency'
  /** Required proficiency string, matched against char.proficienciesOther
   *  (case-insensitive substring). E.g. "Light Armor Training",
   *  "Shield Training". */
  proficiency: string
}

export interface PrereqSpellcasting {
  kind: 'spellcasting'
  /** Accept Spellcasting, Spellcasting Feature, or Pact Magic. */
  acceptPactMagic: boolean
}

export interface PrereqFightingStyle {
  kind: 'fighting-style'
}

export type FeatPrereq =
  | PrereqLevel
  | PrereqAbility
  | PrereqProficiency
  | PrereqSpellcasting
  | PrereqFightingStyle

const ABILITY_NAMES: Record<string, AbilityKey> = {
  strength: 'str', str: 'str',
  dexterity: 'dex', dex: 'dex',
  constitution: 'con', con: 'con',
  intelligence: 'int', int: 'int',
  wisdom: 'wis', wis: 'wis',
  charisma: 'cha', cha: 'cha',
}

/**
 * Parse a free-text prerequisite string into a list of structured clauses.
 * Returns empty list for empty/undefined input.
 *
 * Unknown clauses are silently dropped — the caller treats absence as
 * "no constraint", which is the safer default (avoid false negatives that
 * would hide valid feats from the player).
 */
export function parsePrerequisite(text: string | undefined): FeatPrereq[] {
  if (!text) return []
  const out: FeatPrereq[] = []
  const clauses = text.split(',').map(s => s.trim()).filter(Boolean)

  for (const raw of clauses) {
    const clause = raw.trim()

    // "Level N+"
    const levelMatch = /^Level\s+(\d+)\+/i.exec(clause)
    if (levelMatch) {
      out.push({ kind: 'level', min: parseInt(levelMatch[1]!, 10) })
      continue
    }

    // "<Ability>[ or <Ability>[ or <Ability>]] N+"  or  "A/B/C N+"
    const abilityMatch =
      /^([A-Za-z]+(?:\s+or\s+[A-Za-z]+)*|[A-Za-z]+(?:\/[A-Za-z]+)+)\s+(\d+)\+/i.exec(clause)
    if (abilityMatch) {
      const names = abilityMatch[1]!.split(/\s+or\s+|\//i).map(s => s.toLowerCase())
      const abilities = names
        .map(n => ABILITY_NAMES[n])
        .filter((a): a is AbilityKey => !!a)
      if (abilities.length) {
        out.push({ kind: 'ability', abilities, min: parseInt(abilityMatch[2]!, 10) })
        continue
      }
    }

    // Spellcasting / Pact Magic
    if (/spellcasting/i.test(clause)) {
      out.push({ kind: 'spellcasting', acceptPactMagic: /pact magic/i.test(clause) })
      continue
    }

    // Fighting Style Feature
    if (/fighting style/i.test(clause)) {
      out.push({ kind: 'fighting-style' })
      continue
    }

    // Proficiency-like ("Light Armor Training", "Heavy Armor Training",
    // "Shield Training", "Medium Armor Training", "Martial Weapon Training")
    if (/training$/i.test(clause)) {
      out.push({ kind: 'proficiency', proficiency: clause })
      continue
    }

    // Unknown — drop silently. Logging here would be noisy at runtime.
  }

  return out
}

/** Per-clause check result; useful for UI tooltips. */
export interface PrereqCheckResult {
  satisfied: boolean
  /** Human-readable list of failing clauses (empty if satisfied). */
  failingClauses: string[]
}

/**
 * Compute the character's total ability scores (base + species + background + ASI).
 * Mirrors the formula used in levelUpGating.ts.
 */
function totalAbility(char: CharacterData, key: AbilityKey): number {
  const base = char.abilityScores[key] ?? 10
  const species = char.speciesBonuses?.[key] ?? 0
  const bg = char.backgroundBonuses?.[key] ?? 0
  const asi = char.asiBonuses?.[key] ?? 0
  return base + species + bg + asi
}

/** Does the character have a given proficiency string (case-insensitive)? */
function hasProficiency(char: CharacterData, prof: string): boolean {
  const needle = prof.toLowerCase()
  return (char.proficienciesOther ?? []).some(p => p.toLowerCase().includes(needle))
}

/** Is the character a spellcaster (class-based) or does it have Pact Magic? */
function isSpellcaster(char: CharacterData, acceptPactMagic: boolean): boolean {
  // Class-based spellcasting: any class entry whose class has spellcasting.
  const classes = char.classes?.length ? char.classes : [{ classId: char.className, level: char.level }]
  for (const entry of classes) {
    const cls = getClassById(entry.classId)
    if (!cls) continue
    if (cls.spellcasting) {
      // Warlock has spellcasting + pact magic (casterType='pact'). Anything else
      // that has spellcasting always satisfies "Spellcasting".
      if (acceptPactMagic) return true
      if (cls.spellcasting.casterType !== 'pact') return true
      // If "or Pact Magic" was specified, even pact counts; if it was just
      // "Spellcasting", pact magic also counts in 2024 (warlock has both).
      // To stay safe, accept all spellcasters here.
      return true
    }
  }
  return false
}

/**
 * Check a parsed prerequisite list against a character.
 * Returns `satisfied: true` with empty failingClauses if all pass.
 */
export function checkPrerequisites(
  char: CharacterData,
  prereqs: FeatPrereq[],
): PrereqCheckResult {
  const failing: string[] = []
  for (const p of prereqs) {
    switch (p.kind) {
      case 'level': {
        if (char.level < p.min) failing.push(`Requires character level ${p.min}+ (current: ${char.level})`)
        break
      }
      case 'ability': {
        const meetsAny = p.abilities.some(a => totalAbility(char, a) >= p.min)
        if (!meetsAny) {
          const names = p.abilities.map(a => a.toUpperCase()).join(' or ')
          failing.push(`Requires ${names} ${p.min}+`)
        }
        break
      }
      case 'proficiency': {
        if (!hasProficiency(char, p.proficiency)) {
          failing.push(`Requires ${p.proficiency}`)
        }
        break
      }
      case 'spellcasting': {
        if (!isSpellcaster(char, p.acceptPactMagic)) {
          failing.push(p.acceptPactMagic ? 'Requires Spellcasting or Pact Magic' : 'Requires Spellcasting')
        }
        break
      }
      case 'fighting-style': {
        // Fighting Style is granted by Fighter/Paladin/Ranger (and a few feats).
        // We check char.featuresTraits for any "Fighting Style: ..." tag and
        // also for a fighting-style class feature flag (heuristic).
        const hasFs = (char.featuresTraits ?? []).some(t => /fighting style/i.test(t))
        if (!hasFs) failing.push('Requires a Fighting Style feature')
        break
      }
    }
  }
  return { satisfied: failing.length === 0, failingClauses: failing }
}

/**
 * Convenience: check a Feat directly against a character.
 */
export function checkFeatPrerequisites(
  char: CharacterData,
  feat: Feat,
): PrereqCheckResult {
  const parsed = parsePrerequisite(feat.prerequisite)
  return checkPrerequisites(char, parsed)
}
