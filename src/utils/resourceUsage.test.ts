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

  // ─── #119 — Catálogo completo de Limited-Use Resources ────────────────
  describe('#119 — feats con usos limitados', () => {
    it('Lucky (origin feat): Luck Points = PB, long rest', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 5 // PB = 3
      char.originFeatId = 'lucky'
      const r = getLimitedResources(char).find(x => x.name === 'Luck Points')
      expect(r).toBeDefined()
      expect(r!.uses).toBe(3)
      expect(r!.recharge).toBe('long rest')
      expect(r!.source).toMatch(/Lucky/)
    })

    it('Lucky en ASI feat (no origin): también aparece', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 9 // PB = 4
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'lucky' }]
      const r = getLimitedResources(char).find(x => x.name === 'Luck Points')
      expect(r?.uses).toBe(4)
      expect(r?.source).toMatch(/ASI Feat lv\.4/)
    })

    it('Fey-Touched: 2 filas (Misty Step + lv.1 spell), 1/long rest', () => {
      const char = freshChar()
      char.className = 'wizard'
      char.level = 4
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'fey-touched' }]
      const names = getLimitedResources(char).map(r => r.name)
      expect(names).toContain('Fey-Touched: Misty Step')
      expect(names).toContain('Fey-Touched: lv.1 spell')
      const rs = getLimitedResources(char).filter(r => r.name.startsWith('Fey-Touched'))
      expect(rs).toHaveLength(2)
      rs.forEach(r => {
        expect(r.uses).toBe(1)
        expect(r.recharge).toBe('long rest')
      })
    })

    it('Shadow-Touched: 2 filas (Invisibility + lv.1 spell), 1/long rest', () => {
      const char = freshChar()
      char.className = 'wizard'
      char.level = 4
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'shadow-touched' }]
      const rs = getLimitedResources(char).filter(r => r.name.startsWith('Shadow-Touched'))
      expect(rs).toHaveLength(2)
      rs.forEach(r => {
        expect(r.uses).toBe(1)
        expect(r.recharge).toBe('long rest')
      })
    })

    it('Magic Initiate: 1 free cast lv.1, long rest', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 1
      char.originFeatId = 'magic-initiate'
      const r = getLimitedResources(char).find(x => x.name.includes('Magic Initiate'))
      expect(r).toBeDefined()
      expect(r!.uses).toBe(1)
      expect(r!.recharge).toBe('long rest')
    })

    it('Ritual Caster: Quick Ritual 1/long rest', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'ritual-caster' }]
      const r = getLimitedResources(char).find(x => x.name === 'Quick Ritual')
      expect(r?.uses).toBe(1)
      expect(r?.recharge).toBe('long rest')
    })

    it('Telepathic: Detect Thoughts 1/long rest', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'telepathic' }]
      const r = getLimitedResources(char).find(x => x.name === 'Telepathic: Detect Thoughts')
      expect(r?.uses).toBe(1)
      expect(r?.recharge).toBe('long rest')
    })

    it('Mage Slayer: Guarded Mind 1/short or long rest', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'mage-slayer' }]
      const r = getLimitedResources(char).find(x => x.name === 'Guarded Mind')
      expect(r?.uses).toBe(1)
      expect(r?.recharge).toMatch(/short or long rest/)
    })

    it('Inspiring Leader NO aparece (no tiene tope de usos)', () => {
      const char = freshChar()
      char.className = 'bard'
      char.level = 4
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'inspiring-leader' }]
      const names = getLimitedResources(char).map(r => r.name)
      expect(names).not.toContain('Inspiring Leader')
    })

    it('Tough, Resilient, Speedy: NO aparecen (sin contador)', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 12
      char.originFeatId = 'tough'
      char.asiChoices = [
        { level: 4, type: 'feat', featId: 'resilient' },
        { level: 8, type: 'feat', featId: 'speedy' },
      ]
      const names = getLimitedResources(char).map(r => r.name).join('|')
      expect(names).not.toMatch(/Tough/)
      expect(names).not.toMatch(/Resilient/)
      expect(names).not.toMatch(/Speedy/)
    })

    it('Combinación: Lucky + Fey-Touched suma 3 filas', () => {
      const char = freshChar()
      char.className = 'bard'
      char.level = 8 // PB = 3
      char.originFeatId = 'lucky'
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'fey-touched' }]
      const feats = getLimitedResources(char).filter(r =>
        r.name === 'Luck Points' || r.name.startsWith('Fey-Touched')
      )
      expect(feats).toHaveLength(3)
    })
  })

  describe('#119 — recursos de clase no modelados anteriormente', () => {
    it('Bard lv.1: Bardic Inspiration = max(1, CHA mod), long rest', () => {
      const char = freshChar()
      char.className = 'bard'
      char.level = 1
      char.abilityScores.cha = 16 // mod +3
      const r = getLimitedResources(char).find(x => x.name === 'Bardic Inspiration')
      expect(r).toBeDefined()
      expect(r!.uses).toBe(3)
      expect(r!.recharge).toBe('long rest')
    })

    it('Bard lv.5+: Bardic Inspiration recarga en short or long rest', () => {
      const char = freshChar()
      char.className = 'bard'
      char.level = 5
      char.abilityScores.cha = 14
      const r = getLimitedResources(char).find(x => x.name === 'Bardic Inspiration')
      expect(r?.recharge).toBe('short or long rest')
    })

    it('Bardic Inspiration: piso = 1 incluso con CHA negativa', () => {
      const char = freshChar()
      char.className = 'bard'
      char.level = 1
      char.abilityScores.cha = 8 // mod -1
      const r = getLimitedResources(char).find(x => x.name === 'Bardic Inspiration')
      expect(r?.uses).toBe(1)
    })

    it('Paladin lv.5: Lay on Hands (25 HP), Smite, Faithful Steed, Channel Divinity', () => {
      const char = freshChar()
      char.className = 'paladin'
      char.level = 5
      const rs = getLimitedResources(char)
      const loh = rs.find(r => r.name.includes('Lay on Hands'))
      expect(loh?.uses).toBe(25)
      expect(loh?.unit).toBe('HP')
      expect(loh?.recharge).toBe('long rest')
      expect(rs.find(r => r.name === "Paladin's Smite")?.uses).toBe(1)
      expect(rs.find(r => r.name === 'Faithful Steed')?.uses).toBe(1)
      expect(rs.find(r => r.name === 'Channel Divinity')).toBeDefined()
    })

    it('Paladin lv.20: Lay on Hands = 100 HP', () => {
      const char = freshChar()
      char.className = 'paladin'
      char.level = 20
      const loh = getLimitedResources(char).find(r => r.name.includes('Lay on Hands'))
      expect(loh?.uses).toBe(100)
    })

    it('Monk lv.6: Focus Points = 6, Uncanny Metabolism = 1/long rest', () => {
      const char = freshChar()
      char.className = 'monk'
      char.level = 6
      const rs = getLimitedResources(char)
      const fp = rs.find(r => r.name === 'Focus Points')
      expect(fp?.uses).toBe(6)
      expect(fp?.recharge).toBe('short or long rest')
      const um = rs.find(r => r.name === 'Uncanny Metabolism')
      expect(um?.uses).toBe(1)
      expect(um?.recharge).toBe('long rest')
    })

    it('Sorcerer lv.5: Sorcery Points = 5, Innate Sorcery = 2/long rest', () => {
      const char = freshChar()
      char.className = 'sorcerer'
      char.level = 5
      const rs = getLimitedResources(char)
      expect(rs.find(r => r.name === 'Sorcery Points')?.uses).toBe(5)
      expect(rs.find(r => r.name === 'Innate Sorcery')?.uses).toBe(2)
    })

    it('Warlock lv.2: Magical Cunning = 1/short rest', () => {
      const char = freshChar()
      char.className = 'warlock'
      char.level = 2
      const r = getLimitedResources(char).find(x => x.name === 'Magical Cunning')
      expect(r?.uses).toBe(1)
      expect(r?.recharge).toBe('short rest')
    })

    it('Wizard lv.1: Arcane Recovery = 1/long rest', () => {
      const char = freshChar()
      char.className = 'wizard'
      char.level = 1
      const r = getLimitedResources(char).find(x => x.name === 'Arcane Recovery')
      expect(r?.uses).toBe(1)
      expect(r?.recharge).toBe('long rest')
    })

    it('Cleric lv.10: Divine Intervention = 1/long rest', () => {
      const char = freshChar()
      char.className = 'cleric'
      char.level = 10
      const r = getLimitedResources(char).find(x => x.name === 'Divine Intervention')
      expect(r?.uses).toBe(1)
      expect(r?.recharge).toBe('long rest')
    })

    it('Cleric lv.9: aún NO tiene Divine Intervention', () => {
      const char = freshChar()
      char.className = 'cleric'
      char.level = 9
      const r = getLimitedResources(char).find(x => x.name === 'Divine Intervention')
      expect(r).toBeUndefined()
    })

    it('Ranger lv.1: Favored Enemy = 2 Hunter\u2019s Mark gratis/long rest', () => {
      const char = freshChar()
      char.className = 'ranger'
      char.level = 1
      const r = getLimitedResources(char).find(x => x.name.startsWith('Favored Enemy'))
      expect(r?.uses).toBe(2)
      expect(r?.recharge).toBe('long rest')
    })

    it('Ranger lv.9: Favored Enemy escala a 4', () => {
      const char = freshChar()
      char.className = 'ranger'
      char.level = 9
      const r = getLimitedResources(char).find(x => x.name.startsWith('Favored Enemy'))
      expect(r?.uses).toBe(4)
    })

    it('FIX Wild Shape: Druid lv.6 = 3 usos (no 2 hardcoded)', () => {
      const char = freshChar()
      char.className = 'druid'
      char.level = 6
      const r = getLimitedResources(char).find(x => x.name === 'Wild Shape')
      expect(r?.uses).toBe(3)
    })

    it('FIX Wild Shape: Druid lv.17 = 4', () => {
      const char = freshChar()
      char.className = 'druid'
      char.level = 17
      const r = getLimitedResources(char).find(x => x.name === 'Wild Shape')
      expect(r?.uses).toBe(4)
    })

    it('Wild Shape lv.20 sigue siendo unlimited (999)', () => {
      const char = freshChar()
      char.className = 'druid'
      char.level = 20
      const r = getLimitedResources(char).find(x => x.name === 'Wild Shape')
      expect(r?.uses).toBe(999)
    })
  })

  describe('#119 — subclase Glamour Bard', () => {
    it('Glamour Bard lv.6: añade Mantle of Majesty', () => {
      const char = freshChar()
      char.className = 'bard'
      char.subclass = 'glamour'
      char.level = 6
      const r = getLimitedResources(char).find(x => x.name === 'Mantle of Majesty')
      expect(r?.uses).toBe(1)
      expect(r?.recharge).toBe('long rest')
    })

    it('Glamour Bard lv.5: aún NO tiene Mantle of Majesty (lv.6)', () => {
      const char = freshChar()
      char.className = 'bard'
      char.subclass = 'glamour'
      char.level = 5
      const r = getLimitedResources(char).find(x => x.name === 'Mantle of Majesty')
      expect(r).toBeUndefined()
    })

    it('Glamour Bard lv.14: añade Unbreakable Majesty', () => {
      const char = freshChar()
      char.className = 'bard'
      char.subclass = 'glamour'
      char.level = 14
      const r = getLimitedResources(char).find(x => x.name === 'Unbreakable Majesty')
      expect(r?.uses).toBe(1)
      expect(r?.recharge).toBe('short or long rest')
    })
  })

  describe('#119 — Caso real Salusa Secundus (Bard Glamour lv.10)', () => {
    it('incluye Lucky, Fey-Touched (x2), Bardic Inspiration, Mantle of Majesty', () => {
      const char = freshChar()
      char.className = 'bard'
      char.subclass = 'glamour'
      char.level = 10
      char.abilityScores.cha = 15 // base 15
      char.backgroundBonuses = { cha: 2, dex: 1 } // wayfarer: +2 cha
      char.asiBonuses = { cha: 2 } // ASI lv.4 feat → cha +1 + lv.8 feat → cha +1 = +2
      // Total CHA = 15+2+2 = 19 (mod +4)
      char.originFeatId = 'lucky'
      char.asiChoices = [
        { level: 4, type: 'feat', featId: 'inspiring-leader', featAbility: 'cha' },
        { level: 8, type: 'feat', featId: 'fey-touched', featAbility: 'cha' },
      ]
      const names = getLimitedResources(char).map(r => r.name)
      expect(names).toContain('Luck Points')
      expect(names).toContain('Fey-Touched: Misty Step')
      expect(names).toContain('Fey-Touched: lv.1 spell')
      expect(names).toContain('Bardic Inspiration')
      expect(names).toContain('Mantle of Majesty')
      // Inspiring Leader NO (sin contador)
      expect(names).not.toContain('Inspiring Leader')
      // Verifica usos clave
      const luck = getLimitedResources(char).find(r => r.name === 'Luck Points')
      expect(luck?.uses).toBe(4) // PB lv.10 = 4
      const bi = getLimitedResources(char).find(r => r.name === 'Bardic Inspiration')
      expect(bi?.uses).toBe(4) // CHA mod = +4
      expect(bi?.recharge).toBe('short or long rest') // lv.10 ≥ 5
    })
  })
})
