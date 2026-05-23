// #118 — Tests del cálculo de AC con desglose
import { describe, it, expect, beforeAll } from 'vitest'
import {
  computeAcBreakdown,
  categorizeForEquip,
  slotsToUnequip,
} from './armorClassBreakdown'
import type { CharacterData, InventoryItem } from '@/stores/character'
import { preloadVariantData, getEquipment } from '@/data'

beforeAll(async () => {
  await preloadVariantData('dnd5e')
})

function baseChar(): CharacterData {
  return {
    id: 'test-id',
    variant: 'dnd5e',
    name: 'Test',
    playerName: '',
    race: 'human',
    subrace: '',
    className: 'bard',
    subclass: '',
    level: 10,
    background: '',
    alignment: '',
    experiencePoints: 0,
    abilityScores: { str: 8, dex: 14, con: 10, int: 15, wis: 12, cha: 19 },
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
    personalityTraits: '', ideals: '', bonds: '', flaws: '',
    featuresTraits: [],
    backstory: '', age: '', height: '', weight: '',
    eyes: '', hair: '', skin: '', allies: '', treasure: '',
    spellcastingClass: '', spellcastingAbility: '',
    cantrips: [], spellsKnown: [], spellsPrepared: [],
    hitDie: 8, maxHp: 53, currentHp: 53, tempHp: 0, speed: 30,
    sessionNotes: '',
    classes: [],
    inventory: [],
  } as unknown as CharacterData
}

function item(partial: Partial<InventoryItem>): InventoryItem {
  return {
    slotId: partial.slotId ?? `slot-${Math.random()}`,
    kind: partial.kind ?? 'armor',
    itemId: partial.itemId ?? '',
    name: partial.name ?? '',
    qty: partial.qty ?? 1,
    equipped: partial.equipped,
    attuned: partial.attuned,
    customAcBonus: partial.customAcBonus,
  }
}

describe('computeAcBreakdown', () => {
  const armorCat = () => getEquipment('dnd5e').armor

  it('devuelve null si no hay items equipped (fallback al sistema legacy)', () => {
    const char = baseChar()
    char.inventory = [item({ kind: 'armor', name: 'Studded Leather Armor', equipped: false })]
    expect(computeAcBreakdown(char, 2, armorCat())).toBeNull()
  })

  it('Studded Leather equipped sola: 12 + DEX', () => {
    const char = baseChar()
    char.inventory = [item({ kind: 'armor', name: 'Studded Leather Armor', equipped: true })]
    const r = computeAcBreakdown(char, 2, armorCat())
    expect(r).not.toBeNull()
    expect(r!.total).toBe(14)  // 12 + 2
    expect(r!.sources.length).toBe(2)
    expect(r!.sources[0]!.label).toContain('Studded Leather')
    expect(r!.sources[1]!.label).toContain('DEX')
  })

  it('Studded Leather + Cloak of Protection attuned y equipped: 12 + DEX + 1', () => {
    const char = baseChar()
    char.inventory = [
      item({ kind: 'armor', name: 'Studded Leather Armor', equipped: true }),
      item({ kind: 'magic', name: 'Cloak of Protection', equipped: true, attuned: true }),
    ]
    const r = computeAcBreakdown(char, 2, armorCat())
    expect(r!.total).toBe(15)  // 12 + 2 + 1
    expect(r!.sources.some(s => s.label.includes('Cloak of Protection'))).toBe(true)
  })

  it('Cloak of Protection equipped pero NO attuned: no aporta AC', () => {
    const char = baseChar()
    char.inventory = [
      item({ kind: 'armor', name: 'Studded Leather Armor', equipped: true }),
      item({ kind: 'magic', name: 'Cloak of Protection', equipped: true, attuned: false }),
    ]
    const r = computeAcBreakdown(char, 2, armorCat())
    expect(r!.total).toBe(14)  // sin el +1 del cloak
  })

  it('Studded Leather +1 magic: parsea +1 y suma al base', () => {
    const char = baseChar()
    char.inventory = [item({ kind: 'armor', name: 'Studded Leather Armor +1', equipped: true })]
    const r = computeAcBreakdown(char, 2, armorCat())
    expect(r!.total).toBe(15)  // 12 + 1 (magic) + 2 (DEX)
  })

  it('Shield equipado: +2 AC', () => {
    const char = baseChar()
    char.inventory = [
      item({ kind: 'armor', name: 'Studded Leather Armor', equipped: true }),
      item({ kind: 'armor', name: 'Shield', equipped: true }),
    ]
    const r = computeAcBreakdown(char, 2, armorCat())
    expect(r!.total).toBe(16)  // 12 + 2 (DEX) + 2 (shield)
  })

  it('Bracers of Defense sin armor: +2 AC sobre unarmored', () => {
    const char = baseChar()
    char.inventory = [
      item({ kind: 'magic', name: 'Bracers of Defense', equipped: true, attuned: true }),
    ]
    const r = computeAcBreakdown(char, 2, armorCat())
    expect(r!.total).toBe(14)  // 10 (unarmored) + 2 (DEX) + 2 (bracers)
  })

  it('Bracers of Defense + armor: bracers no aportan', () => {
    const char = baseChar()
    char.inventory = [
      item({ kind: 'armor', name: 'Studded Leather Armor', equipped: true }),
      item({ kind: 'magic', name: 'Bracers of Defense', equipped: true, attuned: true }),
    ]
    const r = computeAcBreakdown(char, 2, armorCat())
    expect(r!.total).toBe(14)  // 12 + 2, bracers se ignoran
  })

  it('customAcBonus en item homebrew se aplica si está equipped', () => {
    const char = baseChar()
    char.inventory = [
      item({ kind: 'custom', name: 'Goggles of Doom', equipped: true, customAcBonus: 2 }),
    ]
    const r = computeAcBreakdown(char, 2, armorCat())
    expect(r!.total).toBe(14)  // 10 + 2 (DEX) + 2 (custom)
  })

  it('Defense Fighting Style suma +1 si armor equipped', () => {
    const char = baseChar()
    char.featDefenseACBonus = true
    char.inventory = [item({ kind: 'armor', name: 'Studded Leather Armor', equipped: true })]
    const r = computeAcBreakdown(char, 2, armorCat())
    expect(r!.total).toBe(15)  // 12 + 2 + 1 defense
  })
})

