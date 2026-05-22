// Tests para getSpellsKnownCount — H1 (auditoría externa 2026-05-21).
//
// La función debe leer las tablas progression.preparedSpells del PHB 2024,
// NO calcular con `abilityMod + level` (fórmula 5e 2014).

import { describe, it, expect, beforeAll } from 'vitest'
import { getSpellsKnownCount, preloadVariantData } from './index'

const noMods = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
const lowMods = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 1 }
const midMods = { str: 0, dex: 0, con: 0, int: 3, wis: 0, cha: 3 }
const highMods = { str: 0, dex: 0, con: 0, int: 5, wis: 0, cha: 5 }

describe('H1 — getSpellsKnownCount usa tabla PHB 2024 (no fórmula 2014)', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  describe('Paladin (half caster)', () => {
    it('lv.1 → 0 (no es caster)', () => {
      expect(getSpellsKnownCount('paladin', 1, midMods)).toBe(0)
    })

    it('lv.2 → 2 (no 4 como decía la fórmula)', () => {
      // La fórmula vieja: max(1, 3+2) = 5. PHB 2024: 2.
      expect(getSpellsKnownCount('paladin', 2, midMods)).toBe(2)
    })

    it('lv.5 → 5', () => {
      expect(getSpellsKnownCount('paladin', 5, midMods)).toBe(5)
    })

    it('lv.20 → 15 (cap por tabla, no por modificador)', () => {
      // Fórmula vieja: max(1, 5+20) = 25. PHB 2024: 15.
      expect(getSpellsKnownCount('paladin', 20, highMods)).toBe(15)
    })

    it('CHA mod no afecta — solo cuenta el nivel', () => {
      expect(getSpellsKnownCount('paladin', 5, noMods)).toBe(5)
      expect(getSpellsKnownCount('paladin', 5, lowMods)).toBe(5)
      expect(getSpellsKnownCount('paladin', 5, midMods)).toBe(5)
      expect(getSpellsKnownCount('paladin', 5, highMods)).toBe(5)
    })
  })

  describe('Ranger (half caster)', () => {
    it('lv.1 → 0', () => {
      expect(getSpellsKnownCount('ranger', 1, midMods)).toBe(0)
    })

    it('lv.2 → 2', () => {
      expect(getSpellsKnownCount('ranger', 2, midMods)).toBe(2)
    })

    it('lv.20 → 15', () => {
      expect(getSpellsKnownCount('ranger', 20, highMods)).toBe(15)
    })
  })

  describe('Bard (full caster prepared)', () => {
    it('lv.1 → 4', () => {
      expect(getSpellsKnownCount('bard', 1, midMods)).toBe(4)
    })

    it('lv.5 → 9 (fórmula vieja daba 8)', () => {
      expect(getSpellsKnownCount('bard', 5, midMods)).toBe(9)
    })

    it('lv.20 → 22', () => {
      expect(getSpellsKnownCount('bard', 20, highMods)).toBe(22)
    })

    it('CHA mod no afecta', () => {
      expect(getSpellsKnownCount('bard', 10, noMods)).toBe(15)
      expect(getSpellsKnownCount('bard', 10, highMods)).toBe(15)
    })
  })

  describe('Cleric (full caster prepared)', () => {
    it('lv.1 → 4', () => {
      expect(getSpellsKnownCount('cleric', 1, midMods)).toBe(4)
    })

    it('lv.10 → 15', () => {
      expect(getSpellsKnownCount('cleric', 10, midMods)).toBe(15)
    })

    it('lv.20 → 22', () => {
      expect(getSpellsKnownCount('cleric', 20, highMods)).toBe(22)
    })
  })

  describe('Druid (full caster prepared)', () => {
    it('lv.20 → 22', () => {
      expect(getSpellsKnownCount('druid', 20, highMods)).toBe(22)
    })
  })

  describe('Sorcerer (full caster prepared)', () => {
    it('lv.1 → 2', () => {
      expect(getSpellsKnownCount('sorcerer', 1, midMods)).toBe(2)
    })

    it('lv.20 → 22', () => {
      expect(getSpellsKnownCount('sorcerer', 20, highMods)).toBe(22)
    })
  })

  describe('Wizard (full caster prepared — tabla propia)', () => {
    it('lv.1 → 4', () => {
      expect(getSpellsKnownCount('wizard', 1, midMods)).toBe(4)
    })

    it('lv.5 → 9', () => {
      expect(getSpellsKnownCount('wizard', 5, midMods)).toBe(9)
    })

    it('lv.20 → 25 (Wizard tiene cap más alto que otros full casters)', () => {
      // Fórmula vieja: max(1, 5+20) = 25 — coincidía por casualidad.
      // PHB 2024 tabla Wizard a lv.20: 25.
      expect(getSpellsKnownCount('wizard', 20, highMods)).toBe(25)
    })
  })

  describe('Warlock (preparedCaster en 2024)', () => {
    it('lv.1 → 2', () => {
      expect(getSpellsKnownCount('warlock', 1, midMods)).toBe(2)
    })

    it('lv.20 → 15', () => {
      expect(getSpellsKnownCount('warlock', 20, midMods)).toBe(15)
    })
  })

  describe('Clases no-casters → 0', () => {
    it('Fighter → 0', () => {
      expect(getSpellsKnownCount('fighter', 5, midMods)).toBe(0)
    })

    it('Barbarian → 0', () => {
      expect(getSpellsKnownCount('barbarian', 5, midMods)).toBe(0)
    })

    it('Rogue → 0', () => {
      expect(getSpellsKnownCount('rogue', 5, midMods)).toBe(0)
    })

    it('Monk → 0', () => {
      expect(getSpellsKnownCount('monk', 5, midMods)).toBe(0)
    })
  })
})
