// Tests para src/utils/weaponMastery.ts — bug #89.

import { describe, it, expect, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import type { CharacterData } from '@/stores/character'
import { preloadVariantData } from '@/data'
import {
  getWeaponMasterySlots,
  getEligibleMasteryWeapons,
  sanitizeMasteries,
  getMasteryFor,
} from './weaponMastery'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('#89 — weaponMastery', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  describe('getWeaponMasterySlots', () => {
    it('Fighter lv.1 → 3 slots', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 1
      expect(getWeaponMasterySlots(c)).toBe(3)
    })

    it('Fighter lv.4 → 4 slots', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 4
      expect(getWeaponMasterySlots(c)).toBe(4)
    })

    it('Fighter lv.10 → 5 slots', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 10
      expect(getWeaponMasterySlots(c)).toBe(5)
    })

    it('Fighter lv.16 → 6 slots (corregido en #85)', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 16
      expect(getWeaponMasterySlots(c)).toBe(6)
    })

    it('Barbarian lv.1 → 2 slots, lv.10 → 4', () => {
      const c = freshChar(); c.className = 'barbarian'; c.level = 1
      expect(getWeaponMasterySlots(c)).toBe(2)
      c.level = 10
      expect(getWeaponMasterySlots(c)).toBe(4)
    })

    it('Paladin / Ranger / Rogue: 2 slots a lv.1, 3 a lv.4', () => {
      for (const cls of ['paladin', 'ranger', 'rogue'] as const) {
        const c = freshChar(); c.className = cls; c.level = 1
        expect(getWeaponMasterySlots(c), `${cls} lv.1`).toBe(2)
        c.level = 4
        expect(getWeaponMasterySlots(c), `${cls} lv.4`).toBe(3)
      }
    })

    it('Cleric / Wizard / Bard sin Weapon Mastery → 0 slots', () => {
      for (const cls of ['cleric', 'wizard', 'bard'] as const) {
        const c = freshChar(); c.className = cls; c.level = 10
        expect(getWeaponMasterySlots(c), cls).toBe(0)
      }
    })
  })

  describe('getEligibleMasteryWeapons', () => {
    it('Fighter: Simple + Martial (varias docenas)', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 1
      const weapons = getEligibleMasteryWeapons(c)
      expect(weapons.length).toBeGreaterThan(20)
      const names = weapons.map(w => w.name)
      expect(names).toContain('Greatsword')   // Martial
      expect(names).toContain('Dagger')        // Simple
      expect(names).toContain('Longbow')       // Martial Ranged
    })

    it('Rogue: Simple + Martial Finesse/Light (limitado)', () => {
      const c = freshChar(); c.className = 'rogue'; c.level = 1
      const weapons = getEligibleMasteryWeapons(c)
      const names = weapons.map(w => w.name)
      expect(names).toContain('Dagger')        // Simple
      expect(names).toContain('Rapier')        // Martial Finesse
      expect(names).toContain('Shortsword')    // Martial Finesse + Light
      expect(names).not.toContain('Greatsword') // Martial heavy, no finesse
      expect(names).not.toContain('Longbow')   // Martial Ranged sin finesse
    })

    it('Cleric (sin mastery) → []', () => {
      const c = freshChar(); c.className = 'cleric'; c.level = 1
      expect(getEligibleMasteryWeapons(c)).toEqual([])
    })
  })

  describe('sanitizeMasteries', () => {
    it('respeta el límite de slots', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 1 // 3 slots
      c.weaponMasteries = ['Rapier', 'Dagger', 'Hand Crossbow', 'Longbow', 'Greatsword']
      expect(sanitizeMasteries(c)).toEqual(['Rapier', 'Dagger', 'Hand Crossbow'])
    })

    it('quita duplicados', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 4 // 4 slots
      c.weaponMasteries = ['Rapier', 'Rapier', 'Dagger', 'Dagger']
      expect(sanitizeMasteries(c)).toEqual(['Rapier', 'Dagger'])
    })

    it('quita armas no elegibles para Rogue', () => {
      const c = freshChar(); c.className = 'rogue'; c.level = 1 // 2 slots
      c.weaponMasteries = ['Dagger', 'Greatsword', 'Rapier']
      // Greatsword no es elegible (no finesse/light) — se descarta.
      expect(sanitizeMasteries(c)).toEqual(['Dagger', 'Rapier'])
    })

    it('PJ sin mastery → []', () => {
      const c = freshChar(); c.className = 'cleric'; c.level = 5
      c.weaponMasteries = ['Mace', 'Dagger']
      expect(sanitizeMasteries(c)).toEqual([])
    })

    it('weaponMasteries undefined → []', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 1
      expect(sanitizeMasteries(c)).toEqual([])
    })
  })

  describe('getMasteryFor', () => {
    it('devuelve la propiedad de maestría correcta', () => {
      expect(getMasteryFor('Rapier')).toBe('Vex')
      expect(getMasteryFor('Greatsword')).toBe('Graze')
      expect(getMasteryFor('Dagger')).toBe('Nick')
      expect(getMasteryFor('Hand Crossbow')).toBe('Vex')
    })

    it('case-insensitive', () => {
      expect(getMasteryFor('rapier')).toBe('Vex')
      expect(getMasteryFor('RAPIER')).toBe('Vex')
    })

    it('arma desconocida → undefined', () => {
      expect(getMasteryFor('Lightsaber')).toBeUndefined()
    })
  })

  // Caso real Cecino lv.10 → 5 slots, Hand Crossbow → Vex
  it('Caso real Cecino lv.10', () => {
    const c = freshChar(); c.className = 'fighter'; c.level = 10
    expect(getWeaponMasterySlots(c)).toBe(5)
    expect(getMasteryFor('Hand Crossbow')).toBe('Vex')
  })
})
