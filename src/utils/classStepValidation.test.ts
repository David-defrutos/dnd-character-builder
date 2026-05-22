// Tests para #93: la validación de Step 2 (Class) bloquea el avance si
// faltan elecciones obligatorias de clase: skills, Fighting Style, Expertise.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { preloadVariantData } from '@/data'
import { getClassById } from '@/data/dnd5e/classes'
import { hasFightingStyleFeature } from './fightingStyle'
import { hasMartialCasterAlt } from './martialCasterAlt'
import { getActiveExpertiseFeatures, setExpertiseChoice } from './expertiseFeatures'

/** Replica la lógica de classStepValidationError() en BuilderView.vue.
 *  Devuelve un identificador de error o null si todo OK. */
function classStepValidationError(char: ReturnType<typeof useCharacterStore>['character']): string | null {
  if (!char.className) return 'selectClass'

  const cls = getClassById(char.className)
  if (!cls) return null

  const classSkillsCount = (char.classSkillProficiencies ?? []).length
  if (classSkillsCount < cls.numSkillChoices) return 'missingClassSkills'

  if (hasFightingStyleFeature(char)) {
    if (!char.fightingStyleFeat && !hasMartialCasterAlt(char)) {
      return 'missingFightingStyle'
    }
  }

  const expertiseFeatures = getActiveExpertiseFeatures(char)
  for (const feat of expertiseFeatures) {
    const chosen = (char.expertiseSources?.[feat.sourceId] ?? []).length
    if (chosen < feat.count) return 'missingExpertise'
  }

  return null
}

