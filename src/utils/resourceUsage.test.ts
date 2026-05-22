// Tests para src/utils/resourceUsage.ts — bug #78.
//
// Verifica la extracción de recursos con usos limitados para varios PJ
// arquetípicos. No es exhaustivo (sería un test de catálogo); cubre los
// principales: Fighter (Second Wind, Action Surge, Indomitable), Cleric
// (Channel Divinity), Barbarian (Rage), Dragonborn (Breath Weapon),
// Echo Knight (Unleash Incarnation, Shadow Martyr).

import { describe, it, expect, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { getLimitedResources } from './resourceUsage'
import { preloadVariantData } from '@/data'
import type { CharacterData } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('#78 — resourceUsage', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  it('un PJ sin clase no devuelve recursos', () => {
    const char = freshChar()
    expect(getLimitedResources(char)).toEqual([])
  })

  it('Fighter lv1: Second Wind con uses de la tabla', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 1
    const rs = getLimitedResources(char)
    const sw = rs.find(r => r.name === 'Second Wind')
    expect(sw).toBeDefined()
    expect(sw!.uses).toBe(2) // tabla: lv1 = 2
    expect(sw!.recharge).toContain('long rest')
  })

  // ─── #83 — tabla Second Wind correcta PHB 2024 ────────────────────────
  it('#83 — Fighter lv4: Second Wind sube a 3', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 4
    const sw = getLimitedResources(char).find(r => r.name === 'Second Wind')
    expect(sw?.uses).toBe(3)
  })

  it('#83 — Fighter lv10: Second Wind sube a 4 (escalón canónico PHB 2024, NO lv.17)', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 10
    const sw = getLimitedResources(char).find(r => r.name === 'Second Wind')
    expect(sw?.uses).toBe(4)
  })

  it('#83 — Fighter lv9: Second Wind sigue en 3 (NO sube hasta lv.10)', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 9
    const sw = getLimitedResources(char).find(r => r.name === 'Second Wind')
    expect(sw?.uses).toBe(3)
  })

  it('#83 — Fighter lv17: Second Wind sigue en 4 (no hay escalón nuevo)', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 17
    const sw = getLimitedResources(char).find(r => r.name === 'Second Wind')
    expect(sw?.uses).toBe(4)
  })

  it('Fighter lv2: añade Action Surge (1 use, short/long rest)', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 2
    const rs = getLimitedResources(char)
    const as = rs.find(r => r.name === 'Action Surge')
    expect(as).toBeDefined()
    expect(as!.uses).toBe(1)
    expect(as!.recharge).toMatch(/short or long rest/i)
  })

  it('Fighter lv17: Action Surge sube a 2 usos', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 17
    const as = getLimitedResources(char).find(r => r.name === 'Action Surge')
    expect(as?.uses).toBe(2)
  })

  it('Fighter lv9/13/17: Indomitable escala 1→2→3', () => {
    for (const [lvl, expected] of [[9, 1], [13, 2], [17, 3]] as const) {
      const char = freshChar()
      char.className = 'fighter'
      char.level = lvl
      const ind = getLimitedResources(char).find(r => r.name === 'Indomitable')
      expect(ind?.uses).toBe(expected)
    }
  })

  it('Cleric lv2: Channel Divinity = 2 usos (tabla)', () => {
    const char = freshChar()
    char.className = 'cleric'
    char.level = 2
    const cd = getLimitedResources(char).find(r => r.name === 'Channel Divinity')
    expect(cd).toBeDefined()
    expect(cd!.uses).toBe(2)
    expect(cd!.recharge).toMatch(/short or long rest/i)
  })

  it('Cleric lv1: aún NO tiene Channel Divinity (lv2)', () => {
    const char = freshChar()
    char.className = 'cleric'
    char.level = 1
    const cd = getLimitedResources(char).find(r => r.name === 'Channel Divinity')
    expect(cd).toBeUndefined()
  })

  it('Barbarian lv5: Rage = 3 (tabla)', () => {
    const char = freshChar()
    char.className = 'barbarian'
    char.level = 5
    const r = getLimitedResources(char).find(x => x.name === 'Rage')
    expect(r?.uses).toBe(3)
  })

  it('Dragonborn lv5: Breath Weapon = PB (3) + Draconic Flight', () => {
    const char = freshChar()
    char.className = 'fighter' // cualquier clase
    char.level = 5 // PB = 3
    char.race = 'dragonborn'
    const rs = getLimitedResources(char)
    const bw = rs.find(r => r.name === 'Breath Weapon')
    const df = rs.find(r => r.name === 'Draconic Flight')
    expect(bw?.uses).toBe(3)
    expect(df?.uses).toBe(1)
  })

  it('Echo Knight lv10 con CON+2: Unleash Incarnation = 2, Shadow Martyr = 1', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 10
    char.subclass = 'echo-knight'
    char.abilityScores.con = 14 // mod +2
    const rs = getLimitedResources(char)
    const ui = rs.find(r => r.name === 'Unleash Incarnation')
    const sm = rs.find(r => r.name === 'Shadow Martyr')
    expect(ui?.uses).toBe(2)
    expect(sm?.uses).toBe(1)
    expect(sm?.recharge).toMatch(/short or long rest/i)
  })

  it('Echo Knight con CON 8 (mod -1): Unleash Incarnation tiene piso de 1', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 3
    char.subclass = 'echo-knight'
    char.abilityScores.con = 8 // mod -1
    const ui = getLimitedResources(char).find(r => r.name === 'Unleash Incarnation')
    expect(ui?.uses).toBe(1)
  })

  // Caso real: Cecino del PDF
  it('Caso real Cecino (Fighter Echo Knight lv10, Dragonborn, CON 14)', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 10
    char.subclass = 'echo-knight'
    char.race = 'dragonborn'
    char.abilityScores = { str: 12, dex: 17, con: 14, int: 10, wis: 14, cha: 8 }
    const names = getLimitedResources(char).map(r => r.name).sort()
    expect(names).toContain('Second Wind')
    expect(names).toContain('Action Surge')
    expect(names).toContain('Indomitable')
    expect(names).toContain('Unleash Incarnation')
    expect(names).toContain('Shadow Martyr')
    expect(names).toContain('Breath Weapon')
    expect(names).toContain('Draconic Flight')
  })

  // ─── #87 — orden alfabético ─────────────────────────────────────────────
  it('#87 — la lista sale ordenada alfabéticamente por nombre', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 10
    char.subclass = 'echo-knight'
    char.race = 'dragonborn'
    char.abilityScores = { str: 12, dex: 17, con: 14, int: 10, wis: 14, cha: 8 }
    const names = getLimitedResources(char).map(r => r.name)
    // Para Cecino lv.10: Action Surge, Breath Weapon, Draconic Flight,
    // Indomitable, Second Wind, Shadow Martyr, Unleash Incarnation
    expect(names).toEqual([
      'Action Surge',
      'Breath Weapon',
      'Draconic Flight',
      'Indomitable',
      'Second Wind',
      'Shadow Martyr',
      'Unleash Incarnation',
    ])
  })

  it('#87 — el orden alfabético es estable para cualquier PJ', () => {
    const char = freshChar()
    char.className = 'cleric'
    char.level = 6
    char.race = 'dragonborn'
    const names = getLimitedResources(char).map(r => r.name)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })
})
