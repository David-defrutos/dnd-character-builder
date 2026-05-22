// #109 — Tests del breakdown de Ability Scores
import { describe, it, expect } from 'vitest'
import { computeAbilityBreakdown } from './abilityScoreBreakdown'
import type { CharacterData } from '@/stores/character'

// Datos extraídos del JSON real de Cecino lv.9 (Fighter, Forest Gnome, Guide):
//   STR 12, DEX 15→19, CON 14→15, INT 10, WIS 13→14, CHA 8
//   asiBonuses: { dex:+2, wis:+1 }
//   backgroundBonuses: { dex:+2, con:+1 }
//   asiChoices: [
//     { lv.4 feat crossbow-expert featAbility:dex },  → +1 DEX
//     { lv.6 feat resilient      featAbility:wis },  → +1 WIS (ST proficiency too)
//     { lv.8 feat resilient      featAbility:dex },  → +1 DEX
//   ]
function cecino(): CharacterData {
  return {
    race: 'gnome', subrace: 'forest-gnome', background: 'guide',
    abilityScores: { str: 12, dex: 15, con: 14, int: 10, wis: 13, cha: 8 },
    speciesBonuses: {},
    backgroundBonuses: { dex: 2, con: 1 },
    asiBonuses: { dex: 2, wis: 1 },
    asiChoices: [
      { level: 4, type: 'feat', featId: 'crossbow-expert', featAbility: 'dex' },
      { level: 6, type: 'feat', featId: 'resilient', featAbility: 'wis' },
      { level: 8, type: 'feat', featId: 'resilient', featAbility: 'dex' },
    ],
  } as unknown as CharacterData
}

describe('computeAbilityBreakdown (Cecino #109)', () => {
  const breakdown = computeAbilityBreakdown(cecino())
  const byAbility = Object.fromEntries(breakdown.map(b => [b.ability, b]))

  it('DEX total = 15 + 2 bg + 1 (Crossbow Expert lv.4) + 1 (Resilient lv.8) = 19', () => {
    expect(byAbility.dex!.total).toBe(19)
    const labels = byAbility.dex!.sources.map(s => s.label)
    expect(labels).toContain('Base')
    expect(labels.some(l => l.startsWith('Background'))).toBe(true)
    expect(labels.some(l => l.includes('Crossbow Expert'))).toBe(true)
    expect(labels.some(l => l.includes('Resilient'))).toBe(true)
    // Suma cuadra:
    const sum = byAbility.dex!.sources.reduce((acc, s) => acc + s.value, 0)
    expect(sum).toBe(19)
    // NO debe haber "Other" (inconsistencia):
    expect(labels).not.toContain('Other')
  })

  it('CON total = 14 + 1 bg = 15', () => {
    expect(byAbility.con!.total).toBe(15)
    const sum = byAbility.con!.sources.reduce((acc, s) => acc + s.value, 0)
    expect(sum).toBe(15)
  })

  it('WIS total = 13 + 1 (Resilient lv.6) = 14', () => {
    expect(byAbility.wis!.total).toBe(14)
    const labels = byAbility.wis!.sources.map(s => s.label)
    expect(labels.some(l => l.includes('Resilient'))).toBe(true)
  })

  it('STR sin bonuses = solo Base 12', () => {
    expect(byAbility.str!.total).toBe(12)
    expect(byAbility.str!.sources).toEqual([{ label: 'Base', value: 12 }])
  })

  it('CHA sin bonuses = solo Base 8', () => {
    expect(byAbility.cha!.total).toBe(8)
    expect(byAbility.cha!.sources).toHaveLength(1)
  })

  it('Las 6 abilities están presentes en el resultado, en orden str→cha', () => {
    expect(breakdown.map(b => b.ability)).toEqual(['str','dex','con','int','wis','cha'])
  })
})

describe('computeAbilityBreakdown — caso ASI +2', () => {
  it('ASI +2 a una sola ability se muestra como "+2"', () => {
    const char = {
      race: 'human', background: 'soldier',
      abilityScores: { str: 13, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      speciesBonuses: {},
      backgroundBonuses: {},
      asiBonuses: { str: 2 },
      asiChoices: [
        { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] },
      ],
    } as unknown as CharacterData
    const b = computeAbilityBreakdown(char)
    const str = b.find(x => x.ability === 'str')!
    expect(str.total).toBe(15)
    expect(str.sources.some(s => s.label.includes('lv.4') && s.value === 2)).toBe(true)
  })
})
