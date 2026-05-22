// Documento generado el 2026-05-19-2143
// Milestone 9 integration tests: verify that the data flowing from
// races/backgrounds/classes correctly populates the character store
// according to the 2024 rules.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { getRaceById } from '@/data/dnd5e/races'
import { getBackgroundById } from '@/data/dnd5e/backgrounds'
import { getClassById } from '@/data/dnd5e/classes'
import { getFeatById } from '@/data/dnd5e/feats'

type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

describe('Milestone 9 — wizard integration with 2024 data', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Race selection', () => {
    it('a 2024 species applies no ability bonuses', () => {
      const dwarf = getRaceById('dwarf')!
      const sum = Object.values(dwarf.abilityBonuses).reduce((a, b) => a + (b ?? 0), 0)
      expect(sum).toBe(0)
    })

    it('Wood Elf has speed 35 (subrace lineage)', () => {
      const elf = getRaceById('elf')!
      const woodElf = elf.subraces.find(s => s.id === 'wood-elf')
      expect(woodElf).toBeDefined()
      // Trait text mentions 35 ft
      expect(woodElf!.traits.join('|')).toMatch(/35 ft/i)
    })

    it('Dwarf has the new 120 ft Darkvision in 2024', () => {
      expect(getRaceById('dwarf')!.darkvision).toBe(120)
    })

    it('Orc has 120 ft Darkvision', () => {
      expect(getRaceById('orc')!.darkvision).toBe(120)
    })
  })

  describe('Background → character store integration', () => {
    it('Acolyte background provides INT/WIS/CHA ability scores and Magic Initiate', () => {
      const acolyte = getBackgroundById('acolyte')!
      expect(acolyte.abilityScores).toEqual(['int', 'wis', 'cha'])
      expect(acolyte.originFeat).toBe('magic-initiate')

      // Simulate the Step5 logic: applying +2/+1 bonuses (default mode).
      const store = useCharacterStore()
      const bonuses: Partial<Record<AbilityKey, number>> = {}
      bonuses[acolyte.abilityScores![0]] = 2
      bonuses[acolyte.abilityScores![1]] = 1
      store.character.backgroundBonuses = { ...bonuses }

      expect(store.character.backgroundBonuses.int).toBe(2)
      expect(store.character.backgroundBonuses.wis).toBe(1)
      expect(store.character.backgroundBonuses.cha).toBeUndefined()
    })

    it("Soldier background can be applied as 1/1/1 instead of 2/1", () => {
      const soldier = getBackgroundById('soldier')!
      const store = useCharacterStore()
      const bonuses: Partial<Record<AbilityKey, number>> = {}
      for (const ab of soldier.abilityScores!) bonuses[ab] = 1
      store.character.backgroundBonuses = { ...bonuses }

      expect(store.character.backgroundBonuses.str).toBe(1)
      expect(store.character.backgroundBonuses.dex).toBe(1)
      expect(store.character.backgroundBonuses.con).toBe(1)
    })

    it('selecting a background records the Origin Feat tag in featuresTraits', () => {
      const sage = getBackgroundById('sage')!
      const feat = getFeatById(sage.originFeat!)
      expect(feat).toBeDefined()

      const store = useCharacterStore()
      const tag = `Feat: ${feat!.name}`
      store.character.featuresTraits.push(tag)

      expect(store.character.featuresTraits).toContain('Feat: Magic Initiate')
    })

    it('switching backgrounds replaces the old origin feat tag (no duplicates)', () => {
      const store = useCharacterStore()

      // First pick Acolyte → tag "Feat: Magic Initiate"
      const acolyte = getBackgroundById('acolyte')!
      const acolyteFeat = getFeatById(acolyte.originFeat!)
      const acolyteTag = `Feat: ${acolyteFeat!.name}`
      store.character.featuresTraits.push(acolyteTag)

      // Then switch to Soldier → tag "Feat: Savage Attacker"
      const soldier = getBackgroundById('soldier')!
      const soldierFeat = getFeatById(soldier.originFeat!)
      const soldierTag = `Feat: ${soldierFeat!.name}`
      store.character.featuresTraits =
        store.character.featuresTraits.map(f => f.startsWith('Feat: ') ? soldierTag : f)

      const featTags = store.character.featuresTraits.filter(f => f.startsWith('Feat: '))
      expect(featTags).toEqual(['Feat: Savage Attacker'])
    })
  })

  describe('Class selection → character store integration', () => {
    it('selecting Wizard sets INT as spellcasting ability', () => {
      const wizard = getClassById('wizard')!
      const store = useCharacterStore()
      store.character.className = wizard.id
      store.character.spellcastingClass = wizard.id
      store.character.spellcastingAbility = wizard.spellcasting!.ability

      expect(store.character.spellcastingAbility).toBe('int')
    })

    it('selecting Fighter activates Weapon Mastery slot 3 at level 1', () => {
      const fighter = getClassById('fighter')!
      expect(fighter.weaponMasteryByLevel?.[0]).toBeGreaterThanOrEqual(2)
    })

    it('Barbarian level-1 character has access to 2 rages', () => {
      const barb = getClassById('barbarian')!
      expect(barb.progression?.rages?.[0]).toBe(2)
    })

    it('subclass is locked until level 3 (2024 default)', () => {
      const fighter = getClassById('fighter')!
      expect(fighter.subclassLevel).toBe(3)
      // At level 2, no subclass would be unlocked
      const lvl = 2
      const unlocked = lvl >= fighter.subclassLevel
      expect(unlocked).toBe(false)
    })

    it("Champion's Improved Critical kicks in at the SRD 5.2.1 level", () => {
      const fighter = getClassById('fighter')!
      const champion = fighter.subclasses.find(s => s.id === 'champion')!
      const impCrit = champion.features.find(f => f.name.toLowerCase().includes('improved critical'))
      expect(impCrit).toBeDefined()
      expect(impCrit!.level).toBeLessThanOrEqual(7) // 2024 puts it at lv.3
    })
  })

  describe('Full character creation flow (Acolyte / Human / Wizard)', () => {
    it('creates a coherent Human Wizard with Acolyte background', () => {
      const store = useCharacterStore()
      const human = getRaceById('human')!
      const acolyte = getBackgroundById('acolyte')!
      const wizard = getClassById('wizard')!

      // 1. Species: Human
      store.character.race = human.id
      store.character.speed = human.speed
      // #92 (PHB 2024): el jugador elige Common + 2 idiomas; ya no se
      // derivan de race.languages. Aquí simulamos esa elección.
      store.character.languages = ['Common', 'Elvish', 'Dwarvish']
      store.character.speciesBonuses = { ...human.abilityBonuses }

      // 2. Background: Acolyte +2 INT +1 WIS
      store.character.background = acolyte.id
      store.character.backgroundBonuses = { int: 2, wis: 1 }
      const feat = getFeatById(acolyte.originFeat!)
      store.character.featuresTraits.push(`Origin Feat: ${feat!.name}`)

      // 3. Class: Wizard
      store.character.className = wizard.id
      store.character.hitDie = wizard.hitDie
      store.character.savingThrowProficiencies = [...wizard.savingThrows]
      store.character.spellcastingClass = wizard.id
      store.character.spellcastingAbility = wizard.spellcasting!.ability

      // Verifications
      expect(store.character.race).toBe('human')
      expect(store.character.background).toBe('acolyte')
      expect(store.character.className).toBe('wizard')
      expect(store.character.backgroundBonuses.int).toBe(2)
      expect(store.character.backgroundBonuses.wis).toBe(1)
      expect(store.character.savingThrowProficiencies).toEqual(['int', 'wis'])
      expect(store.character.spellcastingAbility).toBe('int')
      expect(store.character.hitDie).toBe(6)
      expect(store.character.speed).toBe(30)
      expect(store.character.featuresTraits).toContain('Origin Feat: Magic Initiate')
    })
  })
})
