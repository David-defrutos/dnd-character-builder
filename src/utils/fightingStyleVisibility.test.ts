/**
 * Tests para #101 (Fighting Style invisible en ficha) y #102 (Archery +2 no aplicado).
 *
 * Escenario: Cecino — Forest Gnome Fighter lv.2 con Fighting Style: Archery
 * y Hand Crossbow en inventario.
 *
 * Expectativas:
 *   - #101: el Fighting Style aparece (a) en el campo "Feats" del PDF de la
 *     hoja 1, y (b) en la sección FEATS del PDF anexo (Detailed Reference).
 *   - #102: el bonus +2 de Archery se aplica al attack bonus al usar un arma
 *     ranged (Hand Crossbow).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { computeWeaponAttack } from '@/utils/weaponCalc'
import { buildPdfFields } from '@/utils/pdfFieldMapping'

function setupCecino() {
  const store = useCharacterStore()
  const c = store.character
  c.name = 'Cecino'
  c.race = 'gnome'
  c.subrace = 'forest-gnome'
  c.className = 'fighter'
  c.level = 2
  c.abilityScores = { str: 10, dex: 16, con: 14, int: 12, wis: 10, cha: 8 }
  c.fightingStyleFeat = 'archery'
  c.inventory = [
    { kind: 'weapon', itemId: 'hand-crossbow', name: 'Hand Crossbow', quantity: 1 } as never,
  ]
  return c
}

describe('#101 + #102 — Fighting Style en ficha y attack bonus', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe('#102 — Archery +2 attack bonus en ranged weapons', () => {
    it('Cecino con Hand Crossbow obtiene +2 de Archery en el attack bonus', () => {
      const char = setupCecino()
      const info = computeWeaponAttack('Hand Crossbow', char)

      // DEX +3, PB +2 (lv.2), Archery +2 → +7
      expect(info.archeryBonus).toBe(2)
      expect(info.attackBonus).toBe(3 + 2 + 2)  // 7
    })

    it('Sin Hand Crossbow ni Fighting Style, attack bonus es DEX+PB', () => {
      const char = setupCecino()
      char.fightingStyleFeat = undefined
      const info = computeWeaponAttack('Hand Crossbow', char)

      expect(info.archeryBonus).toBe(0)
      expect(info.attackBonus).toBe(3 + 2)  // DEX +3, PB +2
    })

    it('Archery NO se aplica a armas melee', () => {
      const char = setupCecino()
      const info = computeWeaponAttack('Longsword', char)
      expect(info.archeryBonus).toBe(0)
    })
  })

  describe('#101 — Fighting Style aparece en el PDF de la ficha (hoja 1)', () => {
    it('El campo Feats incluye "Fighting Style: Archery"', () => {
      const char = setupCecino()
      const fields = buildPdfFields(char)
      // Esperamos que el feat esté listado en Feats con el nombre del estilo.
      expect(fields['Feats'] ?? '').toMatch(/archery/i)
    })
  })
})
