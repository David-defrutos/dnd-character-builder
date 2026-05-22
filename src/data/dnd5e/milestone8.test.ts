// Documento generado el 2026-05-19-2117
// Sanity check for Milestone 8:
//   • All weapons have a 2024 Mastery property assigned.
//   • Key spells updated to the 2024 rules (True Strike, Counterspell,
//     Dispel Magic, Sleep, Hunter's Mark).

import { describe, it, expect } from 'vitest'
import {
  simpleWeapons,
  martialWeapons,
  armor,
  getWeaponByName,
  getArmorByName,
  getWeaponsByMastery,
  masteryDescriptions,
} from '@/data/dnd5e/equipment'
import { spells, getSpellById } from '@/data/dnd5e/spells'

const allMasteries = ['Cleave', 'Graze', 'Nick', 'Push', 'Sap', 'Slow', 'Topple', 'Vex'] as const

describe('Milestone 8 — Weapon Mastery 2024', () => {
  it('every simple weapon has a Mastery property', () => {
    for (const w of simpleWeapons) {
      expect(w.mastery, `${w.name} should have a mastery property`).toBeDefined()
      expect(allMasteries).toContain(w.mastery)
    }
  })

  it('every martial weapon has a Mastery property', () => {
    for (const w of martialWeapons) {
      expect(w.mastery, `${w.name} should have a mastery property`).toBeDefined()
      expect(allMasteries).toContain(w.mastery)
    }
  })

  it('each of the 8 mastery properties has a description', () => {
    for (const m of allMasteries) {
      expect(masteryDescriptions[m]).toBeDefined()
      expect(masteryDescriptions[m].length).toBeGreaterThan(20)
    }
  })

  it('each of the 8 mastery properties is used by at least one weapon', () => {
    for (const m of allMasteries) {
      const ws = getWeaponsByMastery(m)
      expect(ws.length, `mastery ${m} should be on at least one weapon`).toBeGreaterThan(0)
    }
  })

  it('signature 2024 weapon → mastery mappings', () => {
    expect(getWeaponByName('Greataxe')?.mastery).toBe('Cleave')
    expect(getWeaponByName('Greatsword')?.mastery).toBe('Graze')
    expect(getWeaponByName('Glaive')?.mastery).toBe('Graze')
    expect(getWeaponByName('Halberd')?.mastery).toBe('Cleave')
    expect(getWeaponByName('Dagger')?.mastery).toBe('Nick')
    expect(getWeaponByName('Scimitar')?.mastery).toBe('Nick')
    expect(getWeaponByName('Mace')?.mastery).toBe('Sap')
    expect(getWeaponByName('Longsword')?.mastery).toBe('Sap')
    expect(getWeaponByName('Rapier')?.mastery).toBe('Vex')
    expect(getWeaponByName('Shortsword')?.mastery).toBe('Vex')
    expect(getWeaponByName('Quarterstaff')?.mastery).toBe('Topple')
    expect(getWeaponByName('Maul')?.mastery).toBe('Topple')
    expect(getWeaponByName('Pike')?.mastery).toBe('Push')
    expect(getWeaponByName('Warhammer')?.mastery).toBe('Push')
    expect(getWeaponByName('Longbow')?.mastery).toBe('Slow')
    expect(getWeaponByName('Club')?.mastery).toBe('Slow')
  })

  it('2024 SRD adds firearms (Musket and Pistol) as Martial Ranged', () => {
    expect(getWeaponByName('Musket')).toBeDefined()
    expect(getWeaponByName('Pistol')).toBeDefined()
    expect(getWeaponByName('Musket')?.mastery).toBe('Slow')
    expect(getWeaponByName('Pistol')?.mastery).toBe('Vex')
  })

  it('weapons expose 2024 costs', () => {
    expect(getWeaponByName('Longsword')?.costLabel).toBe('15 GP')
    expect(getWeaponByName('Greatsword')?.costLabel).toBe('50 GP')
    expect(getWeaponByName('Dagger')?.costLabel).toBe('2 GP')
  })

  it('armor 2024 costs are aligned with the PHB', () => {
    expect(getArmorByName('Plate Armor')?.costLabel).toBe('1,500 GP')
    expect(getArmorByName('Breastplate')?.costLabel).toBe('400 GP')
    expect(getArmorByName('Chain Mail')?.costLabel).toBe('75 GP')
    expect(getArmorByName('Shield')?.costLabel).toBe('10 GP')
  })

  it('armor strength requirements unchanged from SRD', () => {
    expect(getArmorByName('Chain Mail')?.strengthReq).toBe(13)
    expect(getArmorByName('Plate Armor')?.strengthReq).toBe(15)
    expect(getArmorByName('Splint Armor')?.strengthReq).toBe(15)
  })

  it('total weapons in 2024 SRD: 24 (10 simple melee + 4 simple ranged + 18 martial melee + 6 martial ranged → but musket+pistol new)', () => {
    expect(simpleWeapons.length).toBe(14) // unchanged from 2014
    expect(martialWeapons.length).toBe(24) // 22 old + Musket + Pistol
  })

  it('armor list has 13 entries (3 light + 5 medium + 4 heavy + shield)', () => {
    expect(armor.length).toBe(13)
    expect(armor.filter(a => a.type === 'light').length).toBe(3)
    expect(armor.filter(a => a.type === 'medium').length).toBe(5)
    expect(armor.filter(a => a.type === 'heavy').length).toBe(4)
    expect(armor.filter(a => a.type === 'shield').length).toBe(1)
  })
})

