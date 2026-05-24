// #147 M2 — Gating de subclase para clases SECUNDARIAS en multiclass.
//
// Antes del fix, pendingLevelDecisions solo gating la primaria con la regla
// "char.level >= cls.subclassLevel && !char.subclass". Eso permitía dejar un
// Wizard secundario en lv.3+ sin Arcane Tradition.
//
// Después del fix, iteramos TODAS las clases (getClassEntries) y emitimos
// una entrada `subclass-<classId>` por cada clase que haya llegado a su
// propio subclassLevel y no tenga subclase elegida.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import type { CharacterData } from '@/stores/character'
import { preloadVariantData } from '@/data'
import { pendingLevelDecisions } from './levelUpGating'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  const c = useCharacterStore().character
  c.variant = 'dnd5e'
  c.abilityScores = { str: 14, dex: 13, con: 14, int: 14, wis: 13, cha: 10 }
  return c
}

describe('#147 M2 — subclase secundaria gating', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Fighter 3 primario sin subclase: emite subclass-fighter', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = ''
    char.level = 3
    char.classes = [{ classId: 'fighter', subclass: '', level: 3, hitDie: 10 }]
    const dec = pendingLevelDecisions(char)
    expect(dec.some(d => d.key === 'subclass-fighter')).toBe(true)
  })

  it('Fighter 3/Wizard 3: ambas necesitan subclase → 2 entradas', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = ''
    char.level = 6
    char.classes = [
      { classId: 'fighter', subclass: '', level: 3, hitDie: 10 },
      { classId: 'wizard', subclass: '', level: 3, hitDie: 6 },
    ]
    const dec = pendingLevelDecisions(char)
    expect(dec.some(d => d.key === 'subclass-fighter')).toBe(true)
    expect(dec.some(d => d.key === 'subclass-wizard')).toBe(true)
  })

  it('Fighter 3 con subclase, Wizard 3 sin subclase: solo emite la del wizard', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'champion'
    char.level = 6
    char.classes = [
      { classId: 'fighter', subclass: 'champion', level: 3, hitDie: 10 },
      { classId: 'wizard', subclass: '', level: 3, hitDie: 6 },
    ]
    const dec = pendingLevelDecisions(char)
    expect(dec.some(d => d.key === 'subclass-fighter')).toBe(false)
    expect(dec.some(d => d.key === 'subclass-wizard')).toBe(true)
  })

  it('Wizard secundario en lv.2 (< subclassLevel 3): NO bloquea', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'champion'
    char.level = 5
    char.classes = [
      { classId: 'fighter', subclass: 'champion', level: 3, hitDie: 10 },
      { classId: 'wizard', subclass: '', level: 2, hitDie: 6 },
    ]
    const dec = pendingLevelDecisions(char)
    expect(dec.some(d => d.key === 'subclass-wizard')).toBe(false)
  })

  it('Mensaje del key indica la clase: "for Wizard"', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'champion'
    char.level = 6
    char.classes = [
      { classId: 'fighter', subclass: 'champion', level: 3, hitDie: 10 },
      { classId: 'wizard', subclass: '', level: 3, hitDie: 6 },
    ]
    const dec = pendingLevelDecisions(char)
    const wiz = dec.find(d => d.key === 'subclass-wizard')
    expect(wiz).toBeDefined()
    expect(wiz!.message).toMatch(/Wizard/)
  })

  it('Fighter+Cleric ambos lv.3 con subclases: 0 entradas de subclase', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'champion'
    char.level = 6
    char.classes = [
      { classId: 'fighter', subclass: 'champion', level: 3, hitDie: 10 },
      { classId: 'cleric', subclass: 'life', level: 3, hitDie: 8 },
    ]
    const dec = pendingLevelDecisions(char)
    expect(dec.filter(d => d.key.startsWith('subclass-'))).toEqual([])
  })

  it('Wizard 2 / Sorcerer 3: solo el Sorcerer (Wizard < 3, Sorcerer = 3)', () => {
    const char = freshChar()
    char.className = 'wizard'
    char.subclass = ''
    char.level = 5
    char.classes = [
      { classId: 'wizard', subclass: '', level: 2, hitDie: 6 },
      { classId: 'sorcerer', subclass: '', level: 3, hitDie: 6 },
    ]
    const dec = pendingLevelDecisions(char)
    expect(dec.some(d => d.key === 'subclass-wizard')).toBe(false)
    expect(dec.some(d => d.key === 'subclass-sorcerer')).toBe(true)
  })
})
