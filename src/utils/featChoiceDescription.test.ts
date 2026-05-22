// #107 — Test de featChoiceDescription
import { describe, it, expect } from 'vitest'
import {
  describeAsiFeatChoice,
  describeOriginFeatChoice,
  describeFightingStyle,
  feateDisplayName,
} from './featChoiceDescription'
import type { CharacterData, ASIChoice } from '@/stores/character'

function emptyChar(): CharacterData {
  return {
    asiChoices: [],
    magicInitiateChoices: [],
  } as unknown as CharacterData
}

describe('describeAsiFeatChoice', () => {
  it('Resilient (WIS) → "WIS"', () => {
    const choice: ASIChoice = {
      level: 6, type: 'feat', featId: 'resilient', featAbility: 'wis',
    }
    expect(describeAsiFeatChoice(choice, emptyChar())).toBe('WIS')
  })

  it('Crossbow Expert (DEX, single option) → "" (no se muestra)', () => {
    // Crossbow Expert solo permite DEX en su asiBonus.abilities,
    // así que no es elección. featAbility se guarda pero no se muestra.
    const choice: ASIChoice = {
      level: 4, type: 'feat', featId: 'crossbow-expert', featAbility: 'dex',
    }
    expect(describeAsiFeatChoice(choice, emptyChar())).toBe('')
  })

  it('Crusher (STR/CON elegida STR) → "+1 STR"', () => {
    const choice: ASIChoice = {
      level: 4, type: 'feat', featId: 'crusher', featAbility: 'str',
    }
    expect(describeAsiFeatChoice(choice, emptyChar())).toBe('+1 STR')
  })

  it('Skilled (3 choices) → "Athletics, Stealth, Perception"', () => {
    // El grupo de Skilled tiene id 'choices', no 'skills'.
    const choice: ASIChoice = {
      level: 4, type: 'feat', featId: 'skilled',
      featChoices: { choices: ['athletics', 'stealth', 'perception'] },
    }
    expect(describeAsiFeatChoice(choice, emptyChar())).toBe('Athletics, Stealth, Perception')
  })

  it('Skill Expert (2 grupos: skill + expertise) → etiquetas separadas', () => {
    const choice: ASIChoice = {
      level: 4, type: 'feat', featId: 'skill-expert', featAbility: 'wis',
      featChoices: { skill: ['arcana'], expertise: ['perception'] },
    }
    const out = describeAsiFeatChoice(choice, emptyChar())
    expect(out).toContain('+1 WIS')
    expect(out).toContain('skill: Arcana')
    expect(out).toContain('expertise: Perception')
  })

  it('ASI puro (no feat) → ""', () => {
    const choice = { level: 4, type: 'asi' } as unknown as ASIChoice
    expect(describeAsiFeatChoice(choice, emptyChar())).toBe('')
  })
})

describe('describeOriginFeatChoice', () => {
  it('Magic Initiate (Cleric) → "Cleric: Guidance Resistance Bless"', () => {
    const char = emptyChar()
    char.magicInitiateChoices = [
      { source: 'origin', spellList: 'cleric',
        cantrips: ['guidance', 'resistance'], levelOneSpell: '1-bless' },
    ]
    const out = describeOriginFeatChoice('magic-initiate', char)
    expect(out).toContain('Cleric:')
    expect(out).toContain('Guidance')
    expect(out).toContain('Resistance')
    expect(out).toContain('Bless')
  })

  it('Origin feat sin elección → ""', () => {
    expect(describeOriginFeatChoice('alert', emptyChar())).toBe('')
  })
})

describe('describeFightingStyle', () => {
  it('Archery → "+2 to ranged weapon attack rolls"', () => {
    expect(describeFightingStyle('archery')).toBe('+2 to ranged weapon attack rolls')
  })

  it('Dueling → +2 damage clause', () => {
    expect(describeFightingStyle('dueling')).toContain('+2 damage')
  })

  it('Defense → +1 AC', () => {
    expect(describeFightingStyle('defense')).toContain('+1 AC')
  })
})

describe('feateDisplayName', () => {
  it('Resilient ASI lv.6 (WIS) → "Resilient (WIS)"', () => {
    const choice: ASIChoice = {
      level: 6, type: 'feat', featId: 'resilient', featAbility: 'wis',
    }
    expect(feateDisplayName('resilient', 'asi', emptyChar(), choice))
      .toBe('Resilient (WIS)')
  })

  it('Origin feat sin elección → solo nombre', () => {
    expect(feateDisplayName('alert', 'origin', emptyChar())).toBe('Alert')
  })

  it('Fighting Style archery → "Archery (+2 to ranged ...)"', () => {
    expect(feateDisplayName('archery', 'fighting-style', emptyChar()))
      .toBe('Archery (+2 to ranged weapon attack rolls)')
  })
})
