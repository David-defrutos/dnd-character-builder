// Tests para H5 (auditoría externa): Bard Expertise como decisión mecánica.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import {
  EXPERTISE_FEATURES,
  getActiveExpertiseFeatures,
  getSkillsBlockedByOtherExpertise,
  rebuildSkillExpertise,
  setExpertiseChoice,
} from './expertiseFeatures'

describe('H5 — Bard Expertise (auditoría externa)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('catálogo EXPERTISE_FEATURES', () => {
    it('incluye Bard lv.2 (2 skills)', () => {
      const f = EXPERTISE_FEATURES.find(x => x.sourceId === 'bard-lv2')
      expect(f).toBeDefined()
      expect(f?.count).toBe(2)
      expect(f?.className).toBe('bard')
      expect(f?.level).toBe(2)
    })

    it('incluye Bard lv.10 (2 skills)', () => {
      const f = EXPERTISE_FEATURES.find(x => x.sourceId === 'bard-lv10')
      expect(f).toBeDefined()
      expect(f?.count).toBe(2)
      expect(f?.level).toBe(10)
    })
  })

  describe('getActiveExpertiseFeatures', () => {
    it('Bard lv.1 → ninguna', () => {
      const store = useCharacterStore()
      store.character.className = 'bard'
      store.character.level = 1
      expect(getActiveExpertiseFeatures(store.character)).toEqual([])
    })

    it('Bard lv.2 → solo bard-lv2', () => {
      const store = useCharacterStore()
      store.character.className = 'bard'
      store.character.level = 2
      const active = getActiveExpertiseFeatures(store.character)
      expect(active.length).toBe(1)
      expect(active[0]?.sourceId).toBe('bard-lv2')
    })

    it('Bard lv.10 → bard-lv2 y bard-lv10', () => {
      const store = useCharacterStore()
      store.character.className = 'bard'
      store.character.level = 10
      const active = getActiveExpertiseFeatures(store.character)
      expect(active.length).toBe(2)
      expect(active.map(f => f.sourceId).sort()).toEqual(['bard-lv10', 'bard-lv2'])
    })

    it('Otras clases (Fighter, Cleric, Druid...) → ninguna', () => {
      const store = useCharacterStore()
      for (const cls of ['fighter', 'cleric', 'druid'] as const) {
        store.character.className = cls
        store.character.level = 20
        expect(getActiveExpertiseFeatures(store.character), cls).toEqual([])
      }
    })

    it('Rogue lv.1 → rogue-lv1 (Expertise activa desde nivel 1)', () => {
      const store = useCharacterStore()
      store.character.className = 'rogue'
      store.character.level = 1
      const active = getActiveExpertiseFeatures(store.character)
      expect(active.length).toBe(1)
      expect(active[0]?.sourceId).toBe('rogue-lv1')
    })

    it('Rogue lv.6 → rogue-lv1 y rogue-lv6', () => {
      const store = useCharacterStore()
      store.character.className = 'rogue'
      store.character.level = 6
      const active = getActiveExpertiseFeatures(store.character)
      expect(active.length).toBe(2)
      expect(active.map(f => f.sourceId).sort()).toEqual(['rogue-lv1', 'rogue-lv6'])
    })

    it('Rogue lv.5 → solo rogue-lv1 (lv.6 aún no)', () => {
      const store = useCharacterStore()
      store.character.className = 'rogue'
      store.character.level = 5
      const active = getActiveExpertiseFeatures(store.character)
      expect(active.length).toBe(1)
      expect(active[0]?.sourceId).toBe('rogue-lv1')
    })

    it('Wizard lv.2 → wizard-scholar', () => {
      const store = useCharacterStore()
      store.character.className = 'wizard'
      store.character.level = 2
      const active = getActiveExpertiseFeatures(store.character)
      expect(active.length).toBe(1)
      expect(active[0]?.sourceId).toBe('wizard-scholar')
    })

    it('Wizard lv.1 → ninguna (Scholar es lv.2)', () => {
      const store = useCharacterStore()
      store.character.className = 'wizard'
      store.character.level = 1
      expect(getActiveExpertiseFeatures(store.character)).toEqual([])
    })
  })

  describe('Wizard Scholar — grantsProficiency', () => {
    it('Selección añade skill a skillProficiencies', () => {
      const store = useCharacterStore()
      store.character.className = 'wizard'
      store.character.level = 2
      store.character.skillProficiencies = []
      setExpertiseChoice(store.character, 'wizard-scholar', ['arcana'])
      expect(store.character.skillProficiencies).toContain('arcana')
      expect(store.character.skillExpertise).toContain('arcana')
    })

    it('Skills disponibles son solo las que define skillOptions', () => {
      // Comprobamos vía el catálogo: Scholar tiene 5 opciones específicas
      const scholar = EXPERTISE_FEATURES.find(f => f.sourceId === 'wizard-scholar')
      expect(scholar?.skillOptions).toEqual([
        'arcana', 'history', 'investigation', 'nature', 'religion',
      ])
    })

    it('Deselección quita la skill de proficiencies si no estaba en bg/clase', () => {
      const store = useCharacterStore()
      store.character.className = 'wizard'
      store.character.level = 2
      store.character.skillProficiencies = []
      store.character.backgroundSkillProficiencies = []
      store.character.classSkillProficiencies = []

      setExpertiseChoice(store.character, 'wizard-scholar', ['arcana'])
      expect(store.character.skillProficiencies).toContain('arcana')

      // Cambio a otra skill — arcana debe desaparecer de proficiencies
      setExpertiseChoice(store.character, 'wizard-scholar', ['history'])
      expect(store.character.skillProficiencies).not.toContain('arcana')
      expect(store.character.skillProficiencies).toContain('history')
    })

    it('Skill ya en bg/clase NO se quita al deseleccionar de Scholar', () => {
      const store = useCharacterStore()
      store.character.className = 'wizard'
      store.character.level = 2
      // Arcana viene del background, no de Scholar
      store.character.backgroundSkillProficiencies = ['arcana']
      store.character.skillProficiencies = ['arcana']

      setExpertiseChoice(store.character, 'wizard-scholar', ['arcana'])
      expect(store.character.skillProficiencies).toContain('arcana')

      // Cambio Scholar a history — arcana sigue (viene del bg)
      setExpertiseChoice(store.character, 'wizard-scholar', ['history'])
      expect(store.character.skillProficiencies).toContain('arcana')
      expect(store.character.skillProficiencies).toContain('history')
    })
  })

  describe('setExpertiseChoice', () => {
    it('guarda las skills elegidas para una fuente', () => {
      const store = useCharacterStore()
      setExpertiseChoice(store.character, 'bard-lv2', ['persuasion', 'deception'])
      expect(store.character.expertiseSources?.['bard-lv2']).toEqual([
        'persuasion', 'deception',
      ])
    })

    it('quita duplicados en la entrada', () => {
      const store = useCharacterStore()
      setExpertiseChoice(store.character, 'bard-lv2', ['persuasion', 'persuasion', 'deception'])
      expect(store.character.expertiseSources?.['bard-lv2']).toEqual([
        'persuasion', 'deception',
      ])
    })

    it('descarta skills ya elegidas en otra fuente (PHB 2024: distintas a las anteriores)', () => {
      const store = useCharacterStore()
      setExpertiseChoice(store.character, 'bard-lv2', ['persuasion', 'deception'])
      // Intento elegir persuasion también en lv.10 — debe descartarse
      setExpertiseChoice(store.character, 'bard-lv10', ['persuasion', 'performance'])
      expect(store.character.expertiseSources?.['bard-lv10']).toEqual(['performance'])
    })

    it('reconstruye skillExpertise como unión de todas las fuentes', () => {
      const store = useCharacterStore()
      setExpertiseChoice(store.character, 'bard-lv2', ['persuasion', 'deception'])
      setExpertiseChoice(store.character, 'bard-lv10', ['performance', 'stealth'])
      expect(store.character.skillExpertise.sort()).toEqual(
        ['deception', 'performance', 'persuasion', 'stealth'].sort()
      )
    })

    it('al cambiar la elección, skillExpertise se actualiza', () => {
      const store = useCharacterStore()
      setExpertiseChoice(store.character, 'bard-lv2', ['persuasion', 'deception'])
      expect(store.character.skillExpertise).toContain('persuasion')

      setExpertiseChoice(store.character, 'bard-lv2', ['athletics'])
      expect(store.character.skillExpertise).not.toContain('persuasion')
      expect(store.character.skillExpertise).toContain('athletics')
    })
  })

  describe('getSkillsBlockedByOtherExpertise', () => {
    it('skills de OTRAS fuentes están bloqueadas, no las propias', () => {
      const store = useCharacterStore()
      setExpertiseChoice(store.character, 'bard-lv2', ['persuasion', 'deception'])
      setExpertiseChoice(store.character, 'bard-lv10', ['performance'])

      // Cuando reasigno bard-lv2, sus propias skills no están bloqueadas
      const blockedForLv2 = getSkillsBlockedByOtherExpertise(store.character, 'bard-lv2')
      expect(blockedForLv2.has('persuasion')).toBe(false)  // mía
      expect(blockedForLv2.has('performance')).toBe(true)  // de lv10

      // Para bard-lv10 al revés
      const blockedForLv10 = getSkillsBlockedByOtherExpertise(store.character, 'bard-lv10')
      expect(blockedForLv10.has('persuasion')).toBe(true)  // de lv2
      expect(blockedForLv10.has('performance')).toBe(false)  // mía
    })
  })

  describe('rebuildSkillExpertise (operación pura)', () => {
    it('sin sources → array vacío', () => {
      const store = useCharacterStore()
      store.character.skillExpertise = ['stale-data']
      rebuildSkillExpertise(store.character)
      expect(store.character.skillExpertise).toEqual([])
    })

    it('múltiples sources sin duplicados', () => {
      const store = useCharacterStore()
      store.character.expertiseSources = {
        'bard-lv2': ['persuasion', 'deception'],
        'bard-lv10': ['performance'],
      }
      rebuildSkillExpertise(store.character)
      expect(store.character.skillExpertise.sort()).toEqual(
        ['deception', 'performance', 'persuasion']
      )
    })
  })
})
