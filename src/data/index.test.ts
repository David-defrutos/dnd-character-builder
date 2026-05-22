import { describe, it, expect, beforeAll } from 'vitest'
import {
  getRaces,
  getClasses,
  getBackgrounds,
  getRules,
  getMaxLevel,
  getEquipment,
  getSpells,
  getSpellSlots,
  getCantripsKnown,
  getSpellsKnownCount,
  getAvailableLanguages,
  preloadVariantData,
} from './index'
import type { GameVariant } from '@/stores/app'

const variants: GameVariant[] = ['dnd5e']

describe('data loader', () => {
  // Preload all variants before running tests
  beforeAll(async () => {
    await Promise.all(variants.map(v => preloadVariantData(v)))
  })
  describe('getRaces', () => {
    it('returns races for dnd5e', () => {
      const races = getRaces('dnd5e')
      expect(races.length).toBeGreaterThan(0)
      expect(races[0]).toHaveProperty('id')
      expect(races[0]).toHaveProperty('name')
    })

    it('dnd5e has 10 races', () => {
      expect(getRaces('dnd5e').length).toBe(10)
    })


  })

  describe('getClasses', () => {
    it('returns classes for dnd5e', () => {
      const classes = getClasses('dnd5e')
      expect(classes.length).toBeGreaterThan(0)
      expect(classes[0]).toHaveProperty('id')
    })

    it('dnd5e has 12 classes', () => {
      expect(getClasses('dnd5e').length).toBe(12)
    })


  })

  describe('getBackgrounds', () => {
    it('returns backgrounds for dnd5e', () => {
      const bgs = getBackgrounds('dnd5e')
      expect(bgs.length).toBeGreaterThan(0)
      expect(bgs[0]).toHaveProperty('id')
    })
  })

  describe('getRules / getMaxLevel', () => {
    it('dnd5e max level is 20', () => {
      expect(getMaxLevel('dnd5e')).toBe(20)
      expect(getRules('dnd5e').maxLevel).toBe(20)
    })




    it('dnd5e uses gold standard', () => {
      expect(getRules('dnd5e').currencyStandard).toBe('gold')
    })
  })

  describe('getEquipment', () => {
    it('returns equipment data with weapons and armor', () => {
      const eq = getEquipment('dnd5e')
      expect(eq).toBeDefined()
      expect(eq.simpleWeapons.length).toBeGreaterThan(0)
      expect(eq.martialWeapons.length).toBeGreaterThan(0)
      expect(eq.armor.length).toBeGreaterThan(0)
    })
  })

  describe('getSpells', () => {
    it('returns spells', () => {
      const spells = getSpells('dnd5e')
      expect(spells.length).toBeGreaterThan(0)
      expect(spells[0]).toHaveProperty('name')
      expect(spells[0]).toHaveProperty('level')
    })
  })

  describe('getSpellSlots', () => {
    it('returns spell slots for wizard at level 1', () => {
      const slots = getSpellSlots('wizard', 1)
      expect(slots[1]).toBeGreaterThan(0) // level 1 spell slots
    })

    it('returns empty for non-caster', () => {
      const slots = getSpellSlots('fighter', 1)
      expect(Object.keys(slots)).toHaveLength(0)
    })

    it('returns more slots at higher levels', () => {
      const low = getSpellSlots('wizard', 1)
      const high = getSpellSlots('wizard', 5)
      const lowTotal = Object.values(low).reduce((a, b) => a + b, 0)
      const highTotal = Object.values(high).reduce((a, b) => a + b, 0)
      expect(highTotal).toBeGreaterThan(lowTotal)
    })
  })

  describe('getCantripsKnown', () => {
    it('returns cantrips for wizard', () => {
      expect(getCantripsKnown('wizard', 1)).toBeGreaterThan(0)
    })

    it('returns 0 for non-caster', () => {
      expect(getCantripsKnown('fighter', 1)).toBe(0)
    })

    it('increases cantrips at higher levels', () => {
      expect(getCantripsKnown('wizard', 10)).toBeGreaterThanOrEqual(getCantripsKnown('wizard', 1))
    })
  })

  describe('getSpellsKnownCount', () => {
    const mods = { str: 0, dex: 0, con: 0, int: 3, wis: 2, cha: 1 }

    it('prepared caster: ability mod + level (min 1)', () => {
      // Wizard is a prepared caster using INT
      const count = getSpellsKnownCount('wizard', 3, mods)
      expect(count).toBeGreaterThanOrEqual(1)
    })

    it('returns 0 for non-caster', () => {
      expect(getSpellsKnownCount('fighter', 1, mods)).toBe(0)
    })
  })

  describe('getAvailableLanguages', () => {
    it('dnd5e includes Common', () => {
      expect(getAvailableLanguages('dnd5e')).toContain('Common')
    })

    it('all variants return languages', () => {
      for (const v of variants) {
        expect(getAvailableLanguages(v).length).toBeGreaterThan(0)
      }
    })
  })

  describe('variant-specific rules', () => {
    it('dnd5e uses gold standard currency', () => {
      expect(getRules('dnd5e').currencyStandard).toBe('gold')
    })
    it('dnd5e short rest is 1 hour', () => {
      expect(getRules('dnd5e').shortRestDuration).toBe('1 hour')
    })
    it('dnd5e long rest is 8 hours', () => {
      expect(getRules('dnd5e').longRestDuration).toBe('8 hours')
    })
  })
})
