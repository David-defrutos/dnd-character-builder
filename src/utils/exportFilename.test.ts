// Tests para #98: nombre de archivo por defecto al exportar JSON.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { buildExportFilename } from './exportFilename'

describe('#98 — buildExportFilename', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Fecha fija para los tests deterministas: 2026-05-21 20:48 local.
  const FIXED = new Date(2026, 4, 21, 20, 48)  // mes 0-indexed → 4 = mayo

  it('Cecino fighter lv.10 (ejemplo del usuario)', () => {
    const store = useCharacterStore()
    store.character.name = 'Cecino'
    store.character.className = 'fighter'
    store.character.level = 10
    const filename = buildExportFilename(store.character, FIXED)
    expect(filename).toBe('Cecino - fighter - lv10 - 2026-05-21-2048.json')
  })

  it('Nivel 1 con padding (lv01)', () => {
    const store = useCharacterStore()
    store.character.name = 'Test'
    store.character.className = 'wizard'
    store.character.level = 1
    const filename = buildExportFilename(store.character, FIXED)
    expect(filename).toBe('Test - wizard - lv01 - 2026-05-21-2048.json')
  })

  it('Nivel 20 con padding (lv20)', () => {
    const store = useCharacterStore()
    store.character.name = 'Hero'
    store.character.className = 'paladin'
    store.character.level = 20
    const filename = buildExportFilename(store.character, FIXED)
    expect(filename).toBe('Hero - paladin - lv20 - 2026-05-21-2048.json')
  })

  it('Sin nombre → fallback "character"', () => {
    const store = useCharacterStore()
    store.character.name = ''
    store.character.className = 'fighter'
    store.character.level = 5
    const filename = buildExportFilename(store.character, FIXED)
    expect(filename).toBe('character - fighter - lv05 - 2026-05-21-2048.json')
  })

  it('Sin clase → omite el segmento', () => {
    const store = useCharacterStore()
    store.character.name = 'Anon'
    store.character.className = ''
    store.character.level = 3
    const filename = buildExportFilename(store.character, FIXED)
    expect(filename).toBe('Anon - lv03 - 2026-05-21-2048.json')
  })

  it('Sanea caracteres prohibidos en el nombre', () => {
    const store = useCharacterStore()
    store.character.name = 'Bad:Name/With\\Slashes?'
    store.character.className = 'rogue'
    store.character.level = 4
    const filename = buildExportFilename(store.character, FIXED)
    // : / \ ? son los caracteres ilegales para filenames; deberían ser _
    expect(filename).toBe('Bad_Name_With_Slashes_ - rogue - lv04 - 2026-05-21-2048.json')
  })

  it('Timestamp local con minutos 0X', () => {
    const store = useCharacterStore()
    store.character.name = 'Test'
    store.character.className = 'cleric'
    store.character.level = 2
    const earlyMorning = new Date(2026, 0, 1, 7, 5)  // 2026-01-01 07:05
    const filename = buildExportFilename(store.character, earlyMorning)
    expect(filename).toBe('Test - cleric - lv02 - 2026-01-01-0705.json')
  })

  it('Termina siempre en .json', () => {
    const store = useCharacterStore()
    store.character.name = 'X'
    store.character.className = 'sorcerer'
    store.character.level = 1
    const filename = buildExportFilename(store.character, FIXED)
    expect(filename.endsWith('.json')).toBe(true)
  })
})
