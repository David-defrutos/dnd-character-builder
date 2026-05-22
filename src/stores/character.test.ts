import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from './character'
import type { CharacterData } from './character'
import { preloadVariantData } from '@/data'

function makeMinimalCharacter(overrides: Partial<CharacterData> = {}): Partial<CharacterData> {
  return {
    variant: 'dnd5e',
    race: 'human',
    className: 'fighter',
    level: 1,
    abilityScores: { str: 16, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
    ...overrides,
  }
}

describe('useCharacterStore', () => {
  // Preload data for tests that use getClasses/getMaxLevel
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initialization', () => {
    it('starts with an empty character', () => {
      const store = useCharacterStore()
      expect(store.character.variant).toBe('dnd5e')
      expect(store.character.name).toBe('')
      expect(store.character.level).toBe(1)
      expect(store.character.abilityScores.str).toBe(10)
    })

    it('starts with empty saved characters', () => {
      const store = useCharacterStore()
      expect(store.savedCharacters).toEqual([])
    })
  })

  describe('resetCharacter', () => {
    it('resets to default values with new id', () => {
      const store = useCharacterStore()
      const oldId = store.character.id
      store.character.name = 'Test'
      store.character.level = 5
      store.resetCharacter()
      expect(store.character.name).toBe('')
      expect(store.character.level).toBe(1)
      expect(store.character.id).not.toBe(oldId)
    })
  })

  describe('computed properties', () => {
    it('calculates ability modifiers correctly', () => {
      const store = useCharacterStore()
      store.character.abilityScores = { str: 16, dex: 14, con: 13, int: 10, wis: 12, cha: 8 }
      expect(store.abilityModifiers.str).toBe(3)
      expect(store.abilityModifiers.dex).toBe(2)
      expect(store.abilityModifiers.con).toBe(1)
      expect(store.abilityModifiers.int).toBe(0)
      expect(store.abilityModifiers.wis).toBe(1)
      expect(store.abilityModifiers.cha).toBe(-1)
    })

    it('includes species bonuses in ability modifiers', () => {
      const store = useCharacterStore()
      store.character.abilityScores.str = 14 // mod +2
      store.character.speciesBonuses = { str: 2 } // total 16, mod +3
      expect(store.abilityModifiers.str).toBe(3)
    })

    it('calculates proficiency bonus by level', () => {
      const store = useCharacterStore()
      store.character.level = 1
      expect(store.profBonus).toBe(2)
      store.character.level = 5
      expect(store.profBonus).toBe(3)
      store.character.level = 9
      expect(store.profBonus).toBe(4)
      store.character.level = 17
      expect(store.profBonus).toBe(6)
    })

    it('calculates armor class (10 + DEX mod)', () => {
      const store = useCharacterStore()
      store.character.abilityScores.dex = 16 // mod +3
      expect(store.armorClass).toBe(13)
    })

    it('calculates initiative from DEX mod', () => {
      const store = useCharacterStore()
      store.character.abilityScores.dex = 14
      expect(store.initiative).toBe(2)
    })

    it('calculates passive perception', () => {
      const store = useCharacterStore()
      store.character.abilityScores.wis = 14 // mod +2
      store.character.level = 1 // prof +2
      expect(store.passivePerception).toBe(12) // 10 + 2

      store.character.skillProficiencies = ['perception']
      expect(store.passivePerception).toBe(14) // 10 + 2 + 2
    })
  })

  describe('save/load/delete', () => {
    it('saves and loads a character', () => {
      const store = useCharacterStore()
      store.character.name = 'Gandalf'
      store.character.race = 'human'
      store.character.className = 'wizard'
      store.saveCharacter()

      expect(store.savedCharacters).toHaveLength(1)
      expect(store.savedCharacters[0]!.name).toBe('Gandalf')

      // Load into a fresh character
      store.resetCharacter()
      expect(store.character.name).toBe('')
      store.loadCharacter(store.savedCharacters[0]!.id)
      expect(store.character.name).toBe('Gandalf')
    })

    it('updates existing character on save', () => {
      const store = useCharacterStore()
      store.character.name = 'Gandalf'
      store.saveCharacter()
      expect(store.savedCharacters).toHaveLength(1)

      store.character.name = 'Gandalf the White'
      store.saveCharacter()
      expect(store.savedCharacters).toHaveLength(1)
      expect(store.savedCharacters[0]!.name).toBe('Gandalf the White')
    })

    it('deletes a character', () => {
      const store = useCharacterStore()
      store.character.name = 'ToDelete'
      store.saveCharacter()
      const id = store.savedCharacters[0]!.id
      expect(store.savedCharacters).toHaveLength(1)

      store.deleteCharacter(id)
      expect(store.savedCharacters).toHaveLength(0)
    })

    it('does nothing when loading non-existent id', () => {
      const store = useCharacterStore()
      store.character.name = 'Original'
      store.loadCharacter('non-existent-id')
      expect(store.character.name).toBe('Original')
    })
  })

  describe('exportJson / importJson', () => {
    it('exports valid JSON', () => {
      const store = useCharacterStore()
      store.character.name = 'Test'
      const json = store.exportJson()
      const parsed = JSON.parse(json)
      expect(parsed.name).toBe('Test')
      expect(parsed.variant).toBe('dnd5e')
    })

    it('imports valid character JSON', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({ name: 'Imported' }))
      const { data, warnings } = store.importJson(json)
      expect(data.name).toBe('Imported')
      expect(data.variant).toBe('dnd5e')
      expect(data.race).toBe('human')
      expect(warnings).toContain('WARN_NO_HP')
    })

    it('rejects invalid JSON string', () => {
      const store = useCharacterStore()
      expect(() => store.importJson('not json')).toThrow('JSON_PARSE_ERROR')
    })

    it('rejects non-object JSON', () => {
      const store = useCharacterStore()
      expect(() => store.importJson('"hello"')).toThrow('JSON_NOT_OBJECT')
      expect(() => store.importJson('[1,2]')).toThrow('JSON_NOT_OBJECT')
    })

    it('rejects missing variant', () => {
      const store = useCharacterStore()
      const json = JSON.stringify({ race: 'human', className: 'fighter', level: 1, abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } })
      expect(() => store.importJson(json)).toThrow('VALIDATION:MISSING_VARIANT')
    })

    it('rejects missing race', () => {
      const store = useCharacterStore()
      const json = JSON.stringify({ variant: 'dnd5e', className: 'fighter', level: 1, abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } })
      expect(() => store.importJson(json)).toThrow('MISSING_RACE')
    })

    it('rejects missing className', () => {
      const store = useCharacterStore()
      const json = JSON.stringify({ variant: 'dnd5e', race: 'human', level: 1, abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } })
      expect(() => store.importJson(json)).toThrow('MISSING_CLASSNAME')
    })

    it('rejects invalid level', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({ level: 0 }))
      expect(() => store.importJson(json)).toThrow('INVALID_LEVEL')
    })

    it('rejects invalid ability scores', () => {
      const store = useCharacterStore()
      const json = JSON.stringify({
        ...makeMinimalCharacter(),
        abilityScores: { str: 0, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      })
      expect(() => store.importJson(json)).toThrow('INVALID_ABILITY_SCORES')
    })

    it('warns about missing name and background', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter())
      const { warnings } = store.importJson(json)
      expect(warnings).toContain('WARN_NO_NAME')
      expect(warnings).toContain('WARN_NO_BACKGROUND')
    })

    it('truncates long strings', () => {
      const store = useCharacterStore()
      const longStr = 'x'.repeat(6000)
      const json = JSON.stringify(makeMinimalCharacter({ name: longStr }))
      const { data } = store.importJson(json)
      expect(data.name.length).toBe(5000)
    })

    it('filters invalid array items', () => {
      const store = useCharacterStore()
      const json = JSON.stringify({
        ...makeMinimalCharacter(),
        skillProficiencies: ['athletics', 42, null, 'perception'],
      })
      const { data } = store.importJson(json)
      expect(data.skillProficiencies).toEqual(['athletics', 'perception'])
    })

    it('strips unknown properties (whitelist)', () => {
      const store = useCharacterStore()
      const json = JSON.stringify({
        ...makeMinimalCharacter(),
        maliciousField: '<script>alert(1)</script>',
      })
      const { data } = store.importJson(json)
      expect((data as any).maliciousField).toBeUndefined()
    })

    it('accepts dnd5e variant', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({ variant: 'dnd5e' }))
      const { data } = store.importJson(json)
      expect(data.variant).toBe('dnd5e')
    })
  })

  describe('multiclass', () => {
    it('isMulticlass is false for single class', () => {
      const store = useCharacterStore()
      expect(store.isMulticlass).toBe(false)
    })

    it('does not add same class twice', () => {
      const store = useCharacterStore()
      store.character.variant = 'dnd5e'
      store.character.className = 'fighter'
      store.addMulticlass('wizard')
      store.addMulticlass('wizard') // duplicate
      expect(store.character.classes).toHaveLength(2)
    })

    it('does not add the same class twice', () => {
      const store = useCharacterStore()
      store.character.variant = 'dnd5e'
      store.character.className = 'fighter'
      store.character.hitDie = 10
      store.character.level = 3
      store.addMulticlass('fighter') // same class
      // classes should have just the primary class entry
      expect(store.character.classes).toHaveLength(1)
    })
  })

  // ─── #82 — importJson preserva inventory y campos opcionales ────────────
  describe('#82 — importJson restaura inventory y feats acumulados', () => {
    it('importa el inventory[] del JSON', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({
        inventory: [
          { slotId: 'a', kind: 'magic', itemId: 'winged-boots', name: 'Winged Boots', qty: 1, attuned: false },
          { slotId: 'b', kind: 'weapon', itemId: 'Rapier', name: 'Rapier', qty: 1 },
          { slotId: 'c', kind: 'custom', itemId: '', name: 'Holy Water', qty: 2, notes: '25 GP each' },
        ],
      }))
      const { data } = store.importJson(json)
      expect(data.inventory).toHaveLength(3)
      expect(data.inventory![0]!.name).toBe('Winged Boots')
      expect(data.inventory![0]!.attuned).toBe(false)
      expect(data.inventory![2]!.notes).toBe('25 GP each')
      expect(data.inventory![2]!.qty).toBe(2)
    })

    it('regenera slotId si falta', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({
        inventory: [
          // @ts-expect-error — falta slotId a propósito
          { kind: 'custom', itemId: '', name: 'Mystery Item', qty: 1 },
        ],
      }))
      const { data } = store.importJson(json)
      expect(data.inventory).toHaveLength(1)
      expect(data.inventory![0]!.slotId.length).toBeGreaterThan(0)
    })

    it('descarta items con shape inválido (sin name, kind desconocido)', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({
        inventory: [
          { slotId: 'a', kind: 'magic', itemId: 'x', name: 'Valid', qty: 1 },
          { slotId: 'b', kind: 'nonsense', itemId: 'x', name: 'Bad kind', qty: 1 },
          { slotId: 'c', kind: 'magic', itemId: 'x', qty: 1 },
        ] as any,
      }))
      const { data } = store.importJson(json)
      expect(data.inventory).toHaveLength(1)
      expect(data.inventory![0]!.name).toBe('Valid')
    })

    it('preserva originFeatId', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({
        originFeatId: 'alert',
      }))
      const { data } = store.importJson(json)
      expect(data.originFeatId).toBe('alert')
    })

    it('preserva featAddedSavingThrows (de Resilient feat)', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({
        featAddedSavingThrows: ['wis'],
      }))
      const { data } = store.importJson(json)
      expect(data.featAddedSavingThrows).toEqual(['wis'])
    })

    it('preserva magicInitiateChoices (#74)', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({
        magicInitiateChoices: [
          { source: 'origin', spellList: 'wizard', cantrips: ['fire-bolt', 'mage-hand'], levelOneSpell: '1-shield' },
        ],
      }))
      const { data } = store.importJson(json)
      expect(data.magicInitiateChoices).toHaveLength(1)
      expect(data.magicInitiateChoices![0]!.spellList).toBe('wizard')
    })

    it('preserva todos los flags de feats acumulados (Cecino-like)', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({
        toughHpBonus: 20,
        featSpeedBonus: 10,
        featInitiativeProf: true,
        featDefenseACBonus: true,
        featAddedProficiencies: ['Heavy armor'],
        featAddedSkillProficiencies: ['perception'],
        featAddedExpertise: ['stealth'],
      }))
      const { data } = store.importJson(json)
      expect(data.toughHpBonus).toBe(20)
      expect(data.featSpeedBonus).toBe(10)
      expect(data.featInitiativeProf).toBe(true)
      expect(data.featDefenseACBonus).toBe(true)
      expect(data.featAddedProficiencies).toEqual(['Heavy armor'])
      expect(data.featAddedSkillProficiencies).toEqual(['perception'])
      expect(data.featAddedExpertise).toEqual(['stealth'])
    })

    it('inventory vacío o ausente no causa errores', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({})) // sin inventory
      const { data } = store.importJson(json)
      expect(data.inventory).toBeUndefined()
    })

    it('inventory como array vacío se preserva', () => {
      const store = useCharacterStore()
      const json = JSON.stringify(makeMinimalCharacter({ inventory: [] }))
      const { data } = store.importJson(json)
      expect(data.inventory).toEqual([])
    })
  })
})
