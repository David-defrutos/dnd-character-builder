// Tests para src/data/dnd5e/equipment.ts — bug #67 (adventuring gear).

import { describe, it, expect } from 'vitest'
import { adventuringGear, getGearByName } from './equipment'

describe('#67 — adventuring gear catalog', () => {
  it('tiene un número razonable de items (≥40)', () => {
    expect(adventuringGear.length).toBeGreaterThanOrEqual(40)
  })

  it('todos los items tienen los campos requeridos', () => {
    for (const g of adventuringGear) {
      expect(g.name).toBeTypeOf('string')
      expect(g.name.length).toBeGreaterThan(0)
      expect(g.category).toMatch(/^(container|light|tool|consumable|utility|survival|clothing)$/)
      expect(g.weight).toBeGreaterThanOrEqual(0)
      expect(g.costCp).toBeGreaterThanOrEqual(0)
      expect(g.costLabel).toBeTypeOf('string')
    }
  })

  it('todos los nombres son únicos', () => {
    const names = adventuringGear.map(g => g.name)
    const set = new Set(names)
    expect(names.length).toBe(set.size)
  })

  it('contiene items canónicos del PHB 2024', () => {
    const names = adventuringGear.map(g => g.name)
    expect(names).toContain('Backpack')
    expect(names).toContain('Torch')
    expect(names).toContain('Rations (1 day)')
    expect(names).toContain('Rope, Hempen (50 ft)')
    expect(names).toContain('Bedroll')
    expect(names).toContain('Tent, 2-person')
    expect(names).toContain('Tinderbox')
    expect(names).toContain('Healer’s Kit')
    expect(names).toContain('Potion of Healing')
  })

  it('getGearByName busca case-insensitive', () => {
    expect(getGearByName('Backpack')?.name).toBe('Backpack')
    expect(getGearByName('BACKPACK')?.name).toBe('Backpack')
    expect(getGearByName('torch')?.name).toBe('Torch')
    expect(getGearByName('nonexistent')).toBeUndefined()
  })

  it('cubre todas las categorías esperadas', () => {
    const cats = new Set(adventuringGear.map(g => g.category))
    expect(cats.has('container')).toBe(true)
    expect(cats.has('light')).toBe(true)
    expect(cats.has('tool')).toBe(true)
    expect(cats.has('consumable')).toBe(true)
    expect(cats.has('utility')).toBe(true)
    expect(cats.has('survival')).toBe(true)
    expect(cats.has('clothing')).toBe(true)
  })
})