describe('categorizeForEquip', () => {
  it('identifica armor correctamente', () => {
    expect(categorizeForEquip(item({ kind: 'armor', name: 'Studded Leather Armor' }))).toBe('armor')
  })
  it('identifica shield correctamente', () => {
    expect(categorizeForEquip(item({ kind: 'armor', name: 'Shield' }))).toBe('shield')
  })
  it('identifica cloak correctamente', () => {
    expect(categorizeForEquip(item({ kind: 'magic', name: 'Cloak of Protection' }))).toBe('cloak')
  })
  it('identifica ring correctamente', () => {
    expect(categorizeForEquip(item({ kind: 'magic', name: 'Ring of Swimming' }))).toBe('ring')
  })
  it('otros caen en "other"', () => {
    expect(categorizeForEquip(item({ kind: 'custom', name: 'Bag of Holding' }))).toBe('other')
  })
})

describe('slotsToUnequip', () => {
  it('al equipar nueva armor desequipa la anterior', () => {
    const inv: InventoryItem[] = [
      item({ slotId: 'a', kind: 'armor', name: 'Leather Armor', equipped: true }),
      item({ slotId: 'b', kind: 'armor', name: 'Studded Leather Armor', equipped: false }),
    ]
    const target = inv[1]!
    expect(slotsToUnequip(inv, target)).toEqual(['a'])
  })

  it('al equipar 3er anillo desequipa el primero (límite 2)', () => {
    const inv: InventoryItem[] = [
      item({ slotId: 'r1', kind: 'magic', name: 'Ring of Swimming', equipped: true }),
      item({ slotId: 'r2', kind: 'magic', name: 'Ring of Protection', equipped: true }),
      item({ slotId: 'r3', kind: 'magic', name: 'Ring of Languages', equipped: false }),
    ]
    expect(slotsToUnequip(inv, inv[2]!)).toEqual(['r1'])
  })

  it('al equipar 2º anillo no desequipa nada (cabe)', () => {
    const inv: InventoryItem[] = [
      item({ slotId: 'r1', kind: 'magic', name: 'Ring of Swimming', equipped: true }),
      item({ slotId: 'r2', kind: 'magic', name: 'Ring of Protection', equipped: false }),
    ]
    expect(slotsToUnequip(inv, inv[1]!)).toEqual([])
  })

  it('item "other" no desequipa nada', () => {
    const inv: InventoryItem[] = [
      item({ slotId: 'a', kind: 'custom', name: 'Bag', equipped: true }),
      item({ slotId: 'b', kind: 'custom', name: 'Rope', equipped: false }),
    ]
    expect(slotsToUnequip(inv, inv[1]!)).toEqual([])
  })
})
