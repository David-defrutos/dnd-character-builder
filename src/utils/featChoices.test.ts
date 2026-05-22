// Documento generado el 2026-05-20-2218 — milestone 25 (#52 fase 2)
//
// Tests de la fase 2 del audit de feats: feats que requieren UI de selección
// activa (Skilled, Crafter, Musician, Observant, Keen Mind, Skill Expert).
//
// Cobertura:
//   1. Datos: cada feat tiene requiresChoices bien tipado.
//   2. applyFeatEffects procesa featChoices y rellena skillProficiencies,
//      skillExpertise y proficienciesOther idempotentemente.
//   3. pendingLevelDecisions detecta elecciones incompletas y bloquea el
//      level-up hasta que el usuario las complete.
//   4. Limitaciones conocidas (Skill Expert: el orden de selección importa).

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { applyFeatEffects } from '@/utils/featEffects'
import { pendingLevelDecisions } from '@/utils/levelUpGating'
import { getFeatById } from '@/data/dnd5e/feats'
import { preloadVariantData } from '@/data'
import type { CharacterData, ASIChoice } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('Milestone 25 — Feats con UI de selección (#52 fase 2)', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => setActivePinia(createPinia()))

  describe('Datos: requiresChoices poblado', () => {
    it('Skilled: 3 skills/tools', () => {
      const feat = getFeatById('skilled')
      expect(feat?.requiresChoices).toHaveLength(1)
      expect(feat?.requiresChoices?.[0]).toMatchObject({
        kind: 'skill-or-tool', count: 3,
      })
    })

    it('Crafter: 3 Artisan\'s Tools', () => {
      expect(getFeatById('crafter')?.requiresChoices?.[0]).toMatchObject({
        kind: 'artisans-tool', count: 3,
      })
    })

    it('Musician: 3 Musical Instruments', () => {
      expect(getFeatById('musician')?.requiresChoices?.[0]).toMatchObject({
        kind: 'musical-instrument', count: 3,
      })
    })

    it('Observant: 1 skill (Insight/Investigation/Perception)', () => {
      const choice = getFeatById('observant')?.requiresChoices?.[0]
      expect(choice).toMatchObject({ kind: 'skill-proficiency', count: 1 })
      expect(choice?.restrictTo).toEqual(['insight', 'investigation', 'perception'])
    })

    it('Keen Mind: 1 skill (Arcana/History/Investigation/Nature/Religion)', () => {
      const choice = getFeatById('keen-mind')?.requiresChoices?.[0]
      expect(choice).toMatchObject({ kind: 'skill-proficiency', count: 1 })
      expect(choice?.restrictTo).toEqual(['arcana', 'history', 'investigation', 'nature', 'religion'])
    })

    it('Skill Expert: 1 skill prof + 1 expertise', () => {
      const choices = getFeatById('skill-expert')?.requiresChoices
      expect(choices).toHaveLength(2)
      expect(choices?.[0]?.kind).toBe('skill-proficiency')
      expect(choices?.[1]?.kind).toBe('skill-expertise')
    })
  })

  describe('applyFeatEffects procesa featChoices', () => {
    it('Observant con perception elegido: añade a skillProficiencies', () => {
      const char = freshChar()
      const choices: ASIChoice[] = [{
        level: 4, type: 'feat', featId: 'observant', featAbility: 'wis',
        featChoices: { skill: ['perception'] },
      }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(char.skillProficiencies).toContain('perception')
      expect(char.featAddedSkillProficiencies).toEqual(['perception'])
    })

    it('Crafter con 3 tools: añade 3 a proficienciesOther', () => {
      const char = freshChar()
      const choices: ASIChoice[] = [{
        level: 1, type: 'feat', featId: 'crafter',
        featChoices: { tools: ["Smith's Tools", "Carpenter's Tools", "Mason's Tools"] },
      }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(char.proficienciesOther).toContain("Smith's Tools")
      expect(char.proficienciesOther).toContain("Carpenter's Tools")
      expect(char.proficienciesOther).toContain("Mason's Tools")
    })

    it('Musician con 3 instrumentos: añade 3 a proficienciesOther', () => {
      const char = freshChar()
      const choices: ASIChoice[] = [{
        level: 1, type: 'feat', featId: 'musician',
        featChoices: { instruments: ['Lute', 'Drum', 'Flute'] },
      }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(char.proficienciesOther).toContain('Lute')
      expect(char.proficienciesOther).toContain('Drum')
      expect(char.proficienciesOther).toContain('Flute')
    })

    it('Skilled con 2 skills + 1 tool: separa correctamente', () => {
      const char = freshChar()
      const choices: ASIChoice[] = [{
        level: 1, type: 'feat', featId: 'skilled',
        featChoices: { choices: ['skill:stealth', 'skill:athletics', "tool:Thieves' Tools"] },
      }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(char.skillProficiencies).toContain('stealth')
      expect(char.skillProficiencies).toContain('athletics')
      expect(char.proficienciesOther).toContain("Thieves' Tools")
    })

    it('Skill Expert: añade skill prof + expertise', () => {
      const char = freshChar()
      const choices: ASIChoice[] = [{
        level: 4, type: 'feat', featId: 'skill-expert', featAbility: 'int',
        featChoices: { skill: ['arcana'], expertise: ['arcana'] },
      }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(char.skillProficiencies).toContain('arcana')
      expect(char.skillExpertise).toContain('arcana')
    })

    it('cambiar las elecciones reemplaza correctamente (idempotente)', () => {
      const char = freshChar()
      // Primera elección: Observant → perception
      let choices: ASIChoice[] = [{
        level: 4, type: 'feat', featId: 'observant', featAbility: 'wis',
        featChoices: { skill: ['perception'] },
      }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(char.skillProficiencies).toContain('perception')

      // Cambia a insight
      choices = [{
        ...choices[0]!,
        featChoices: { skill: ['insight'] },
      }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(char.skillProficiencies).not.toContain('perception')
      expect(char.skillProficiencies).toContain('insight')
    })

    it('quitar el feat también quita las skills/profs elegidas', () => {
      const char = freshChar()
      applyFeatEffects(char, [{
        level: 4, type: 'feat', featId: 'musician',
        featChoices: { instruments: ['Lute', 'Drum', 'Flute'] },
      }])
      expect(char.proficienciesOther).toContain('Lute')
      applyFeatEffects(char, [])
      expect(char.proficienciesOther).not.toContain('Lute')
      expect(char.proficienciesOther).not.toContain('Drum')
    })

    it('no duplica si el personaje ya tenía esa skill por clase', () => {
      const char = freshChar()
      char.skillProficiencies = ['perception'] // ya prof por su clase
      applyFeatEffects(char, [{
        level: 4, type: 'feat', featId: 'observant', featAbility: 'wis',
        featChoices: { skill: ['perception'] },
      }])
      const count = char.skillProficiencies.filter(s => s === 'perception').length
      expect(count).toBe(1)
    })

    it('NO aplica nada si featChoices está vacío (pendiente)', () => {
      const char = freshChar()
      applyFeatEffects(char, [{
        level: 4, type: 'feat', featId: 'observant', featAbility: 'wis',
        featChoices: {},
      }])
      expect(char.featAddedSkillProficiencies).toEqual([])
    })
  })

  describe('pendingLevelDecisions detecta elecciones incompletas', () => {
    function readyChar(): CharacterData {
      const char = freshChar()
      char.className = 'fighter'
      char.subclass = 'echo-knight'
      char.level = 4
      // Quitamos subclass-gating preocupándonos solo del slot ASI lv 4
      return char
    }

    it('Observant sin skill seleccionado: pendiente', () => {
      const char = readyChar()
      char.asiChoices = [{
        level: 4, type: 'feat', featId: 'observant', featAbility: 'wis',
        featChoices: {},
      }]
      const decisions = pendingLevelDecisions(char)
      const relevant = decisions.find(d => d.key === 'feat-4-skill')
      expect(relevant).toBeDefined()
      expect(relevant?.message).toContain('Observant')
      expect(relevant?.message).toContain('0/1')
    })

    it('Observant con skill seleccionado: no pendiente por ese feat', () => {
      const char = readyChar()
      char.asiChoices = [{
        level: 4, type: 'feat', featId: 'observant', featAbility: 'wis',
        featChoices: { skill: ['perception'] },
      }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.find(d => d.key === 'feat-4-skill')).toBeUndefined()
    })

    it('Crafter con solo 2/3 tools: pendiente', () => {
      const char = readyChar()
      char.asiChoices = [{
        level: 4, type: 'feat', featId: 'crafter',
        featChoices: { tools: ["Smith's Tools", "Carpenter's Tools"] },
      }]
      const decisions = pendingLevelDecisions(char)
      const relevant = decisions.find(d => d.key === 'feat-4-tools')
      expect(relevant).toBeDefined()
      expect(relevant?.message).toContain('2/3')
    })

    it('Skill Expert con prof pero sin expertise: pendiente solo de expertise', () => {
      const char = readyChar()
      char.asiChoices = [{
        level: 4, type: 'feat', featId: 'skill-expert', featAbility: 'int',
        featChoices: { skill: ['arcana'], expertise: [] },
      }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.find(d => d.key === 'feat-4-skill')).toBeUndefined()
      expect(decisions.find(d => d.key === 'feat-4-expertise')).toBeDefined()
    })
  })
})
