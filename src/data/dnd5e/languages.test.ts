// Tests para src/data/dnd5e/languages.ts — bug #92.

import { describe, it, expect } from 'vitest'
import { LANGUAGES, getLanguageById, getLanguageByName } from './languages'

describe('#92 — Languages catalog (PHB 2024)', () => {
  it('incluye los 10 standard languages del PHB 2024', () => {
    const standard = LANGUAGES.filter(l => !l.rare).map(l => l.name)
    expect(standard).toContain('Common')
    expect(standard).toContain('Common Sign Language')
    expect(standard).toContain('Draconic')
    expect(standard).toContain('Dwarvish')
    expect(standard).toContain('Elvish')
    expect(standard).toContain('Giant')
    expect(standard).toContain('Gnomish')
    expect(standard).toContain('Goblin')
    expect(standard).toContain('Halfling')
    expect(standard).toContain('Orc')
    expect(standard).toHaveLength(10)
  })

  it('incluye los rare languages del PHB 2024', () => {
    const rare = LANGUAGES.filter(l => l.rare).map(l => l.name)
    expect(rare).toContain('Abyssal')
    expect(rare).toContain('Celestial')
    expect(rare).toContain('Deep Speech')
    expect(rare).toContain('Druidic')
    expect(rare).toContain('Infernal')
    expect(rare).toContain('Primordial')
    expect(rare).toContain('Sylvan')
    expect(rare).toContain("Thieves' Cant")
    expect(rare).toContain('Undercommon')
  })

  it('Common no está marcado como rare', () => {
    const common = LANGUAGES.find(l => l.id === 'common')
    expect(common?.rare).toBeFalsy()
  })

  it('getLanguageById funciona', () => {
    expect(getLanguageById('giant')?.name).toBe('Giant')
    expect(getLanguageById('inexistente')).toBeUndefined()
  })

  it('getLanguageByName es case-insensitive', () => {
    expect(getLanguageByName('giant')?.id).toBe('giant')
    expect(getLanguageByName('GIANT')?.id).toBe('giant')
    expect(getLanguageByName('  Giant  ')?.id).toBe('giant')
  })

  it("Thieves' Cant tiene el apóstrofe correcto", () => {
    expect(getLanguageById('thieves-cant')?.name).toBe("Thieves' Cant")
  })

  it('todos los idiomas tienen typicalSpeakers no vacío', () => {
    for (const lang of LANGUAGES) {
      expect(lang.typicalSpeakers, lang.name).toBeTruthy()
      expect(lang.typicalSpeakers.length, lang.name).toBeGreaterThan(3)
    }
  })

  it('ids únicos', () => {
    const ids = LANGUAGES.map(l => l.id)
    const set = new Set(ids)
    expect(set.size).toBe(ids.length)
  })
})
