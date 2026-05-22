// milestone5.test.ts — Hito 5: Aasimar + 12 trasfondos PHB 2024
import { describe, it, expect } from 'vitest'
import { races, getRaceById } from '@/data/dnd5e/races'
import { backgrounds, getBackgroundById } from '@/data/dnd5e/backgrounds'

describe('Hito 5 — Aasimar + trasfondos PHB 2024', () => {
  it('Aasimar is present as a species', () => {
    const a = getRaceById('aasimar')
    expect(a).toBeDefined()
    expect(a!.name).toBe('Aasimar')
  })

  it('Aasimar has 10 species total', () => {
    expect(races.length).toBe(10)
  })

  it('Aasimar has Celestial Resistance trait', () => {
    const a = getRaceById('aasimar')!
    expect(a.traits.some(t => t.includes('Celestial Resistance'))).toBe(true)
  })

  it('Aasimar has Healing Hands trait', () => {
    const a = getRaceById('aasimar')!
    expect(a.traits.some(t => t.includes('Healing Hands'))).toBe(true)
  })

  it('Aasimar has Celestial Revelation at level 3', () => {
    const a = getRaceById('aasimar')!
    expect(a.traits.some(t => t.includes('Celestial Revelation'))).toBe(true)
  })

  it('all 16 PHB 2024 backgrounds are present', () => {
    const required = [
      'acolyte', 'artisan', 'charlatan', 'criminal', 'entertainer',
      'farmer', 'guard', 'guide', 'hermit', 'merchant',
      'noble', 'sage', 'sailor', 'scribe', 'soldier', 'wayfarer',
    ]
    const ids = backgrounds.map(b => b.id)
    for (const id of required) {
      expect(ids, `Missing background: ${id}`).toContain(id)
    }
  })

  it('new PHB backgrounds have abilityScores and originFeat', () => {
    const newBgs = ['guard', 'guide', 'merchant', 'scribe', 'wayfarer']
    for (const id of newBgs) {
      const bg = getBackgroundById(id)
      expect(bg, `Missing background ${id}`).toBeDefined()
      expect(bg!.abilityScores, `${id} missing abilityScores`).toBeDefined()
      expect(bg!.originFeat, `${id} missing originFeat`).toBeTruthy()
    }
  })

  it('updated PHB backgrounds have correct originFeat', () => {
    expect(getBackgroundById('entertainer')?.originFeat).toBe('musician')
    expect(getBackgroundById('hermit')?.originFeat).toBe('healer')
    expect(getBackgroundById('noble')?.originFeat).toBe('skilled')
    expect(getBackgroundById('charlatan')?.originFeat).toBe('skilled')
    expect(getBackgroundById('guard')?.originFeat).toBe('alert')
    expect(getBackgroundById('guide')?.originFeat).toBe('magic-initiate')
    expect(getBackgroundById('merchant')?.originFeat).toBe('lucky')
    expect(getBackgroundById('wayfarer')?.originFeat).toBe('lucky')
  })
})
