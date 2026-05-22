// Documento generado el 2026-05-19-2012
// Sanity check: verifies the Milestone 2 data is loaded correctly.

import { describe, it, expect } from 'vitest'
import { races, getRaceById } from '@/data/dnd5e/races'
import { backgrounds, getBackgroundById } from '@/data/dnd5e/backgrounds'
import { feats, getFeatById } from '@/data/dnd5e/feats'

describe('Milestone 2 — 2024 species, backgrounds and feats', () => {
  it('exposes the nine 2024 species', () => {
    const ids = races.map(r => r.id)
    expect(ids).toEqual(expect.arrayContaining([
      'dragonborn', 'dwarf', 'elf', 'gnome', 'goliath',
      'halfling', 'human', 'orc', 'tiefling',
    ]))
    // No racial Ability Score Increases in 2024
    for (const race of races) {
      const sumOfBonuses = Object.values(race.abilityBonuses ?? {}).reduce((a, b) => a + (b ?? 0), 0)
      expect(sumOfBonuses).toBe(0)
    }
  })

  it('has correct 2024 Dwarf darkvision (120 ft, was 60 in 2014)', () => {
    const dwarf = getRaceById('dwarf')
    expect(dwarf?.darkvision).toBe(120)
  })

  it('has correct 2024 Orc traits including Adrenaline Rush', () => {
    const orc = getRaceById('orc')
    expect(orc?.darkvision).toBe(120)
    expect(orc?.traits.join('|')).toMatch(/Adrenaline Rush/)
    expect(orc?.traits.join('|')).toMatch(/Relentless Endurance/)
  })

  it('has Elf lineages as subraces', () => {
    const elf = getRaceById('elf')
    const subIds = elf?.subraces.map(s => s.id) ?? []
    expect(subIds).toEqual(expect.arrayContaining(['drow', 'high-elf', 'wood-elf']))
  })

  it('has Tiefling Fiendish Legacies', () => {
    const tief = getRaceById('tiefling')
    const subIds = tief?.subraces.map(s => s.id) ?? []
    expect(subIds).toEqual(expect.arrayContaining(['abyssal-tiefling', 'chthonic-tiefling', 'infernal-tiefling']))
  })

  it('exposes the four 2024 Origin Feats', () => {
    const ids = feats.map(f => f.id)
    expect(ids).toEqual(expect.arrayContaining(['alert', 'magic-initiate', 'savage-attacker', 'skilled']))
  })

  it('2024 backgrounds carry abilityScores + originFeat', () => {
    const acolyte = getBackgroundById('acolyte')
    expect(acolyte?.abilityScores).toEqual(['int', 'wis', 'cha'])
    expect(acolyte?.originFeat).toBe('magic-initiate')

    const criminal = getBackgroundById('criminal')
    expect(criminal?.abilityScores).toEqual(['dex', 'con', 'int'])
    expect(criminal?.originFeat).toBe('alert')

    const sage = getBackgroundById('sage')
    expect(sage?.abilityScores).toEqual(['con', 'int', 'wis'])
    expect(sage?.originFeat).toBe('magic-initiate')

    const soldier = getBackgroundById('soldier')
    expect(soldier?.abilityScores).toEqual(['str', 'dex', 'con'])
    expect(soldier?.originFeat).toBe('savage-attacker')
  })

  it('background origin feat IDs resolve to existing feats', () => {
    const bgsWithFeats = backgrounds.filter(b => b.originFeat)
    expect(bgsWithFeats.length).toBeGreaterThanOrEqual(4)
    for (const bg of bgsWithFeats) {
      const feat = getFeatById(bg.originFeat!)
      expect(feat, `Origin feat ${bg.originFeat} from ${bg.id} should exist`).toBeDefined()
      expect(feat?.category).toBe('origin')
    }
  })

  it('Soldier skill proficiencies are 2024 (Athletics + Intimidation)', () => {
    const soldier = getBackgroundById('soldier')
    expect(soldier?.skillProficiencies).toEqual(['athletics', 'intimidation'])
  })

  it('Criminal skill proficiencies are 2024 (SoH + Stealth, not Deception)', () => {
    const criminal = getBackgroundById('criminal')
    expect(criminal?.skillProficiencies).toEqual(['sleight-of-hand', 'stealth'])
  })
})
