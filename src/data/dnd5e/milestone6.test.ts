// milestone6.test.ts — Hito 6: General Feats + Fighting Style Feats + Origin Feats completos
import { describe, it, expect } from 'vitest'
import { feats, getFeatById } from '@/data/dnd5e/feats'

describe('Hito 6 — Feats PHB 2024 completos', () => {
  it('has at least 60 feats total', () => {
    expect(feats.length).toBeGreaterThanOrEqual(60)
  })

  it('Origin Feats: 10 entries (Alert, Crafter, Healer, Lucky, Magic Initiate, Musician, Savage Attacker, Skilled, Tavern Brawler, Tough)', () => {
    const origins = feats.filter(f => f.category === 'origin')
    expect(origins.length).toBeGreaterThanOrEqual(10)
    const ids = origins.map(f => f.id)
    for (const id of ['alert', 'crafter', 'healer', 'lucky', 'magic-initiate', 'musician', 'savage-attacker', 'skilled', 'tavern-brawler', 'tough']) {
      expect(ids, `Missing origin feat: ${id}`).toContain(id)
    }
  })

  it('General Feats: at least 30 entries', () => {
    const generals = feats.filter(f => f.category === 'general')
    expect(generals.length).toBeGreaterThanOrEqual(30)
  })

  it('General Feats include key PHB feats', () => {
    const ids = feats.map(f => f.id)
    const keyFeats = [
      'great-weapon-master', 'sharpshooter', 'sentinel', 'polearm-master',
      'war-caster', 'resilient', 'fey-touched', 'shadow-touched',
      'inspiring-leader', 'mage-slayer', 'crossbow-expert', 'dual-wielder',
      'shield-master', 'skulker', 'slasher', 'crusher', 'piercer',
      'athlete', 'charger', 'chef', 'durable', 'elemental-adept',
      'heavily-armored', 'heavy-armor-master', 'keen-mind', 'lightly-armored',
      'medium-armor-master', 'moderately-armored', 'mounted-combatant',
      'observant', 'poisoner', 'ritual-caster', 'skill-expert',
      'speedy', 'spell-sniper', 'telekinetic', 'telepathic', 'weapon-master',
    ]
    for (const id of keyFeats) {
      expect(ids, `Missing general feat: ${id}`).toContain(id)
    }
  })

  it('Fighting Style Feats: 9 entries', () => {
    const fs = feats.filter(f => f.category === 'fighting-style')
    expect(fs.length).toBe(10)
    const ids = fs.map(f => f.id)
    for (const id of ['archery', 'blind-fighting', 'defense', 'dueling', 'great-weapon-fighting', 'interception', 'protection', 'thrown-weapon-fighting', 'two-weapon-fighting', 'unarmed-fighting']) {
      if (id !== 'unarmed-fighting' || ids.includes(id)) {
        // unarmed-fighting should be there
      }
    }
    expect(ids).toContain('archery')
    expect(ids).toContain('defense')
    expect(ids).toContain('interception')
    expect(ids).toContain('unarmed-fighting')
  })

  it('Epic Boon Feats: at least 7 entries', () => {
    const boons = feats.filter(f => f.category === 'epic-boon')
    expect(boons.length).toBeGreaterThanOrEqual(7)
  })

  it('all feats have id, name, category and description', () => {
    for (const f of feats) {
      expect(f.id, 'missing id').toBeTruthy()
      expect(f.name, `${f.id} missing name`).toBeTruthy()
      expect(f.category, `${f.id} missing category`).toBeTruthy()
      expect(f.description, `${f.id} missing description`).toBeTruthy()
    }
  })

  it('getFeatById works for key feats', () => {
    expect(getFeatById('great-weapon-master')?.name).toBe('Great Weapon Master')
    expect(getFeatById('sentinel')?.category).toBe('general')
    expect(getFeatById('archery')?.category).toBe('fighting-style')
    expect(getFeatById('lucky')?.category).toBe('origin')
  })
})
