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

  // #123 — stored items NO cuentan; desglose por bloque
  it('#123 — items con stored:true no cuentan en total ni status', () => {
    const load = computeCurrentLoad(baseChar({
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      inventory: [
        { slotId: 'a', kind: 'custom', itemId: '', name: 'Carried', qty: 1, weight: 30 },
        { slotId: 'b', kind: 'custom', itemId: '', name: 'In Bag', qty: 1, weight: 80, stored: true },
      ],
    }))
    expect(load.total).toBe(30)
    expect(load.storedLbs).toBe(80)
    expect(load.carriedLbs).toBe(30)
    expect(load.equippedLbs).toBe(0)
    expect(load.status).toBe('Unencumbered')
  })

  it('#123 — desglose por bloques (equipped + carried + stored)', () => {
    const load = computeCurrentLoad(baseChar({
      inventory: [
        { slotId: 'a', kind: 'custom', itemId: '', name: 'Armor', qty: 1, weight: 20, equipped: true },
        { slotId: 'b', kind: 'custom', itemId: '', name: 'Sword', qty: 1, weight: 6, equipped: true },
        { slotId: 'c', kind: 'custom', itemId: '', name: 'Rations', qty: 5, weight: 2 },
        { slotId: 'd', kind: 'custom', itemId: '', name: 'Bedroll', qty: 1, weight: 7, stored: true },
      ],
    }))
    expect(load.equippedLbs).toBe(26)
    expect(load.carriedLbs).toBe(10)
    expect(load.storedLbs).toBe(7)
    expect(load.total).toBe(36)  // 26 + 10
  })

  it('#123 — Salusa con todo en BoH baja de Encumbered a Unencumbered', () => {
    // STR 8 → cap 120; encumbered > 40.
    // Sin stored: 13 + 4 + 15 + 1 + 1 + 1 + 7 + 10 + 1 = 53 → Encumbered.
    // Con bedroll, rope, healing potions y violín dentro de BoH: queda 13+4+15+1+1 = 34 → Unencumbered.
    const inventory: CharacterData['inventory'] = [
      { slotId: 'armor', kind: 'custom', itemId: '', name: 'Studded Leather', qty: 1, weight: 13, equipped: true },
      { slotId: 'dagger', kind: 'custom', itemId: '', name: 'Dagger x4', qty: 4, weight: 1 },
      { slotId: 'boh', kind: 'custom', itemId: '', name: 'Bag of Holding', qty: 1, weight: 15 },
      { slotId: 'cloak', kind: 'custom', itemId: '', name: 'Cloak of Protection', qty: 1, weight: 1, equipped: true },
      { slotId: 'tools', kind: 'custom', itemId: '', name: "Thieves' Tools", qty: 1, weight: 1 },
      { slotId: 'violin', kind: 'custom', itemId: '', name: 'Violin', qty: 1, weight: 1, stored: true },
      { slotId: 'bedroll', kind: 'custom', itemId: '', name: 'Bedroll', qty: 1, weight: 7, stored: true },
      { slotId: 'rope', kind: 'custom', itemId: '', name: 'Rope', qty: 1, weight: 10, stored: true },
      { slotId: 'potion', kind: 'custom', itemId: '', name: 'Healing Potion', qty: 2, weight: 0.5, stored: true },
    ]
    const load = computeCurrentLoad(baseChar({
      abilityScores: { str: 8, dex: 13, con: 10, int: 15, wis: 12, cha: 15 },
      inventory,
    }))
    // 13 (armor eq) + 1 (cloak eq) + 4 (4 daggers) + 15 (BoH) + 1 (tools) = 34
    expect(load.total).toBe(34)
    expect(load.storedLbs).toBe(1 + 7 + 10 + 1)  // 19 lbs en la bolsa
    expect(load.status).toBe('Unencumbered')
  })

  // #127 — kind 'gear' resuelve weight desde adventuringGear por id
  it('#127 — items kind:gear resuelven weight desde el catálogo por id', () => {
    const load = computeCurrentLoad(baseChar({
      inventory: [
        // Bedroll (7 lb) + Rope Hempen (10 lb) + Viol (1 lb) + Thieves' Tools (1 lb)
        { slotId: 'a', kind: 'gear', itemId: 'bedroll', name: 'Bedroll', qty: 1 },
        { slotId: 'b', kind: 'gear', itemId: 'rope', name: 'Rope, Hempen (50 ft)', qty: 1 },
        { slotId: 'c', kind: 'gear', itemId: 'viol', name: 'Viol', qty: 1 },
        { slotId: 'd', kind: 'gear', itemId: 'thieves-tools', name: "Thieves' Tools", qty: 1 },
      ],
    }))
    expect(load.total).toBe(7 + 10 + 1 + 1)  // 19 lb
  })

  it('#127 — gear con itemId desconocido devuelve weight 0 (no rompe)', () => {
    const load = computeCurrentLoad(baseChar({
      inventory: [
        { slotId: 'a', kind: 'gear', itemId: 'item-que-no-existe', name: 'Unknown', qty: 1 },
      ],
    }))
    expect(load.total).toBe(0)
  })
})
