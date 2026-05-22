// Tests para src/utils/magicInitiate.ts — bug #74.
//
// Cubre: detección de instancias (origin + ASI), guardar/leer/borrar elecciones,
// sync al cambiar de feat, gating (instancia completa o incompleta),
// agregación de cantrips/spells para PDF/appendix.

import { describe, it, expect } from 'vitest'
import {
  getMagicInitiateInstances,
  getMagicInitiateChoice,
  setMagicInitiateChoice,
  removeMagicInitiateChoice,
  syncMagicInitiateChoices,
  isMagicInitiateInstanceComplete,
  hasPendingMagicInitiate,
  getMagicInitiateCantripIds,
  getMagicInitiateLevelOneSpellIds,
} from './magicInitiate'
import type { CharacterData } from '@/stores/character'

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

describe('magicInitiate — instance detection', () => {
  it('returns empty list if no origin feat and no ASI feats', () => {
    const char = makeChar()
    expect(getMagicInitiateInstances(char)).toEqual([])
  })

  it('detects Magic Initiate as origin feat', () => {
    const char = makeChar({ originFeatId: 'magic-initiate' })
    const inst = getMagicInitiateInstances(char)
    expect(inst).toHaveLength(1)
    expect(inst[0]!.source).toBe('origin')
    expect(inst[0]!.label).toContain('Background')
  })

  it('does NOT detect a non-Magic-Initiate origin feat', () => {
    const char = makeChar({ originFeatId: 'lucky' })
    expect(getMagicInitiateInstances(char)).toEqual([])
  })

  it('detects Magic Initiate from an ASI feat slot', () => {
    const char = makeChar({
      asiChoices: [{ level: 4, type: 'feat', featId: 'magic-initiate' }],
    })
    const inst = getMagicInitiateInstances(char)
    expect(inst).toHaveLength(1)
    expect(inst[0]!.source).toBe('asi-4')
    expect(inst[0]!.label).toContain('Level 4')
  })

  it('detects multiple Magic Initiate instances (origin + ASI, repeatable)', () => {
    const char = makeChar({
      originFeatId: 'magic-initiate',
      asiChoices: [
        { level: 4, type: 'feat', featId: 'magic-initiate' },
        { level: 8, type: 'feat', featId: 'tough' },
        { level: 12, type: 'feat', featId: 'magic-initiate' },
      ],
    })
    const inst = getMagicInitiateInstances(char)
    expect(inst).toHaveLength(3)
    expect(inst.map(i => i.source)).toEqual(['origin', 'asi-4', 'asi-12'])
  })

  it('orders ASI instances by ascending level', () => {
    const char = makeChar({
      asiChoices: [
        { level: 12, type: 'feat', featId: 'magic-initiate' },
        { level: 4, type: 'feat', featId: 'magic-initiate' },
        { level: 8, type: 'feat', featId: 'magic-initiate' },
      ],
    })
    const inst = getMagicInitiateInstances(char)
    expect(inst.map(i => i.source)).toEqual(['asi-4', 'asi-8', 'asi-12'])
  })
})

describe('magicInitiate — choices storage', () => {
  it('returns undefined for unset source', () => {
    const char = makeChar({ originFeatId: 'magic-initiate' })
    expect(getMagicInitiateChoice(char, 'origin')).toBeUndefined()
  })

  it('stores a choice', () => {
    const char = makeChar({ originFeatId: 'magic-initiate' })
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard',
      cantrips: ['fire-bolt', 'mage-hand'],
      levelOneSpell: '1-magic-missile',
    })
    const c = getMagicInitiateChoice(char, 'origin')
    expect(c?.spellList).toBe('wizard')
    expect(c?.cantrips).toEqual(['fire-bolt', 'mage-hand'])
    expect(c?.levelOneSpell).toBe('1-magic-missile')
  })

  it('overwrites an existing choice for the same source', () => {
    const char = makeChar({ originFeatId: 'magic-initiate' })
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard',
      cantrips: ['fire-bolt'],
      levelOneSpell: '',
    })
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'cleric',
      cantrips: ['guidance', 'sacred-flame'],
      levelOneSpell: '1-cure-wounds',
    })
    const c = getMagicInitiateChoice(char, 'origin')
    expect(c?.spellList).toBe('cleric')
    expect(c?.cantrips).toHaveLength(2)
    expect(char.magicInitiateChoices).toHaveLength(1)
  })

  it('keeps multiple sources independent', () => {
    const char = makeChar()
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield',
    })
    setMagicInitiateChoice(char, 'asi-4', {
      spellList: 'druid', cantrips: ['druidcraft', 'produce-flame'], levelOneSpell: '1-cure-wounds',
    })
    expect(getMagicInitiateChoice(char, 'origin')?.spellList).toBe('wizard')
    expect(getMagicInitiateChoice(char, 'asi-4')?.spellList).toBe('druid')
  })

  it('removes a choice by source', () => {
    const char = makeChar()
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield',
    })
    removeMagicInitiateChoice(char, 'origin')
    expect(getMagicInitiateChoice(char, 'origin')).toBeUndefined()
  })
})

