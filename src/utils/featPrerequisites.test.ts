// Tests para src/utils/featPrerequisites.ts — bug #71.
//
// Cubre el parser de strings de prereq y el checker contra un personaje.
// Casos: Level N+, ability (single/multiple OR), proficiency, spellcasting,
// fighting style.

import { describe, it, expect } from 'vitest'
import {
  parsePrerequisite,
  checkPrerequisites,
  checkFeatPrerequisites,
} from './featPrerequisites'
import type { CharacterData } from '@/stores/character'
import type { Feat } from '@/data/dnd5e/feats'

function makeChar(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    id: 'test',
    variant: 'dnd5e',
    name: '',
    playerName: '',
    race: '',
    subrace: '',
    className: '',
    subclass: '',
    level: 1,
    background: '',
    alignment: '',
    experiencePoints: 0,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    speciesBonuses: {},
    backgroundBonuses: {},
    asiBonuses: {},
    skillProficiencies: [],
    skillExpertise: [],
    savingThrowProficiencies: [],
    languages: [],
    proficienciesOther: [],
    weapons: [],
    armor: '',
    shield: false,
    equipment: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    personalityTraits: '',
    ideals: '',
    bonds: '',
    flaws: '',
    featuresTraits: [],
    backstory: '',
    age: '',
    height: '',
    weight: '',
    eyes: '',
    hair: '',
    skin: '',
    allies: '',
    treasure: '',
    spellcastingClass: '',
    spellcastingAbility: '',
    cantrips: [],
    spellsKnown: [],
    spellsPrepared: [],
    hitDie: 8,
    maxHp: 0,
    currentHp: 0,
    tempHp: 0,
    speed: 30,
    sessionNotes: '',
    classes: [],
    asiChoices: [],
    ...overrides,
  }
}

describe('parsePrerequisite', () => {
  it('returns [] for empty/undefined', () => {
    expect(parsePrerequisite(undefined)).toEqual([])
    expect(parsePrerequisite('')).toEqual([])
  })

  it('parses "Level 4+"', () => {
    const r = parsePrerequisite('Level 4+')
    expect(r).toEqual([{ kind: 'level', min: 4 }])
  })

  it('parses "Level 19+"', () => {
    const r = parsePrerequisite('Level 19+')
    expect(r).toEqual([{ kind: 'level', min: 19 }])
  })

  it('parses ability "Charisma 13+"', () => {
    const r = parsePrerequisite('Charisma 13+')
    expect(r).toEqual([{ kind: 'ability', abilities: ['cha'], min: 13 }])
  })

  it('parses OR ability "Strength or Dexterity 13+"', () => {
    const r = parsePrerequisite('Strength or Dexterity 13+')
    expect(r).toEqual([{ kind: 'ability', abilities: ['str', 'dex'], min: 13 }])
  })

  it('parses slash-separated abilities', () => {
    const r = parsePrerequisite('Intelligence/Wisdom/Charisma 13+')
    expect(r).toEqual([{ kind: 'ability', abilities: ['int', 'wis', 'cha'], min: 13 }])
  })

  it('parses "Heavy Armor Training" as proficiency', () => {
    const r = parsePrerequisite('Heavy Armor Training')
    expect(r).toEqual([{ kind: 'proficiency', proficiency: 'Heavy Armor Training' }])
  })

  it('parses "Spellcasting or Pact Magic"', () => {
    const r = parsePrerequisite('Spellcasting or Pact Magic')
    expect(r).toEqual([{ kind: 'spellcasting', acceptPactMagic: true }])
  })

  it('parses "Spellcasting Feature"', () => {
    const r = parsePrerequisite('Spellcasting Feature')
    expect(r).toEqual([{ kind: 'spellcasting', acceptPactMagic: false }])
  })

  it('parses "Fighting Style Feature"', () => {
    const r = parsePrerequisite('Fighting Style Feature')
    expect(r).toEqual([{ kind: 'fighting-style' }])
  })

  it('parses compound "Level 4+, Strength 13+"', () => {
    const r = parsePrerequisite('Level 4+, Strength 13+')
    expect(r).toHaveLength(2)
    expect(r[0]).toEqual({ kind: 'level', min: 4 })
    expect(r[1]).toEqual({ kind: 'ability', abilities: ['str'], min: 13 })
  })

  it('parses compound "Level 4+, Heavy Armor Training"', () => {
    const r = parsePrerequisite('Level 4+, Heavy Armor Training')
    expect(r).toHaveLength(2)
    expect(r[0]).toEqual({ kind: 'level', min: 4 })
    expect(r[1]).toEqual({ kind: 'proficiency', proficiency: 'Heavy Armor Training' })
  })

  it('drops unknown clauses silently (safer default)', () => {
    const r = parsePrerequisite('Level 4+, Some weird unparseable thing')
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ kind: 'level', min: 4 })
  })
})

describe('checkPrerequisites — level', () => {
  it('passes when char.level >= min', () => {
    const char = makeChar({ level: 5 })
    const r = checkPrerequisites(char, [{ kind: 'level', min: 4 }])
    expect(r.satisfied).toBe(true)
  })

  it('fails when char.level < min', () => {
    const char = makeChar({ level: 3 })
    const r = checkPrerequisites(char, [{ kind: 'level', min: 4 }])
    expect(r.satisfied).toBe(false)
    expect(r.failingClauses[0]).toContain('level 4+')
  })
})

