// Documento generado el 2026-05-20-1940 — milestone 21 (#52 auditoría feats)
//
// Implementa los efectos mecánicos automatizables de varios feats que antes
// solo aparecían como texto descriptivo:
//   - Alert     → PB añadido al Initiative
//   - Speedy    → +10 ft a la velocidad
//   - Defense   → +1 AC mientras lleves armadura
//   - Archery   → +2 ataque con armas ranged
//   - Dueling   → +2 damage con melee de una mano sin otra arma
//
// Otros feats quedan apuntados pero requieren UI de selección o son efectos
// runtime (Lucky, Charger, Crusher, Slasher…) que no van en la character sheet.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { applyFeatEffects } from '@/utils/featEffects'
import { computeWeaponAttack } from '@/utils/weaponCalc'
import { getDnd2024FieldMapping } from '@/utils/pdfFieldMapping'
import { preloadVariantData } from '@/data'
import type { CharacterData, ASIChoice } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('Milestone 21 — audit de efectos mecánicos de feats (#52)', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => setActivePinia(createPinia()))

  describe('Alert — Initiative Proficiency', () => {
    it('Alert añade PB al Initiative', () => {
      const store = useCharacterStore()
      const char = store.character
      char.abilityScores.dex = 14 // +2
      char.level = 5 // PB +3
      const choices: ASIChoice[] = [{ level: 1, type: 'feat', featId: 'alert' }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(char.featInitiativeProf).toBe(true)
      expect(store.initiative).toBe(5) // DEX +2 + PB +3
    })

    it('sin Alert el Initiative es solo DEX', () => {
      const store = useCharacterStore()
      const char = store.character
      char.abilityScores.dex = 14
      char.level = 5
      char.asiChoices = []
      applyFeatEffects(char, [])
      expect(char.featInitiativeProf).toBe(false)
      expect(store.initiative).toBe(2)
    })

    it('deseleccionar Alert quita el bonus', () => {
      const char = freshChar()
      applyFeatEffects(char, [{ level: 1, type: 'feat', featId: 'alert' }])
      expect(char.featInitiativeProf).toBe(true)
      applyFeatEffects(char, [])
      expect(char.featInitiativeProf).toBe(false)
    })

    it('PDF Initiative incluye el bonus de Alert', () => {
      const char = freshChar()
      char.abilityScores.dex = 14
      char.level = 5
      const choices: ASIChoice[] = [{ level: 1, type: 'feat', featId: 'alert' }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      const fields = getDnd2024FieldMapping(char)
      expect(fields['Initiative']).toBe('+5')
    })
  })

  describe('Speedy — Speed Increase', () => {
    it('Speedy añade +10 a la velocidad en el PDF', () => {
      const char = freshChar()
      char.speed = 30
      const choices: ASIChoice[] = [{ level: 4, type: 'feat', featId: 'speedy', featAbility: 'dex' }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(char.featSpeedBonus).toBe(10)
      const fields = getDnd2024FieldMapping(char)
      expect(fields['Speed']).toBe('40 ft')
    })

    it('sin Speedy speed normal', () => {
      const char = freshChar()
      char.speed = 30
      applyFeatEffects(char, [])
      expect(char.featSpeedBonus).toBe(0)
      const fields = getDnd2024FieldMapping(char)
      expect(fields['Speed']).toBe('30 ft')
    })
  })

  describe('Defense — +1 AC con armadura', () => {
    it('Defense + Breastplate: AC base 16 → 17', () => {
      const store = useCharacterStore()
      const char = store.character
      char.abilityScores.dex = 16 // +3
      char.armor = 'Breastplate'
      char.shield = false
      const choices: ASIChoice[] = [{ level: 1, type: 'feat', featId: 'defense' }]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(store.armorClass).toBe(17)
    })

    it('Defense SIN armadura: NO suma (regla del feat)', () => {
      const store = useCharacterStore()
      const char = store.character
      char.abilityScores.dex = 16
      char.armor = ''
      char.shield = false
      applyFeatEffects(char, [{ level: 1, type: 'feat', featId: 'defense' }])
      // Unarmored = 10 + DEX = 13. Defense no debe sumar.
      expect(store.armorClass).toBe(13)
    })

    it('Defense + Plate + Shield: 18 + 2 + 1 = 21', () => {
      const store = useCharacterStore()
      const char = store.character
      char.abilityScores.dex = 10
      char.armor = 'Plate Armor'
      char.shield = true
      applyFeatEffects(char, [{ level: 1, type: 'feat', featId: 'defense' }])
      expect(store.armorClass).toBe(21)
    })
  })

  describe('Archery — +2 ataque con ranged weapons', () => {
    it('Hand Crossbow con Archery: +2 al attack', () => {
      const char = freshChar()
      char.level = 10
      char.abilityScores.dex = 16
      char.proficienciesOther = ['Simple weapons', 'Martial weapons']
      char.asiChoices = [{ level: 1, type: 'feat', featId: 'archery' }]
      const info = computeWeaponAttack('Hand Crossbow', char)
      // Sin Archery sería +7 (DEX 3 + PB 4); con Archery +9.
      expect(info.attackBonus).toBe(9)
    })

    it('Archery NO afecta a armas melee', () => {
      const char = freshChar()
      char.level = 5
      char.abilityScores.str = 18 // +4
      char.proficienciesOther = ['Martial weapons']
      char.asiChoices = [{ level: 1, type: 'feat', featId: 'archery' }]
      const info = computeWeaponAttack('Longsword', char)
      // STR +4, PB +3 → +7. Sin bonus de Archery.
      expect(info.attackBonus).toBe(7)
    })
  })

  describe('Dueling — +2 damage 1-handed melee', () => {
    it('Longsword (versatile) con Dueling: NO suma (versatile)', () => {
      const char = freshChar()
      char.level = 5
      char.abilityScores.str = 18 // +4
      char.proficienciesOther = ['Martial weapons']
      char.asiChoices = [{ level: 1, type: 'feat', featId: 'dueling' }]
      const info = computeWeaponAttack('Longsword', char)
      // Longsword tiene "versatile (1d10)" en properties → no aplica
      expect(info.damage).toBe('1d8 +4 slashing')
    })

    it('Rapier (sin versatile, no two-handed) con Dueling: +2 al damage', () => {
      const char = freshChar()
      char.level = 5
      char.abilityScores.str = 14
      char.abilityScores.dex = 18 // +4 (finesse → DEX)
      char.proficienciesOther = ['Martial weapons']
      char.asiChoices = [{ level: 1, type: 'feat', featId: 'dueling' }]
      const info = computeWeaponAttack('Rapier', char)
      // DEX +4 + Dueling +2 → +6 damage
      expect(info.damage).toBe('1d8 +6 piercing')
    })

    it('Dueling NO afecta a ranged weapons (no es melee)', () => {
      const char = freshChar()
      char.level = 5
      char.abilityScores.dex = 16 // +3
      char.proficienciesOther = ['Simple weapons', 'Martial weapons']
      char.asiChoices = [{ level: 1, type: 'feat', featId: 'dueling' }]
      const info = computeWeaponAttack('Hand Crossbow', char)
      // DEX +3, no bonus de Dueling
      expect(info.damage).toBe('1d6 +3 piercing')
    })

    it('Greatsword (two-handed) con Dueling: NO suma', () => {
      const char = freshChar()
      char.level = 5
      char.abilityScores.str = 18 // +4
      char.proficienciesOther = ['Martial weapons']
      char.asiChoices = [{ level: 1, type: 'feat', featId: 'dueling' }]
      const info = computeWeaponAttack('Greatsword', char)
      expect(info.damage).toBe('2d6 +4 slashing')
    })
  })

  describe('Combinaciones', () => {
    it('Alert + Speedy + Defense en el mismo personaje aplican todos', () => {
      const store = useCharacterStore()
      const char = store.character
      char.abilityScores.dex = 14 // +2
      char.level = 5 // PB +3
      char.armor = 'Chain Mail'
      char.shield = false
      char.speed = 30
      const choices: ASIChoice[] = [
        { level: 1, type: 'feat', featId: 'alert' },
        { level: 4, type: 'feat', featId: 'speedy', featAbility: 'dex' },
        { level: 1, type: 'feat', featId: 'defense' },
      ]
      char.asiChoices = choices
      applyFeatEffects(char, choices)
      expect(store.initiative).toBe(5) // DEX 2 + PB 3
      expect(store.armorClass).toBe(17) // Chain 16 + Defense 1 (DEX ignored heavy)
      expect(char.featSpeedBonus).toBe(10)
    })
  })
})