describe('magicInitiate — sync', () => {
  it('drops stale origin choice when origin feat is gone', () => {
    const char = makeChar({
      originFeatId: undefined,
      magicInitiateChoices: [
        { source: 'origin', spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield' },
      ],
    })
    syncMagicInitiateChoices(char)
    expect(char.magicInitiateChoices).toEqual([])
  })

  it('drops stale ASI choice when feat was replaced', () => {
    const char = makeChar({
      asiChoices: [{ level: 4, type: 'feat', featId: 'tough' }],
      magicInitiateChoices: [
        { source: 'asi-4', spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield' },
      ],
    })
    syncMagicInitiateChoices(char)
    expect(char.magicInitiateChoices).toEqual([])
  })

  it('keeps valid choices intact', () => {
    const char = makeChar({
      originFeatId: 'magic-initiate',
      magicInitiateChoices: [
        { source: 'origin', spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield' },
      ],
    })
    syncMagicInitiateChoices(char)
    expect(char.magicInitiateChoices).toHaveLength(1)
  })

  it('is idempotent (multiple syncs do not break anything)', () => {
    const char = makeChar({
      originFeatId: 'magic-initiate',
      magicInitiateChoices: [
        { source: 'origin', spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield' },
      ],
    })
    syncMagicInitiateChoices(char)
    syncMagicInitiateChoices(char)
    expect(char.magicInitiateChoices).toHaveLength(1)
  })
})

describe('magicInitiate — completion', () => {
  it('an instance is incomplete with no stored choice', () => {
    const char = makeChar({ originFeatId: 'magic-initiate' })
    expect(isMagicInitiateInstanceComplete(char, 'origin')).toBe(false)
  })

  it('an instance is incomplete with < 2 cantrips', () => {
    const char = makeChar({ originFeatId: 'magic-initiate' })
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard',
      cantrips: ['fire-bolt'],
      levelOneSpell: '1-shield',
    })
    expect(isMagicInitiateInstanceComplete(char, 'origin')).toBe(false)
  })

  it('an instance is incomplete with no level-1 spell', () => {
    const char = makeChar({ originFeatId: 'magic-initiate' })
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard',
      cantrips: ['fire-bolt', 'mage-hand'],
      levelOneSpell: '',
    })
    expect(isMagicInitiateInstanceComplete(char, 'origin')).toBe(false)
  })

  it('an instance is complete with 2 cantrips + 1 level-1 spell', () => {
    const char = makeChar({ originFeatId: 'magic-initiate' })
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard',
      cantrips: ['fire-bolt', 'mage-hand'],
      levelOneSpell: '1-magic-missile',
    })
    expect(isMagicInitiateInstanceComplete(char, 'origin')).toBe(true)
  })

  it('hasPendingMagicInitiate is true when any instance is missing', () => {
    const char = makeChar({
      originFeatId: 'magic-initiate',
      asiChoices: [{ level: 4, type: 'feat', featId: 'magic-initiate' }],
    })
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield',
    })
    expect(hasPendingMagicInitiate(char)).toBe(true)
  })

  it('hasPendingMagicInitiate is false when all instances are filled', () => {
    const char = makeChar({
      originFeatId: 'magic-initiate',
      asiChoices: [{ level: 4, type: 'feat', featId: 'magic-initiate' }],
    })
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield',
    })
    setMagicInitiateChoice(char, 'asi-4', {
      spellList: 'druid', cantrips: ['druidcraft', 'produce-flame'], levelOneSpell: '1-cure-wounds',
    })
    expect(hasPendingMagicInitiate(char)).toBe(false)
  })

  it('hasPendingMagicInitiate is false when no instances exist', () => {
    const char = makeChar()
    expect(hasPendingMagicInitiate(char)).toBe(false)
  })
})

describe('magicInitiate — aggregation', () => {
  it('aggregates cantrips across instances without duplicates', () => {
    const char = makeChar()
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield',
    })
    setMagicInitiateChoice(char, 'asi-4', {
      spellList: 'cleric', cantrips: ['guidance', 'sacred-flame'], levelOneSpell: '1-cure-wounds',
    })
    expect(getMagicInitiateCantripIds(char)).toEqual([
      'fire-bolt', 'mage-hand', 'guidance', 'sacred-flame',
    ])
  })

  it('deduplicates if the same cantrip appears in two instances', () => {
    const char = makeChar()
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield',
    })
    setMagicInitiateChoice(char, 'asi-4', {
      spellList: 'wizard', cantrips: ['fire-bolt', 'minor-illusion'], levelOneSpell: '1-magic-missile',
    })
    expect(getMagicInitiateCantripIds(char)).toEqual([
      'fire-bolt', 'mage-hand', 'minor-illusion',
    ])
  })

  it('aggregates level-1 spells across instances', () => {
    const char = makeChar()
    setMagicInitiateChoice(char, 'origin', {
      spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield',
    })
    setMagicInitiateChoice(char, 'asi-4', {
      spellList: 'cleric', cantrips: ['guidance', 'sacred-flame'], levelOneSpell: '1-cure-wounds',
    })
    expect(getMagicInitiateLevelOneSpellIds(char)).toEqual([
      '1-shield', '1-cure-wounds',
    ])
  })

  it('returns empty arrays when no instances are filled', () => {
    const char = makeChar()
    expect(getMagicInitiateCantripIds(char)).toEqual([])
    expect(getMagicInitiateLevelOneSpellIds(char)).toEqual([])
  })
})