describe('checkPrerequisites — ability', () => {
  it('passes single ability', () => {
    const char = makeChar({ abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 14 } })
    const r = checkPrerequisites(char, [{ kind: 'ability', abilities: ['cha'], min: 13 }])
    expect(r.satisfied).toBe(true)
  })

  it('fails single ability below threshold', () => {
    const char = makeChar({ abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 12 } })
    const r = checkPrerequisites(char, [{ kind: 'ability', abilities: ['cha'], min: 13 }])
    expect(r.satisfied).toBe(false)
    expect(r.failingClauses[0]).toContain('CHA')
  })

  it('passes OR if any ability qualifies', () => {
    const char = makeChar({ abilityScores: { str: 8, dex: 15, con: 10, int: 10, wis: 10, cha: 10 } })
    const r = checkPrerequisites(char, [{ kind: 'ability', abilities: ['str', 'dex'], min: 13 }])
    expect(r.satisfied).toBe(true)
  })

  it('fails OR if no ability qualifies', () => {
    const char = makeChar({ abilityScores: { str: 8, dex: 12, con: 10, int: 10, wis: 10, cha: 10 } })
    const r = checkPrerequisites(char, [{ kind: 'ability', abilities: ['str', 'dex'], min: 13 }])
    expect(r.satisfied).toBe(false)
  })

  it('counts speciesBonuses, backgroundBonuses and asiBonuses', () => {
    const char = makeChar({
      abilityScores: { str: 8, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      asiBonuses: { str: 5 }, // 8 + 5 = 13
    })
    const r = checkPrerequisites(char, [{ kind: 'ability', abilities: ['str'], min: 13 }])
    expect(r.satisfied).toBe(true)
  })
})

describe('checkPrerequisites — proficiency', () => {
  it('passes when proficiency is in proficienciesOther', () => {
    const char = makeChar({ proficienciesOther: ['Heavy armor', 'Shields'] })
    const r = checkPrerequisites(char, [{ kind: 'proficiency', proficiency: 'Heavy Armor' }])
    expect(r.satisfied).toBe(true)
  })

  it('matches case-insensitive substring', () => {
    const char = makeChar({ proficienciesOther: ['Light Armor Training'] })
    const r = checkPrerequisites(char, [{ kind: 'proficiency', proficiency: 'Light Armor Training' }])
    expect(r.satisfied).toBe(true)
  })

  it('fails when proficiency is missing', () => {
    const char = makeChar({ proficienciesOther: ['Light armor'] })
    const r = checkPrerequisites(char, [{ kind: 'proficiency', proficiency: 'Heavy Armor Training' }])
    expect(r.satisfied).toBe(false)
  })
})

describe('checkPrerequisites — spellcasting', () => {
  it('passes when char has a spellcasting class', () => {
    const char = makeChar({ className: 'wizard', level: 4 })
    const r = checkPrerequisites(char, [{ kind: 'spellcasting', acceptPactMagic: false }])
    expect(r.satisfied).toBe(true)
  })

  it('fails when char is not a spellcaster', () => {
    const char = makeChar({ className: 'fighter', level: 4 })
    const r = checkPrerequisites(char, [{ kind: 'spellcasting', acceptPactMagic: false }])
    expect(r.satisfied).toBe(false)
  })

  it('passes warlock with acceptPactMagic=true', () => {
    const char = makeChar({ className: 'warlock', level: 4 })
    const r = checkPrerequisites(char, [{ kind: 'spellcasting', acceptPactMagic: true }])
    expect(r.satisfied).toBe(true)
  })
})

describe('checkPrerequisites — fighting style', () => {
  it('passes when featuresTraits has any "Fighting Style:" tag', () => {
    const char = makeChar({ featuresTraits: ['Fighting Style: Defense'] })
    const r = checkPrerequisites(char, [{ kind: 'fighting-style' }])
    expect(r.satisfied).toBe(true)
  })

  it('fails when no Fighting Style tag is present', () => {
    const char = makeChar({ featuresTraits: ['Second Wind'] })
    const r = checkPrerequisites(char, [{ kind: 'fighting-style' }])
    expect(r.satisfied).toBe(false)
  })
})

describe('checkFeatPrerequisites — end-to-end', () => {
  it('Actor (Level 4+, Charisma 13+) — fail when CHA 12', () => {
    const actor: Feat = {
      id: 'actor', name: 'Actor', category: 'general',
      prerequisite: 'Level 4+, Charisma 13+',
      description: '',
    }
    const char = makeChar({
      level: 4,
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 12 },
    })
    const r = checkFeatPrerequisites(char, actor)
    expect(r.satisfied).toBe(false)
    expect(r.failingClauses).toHaveLength(1) // only CHA fails, level is OK
  })

  it('Actor — pass when level 4 and CHA 14', () => {
    const actor: Feat = {
      id: 'actor', name: 'Actor', category: 'general',
      prerequisite: 'Level 4+, Charisma 13+',
      description: '',
    }
    const char = makeChar({
      level: 4,
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 14 },
    })
    expect(checkFeatPrerequisites(char, actor).satisfied).toBe(true)
  })

  it('Epic Boon (Level 19+) — fail at level 18', () => {
    const boon: Feat = {
      id: 'boon-of-fate', name: 'Boon of Fate', category: 'epic-boon',
      prerequisite: 'Level 19+',
      description: '',
    }
    const char = makeChar({ level: 18 })
    expect(checkFeatPrerequisites(char, boon).satisfied).toBe(false)
  })

  it('feat with no prerequisite is always eligible', () => {
    const lucky: Feat = {
      id: 'lucky', name: 'Lucky', category: 'origin',
      description: '',
    }
    const char = makeChar()
    expect(checkFeatPrerequisites(char, lucky).satisfied).toBe(true)
  })
})