describe('Milestone 8 — 2024 spell updates', () => {
  it('True Strike is the 2024 weapon-attack cantrip (no longer give-advantage)', () => {
    const ts = getSpellById('true-strike')
    expect(ts).toBeDefined()
    expect(ts!.range).toBe('Self')
    expect(ts!.description).toMatch(/weapon/i)
    expect(ts!.description).toMatch(/spellcasting ability/i)
    expect(ts!.description).toMatch(/Radiant/i)
    // Make sure the old text "advantage on your next attack" is gone
    expect(ts!.description).not.toMatch(/advantage on your.*next attack/i)
  })

  it('Counterspell is now a CON save (not auto-counter)', () => {
    const cs = getSpellById('3-counterspell')
    expect(cs).toBeDefined()
    // El texto canónico 2024 usa "Constitution saving throw" (no la
    // abreviatura "CON"). Aceptamos ambas formas, y nos aseguramos de
    // que NO es el flavor de 2014 ("3rd level or lower, it fails").
    expect(cs!.description).toMatch(/Constitution saving throw|CON saving throw|CON save/i)
    expect(cs!.description).not.toMatch(/3rd level or lower, it fails/i)
  })

  it("Dispel Magic uses ability check vs DC 10 + spell level for lv.4+", () => {
    const dm = getSpellById('3-dispel-magic')
    expect(dm).toBeDefined()
    expect(dm!.description).toMatch(/DC 10/i)
    // PHB 2024 dice "level 4 or higher" (texto canónico). El catálogo
    // antiguo tenía "level 4+". Aceptamos ambas formas.
    expect(dm!.description).toMatch(/level 4(\+|\s+or higher)/i)
  })

  it('Sleep is now a WIS-save Incapacitated/Unconscious spell (not 5d8 HP)', () => {
    const sl = getSpellById('1-sleep')
    expect(sl).toBeDefined()
    expect(sl!.description).toMatch(/WIS save|Wisdom saving throw/i)
    expect(sl!.description).not.toMatch(/5d8/)
  })

  it("Hunter's Mark damage is now Force type (was weapon's type in 2014)", () => {
    const hm = getSpellById('1-hunters-mark')
    expect(hm).toBeDefined()
    expect(hm!.description).toMatch(/Force damage/i)
    expect(hm!.description).toMatch(/Perception|Survival/i)
  })

  it('spell catalogue is non-empty', () => {
    expect(spells.length).toBeGreaterThan(50)
    expect(spells.filter(s => s.level === 0).length).toBeGreaterThan(0)
    expect(spells.filter(s => s.level === 9).length).toBeGreaterThan(0)
  })
})