describe('#93 — validación Step 2 (Class) bloquea avance', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Class skills', () => {
    it('Fighter sin clase elegida → selectClass', () => {
      const store = useCharacterStore()
      expect(classStepValidationError(store.character)).toBe('selectClass')
    })

    it('Fighter con 0 class skills → missingClassSkills (Fighter requiere 2)', () => {
      const store = useCharacterStore()
      store.character.className = 'fighter'
      store.character.level = 1
      store.character.classSkillProficiencies = []
      expect(classStepValidationError(store.character)).toBe('missingClassSkills')
    })

    it('Fighter con 1 class skill → missingClassSkills', () => {
      const store = useCharacterStore()
      store.character.className = 'fighter'
      store.character.level = 1
      store.character.classSkillProficiencies = ['athletics']
      store.character.fightingStyleFeat = 'defense'
      expect(classStepValidationError(store.character)).toBe('missingClassSkills')
    })

    it('Fighter con 2 class skills + Fighting Style → OK', () => {
      const store = useCharacterStore()
      store.character.className = 'fighter'
      store.character.level = 1
      store.character.classSkillProficiencies = ['athletics', 'perception']
      store.character.fightingStyleFeat = 'defense'
      expect(classStepValidationError(store.character)).toBeNull()
    })

    it('Reproduce el JSON de Cecino: Fighter lv.2, bg Guide, classSkills=[] → bloqueado', () => {
      const store = useCharacterStore()
      store.character.className = 'fighter'
      store.character.level = 2
      store.character.backgroundSkillProficiencies = ['stealth', 'survival']
      store.character.classSkillProficiencies = []
      store.character.fightingStyleFeat = 'archery'
      expect(classStepValidationError(store.character)).toBe('missingClassSkills')
    })

    it('Cecino con sus 2 class skills añadidas → OK', () => {
      const store = useCharacterStore()
      store.character.className = 'fighter'
      store.character.level = 2
      store.character.backgroundSkillProficiencies = ['stealth', 'survival']
      store.character.classSkillProficiencies = ['athletics', 'perception']
      store.character.fightingStyleFeat = 'archery'
      expect(classStepValidationError(store.character)).toBeNull()
    })
  })

  describe('Fighting Style', () => {
    it('Fighter lv.1 con skills pero sin Fighting Style → missingFightingStyle', () => {
      const store = useCharacterStore()
      store.character.className = 'fighter'
      store.character.level = 1
      store.character.classSkillProficiencies = ['athletics', 'perception']
      // sin fightingStyleFeat
      expect(classStepValidationError(store.character)).toBe('missingFightingStyle')
    })

    it('Paladin lv.1 (sin feature aún) sin Fighting Style → OK si tiene skills', () => {
      const store = useCharacterStore()
      store.character.className = 'paladin'
      store.character.level = 1
      store.character.classSkillProficiencies = ['athletics', 'persuasion']
      expect(classStepValidationError(store.character)).toBeNull()
    })

    it('Paladin lv.2 sin Fighting Style → missingFightingStyle', () => {
      const store = useCharacterStore()
      store.character.className = 'paladin'
      store.character.level = 2
      store.character.classSkillProficiencies = ['athletics', 'persuasion']
      expect(classStepValidationError(store.character)).toBe('missingFightingStyle')
    })

    it('Paladin lv.2 con Blessed Warrior (Alt) → OK', () => {
      const store = useCharacterStore()
      store.character.className = 'paladin'
      store.character.level = 2
      store.character.classSkillProficiencies = ['athletics', 'persuasion']
      store.character.martialCasterAlt = {
        source: 'paladin-blessed',
        cantrips: ['guidance', 'sacred-flame'],
      }
      expect(classStepValidationError(store.character)).toBeNull()
    })

    it('Ranger lv.2 sin Fighting Style → missingFightingStyle', () => {
      const store = useCharacterStore()
      store.character.className = 'ranger'
      store.character.level = 2
      store.character.classSkillProficiencies = ['athletics', 'perception', 'stealth']
      expect(classStepValidationError(store.character)).toBe('missingFightingStyle')
    })

    it('Wizard lv.5 sin Fighting Style → OK (Wizard no tiene la feature)', () => {
      const store = useCharacterStore()
      store.character.className = 'wizard'
      store.character.level = 5
      store.character.classSkillProficiencies = ['arcana', 'history']
      // Wizard lv.2+ tiene Scholar (Expertise), pero esto va por separado
      setExpertiseChoice(store.character, 'wizard-scholar', ['investigation'])
      expect(classStepValidationError(store.character)).toBeNull()
    })
  })

  describe('Expertise', () => {
    it('Bard lv.2 sin Expertise elegida → missingExpertise', () => {
      const store = useCharacterStore()
      store.character.className = 'bard'
      store.character.level = 2
      store.character.classSkillProficiencies = ['persuasion', 'deception', 'performance']
      // sin expertiseSources
      expect(classStepValidationError(store.character)).toBe('missingExpertise')
    })

    it('Bard lv.2 con 2 Expertise → OK', () => {
      const store = useCharacterStore()
      store.character.className = 'bard'
      store.character.level = 2
      store.character.classSkillProficiencies = ['persuasion', 'deception', 'performance']
      store.character.skillProficiencies = ['persuasion', 'deception', 'performance']
      setExpertiseChoice(store.character, 'bard-lv2', ['persuasion', 'deception'])
      expect(classStepValidationError(store.character)).toBeNull()
    })

    it('Bard lv.10 con solo bard-lv2 completo → missingExpertise (falta bard-lv10)', () => {
      const store = useCharacterStore()
      store.character.className = 'bard'
      store.character.level = 10
      store.character.classSkillProficiencies = ['persuasion', 'deception', 'performance']
      store.character.skillProficiencies = ['persuasion', 'deception', 'performance', 'stealth', 'insight']
      setExpertiseChoice(store.character, 'bard-lv2', ['persuasion', 'deception'])
      // bard-lv10 sin elegir
      expect(classStepValidationError(store.character)).toBe('missingExpertise')
    })

    it('Rogue lv.1 sin Expertise → missingExpertise', () => {
      const store = useCharacterStore()
      store.character.className = 'rogue'
      store.character.level = 1
      store.character.classSkillProficiencies = ['stealth', 'sleight-of-hand', 'perception', 'acrobatics']
      expect(classStepValidationError(store.character)).toBe('missingExpertise')
    })

    it('Wizard lv.2 sin Scholar → missingExpertise', () => {
      const store = useCharacterStore()
      store.character.className = 'wizard'
      store.character.level = 2
      store.character.classSkillProficiencies = ['arcana', 'history']
      expect(classStepValidationError(store.character)).toBe('missingExpertise')
    })

    it('Wizard lv.2 con Scholar → OK', () => {
      const store = useCharacterStore()
      store.character.className = 'wizard'
      store.character.level = 2
      store.character.classSkillProficiencies = ['arcana', 'history']
      store.character.skillProficiencies = ['arcana', 'history']
      setExpertiseChoice(store.character, 'wizard-scholar', ['investigation'])
      expect(classStepValidationError(store.character)).toBeNull()
    })
  })

  describe('Orden de fallos', () => {
    it('Si faltan varios, missingClassSkills tiene prioridad sobre missingFightingStyle', () => {
      const store = useCharacterStore()
      store.character.className = 'fighter'
      store.character.level = 1
      store.character.classSkillProficiencies = []  // falta
      // sin fightingStyleFeat tampoco
      expect(classStepValidationError(store.character)).toBe('missingClassSkills')
    })

    it('Class skills completas pero Fighting Style falta → missingFightingStyle', () => {
      const store = useCharacterStore()
      store.character.className = 'fighter'
      store.character.level = 1
      store.character.classSkillProficiencies = ['athletics', 'perception']
      expect(classStepValidationError(store.character)).toBe('missingFightingStyle')
    })
  })
})
