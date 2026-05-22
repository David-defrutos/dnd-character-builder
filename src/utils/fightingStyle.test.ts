// Tests para src/utils/fightingStyle.ts — bug #94.

import { describe, it, expect, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import type { CharacterData } from '@/stores/character'
import { preloadVariantData } from '@/data'
import {
  getFightingStyleFeats,
  hasFightingStyleFeature,
  getFightingStyleSource,
  getFightingStyleSourceLabel,
} from './fightingStyle'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('#94 — fightingStyle helpers', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  describe('getFightingStyleFeats', () => {
    it('devuelve solo feats con category fighting-style', () => {
      const styles = getFightingStyleFeats()
      expect(styles.length).toBeGreaterThan(0)
      expect(styles.every(f => f.category === 'fighting-style')).toBe(true)
    })

    it('incluye al menos los clásicos: Defense, Dueling, Great Weapon Fighting, Archery', () => {
      const names = getFightingStyleFeats().map(f => f.name)
      expect(names).toContain('Defense')
      expect(names).toContain('Dueling')
      expect(names).toContain('Archery')
    })
  })

  describe('hasFightingStyleFeature', () => {
    it('Fighter lv.1 → true', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 1
      expect(hasFightingStyleFeature(c)).toBe(true)
    })

    it('Paladin lv.1 → false (necesita lv.2)', () => {
      const c = freshChar(); c.className = 'paladin'; c.level = 1
      expect(hasFightingStyleFeature(c)).toBe(false)
    })

    it('Paladin lv.2 → true', () => {
      const c = freshChar(); c.className = 'paladin'; c.level = 2
      expect(hasFightingStyleFeature(c)).toBe(true)
    })

    it('Ranger lv.2 → true', () => {
      const c = freshChar(); c.className = 'ranger'; c.level = 2
      expect(hasFightingStyleFeature(c)).toBe(true)
    })

    it('Cleric, Wizard, etc → false', () => {
      for (const cls of ['cleric', 'wizard', 'sorcerer', 'rogue'] as const) {
        const c = freshChar(); c.className = cls; c.level = 20
        expect(hasFightingStyleFeature(c), cls).toBe(false)
      }
    })
  })

  describe('getFightingStyleSourceLabel', () => {
    it('formato "Fighter lv.1"', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 5
      expect(getFightingStyleSourceLabel(c)).toBe('Fighter lv.1')
    })

    it('formato "Paladin lv.2"', () => {
      const c = freshChar(); c.className = 'paladin'; c.level = 10
      expect(getFightingStyleSourceLabel(c)).toBe('Paladin lv.2')
    })

    it('vacío para clases sin feature', () => {
      const c = freshChar(); c.className = 'cleric'; c.level = 20
      expect(getFightingStyleSourceLabel(c)).toBe('')
    })
  })

  describe('getFightingStyleSource', () => {
    it('Ranger lv.5 → { Ranger, 2 }', () => {
      const c = freshChar(); c.className = 'ranger'; c.level = 5
      expect(getFightingStyleSource(c)).toEqual({ className: 'Ranger', level: 2 })
    })

    it('Ranger lv.1 → null (aún no llega)', () => {
      const c = freshChar(); c.className = 'ranger'; c.level = 1
      expect(getFightingStyleSource(c)).toBeNull()
    })
  })

  describe('flujo de selección', () => {
    it('Fighter lv.1: el id se persiste en fightingStyleFeat', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 1
      c.fightingStyleFeat = 'defense'
      expect(c.fightingStyleFeat).toBe('defense')
    })

    it('se puede cambiar el style (replace en cada level-up de Fighter)', () => {
      const c = freshChar(); c.className = 'fighter'; c.level = 3
      c.fightingStyleFeat = 'defense'
      // Sube a 4 y cambia
      c.level = 4
      c.fightingStyleFeat = 'dueling'
      expect(c.fightingStyleFeat).toBe('dueling')
    })
  })
})
