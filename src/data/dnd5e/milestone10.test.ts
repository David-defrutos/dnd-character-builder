// Documento generado el 2026-05-19-2200
// Milestone 10 tests: ASI/Feat checkpoint logic.

import { describe, it, expect } from 'vitest'
import {
  getAsiLevels,
  isEpicBoonLevel,
  eligibleFeats,
  aggregateAsiBumps,
  ABILITY_KEYS,
} from '@/data/dnd5e/asi'
import { getClassById } from '@/data/dnd5e/classes'
import type { ASIChoice } from '@/stores/character'

describe('Milestone 10 — ASI / Feat checkpoints', () => {
  describe('ASI level detection', () => {
    it('Wizard gets ASIs at 4, 8, 12, 16, 19', () => {
      expect(getAsiLevels('wizard', 20)).toEqual([4, 8, 12, 16, 19])
    })

    it('Fighter gets the standard ASIs plus 6 and 14', () => {
      expect(getAsiLevels('fighter', 20)).toEqual([4, 6, 8, 12, 14, 16, 19])
    })

    it('Rogue gets the standard ASIs plus 10', () => {
      expect(getAsiLevels('rogue', 20)).toEqual([4, 8, 10, 12, 16, 19])
    })

    it('Barbarian gets the standard ASIs (no extras)', () => {
      expect(getAsiLevels('barbarian', 20)).toEqual([4, 8, 12, 16, 19])
    })

    it('Fighter at level 10 has exactly 3 checkpoints (4, 6, 8)', () => {
      expect(getAsiLevels('fighter', 10)).toEqual([4, 6, 8])
    })

    it('Fighter at level 5 has only one checkpoint (4)', () => {
      expect(getAsiLevels('fighter', 5)).toEqual([4])
    })

    it('Any class at level 3 has zero checkpoints', () => {
      for (const id of ['barbarian', 'fighter', 'rogue', 'wizard']) {
        expect(getAsiLevels(id, 3)).toEqual([])
      }
    })

    it('returns empty list for an unknown class', () => {
      expect(getAsiLevels('not-a-class', 20)).toEqual([])
    })
  })

  describe('isEpicBoonLevel', () => {
    it('only level 19 is an Epic Boon level', () => {
      expect(isEpicBoonLevel(19)).toBe(true)
      expect(isEpicBoonLevel(4)).toBe(false)
      expect(isEpicBoonLevel(20)).toBe(false)
    })
  })

  describe('eligibleFeats', () => {
    const fighter = getClassById('fighter')!

    // H6 (auditoría externa): PHB 2024 — los Origin feats se eligen
    // únicamente a través del background a lv.1. Los ASI normales solo
    // ofrecen General feats.
    it('exposes ONLY General feats at non-19 levels (PHB 2024 H6)', () => {
      const feats = eligibleFeats(4, fighter)
      const cats = new Set(feats.map(f => f.category))
      expect(cats.has('general')).toBe(true)
      expect(cats.has('origin')).toBe(false)
      expect(cats.has('epic-boon')).toBe(false)
    })

    it('exposes ONLY Epic Boon feats at level 19', () => {
      const feats = eligibleFeats(19, fighter)
      expect(feats.length).toBeGreaterThan(0)
      for (const f of feats) {
        expect(f.category).toBe('epic-boon')
      }
    })
  })

  describe('aggregateAsiBumps', () => {
    it('sums +2 and +1+1 correctly', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'asi', asiMode: '2',   asiAbilities: ['str'] },
        { level: 8, type: 'asi', asiMode: '1+1', asiAbilities: ['dex', 'con'] },
      ]
      const out = aggregateAsiBumps(choices)
      expect(out.str).toBe(2)
      expect(out.dex).toBe(1)
      expect(out.con).toBe(1)
      expect(out.int ?? 0).toBe(0)
    })

    it('skips feat checkpoints', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'alert' },
        { level: 8, type: 'asi', asiMode: '2', asiAbilities: ['cha'] },
      ]
      const out = aggregateAsiBumps(choices)
      expect(out.cha).toBe(2)
      expect(Object.keys(out)).toHaveLength(1)
    })

    it('stacks the same ability across checkpoints', () => {
      const choices: ASIChoice[] = [
        { level: 4,  type: 'asi', asiMode: '2', asiAbilities: ['str'] },
        { level: 6,  type: 'asi', asiMode: '2', asiAbilities: ['str'] }, // Fighter
        { level: 8,  type: 'asi', asiMode: '1+1', asiAbilities: ['str', 'con'] },
      ]
      const out = aggregateAsiBumps(choices)
      expect(out.str).toBe(5)
      expect(out.con).toBe(1)
    })

    it('returns empty object when no ASI choices', () => {
      expect(aggregateAsiBumps([])).toEqual({})
      expect(aggregateAsiBumps([{ level: 4, type: 'feat', featId: 'alert' }])).toEqual({})
    })
  })

  describe('Realistic Fighter 10 scenario', () => {
    it('Fighter 10 (Cecino case): 3 checkpoints with 2 ASIs + 1 feat', () => {
      const choices: ASIChoice[] = [
        { level: 4, type: 'asi',  asiMode: '2', asiAbilities: ['str'] },
        { level: 6, type: 'feat', featId: 'alert' },
        { level: 8, type: 'asi',  asiMode: '1+1', asiAbilities: ['dex', 'con'] },
      ]
      const levels = getAsiLevels('fighter', 10)
      expect(levels).toEqual([4, 6, 8])

      const bumps = aggregateAsiBumps(choices)
      expect(bumps.str).toBe(2)
      expect(bumps.dex).toBe(1)
      expect(bumps.con).toBe(1)
    })
  })

  describe('ABILITY_KEYS sanity', () => {
    it('exposes 6 abilities in canonical order', () => {
      expect(ABILITY_KEYS).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha'])
    })
  })
})
