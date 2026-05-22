// Documento generado el 2026-05-20-1735 — milestone 15 (#51 Resilient prof)
// Bug: el feat Resilient aplica el +1 al stat correctamente pero no añade
// proficiencia en la tirada de salvación del atributo elegido.
// Confirmado: Resilient (WIS) no marca WIS saving throw como proficient.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { applyFeatEffects } from '@/utils/featEffects'
import { getFeatById } from '@/data/dnd5e/feats'
import type { CharacterData, ASIChoice } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('Milestone 15 — feat Resilient (#51) saving throw proficiency', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe('schema del feat', () => {
    it('resilient tiene grantsSavingThrowProficiency: true', () => {
      const f = getFeatById('resilient')
      expect(f?.grantsSavingThrowProficiency).toBe(true)
    })

    it('resilient permite cualquiera de las 6 abilities', () => {
      const f = getFeatById('resilient')
      expect(f?.asiBonus?.abilities).toHaveLength(6)
    })

    it('otros feats no tienen grantsSavingThrowProficiency', () => {
      const fwithout = ['tough', 'crossbow-expert', 'crusher', 'sharpshooter', 'durable']
      for (const id of fwithout) {
        const f = getFeatById(id)
        expect(f?.grantsSavingThrowProficiency).toBeFalsy()
      }
    })
  })

  describe('applyFeatEffects con Resilient', () => {
    it('Resilient (WIS) añade wis a savingThrowProficiencies', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.savingThrowProficiencies = ['str', 'con'] // del Fighter
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'resilient', featAbility: 'wis' },
      ]
      applyFeatEffects(char, choices)
      expect(char.savingThrowProficiencies).toContain('wis')
      // Las del Fighter siguen ahí
      expect(char.savingThrowProficiencies).toContain('str')
      expect(char.savingThrowProficiencies).toContain('con')
    })

    it('Resilient sin featAbility (usuario no eligió) NO añade nada', () => {
      const char = freshChar()
      char.savingThrowProficiencies = ['str', 'con']
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'resilient' },
      ]
      applyFeatEffects(char, choices)
      expect(char.savingThrowProficiencies.sort()).toEqual(['con', 'str'])
      expect(char.featAddedSavingThrows).toEqual([])
    })

    it('Resilient cambia de WIS a INT: quita WIS y añade INT', () => {
      const char = freshChar()
      char.savingThrowProficiencies = ['str', 'con']
      applyFeatEffects(char, [{ level: 4, type: 'feat', featId: 'resilient', featAbility: 'wis' }])
      expect(char.savingThrowProficiencies).toContain('wis')
      // Ahora cambia
      applyFeatEffects(char, [{ level: 4, type: 'feat', featId: 'resilient', featAbility: 'int' }])
      expect(char.savingThrowProficiencies).not.toContain('wis')
      expect(char.savingThrowProficiencies).toContain('int')
      // No tocó las del Fighter
      expect(char.savingThrowProficiencies).toContain('str')
      expect(char.savingThrowProficiencies).toContain('con')
    })

    it('Deseleccionar Resilient (cambiar a ASI) quita su saving throw prof', () => {
      const char = freshChar()
      char.savingThrowProficiencies = ['str', 'con']
      applyFeatEffects(char, [{ level: 4, type: 'feat', featId: 'resilient', featAbility: 'wis' }])
      expect(char.savingThrowProficiencies).toContain('wis')
      // Ahora deselecciona
      applyFeatEffects(char, [{ level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] }])
      expect(char.savingThrowProficiencies).not.toContain('wis')
      expect(char.savingThrowProficiencies.sort()).toEqual(['con', 'str'])
    })

    it('Resilient en CON cuando el Fighter ya tiene CON: no duplica', () => {
      const char = freshChar()
      char.savingThrowProficiencies = ['str', 'con']
      applyFeatEffects(char, [{ level: 4, type: 'feat', featId: 'resilient', featAbility: 'con' }])
      // Solo una entrada 'con'
      expect(char.savingThrowProficiencies.filter(a => a === 'con')).toHaveLength(1)
    })

    it('idempotencia: aplicar dos veces no duplica', () => {
      const char = freshChar()
      char.savingThrowProficiencies = ['str', 'con']
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'resilient', featAbility: 'dex' },
      ]
      applyFeatEffects(char, choices)
      applyFeatEffects(char, choices)
      expect(char.savingThrowProficiencies.filter(a => a === 'dex')).toHaveLength(1)
    })

    it('múltiples Resilient (Epic Boon nivel 19 también) acumulan correctamente', () => {
      // Resilient es no-repeatable estrictamente, pero el sistema debería
      // tolerar el caso teórico sin romperse.
      const char = freshChar()
      char.savingThrowProficiencies = ['str', 'con']
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'resilient', featAbility: 'wis' },
        { level: 8, type: 'feat', featId: 'resilient', featAbility: 'int' },
      ]
      applyFeatEffects(char, choices)
      expect(char.savingThrowProficiencies).toContain('wis')
      expect(char.savingThrowProficiencies).toContain('int')
      expect(char.featAddedSavingThrows?.sort()).toEqual(['int', 'wis'])
    })
  })

  describe('Tough (regresión — sigue funcionando tras refactor)', () => {
    it('Tough en nivel 4 da +8 HP (level × 2)', () => {
      const char = freshChar()
      char.level = 4
      applyFeatEffects(char, [{ level: 4, type: 'feat', featId: 'tough' }])
      expect(char.toughHpBonus).toBe(8)
    })

    it('Deseleccionar Tough quita el bonus', () => {
      const char = freshChar()
      char.level = 4
      applyFeatEffects(char, [{ level: 4, type: 'feat', featId: 'tough' }])
      expect(char.toughHpBonus).toBe(8)
      applyFeatEffects(char, [{ level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] }])
      expect(char.toughHpBonus).toBe(0)
    })
  })
})
