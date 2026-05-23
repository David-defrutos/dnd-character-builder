// Documento generado el 2026-05-23-0914
import { describe, expect, it } from 'vitest'
import { allMagicItems, getMagicItemById } from './magic-items'

describe('magic item weights', () => {
  it('defines a numeric non-negative weight for every magic item', () => {
    expect(allMagicItems.length).toBeGreaterThanOrEqual(300)
    for (const item of allMagicItems) {
      expect(typeof item.weight, item.name).toBe('number')
      expect(Number.isFinite(item.weight), item.name).toBe(true)
      expect(item.weight, item.name).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps special cases explicit', () => {
    expect(getMagicItemById('bag-of-holding')?.weight).toBe(15)
    expect(getMagicItemById('ring-of-protection')?.weight).toBe(0)
    expect(getMagicItemById('wand-of-magic-missiles')?.weight).toBe(1)
    expect(getMagicItemById('dagger-plus1')?.weight).toBe(1)
    expect(getMagicItemById('plate-armor-plus1')?.weight).toBe(65)
  })
})
