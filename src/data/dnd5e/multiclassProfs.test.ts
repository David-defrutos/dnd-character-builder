// #139 Fase 6 (M8) — Tests para proficiencies parciales de multiclass.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { preloadVariantData } from '@/data'
import { MULTICLASS_PROFS, getMulticlassProfs } from './multiclassProfs'

describe('#139 Fase 6 (M8) — MULTICLASS_PROFS tabla', () => {
  it('cubre las 12 clases base de D&D 5e', () => {
    const expected = [
      'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
      'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
    ]
    for (const id of expected) {
      expect(MULTICLASS_PROFS[id]).toBeDefined()
    }
  })

  it('Cleric: Light + Medium + Shields, sin armas, sin tools', () => {
    const p = getMulticlassProfs('cleric')!
    expect(p.armor).toEqual(['Light armor', 'Medium armor', 'Shields'])
    expect(p.weapons).toEqual([])
    expect(p.tools).toEqual([])
  })

  it('Fighter: Light + Medium + Shields, Martial weapons', () => {
    const p = getMulticlassProfs('fighter')!
    expect(p.armor).toEqual(['Light armor', 'Medium armor', 'Shields'])
    expect(p.weapons).toEqual(['Martial weapons'])
  })

  it('Rogue: Light armor, Thieves Tools, 1 skill de la lista', () => {
    const p = getMulticlassProfs('rogue')!
    expect(p.armor).toEqual(['Light armor'])
    expect(p.tools).toEqual(["Thieves' Tools"])
    expect(p.skillFromList).toBe(1)
  })

  it('Bard: Light armor, 1 skill, 1 musical instrument', () => {
    const p = getMulticlassProfs('bard')!
    expect(p.armor).toEqual(['Light armor'])
    expect(p.skillFromList).toBe(1)
    expect(p.musicalInstrumentChoice).toBe(true)
  })

  it('Wizard: ninguna proficiency adicional', () => {
    const p = getMulticlassProfs('wizard')!
    expect(p.armor).toEqual([])
    expect(p.weapons).toEqual([])
    expect(p.tools).toEqual([])
  })

  it('Monk: ninguna proficiency adicional', () => {
    const p = getMulticlassProfs('monk')!
    expect(p.armor).toEqual([])
    expect(p.weapons).toEqual([])
    expect(p.tools).toEqual([])
  })

  it('clase desconocida devuelve null', () => {
    expect(getMulticlassProfs('foo-class')).toBeNull()
  })
})

describe('#139 Fase 6 (M8) — addMulticlass aplica proficiencies', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Wizard primario añade Cleric: gana Light, Medium, Shields', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'wizard'
    char.subclass = ''
    char.hitDie = 6
    char.abilityScores = { str: 8, dex: 14, con: 14, int: 16, wis: 13, cha: 10 }
    char.classArmorProficiencies = []  // wizard base no tiene armadura
    char.classWeaponProficiencies = []
    char.classToolProficiencies = []

    const r = store.addMulticlass('cleric')
    expect(r.ok).toBe(true)
    expect(char.classArmorProficiencies).toContain('Light armor')
    expect(char.classArmorProficiencies).toContain('Medium armor')
    expect(char.classArmorProficiencies).toContain('Shields')
  })

  it('Wizard primario añade Fighter: gana Light/Medium/Shields + Martial weapons', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'wizard'
    char.subclass = ''
    char.hitDie = 6
    char.abilityScores = { str: 13, dex: 14, con: 14, int: 16, wis: 10, cha: 10 }
    char.classArmorProficiencies = []
    char.classWeaponProficiencies = []
    char.classToolProficiencies = []

    const r = store.addMulticlass('fighter')
    expect(r.ok).toBe(true)
    expect(char.classWeaponProficiencies).toContain('Martial weapons')
    expect(char.classArmorProficiencies).toContain('Light armor')
  })

  it('Fighter primario añade Rogue: gana Thieves Tools sin duplicar Light armor', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'fighter'
    char.subclass = ''
    char.hitDie = 10
    char.abilityScores = { str: 13, dex: 14, con: 14, int: 10, wis: 10, cha: 8 }
    // Fighter base ya tiene Light + Medium + Shields.
    char.classArmorProficiencies = ['Light armor', 'Medium armor', 'Heavy armor', 'Shields']
    char.classWeaponProficiencies = ['Simple weapons', 'Martial weapons']
    char.classToolProficiencies = []

    const r = store.addMulticlass('rogue')
    expect(r.ok).toBe(true)
    expect(char.classToolProficiencies).toEqual(["Thieves' Tools"])
    // Light armor no se duplica.
    const lightCount = char.classArmorProficiencies.filter(p => p === 'Light armor').length
    expect(lightCount).toBe(1)
  })

  it('Wizard primario añade Wizard fallido (no se puede tener dos veces) NO toca proficiencies', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'wizard'
    char.subclass = ''
    char.hitDie = 6
    char.abilityScores = { str: 10, dex: 14, con: 14, int: 16, wis: 10, cha: 10 }
    char.classes = [{ classId: 'wizard', subclass: '', level: 5, hitDie: 6 }]
    char.classArmorProficiencies = []
    const before = [...char.classArmorProficiencies]
    const r = store.addMulticlass('wizard')
    expect(r.ok).toBe(false)
    expect(char.classArmorProficiencies).toEqual(before)
  })

  it('Sorcerer (sin proficiencies multiclass) no cambia los arrays', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'wizard'
    char.subclass = ''
    char.hitDie = 6
    char.abilityScores = { str: 10, dex: 14, con: 14, int: 16, wis: 10, cha: 13 }
    char.classArmorProficiencies = []
    char.classWeaponProficiencies = []
    char.classToolProficiencies = []

    const r = store.addMulticlass('sorcerer')
    expect(r.ok).toBe(true)
    expect(char.classArmorProficiencies).toEqual([])
    expect(char.classWeaponProficiencies).toEqual([])
    expect(char.classToolProficiencies).toEqual([])
  })
})
