// Documento generado el 2026-05-20-1820 — milestone 16 (#57 species choices)
// Bug: al elegir Dragonborn no se pregunta por Draconic Ancestry.
// Fix: añadido campo Race.choices y char.speciesChoices.
// El gating de level-up bloquea si una species choice está sin elegir.

import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { pendingLevelDecisions } from '@/utils/levelUpGating'
import { preloadVariantData, getRaces } from '@/data'
import type { CharacterData } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('Milestone 16 — species choices (#57)', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => setActivePinia(createPinia()))

  describe('Race.choices schema', () => {
    it('Dragonborn tiene choices con draconic-ancestry', () => {
      const races = getRaces('dnd5e')
      const dragonborn = races.find(r => r.id === 'dragonborn')
      expect(dragonborn?.choices).toBeDefined()
      expect(dragonborn?.choices?.length).toBe(1)
      expect(dragonborn?.choices?.[0]?.id).toBe('draconic-ancestry')
    })

    it('Dragonborn ofrece las 10 ancestries canónicas con tipos de daño', () => {
      const races = getRaces('dnd5e')
      const dragonborn = races.find(r => r.id === 'dragonborn')
      const ancestry = dragonborn?.choices?.[0]
      expect(ancestry?.options).toHaveLength(10)
      const ids = ancestry?.options.map(o => o.id).sort()
      expect(ids).toEqual([
        'black', 'blue', 'brass', 'bronze', 'copper',
        'gold', 'green', 'red', 'silver', 'white',
      ])
      // Verificar algunos tipos de daño concretos (PHB 2024)
      const damageByAncestry: Record<string, string> = {}
      for (const opt of ancestry?.options ?? []) {
        if (opt.details) damageByAncestry[opt.id] = opt.details
      }
      expect(damageByAncestry.black).toBe('Acid')
      expect(damageByAncestry.red).toBe('Fire')
      expect(damageByAncestry.silver).toBe('Cold')
      expect(damageByAncestry.green).toBe('Poison')
      expect(damageByAncestry.bronze).toBe('Lightning')
    })

    it('especies sin choices tienen el campo undefined (no obliga a tener arrays vacíos)', () => {
      const races = getRaces('dnd5e')
      const human = races.find(r => r.id === 'human')
      expect(human?.choices ?? []).toEqual([])
    })
  })

  describe('gating — species choices pendientes bloquean', () => {
    it('Dragonborn sin Draconic Ancestry bloquea el level-up', () => {
      const char = freshChar()
      char.race = 'dragonborn'
      char.className = 'fighter'
      char.subclass = 'champion'
      char.level = 1
      char.speciesChoices = {}
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'species-choice-draconic-ancestry')).toBe(true)
    })

    it('Dragonborn con Draconic Ancestry elegido NO bloquea por la species choice', () => {
      const char = freshChar()
      char.race = 'dragonborn'
      char.className = 'fighter'
      char.subclass = 'champion'
      char.level = 1
      char.speciesChoices = { 'draconic-ancestry': 'red' }
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key.startsWith('species-choice'))).toBe(false)
    })

    it('especies sin choices no añaden decisiones pendientes', () => {
      const char = freshChar()
      char.race = 'human'
      char.className = 'fighter'
      char.subclass = 'champion'
      char.level = 1
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key.startsWith('species-choice'))).toBe(false)
    })

    it('character sin raza no rompe el gating', () => {
      const char = freshChar()
      char.race = ''
      char.className = 'fighter'
      char.level = 1
      expect(() => pendingLevelDecisions(char)).not.toThrow()
    })
  })
})
