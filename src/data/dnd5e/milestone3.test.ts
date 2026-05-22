// Documento generado el 2026-05-19-2105
// Sanity check for Milestone 3: 12 base classes with their 12 SRD subclasses.

import { describe, it, expect } from 'vitest'
import { classes, getClassById, getSubclassById, getFeaturesForLevel } from '@/data/dnd5e/classes'

const expectedClasses: Array<{ id: string; subclassId: string; subclassName: string }> = [
  { id: 'barbarian', subclassId: 'berserker',          subclassName: 'Path of the Berserker' },
  { id: 'bard',      subclassId: 'lore',               subclassName: 'College of Lore' },
  { id: 'cleric',    subclassId: 'life-domain',        subclassName: 'Life Domain' },
  { id: 'druid',     subclassId: 'circle-of-the-land', subclassName: 'Circle of the Land' },
  { id: 'fighter',   subclassId: 'champion',           subclassName: 'Champion' },
  { id: 'monk',      subclassId: 'open-hand',          subclassName: 'Warrior of the Open Hand' },
  { id: 'paladin',   subclassId: 'oath-of-devotion',   subclassName: 'Oath of Devotion' },
  { id: 'ranger',    subclassId: 'hunter',             subclassName: 'Hunter' },
  { id: 'rogue',     subclassId: 'thief',              subclassName: 'Thief' },
  { id: 'sorcerer',  subclassId: 'draconic',           subclassName: 'Draconic Sorcery' },
  { id: 'warlock',   subclassId: 'fiend-patron',       subclassName: 'Fiend Patron' },
  { id: 'wizard',    subclassId: 'evoker',             subclassName: 'Evoker' },
]

describe('Milestone 3 — 12 classes with their SRD subclasses', () => {
  it('exposes exactly 12 classes', () => {
    expect(classes.length).toBe(12)
    const ids = classes.map(c => c.id)
    expect(ids).toEqual(expect.arrayContaining(expectedClasses.map(e => e.id)))
  })

  it.each(expectedClasses)('$id has the SRD subclass $subclassName at level 3', ({ id, subclassId, subclassName }) => {
    const cls = getClassById(id)
    expect(cls, `class ${id} should exist`).toBeDefined()
    expect(cls!.subclassLevel).toBe(3)
    expect(cls!.subclasses.length).toBeGreaterThanOrEqual(1)
    const sub = getSubclassById(id, subclassId)
    expect(sub, `subclass ${subclassId} of ${id} should exist`).toBeDefined()
    expect(sub!.name).toBe(subclassName)
    expect(sub!.features.length).toBeGreaterThanOrEqual(3)
  })

  it.each(expectedClasses)('$id has features covering levels 1-20', ({ id }) => {
    const cls = getClassById(id)!
    const minLevel = Math.min(...cls.features.map(f => f.level))
    const maxLevel = Math.max(...cls.features.map(f => f.level))
    expect(minLevel).toBe(1)
    expect(maxLevel).toBe(20)
  })

  it('all spellcasting classes are prepared casters in 2024 (spellsKnown null)', () => {
    const spellcasters = classes.filter(c => c.spellcasting !== null)
    expect(spellcasters.length).toBeGreaterThanOrEqual(7)
    for (const cls of spellcasters) {
      expect(cls.spellcasting!.preparedCaster, `${cls.id} should be a prepared caster`).toBe(true)
      expect(cls.spellcasting!.spellsKnown, `${cls.id} should not have a fixed spellsKnown list`).toBeNull()
    }
  })

  it('Barbarian has Weapon Mastery and Rages progression', () => {
    const barb = getClassById('barbarian')!
    expect(barb.weaponMasteryByLevel).toBeDefined()
    expect(barb.weaponMasteryByLevel!.length).toBe(20)
    expect(barb.progression?.rages).toBeDefined()
    expect(barb.progression?.rages?.length).toBe(20)
  })

  it('Fighter has Weapon Mastery at level 1', () => {
    const fighter = getClassById('fighter')!
    expect(fighter.weaponMasteryByLevel).toBeDefined()
    const masteryFeature = fighter.features.find(f => f.name.includes('Weapon Mastery'))
    expect(masteryFeature?.level).toBeLessThanOrEqual(1)
  })

  it('Monk has Focus Points (renamed from Ki) and Martial Arts die', () => {
    const monk = getClassById('monk')!
    expect(monk.progression?.focusPoints).toBeDefined()
    expect(monk.progression?.martialArtsDie).toBeDefined()
    expect(monk.progression?.focusPoints?.length).toBe(20)
  })

  it('Rogue has Sneak Attack and Thief subclass', () => {
    const rogue = getClassById('rogue')!
    const sneak = rogue.features.find(f => f.name.includes('Sneak Attack'))
    expect(sneak).toBeDefined()
    expect(rogue.subclasses[0]!.name).toBe('Thief')
  })

  it('Sorcerer has Sorcery Points progression', () => {
    const sorc = getClassById('sorcerer')!
    expect(sorc.progression?.sorceryPoints).toBeDefined()
    expect(sorc.progression?.sorceryPoints?.length).toBe(20)
  })

  it('Paladin has Lay On Hands', () => {
    const pal = getClassById('paladin')!
    const lay = pal.features.find(f => f.name.toLowerCase().includes('lay on hands'))
    expect(lay).toBeDefined()
  })

  it('every class grants an Epic Boon at level 19', () => {
    for (const cls of classes) {
      const epicBoon = cls.features.find(f => f.level === 19 && f.name.toLowerCase().includes('boon'))
      expect(epicBoon, `${cls.id} should have an Epic Boon at level 19`).toBeDefined()
    }
  })

  it('getFeaturesForLevel returns more features at higher levels', () => {
    const at1 = getFeaturesForLevel('wizard', 1).length
    const at10 = getFeaturesForLevel('wizard', 10).length
    const at20 = getFeaturesForLevel('wizard', 20).length
    expect(at1).toBeGreaterThan(0)
    expect(at10).toBeGreaterThan(at1)
    expect(at20).toBeGreaterThanOrEqual(at10)
  })
})
