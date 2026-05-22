// Documento generado el 2026-05-20-1845 — milestone 19 (#55 PDF Armor Class)
// Bug: el PDF mostraba AC = 10 + DEX_mod sin tener en cuenta la armadura equipada.
// Confirmado: Cecino con Breastplate (medium, baseAC 14, maxDex 2) y DEX +3
// debería mostrar AC 16, no 13.

import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { computeArmorClass } from '@/utils/calculations'
import { getDnd2024FieldMapping } from '@/utils/pdfFieldMapping'
import { armor as armorCatalogue } from '@/data/dnd5e/equipment'
import { preloadVariantData } from '@/data'
import type { CharacterData } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('Milestone 19 — Armor Class con armadura equipada (#55)', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => setActivePinia(createPinia()))

  describe('computeArmorClass (cálculo puro)', () => {
    it('sin armadura: 10 + DEX', () => {
      expect(computeArmorClass(3, '', false, armorCatalogue)).toBe(13)
      expect(computeArmorClass(0, '', false, armorCatalogue)).toBe(10)
      expect(computeArmorClass(-1, '', false, armorCatalogue)).toBe(9)
    })

    it('Light armor: baseAC + DEX completo (sin cap)', () => {
      // Leather Armor (light, baseAC 11)
      expect(computeArmorClass(5, 'Leather Armor', false, armorCatalogue)).toBe(16)
      // Studded Leather (light, baseAC 12)
      expect(computeArmorClass(3, 'Studded Leather Armor', false, armorCatalogue)).toBe(15)
    })

    it('Medium armor: baseAC + min(DEX, 2)', () => {
      // Breastplate (medium, baseAC 14, maxDex 2) — caso del bug
      expect(computeArmorClass(3, 'Breastplate', false, armorCatalogue)).toBe(16)
      expect(computeArmorClass(1, 'Breastplate', false, armorCatalogue)).toBe(15)
      expect(computeArmorClass(5, 'Breastplate', false, armorCatalogue)).toBe(16) // capped
      // Hide Armor (medium, baseAC 12)
      expect(computeArmorClass(4, 'Hide Armor', false, armorCatalogue)).toBe(14)
    })

    it('Heavy armor: baseAC (DEX ignorado)', () => {
      // Plate Armor (heavy, baseAC 18)
      expect(computeArmorClass(5, 'Plate Armor', false, armorCatalogue)).toBe(18)
      expect(computeArmorClass(-2, 'Plate Armor', false, armorCatalogue)).toBe(18)
      // Chain Mail (heavy, baseAC 16)
      expect(computeArmorClass(3, 'Chain Mail', false, armorCatalogue)).toBe(16)
    })

    it('Shield: +2 sobre cualquier AC base', () => {
      expect(computeArmorClass(3, 'Breastplate', true, armorCatalogue)).toBe(18) // 16 + 2
      expect(computeArmorClass(3, '', true, armorCatalogue)).toBe(15) // 13 + 2
      expect(computeArmorClass(0, 'Plate Armor', true, armorCatalogue)).toBe(20) // 18 + 2
    })

    it('nombre de armadura no encontrado → unarmored', () => {
      expect(computeArmorClass(3, 'Imaginary Plate of +9000', false, armorCatalogue)).toBe(13)
    })

    it('matching es case-insensitive', () => {
      expect(computeArmorClass(3, 'breastplate', false, armorCatalogue)).toBe(16)
      expect(computeArmorClass(3, 'BREASTPLATE', false, armorCatalogue)).toBe(16)
    })

    it('una armadura con type=shield no se trata como armor base', () => {
      // Equipar "Shield" en el campo de armor no debería contar como armadura.
      // (El usuario debería usar char.shield, pero defensa en profundidad.)
      expect(computeArmorClass(3, 'Shield', false, armorCatalogue)).toBe(13)
    })
  })

  describe('store armorClass computed', () => {
    it('AC se actualiza al asignar char.armor', () => {
      const store = useCharacterStore()
      const char = store.character
      char.abilityScores.dex = 16 // mod +3
      char.armor = 'Breastplate'
      char.shield = false
      expect(store.armorClass).toBe(16)
    })

    it('AC suma +2 si char.shield = true', () => {
      const store = useCharacterStore()
      const char = store.character
      char.abilityScores.dex = 16
      char.armor = 'Breastplate'
      char.shield = true
      expect(store.armorClass).toBe(18)
    })

    it('si char.armor está vacío, detecta la primera armadura del inventory[]', () => {
      const store = useCharacterStore()
      const char = store.character
      char.abilityScores.dex = 16
      char.armor = ''
      char.inventory = [
        { slotId: 'a1', kind: 'armor', itemId: 'breastplate', name: 'Breastplate', qty: 1 },
      ]
      expect(store.armorClass).toBe(16)
    })

    it('un shield en inventory[] suma +2 aunque char.shield=false', () => {
      const store = useCharacterStore()
      const char = store.character
      char.abilityScores.dex = 16
      char.armor = ''
      char.shield = false
      char.inventory = [
        { slotId: 'a1', kind: 'armor', itemId: 'breastplate', name: 'Breastplate', qty: 1 },
        { slotId: 'a2', kind: 'armor', itemId: 'shield', name: 'Shield', qty: 1 },
      ]
      expect(store.armorClass).toBe(18)
    })
  })

  describe('PDF mapping (campo AC)', () => {
    it('CASO DEL BUG: Cecino con Breastplate, DEX +3 → AC 16', () => {
      const char = freshChar()
      char.abilityScores.dex = 16 // +3
      char.armor = 'Breastplate'
      char.shield = false
      const fields = getDnd2024FieldMapping(char)
      expect(fields['AC']).toBe('16')
    })

    it('Sin armadura: AC = 10 + DEX', () => {
      const char = freshChar()
      char.abilityScores.dex = 14 // +2
      char.armor = ''
      char.shield = false
      const fields = getDnd2024FieldMapping(char)
      expect(fields['AC']).toBe('12')
    })

    it('Plate Armor + Shield: AC 20', () => {
      const char = freshChar()
      char.abilityScores.dex = 10
      char.armor = 'Plate Armor'
      char.shield = true
      const fields = getDnd2024FieldMapping(char)
      expect(fields['AC']).toBe('20')
    })

    it('Armadura solo en inventory[] (no en char.armor): se detecta y aplica', () => {
      const char = freshChar()
      char.abilityScores.dex = 16
      char.armor = ''
      char.inventory = [
        { slotId: 'a1', kind: 'armor', itemId: 'breastplate', name: 'Breastplate', qty: 1 },
      ]
      const fields = getDnd2024FieldMapping(char)
      expect(fields['AC']).toBe('16')
    })
  })
})
