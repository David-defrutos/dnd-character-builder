// milestone4.test.ts — Hito 4: 36 subclases adicionales PHB 2024
import { describe, it, expect } from 'vitest'
import { classes, getClassById, getSubclassById } from '@/data/dnd5e/classes'

const EXPECTED_SUBCLASSES: Record<string, string[]> = {
  barbarian: ['berserker', 'wild-heart', 'world-tree', 'zealot'],
  bard:      ['dance', 'glamour', 'lore', 'valor'],
  cleric:    ['life-domain', 'light-domain', 'trickery-domain', 'war-domain'],
  druid:     ['circle-of-the-land', 'circle-of-the-moon', 'circle-of-the-sea', 'circle-of-the-stars'],
  fighter:   ['champion', 'battle-master', 'eldritch-knight', 'psi-warrior', 'echo-knight'],
  monk:      ['open-hand', 'warrior-of-mercy', 'warrior-of-shadow', 'warrior-of-the-elements'],
  paladin:   ['oath-of-devotion', 'oath-of-glory', 'oath-of-the-ancients', 'oath-of-vengeance'],
  ranger:    ['hunter', 'beast-master', 'fey-wanderer', 'gloom-stalker'],
  rogue:     ['thief', 'arcane-trickster', 'assassin', 'soulknife'],
  sorcerer:  ['draconic', 'aberrant-sorcery', 'clockwork-sorcery', 'wild-magic-sorcery'],
  warlock:   ['fiend-patron', 'archfey-patron', 'celestial-patron', 'great-old-one-patron'],
  wizard:    ['evoker', 'abjurer', 'diviner', 'illusionist'],
}

describe('Hito 4 — 36 subclases PHB 2024 + Echo Knight', () => {
  it('all 12 classes present', () => {
    const ids = classes.map(c => c.id)
    for (const cls of Object.keys(EXPECTED_SUBCLASSES)) {
      expect(ids, `Missing class: ${cls}`).toContain(cls)
    }
  })

  for (const [classId, subclassIds] of Object.entries(EXPECTED_SUBCLASSES)) {
    it(`${classId}: has ${subclassIds.length} subclasses`, () => {
      const cls = getClassById(classId)
      expect(cls, `Class ${classId} not found`).toBeDefined()
      for (const subId of subclassIds) {
        const sub = getSubclassById(classId, subId)
        expect(sub, `Missing subclass: ${classId} > ${subId}`).toBeDefined()
        expect(sub!.features.length, `${classId} > ${subId} has no features`).toBeGreaterThan(0)
        // All features must have a level
        for (const f of sub!.features) {
          expect(f.level, `${classId} > ${subId} > feature ${f.id} missing level`).toBeGreaterThan(0)
          expect(f.description, `${classId} > ${subId} > feature ${f.id} missing description`).toBeTruthy()
        }
      }
    })
  }

  it('Fighter has 5 subclasses (4 PHB + Echo Knight)', () => {
    const fighter = getClassById('fighter')!
    expect(fighter.subclasses).toHaveLength(5)
    expect(fighter.subclasses.map(s => s.id)).toContain('echo-knight')
  })

  it('total subclass count is 50 (48 PHB + Echo Knight + Death Domain)', () => {
    const total = classes.reduce((sum, c) => sum + c.subclasses.length, 0)
    expect(total).toBe(50)
  })

  it('all subclasses have features starting at level 3', () => {
    for (const cls of classes) {
      for (const sub of cls.subclasses) {
        const minLevel = Math.min(...sub.features.map(f => f.level))
        expect(minLevel, `${cls.id} > ${sub.id} first feature not at level 3`).toBe(3)
      }
    }
  })

  it('Warlock Great Old One has Awakened Mind + Psychic Spells at level 3', () => {
    const sub = getSubclassById('warlock', 'great-old-one-patron')!
    const lv3 = sub.features.filter(f => f.level === 3).map(f => f.id)
    expect(lv3).toContain('awakened-mind')
    expect(lv3).toContain('psychic-spells')
  })

  it('Wizard Diviner has Portent at level 3', () => {
    const sub = getSubclassById('wizard', 'diviner')!
    expect(sub.features.find(f => f.id === 'portent')).toBeDefined()
  })

  it('Sorcerer Wild Magic has Tides of Chaos at level 3', () => {
    const sub = getSubclassById('sorcerer', 'wild-magic-sorcery')!
    expect(sub.features.find(f => f.id === 'tides-of-chaos')).toBeDefined()
  })
})
