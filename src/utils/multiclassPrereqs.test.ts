// #139 Fase 6 (M7) — Tests para multiclassPrereqsSatisfied.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import type { CharacterData } from '@/stores/character'
import { preloadVariantData, getClasses } from '@/data'
import { multiclassPrereqsSatisfied } from './multiclassPrereqs'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  const c = useCharacterStore().character
  c.variant = 'dnd5e'
  // Defaults razonables, todos a 10.
  c.abilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  return c
}

describe('#139 Fase 6 (M7) — multiclassPrereqsSatisfied', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('PJ sin clases (entries vacíos) solo valida la nueva', () => {
    const char = freshChar()
    char.abilityScores.int = 13
    const classes = getClasses('dnd5e')
    const wizard = classes.find(c => c.id === 'wizard')!
    const r = multiclassPrereqsSatisfied(char, wizard, classes)
    expect(r.satisfied).toBe(true)
  })

  it('Wizard requiere INT 13: PJ con INT 10 falla', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.classes = [{ classId: 'fighter', subclass: '', level: 4, hitDie: 10 }]
    char.abilityScores.str = 16  // fighter prereq satisfecho (STR)
    // INT en 10 → no satisface Wizard prereq.
    const classes = getClasses('dnd5e')
    const wizard = classes.find(c => c.id === 'wizard')!
    const r = multiclassPrereqsSatisfied(char, wizard, classes)
    expect(r.satisfied).toBe(false)
    expect(r.failures.join(' ')).toMatch(/Wizard.*INT 13/i)
    expect(r.failures.join(' ')).toMatch(/have 10/i)
  })

  it('Fighter→Wizard con STR 16 + INT 13: OK', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.classes = [{ classId: 'fighter', subclass: '', level: 4, hitDie: 10 }]
    char.abilityScores.str = 16
    char.abilityScores.int = 13
    const classes = getClasses('dnd5e')
    const wizard = classes.find(c => c.id === 'wizard')!
    const r = multiclassPrereqsSatisfied(char, wizard, classes)
    expect(r.satisfied).toBe(true)
    expect(r.failures).toEqual([])
  })

  it('Fighter→Wizard con STR 10 + INT 13: el FIGHTER falla', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.classes = [{ classId: 'fighter', subclass: '', level: 4, hitDie: 10 }]
    char.abilityScores.str = 10  // Fighter requires STR 13
    char.abilityScores.int = 13
    const classes = getClasses('dnd5e')
    const wizard = classes.find(c => c.id === 'wizard')!
    const r = multiclassPrereqsSatisfied(char, wizard, classes)
    expect(r.satisfied).toBe(false)
    expect(r.failures.join(' ')).toMatch(/Fighter.*STR 13/i)
  })

  it('Fighter acepta STR 13 O DEX 13 (varias primary abilities)', () => {
    const char = freshChar()
    char.className = 'wizard'
    char.classes = [{ classId: 'wizard', subclass: '', level: 5, hitDie: 6 }]
    char.abilityScores.int = 16  // wizard prereq OK
    char.abilityScores.str = 10
    char.abilityScores.dex = 14  // Fighter via DEX 13+
    const classes = getClasses('dnd5e')
    const fighter = classes.find(c => c.id === 'fighter')!
    const r = multiclassPrereqsSatisfied(char, fighter, classes)
    expect(r.satisfied).toBe(true)
  })

  it('asiBonuses cuentan: STR 12 base + ASI +1 = 13, válido', () => {
    const char = freshChar()
    char.className = 'wizard'
    char.classes = [{ classId: 'wizard', subclass: '', level: 4, hitDie: 6 }]
    char.abilityScores.int = 16
    char.abilityScores.str = 12
    char.asiBonuses = { str: 1 }
    const classes = getClasses('dnd5e')
    const fighter = classes.find(c => c.id === 'fighter')!
    const r = multiclassPrereqsSatisfied(char, fighter, classes)
    expect(r.satisfied).toBe(true)
  })

  it('Triple multiclass: TODAS las existentes + nueva deben cumplir', () => {
    const char = freshChar()
    char.className = 'cleric'
    char.classes = [
      { classId: 'cleric', subclass: '', level: 3, hitDie: 8 },
      { classId: 'wizard', subclass: '', level: 2, hitDie: 6 },
    ]
    char.abilityScores.wis = 16  // cleric OK
    char.abilityScores.int = 14  // wizard OK
    char.abilityScores.cha = 10  // sorcerer requiere CHA 13 → falla
    const classes = getClasses('dnd5e')
    const sorcerer = classes.find(c => c.id === 'sorcerer')!
    const r = multiclassPrereqsSatisfied(char, sorcerer, classes)
    expect(r.satisfied).toBe(false)
    expect(r.failures.join(' ')).toMatch(/Sorcerer.*CHA 13/i)
  })

  it('Devuelve TODAS las violaciones, no solo la primera', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.classes = [{ classId: 'fighter', subclass: '', level: 4, hitDie: 10 }]
    // STR 10 → fighter falla. INT 10 → wizard falla.
    char.abilityScores.str = 10
    char.abilityScores.dex = 10
    char.abilityScores.int = 10
    const classes = getClasses('dnd5e')
    const wizard = classes.find(c => c.id === 'wizard')!
    const r = multiclassPrereqsSatisfied(char, wizard, classes)
    expect(r.satisfied).toBe(false)
    expect(r.failures).toHaveLength(2)
  })
})
