// Documento generado el 2026-05-20-1010 — test de regresión bug #48 (Feats ASI)
// Bug: los feats que otorgan +1 a un atributo no aplican el bonus al stat.
// Caso confirmado: DEX 15 + Crossbow Expert + Sharpshooter debería dar DEX 17,
// pero el bonus de los feats se ignoraba en aggregateAsiBumps.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { aggregateAsiBumps, resolveFeatAbility } from '@/data/dnd5e/asi'
import { feats, getFeatById } from '@/data/dnd5e/feats'
import type { ASIChoice } from '@/stores/character'

describe('Bugfix tarea 48 — Feats ASI aplican bonus al stat', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe('schema de feats — todos los feats con "ASI: +1" en descripción tienen asiBonus', () => {
    it('crossbow-expert tiene asiBonus DEX fijo', () => {
      const f = getFeatById('crossbow-expert')
      expect(f?.asiBonus).toEqual({ abilities: ['dex'], amount: 1 })
    })

    it('sharpshooter tiene asiBonus DEX fijo', () => {
      const f = getFeatById('sharpshooter')
      expect(f?.asiBonus).toEqual({ abilities: ['dex'], amount: 1 })
    })

    it('crusher tiene asiBonus con dos opciones (STR/CON)', () => {
      const f = getFeatById('crusher')
      expect(f?.asiBonus?.abilities.sort()).toEqual(['con', 'str'])
      expect(f?.asiBonus?.amount).toBe(1)
    })

    it('mounted-combatant tiene asiBonus con tres opciones (STR/DEX/WIS)', () => {
      const f = getFeatById('mounted-combatant')
      expect(f?.asiBonus?.abilities.sort()).toEqual(['dex', 'str', 'wis'])
    })

    it('skill-expert tiene asiBonus con las 6 abilities', () => {
      const f = getFeatById('skill-expert')
      expect(f?.asiBonus?.abilities).toHaveLength(6)
    })

    it('resilient (con "in which you lack saving throw") tiene asiBonus con 6 opciones', () => {
      const f = getFeatById('resilient')
      expect(f?.asiBonus?.abilities).toHaveLength(6)
    })

    it('ability-score-improvement feat NO tiene asiBonus (se maneja como ASI tipo)', () => {
      const f = getFeatById('ability-score-improvement')
      expect(f?.asiBonus).toBeUndefined()
    })

    it('todos los feats general/epic-boon con "ASI: +1" en descripción tienen asiBonus', () => {
      const offenders: string[] = []
      for (const f of feats) {
        if (f.id === 'ability-score-improvement') continue
        if (/ASI:\s*\+1/i.test(f.description) && !f.asiBonus) {
          offenders.push(f.id)
        }
      }
      expect(offenders).toEqual([])
    })

    it('ningún feat de origin tiene asiBonus (los origin feats no dan ASI en 2024)', () => {
      const origin = feats.filter(f => f.category === 'origin')
      const withBonus = origin.filter(f => f.asiBonus)
      expect(withBonus).toEqual([])
    })
  })

  describe('aggregateAsiBumps — suma los bonos de feats', () => {
    it('Crossbow Expert añade +1 DEX (feat con asiBonus fijo)', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'crossbow-expert', featAbility: 'dex' },
      ]
      expect(aggregateAsiBumps(choices)).toEqual({ dex: 1 })
    })

    it('Sharpshooter añade +1 DEX', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'sharpshooter', featAbility: 'dex' },
      ]
      expect(aggregateAsiBumps(choices)).toEqual({ dex: 1 })
    })

    it('Crossbow Expert + Sharpshooter (CASO DEL BUG #48) suma +2 DEX', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'crossbow-expert', featAbility: 'dex' },
        { level: 8, type: 'feat', featId: 'sharpshooter', featAbility: 'dex' },
      ]
      expect(aggregateAsiBumps(choices)).toEqual({ dex: 2 })
    })

    it('Crusher con featAbility="str" da +1 STR', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'crusher', featAbility: 'str' },
      ]
      expect(aggregateAsiBumps(choices)).toEqual({ str: 1 })
    })

    it('Crusher con featAbility="con" da +1 CON', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'crusher', featAbility: 'con' },
      ]
      expect(aggregateAsiBumps(choices)).toEqual({ con: 1 })
    })

    it('Crusher sin featAbility (usuario no eligió todavía) no aplica bonus', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'crusher' },
      ]
      expect(aggregateAsiBumps(choices)).toEqual({})
    })

    it('Crusher con featAbility inválido (no en abilities permitidas) no aplica bonus', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'crusher', featAbility: 'dex' },
      ]
      expect(aggregateAsiBumps(choices)).toEqual({})
    })

    it('feat sin asiBonus no contribuye (ej: ability-score-improvement como feat)', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'ability-score-improvement' },
      ]
      expect(aggregateAsiBumps(choices)).toEqual({})
    })

    it('mezcla de ASI puros y feats: suma todo correctamente', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] },
        { level: 8, type: 'feat', featId: 'crossbow-expert', featAbility: 'dex' },
        { level: 12, type: 'asi', asiMode: '1+1', asiAbilities: ['con', 'wis'] },
      ]
      expect(aggregateAsiBumps(choices)).toEqual({ str: 2, dex: 1, con: 1, wis: 1 })
    })

    it('Tough (CON fijo) suma +1 CON', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'tough', featAbility: 'con' },
      ]
      // Tough es feat origin pero el origin no debería tener asiBonus.
      // Si lo tuviera, este test cambiaría; lo dejamos como guard.
      const tough = getFeatById('tough')
      if (tough?.asiBonus) {
        expect(aggregateAsiBumps(choices)).toEqual({ con: 1 })
      } else {
        expect(aggregateAsiBumps(choices)).toEqual({})
      }
    })

    it('Durable (CON fijo) suma +1 CON', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'durable', featAbility: 'con' },
      ]
      expect(aggregateAsiBumps(choices)).toEqual({ con: 1 })
    })
  })

  describe('resolveFeatAbility — helper para autoasignar', () => {
    it('feat con una sola opción se auto-resuelve', () => {
      expect(resolveFeatAbility('crossbow-expert', undefined)).toBe('dex')
      expect(resolveFeatAbility('sharpshooter', undefined)).toBe('dex')
    })

    it('feat con múltiples opciones se queda en undefined si no había elección previa', () => {
      expect(resolveFeatAbility('crusher', undefined)).toBeUndefined()
    })

    it('feat con múltiples opciones mantiene la elección previa si sigue siendo válida', () => {
      expect(resolveFeatAbility('crusher', 'str')).toBe('str')
      expect(resolveFeatAbility('crusher', 'con')).toBe('con')
    })

    it('feat con múltiples opciones limpia la elección si ya no es válida', () => {
      expect(resolveFeatAbility('crusher', 'dex')).toBeUndefined()
    })

    it('featId vacío devuelve undefined', () => {
      expect(resolveFeatAbility('', undefined)).toBeUndefined()
      expect(resolveFeatAbility(undefined, 'str')).toBeUndefined()
    })

    it('feat inexistente devuelve undefined', () => {
      expect(resolveFeatAbility('feat-que-no-existe', 'str')).toBeUndefined()
    })

    it('feat sin asiBonus devuelve undefined', () => {
      expect(resolveFeatAbility('ability-score-improvement', 'str')).toBeUndefined()
    })
  })

  describe('integración con character store', () => {
    it('escenario completo: DEX 15 + Crossbow Expert + Sharpshooter → totalAbilityScore("dex") === 17', () => {
      const store = useCharacterStore()
      store.character.abilityScores.dex = 15
      store.character.asiChoices = [
        { level: 4, type: 'feat', featId: 'crossbow-expert', featAbility: 'dex' },
        { level: 8, type: 'feat', featId: 'sharpshooter', featAbility: 'dex' },
      ]
      store.character.asiBonuses = aggregateAsiBumps(store.character.asiChoices)
      expect(store.totalAbilityScore('dex')).toBe(17)
    })
  })
})
