// milestone9_equipment.test.ts — Tarea #9: Gestión de equipo en ficha
import { describe, it, expect } from 'vitest'
import { magicItems, getMagicItemById, getMagicItemsByCategory, getMagicItemsByRarity } from '@/data/dnd5e/magic-items'

describe('Magic Items SRD 5.2.1', () => {
  it('loads at least 250 magic items', () => {
    expect(magicItems.length).toBeGreaterThanOrEqual(250)
  })

  it('every item has required fields', () => {
    for (const item of magicItems) {
      expect(item.id, `${item.name} missing id`).toBeTruthy()
      expect(item.name, `item missing name`).toBeTruthy()
      expect(item.category, `${item.name} missing category`).toBeTruthy()
      expect(item.rarity, `${item.name} missing rarity`).toBeTruthy()
      expect(typeof item.attunement).toBe('boolean')
    }
  })

  it('no item has rarity "Rarity Varies" (should be "Varies")', () => {
    const bad = magicItems.filter(i => (i.rarity as string) === 'Rarity Varies')
    expect(bad.map(i => i.name)).toEqual([])
  })

  it('all rarities are valid values', () => {
    const valid = new Set(['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact', 'Varies'])
    for (const item of magicItems) {
      expect(valid.has(item.rarity), `${item.name} has invalid rarity: ${item.rarity}`).toBe(true)
    }
  })

  it('all categories are valid values', () => {
    const valid = new Set(['Armor', 'Potion', 'Ring', 'Rod', 'Scroll', 'Staff', 'Wand', 'Weapon', 'Wondrous Item'])
    for (const item of magicItems) {
      expect(valid.has(item.category), `${item.name} has invalid category: ${item.category}`).toBe(true)
    }
  })

  it('includes well-known items', () => {
    const names = magicItems.map(i => i.name)
    expect(names).toContain('Bag of Holding')
    expect(names).toContain('Cloak of Invisibility')
    expect(names).toContain('Ring of Protection')
    expect(names).toContain('Staff of Power')
    expect(names).toContain('Vorpal Sword')
  })

  it('Bag of Holding is Uncommon and does not require attunement', () => {
    const item = getMagicItemById('bag-of-holding')
    expect(item).toBeDefined()
    expect(item!.rarity).toBe('Uncommon')
    expect(item!.attunement).toBe(false)
    expect(item!.category).toBe('Wondrous Item')
  })

  it('Ring of Protection requires attunement', () => {
    const item = getMagicItemById('ring-of-protection')
    expect(item).toBeDefined()
    expect(item!.attunement).toBe(true)
  })

  it('roughly 50% of items require attunement', () => {
    const attuned = magicItems.filter(i => i.attunement).length
    const ratio = attuned / magicItems.length
    expect(ratio).toBeGreaterThan(0.3)
    expect(ratio).toBeLessThan(0.7)
  })

  it('getMagicItemsByCategory returns only items of that category', () => {
    const rings = getMagicItemsByCategory('Ring')
    expect(rings.length).toBeGreaterThan(0)
    for (const r of rings) expect(r.category).toBe('Ring')
  })

  it('getMagicItemsByRarity returns only items of that rarity', () => {
    const legendaries = getMagicItemsByRarity('Legendary')
    expect(legendaries.length).toBeGreaterThan(0)
    for (const l of legendaries) expect(l.rarity).toBe('Legendary')
  })

  it('has items in every category', () => {
    const cats = ['Armor', 'Potion', 'Ring', 'Rod', 'Scroll', 'Staff', 'Wand', 'Weapon', 'Wondrous Item']
    for (const cat of cats) {
      const count = magicItems.filter(i => i.category === cat).length
      expect(count, `No items in category ${cat}`).toBeGreaterThan(0)
    }
  })

  it('has items in every non-artifact rarity', () => {
    const rarities = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary']
    for (const r of rarities) {
      const count = magicItems.filter(i => i.rarity === r).length
      expect(count, `No items with rarity ${r}`).toBeGreaterThan(0)
    }
  })
})
