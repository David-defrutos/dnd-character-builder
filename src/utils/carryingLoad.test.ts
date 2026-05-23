// Documento generado el 2026-05-23-0914
import { describe, expect, it } from 'vitest'
import type { CharacterData } from '@/stores/character'
import { computeCurrentLoad, lbsToKg } from './carryingLoad'

function baseChar(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    id: 'test',
    variant: 'dnd5e',
    name: 'Test',
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
    speciesChoices: {},
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
    currentHp: 0,
    tempHp: 0,
    maxHp: 0,
    hitDie: 8,
    speed: 30,
    classes: [],
    sessionNotes: '',
    inventory: [],
    weaponMasteries: [],
    asiChoices: [],
    levelHistory: [],
    ...overrides,
  }
}

describe('carryingLoad', () => {
  it('sums weapon, armor, magic and custom item weights times quantity', () => {
    const char = baseChar({
      inventory: [
        { slotId: 'w1', kind: 'weapon', itemId: 'Dagger', name: 'Dagger', qty: 2 },
        { slotId: 'a1', kind: 'armor', itemId: 'Shield', name: 'Shield', qty: 1 },
        { slotId: 'm1', kind: 'magic', itemId: 'bag-of-holding', name: 'Bag of Holding', qty: 1 },
        { slotId: 'c1', kind: 'custom', itemId: '', name: 'Rations', qty: 3, weight: 2 },
      ],
    })

    const load = computeCurrentLoad(char)

    expect(load.total).toBe(29)
    expect(load.totalKg).toBe(13)
    expect(load.capacity).toBe(150)
    expect(load.capacityUsedPct).toBe(19)
    expect(load.status).toBe('Unencumbered')
  })

  it('treats missing custom weight as zero', () => {
    const load = computeCurrentLoad(baseChar({
      inventory: [{ slotId: 'c1', kind: 'custom', itemId: '', name: 'Unknown', qty: 99 }],
    }))

    expect(load.total).toBe(0)
    expect(load.breakdown).toHaveLength(0)
  })

  it('uses variant encumbrance thresholds', () => {
    const encumbered = computeCurrentLoad(baseChar({
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      inventory: [{ slotId: 'c1', kind: 'custom', itemId: '', name: 'Load', qty: 1, weight: 60 }],
    }))
    const heavily = computeCurrentLoad(baseChar({
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      inventory: [{ slotId: 'c1', kind: 'custom', itemId: '', name: 'Load', qty: 1, weight: 110 }],
    }))

    expect(encumbered.status).toBe('Encumbered')
    expect(heavily.status).toBe('Heavily Encumbered')
  })

  it('rounds pounds to kilograms', () => {
    expect(lbsToKg(17)).toBe(8)
  })
})
