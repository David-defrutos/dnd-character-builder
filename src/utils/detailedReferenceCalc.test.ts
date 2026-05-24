// #120 — Tests para los helpers puros del Detailed Reference.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import type { CharacterData } from '@/stores/character'
import {
  totalAbilityScore, abilityModifier, fmtMod, pbForLevel,
  computeSavingThrows, computeHitPointsBreakdown, computeMiscellaneous,
  computeSpellcastingCalculations, computeSpellcastingCalculationsByClass,
  computeSpellSlots, computeCarryingCapacity,
  lbsToKg,
} from './detailedReferenceCalc'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

/** Setup Salusa lv.10 Bard Glamour para casos reales. */
function salusa(): CharacterData {
  const char = freshChar()
  char.name = 'Salusa Secundus'
  char.className = 'bard'
  char.subclass = 'glamour'
  char.level = 10
  char.race = 'aasimar'
  char.background = 'wayfarer'
  char.hitDie = 8
  char.maxHp = 53
  char.abilityScores = { str: 8, dex: 13, con: 10, int: 15, wis: 12, cha: 15 }
  char.backgroundBonuses = { cha: 2, dex: 1 }
  char.asiBonuses = { cha: 2 }
  char.savingThrowProficiencies = ['dex', 'cha']
  char.skillProficiencies = ['acrobatics', 'stealth', 'insight', 'perception', 'performance', 'persuasion']
  char.skillExpertise = ['acrobatics', 'stealth', 'insight', 'perception']
  char.spellcastingAbility = 'cha'
  return char
}

describe('#120 — detailedReferenceCalc helpers básicos', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('totalAbilityScore suma base + species + background + ASI', () => {
    const char = freshChar()
    char.abilityScores.cha = 15
    char.backgroundBonuses = { cha: 2 }
    char.asiBonuses = { cha: 2 }
    expect(totalAbilityScore(char, 'cha')).toBe(19)
  })

  it('totalAbilityScore default 10 si falta el campo', () => {
    const char = freshChar()
    expect(totalAbilityScore(char, 'str')).toBeGreaterThanOrEqual(8) // default del store
  })

  it('abilityModifier calcula bien', () => {
    expect(abilityModifier(19)).toBe(4)
    expect(abilityModifier(15)).toBe(2)
    expect(abilityModifier(10)).toBe(0)
    expect(abilityModifier(8)).toBe(-1)
    expect(abilityModifier(1)).toBe(-5)
  })

  it('fmtMod añade signo +', () => {
    expect(fmtMod(4)).toBe('+4')
    expect(fmtMod(0)).toBe('+0')
    expect(fmtMod(-1)).toBe('-1')
  })

  it('pbForLevel: escalones canónicos PHB', () => {
    expect(pbForLevel(1)).toBe(2)
    expect(pbForLevel(4)).toBe(2)
    expect(pbForLevel(5)).toBe(3)
    expect(pbForLevel(8)).toBe(3)
    expect(pbForLevel(9)).toBe(4)
    expect(pbForLevel(12)).toBe(4)
    expect(pbForLevel(13)).toBe(5)
    expect(pbForLevel(16)).toBe(5)
    expect(pbForLevel(17)).toBe(6)
    expect(pbForLevel(20)).toBe(6)
  })

  it('lbsToKg redondea al entero', () => {
    expect(lbsToKg(120)).toBe(54)
    expect(lbsToKg(240)).toBe(109)
    expect(lbsToKg(40)).toBe(18)
    expect(lbsToKg(80)).toBe(36)
    expect(lbsToKg(0)).toBe(0)
  })
})

describe('#120 — computeSavingThrows', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('Salusa: 6 filas, DEX y CHA proficient', () => {
    const rows = computeSavingThrows(salusa())
    expect(rows).toHaveLength(6)
    const byAbility = Object.fromEntries(rows.map(r => [r.ability, r]))
    expect(byAbility.str?.total).toBe(-1)
    expect(byAbility.dex?.total).toBe(6) // mod +2 + PB +4
    expect(byAbility.dex?.isProficient).toBe(true)
    expect(byAbility.con?.total).toBe(0)
    expect(byAbility.int?.total).toBe(2)
    expect(byAbility.wis?.total).toBe(1)
    expect(byAbility.cha?.total).toBe(8) // mod +4 + PB +4
    expect(byAbility.cha?.isProficient).toBe(true)
  })

  it('Sources string incluye "(proficient)" si lo es', () => {
    const rows = computeSavingThrows(salusa())
    const cha = rows.find(r => r.ability === 'cha')!
    expect(cha.sources).toContain('CHA +4')
    expect(cha.sources).toContain('PB +4 (proficient)')
    const str = rows.find(r => r.ability === 'str')!
    expect(str.sources).toBe('STR -1')
  })

  it('Resilient feat añade saving throw proficiency', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 4
    char.abilityScores.wis = 12
    char.featAddedSavingThrows = ['wis']
    const rows = computeSavingThrows(char)
    const wis = rows.find(r => r.ability === 'wis')!
    expect(wis.isProficient).toBe(true)
    expect(wis.total).toBe(3) // mod +1 + PB +2
  })
})

describe('#120 — computeHitPointsBreakdown', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('Salusa Bard lv.10: 53 HP (8 + avg 5×9 + CON 0×10)', () => {
    const bd = computeHitPointsBreakdown(salusa())
    expect(bd).not.toBeNull()
    expect(bd!.total).toBe(53)
    // 4 filas: lv.1, lv.2-10, CON, (no Tough, no Dwarven)
    expect(bd!.rows).toHaveLength(3)
    expect(bd!.rows[0]!.value).toBe(8)   // d8 max
    expect(bd!.rows[1]!.value).toBe(45)  // avg 5 × 9 lv
    expect(bd!.rows[2]!.value).toBe(0)   // CON +0 × 10
  })

  it('lv.1 monoclase: solo 1 fila lv.1 + CON', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 1
    char.abilityScores.con = 14 // CON +2
    char.maxHp = 12
    const bd = computeHitPointsBreakdown(char)
    expect(bd).not.toBeNull()
    // 2 filas: Fighter lv.1 (d10 max=10) + CON (+2 × 1 lv = 2)
    expect(bd!.rows).toHaveLength(2)
    expect(bd!.rows[0]!.value).toBe(10)
    expect(bd!.rows[1]!.value).toBe(2)
  })

  it('Tough feat: añade fila propia', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 5
    char.toughHpBonus = 10 // 2 × 5
    char.maxHp = 50
    const bd = computeHitPointsBreakdown(char)
    const labels = bd!.rows.map(r => r.label)
    expect(labels.some(l => l.includes('Tough'))).toBe(true)
    expect(bd!.rows.find(r => r.label.includes('Tough'))?.value).toBe(10)
  })

  it('Dwarven Toughness: añade fila propia', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.race = 'dwarf'
    char.level = 5
    char.maxHp = 60
    const bd = computeHitPointsBreakdown(char)
    const dwarven = bd!.rows.find(r => r.label.includes('Dwarven'))
    expect(dwarven).toBeDefined()
    expect(dwarven!.value).toBe(5) // +1 × 5 lv
  })

  it('PJ sin className → null', () => {
    const char = freshChar()
    char.className = ''
    expect(computeHitPointsBreakdown(char)).toBeNull()
  })
})

describe('#120 — computeMiscellaneous', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('Salusa: Initiative simple DEX +2', () => {
    const m = computeMiscellaneous(salusa())
    expect(m.initiative).toBe('Initiative: DEX +2 = +2')
  })

  it('Alert feat: añade PB a Initiative', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 9 // PB = 4
    char.abilityScores.dex = 14
    char.featInitiativeProf = true
    const m = computeMiscellaneous(char)
    expect(m.initiative).toContain('+ PB +4 (Alert feat)')
    expect(m.initiative).toContain('= +6')
  })

  it('Salusa: Passive Perception = 19 (WIS +1 + PB +4 prof + PB +4 expertise)', () => {
    const m = computeMiscellaneous(salusa())
    expect(m.passivePerception).toContain('= 19')
    expect(m.passivePerception).toContain('PB +4 (proficient)')
    expect(m.passivePerception).toContain('PB +4 (expertise)')
  })

  it('Sin proficiency en Perception: Passive = 10 + WIS', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 1
    char.abilityScores.wis = 12
    char.skillProficiencies = []
    char.skillExpertise = []
    const m = computeMiscellaneous(char)
    expect(m.passivePerception).toBe('Passive Perception: 10 + WIS +1 = 11')
  })

  it('Salusa: Skills with Expertise lista las 4', () => {
    const m = computeMiscellaneous(salusa())
    expect(m.expertise).toBeDefined()
    expect(m.expertise).toContain('Acrobatics')
    expect(m.expertise).toContain('Stealth')
    expect(m.expertise).toContain('Insight')
    expect(m.expertise).toContain('Perception')
    expect(m.expertise).toContain('counted twice = +8')
  })

  it('Sin Expertise: expertise = undefined', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 1
    char.skillExpertise = []
    const m = computeMiscellaneous(char)
    expect(m.expertise).toBeUndefined()
  })

  it('Skill multi-palabra: "sleight-of-hand" → "Sleight Of Hand"', () => {
    const char = freshChar()
    char.className = 'rogue'
    char.level = 1
    char.skillExpertise = ['sleight-of-hand']
    const m = computeMiscellaneous(char)
    expect(m.expertise).toContain('Sleight Of Hand')
  })
})

describe('#120 — computeSpellcastingCalculations', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('Salusa: CHA +4, PB +4 → DC 16, Atk +8', () => {
    const c = computeSpellcastingCalculations(salusa())
    expect(c).not.toBeNull()
    expect(c!.abilityKey).toBe('cha')
    expect(c!.saveDc).toBe(16)
    expect(c!.attackBonus).toBe(8)
    expect(c!.abilityLine).toBe('Spellcasting Ability: Charisma (CHA +4)')
    expect(c!.saveDcLine).toBe('Spell Save DC: 8 + PB +4 + CHA +4 = 16')
    expect(c!.attackBonusLine).toBe('Spell Attack Bonus: PB +4 + CHA +4 = +8')
  })

  it('Sin spellcasting ability: null', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.spellcastingAbility = ''
    expect(computeSpellcastingCalculations(char)).toBeNull()
  })

  it('Wizard INT +5 lv.5 (PB +3) → DC 16, Atk +8', () => {
    const char = freshChar()
    char.className = 'wizard'
    char.level = 5
    char.abilityScores.int = 20
    char.spellcastingAbility = 'int'
    const c = computeSpellcastingCalculations(char)!
    expect(c.saveDc).toBe(16)
    expect(c.attackBonus).toBe(8)
    expect(c.abilityLine).toContain('Intelligence')
  })
})

describe('#139 Fase 5 — computeSpellcastingCalculationsByClass', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('PJ sin caster: array vacío', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 5
    char.subclass = 'champion'
    char.abilityScores = { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }
    char.classes = [{ classId: 'fighter', subclass: 'champion', level: 5, hitDie: 10 }]
    expect(computeSpellcastingCalculationsByClass(char)).toEqual([])
  })

  it('PJ monoclase wizard: un solo elemento', () => {
    const char = freshChar()
    char.className = 'wizard'
    char.subclass = ''
    char.level = 5
    char.abilityScores = { str: 8, dex: 14, con: 14, int: 17, wis: 12, cha: 10 }
    char.spellcastingAbility = 'int'
    char.classes = [{ classId: 'wizard', subclass: '', level: 5, hitDie: 6 }]
    const r = computeSpellcastingCalculationsByClass(char)
    expect(r).toHaveLength(1)
    expect(r[0]!.classId).toBe('wizard')
    expect(r[0]!.classLevel).toBe(5)
    expect(r[0]!.abilityKey).toBe('int')
    expect(r[0]!.saveDc).toBeGreaterThan(0)
    expect(r[0]!.attackBonus).toBeGreaterThan(0)
  })

  it('PJ multiclass Cleric+Wizard: dos elementos con abilities distintas', () => {
    const char = freshChar()
    char.className = 'cleric'
    char.subclass = ''
    char.level = 8  // 5+3
    char.abilityScores = { str: 10, dex: 12, con: 14, int: 16, wis: 16, cha: 10 }
    char.spellcastingAbility = 'wis'
    char.classes = [
      { classId: 'cleric', subclass: '', level: 5, hitDie: 8 },
      { classId: 'wizard', subclass: '', level: 3, hitDie: 6 },
    ]
    const r = computeSpellcastingCalculationsByClass(char)
    expect(r).toHaveLength(2)
    expect(r.map(c => c.classId).sort()).toEqual(['cleric', 'wizard'])
    const cleric = r.find(c => c.classId === 'cleric')!
    const wizard = r.find(c => c.classId === 'wizard')!
    expect(cleric.abilityKey).toBe('wis')
    expect(wizard.abilityKey).toBe('int')
    // PB es del nivel TOTAL (8 → PB 3), no por clase.
    // saveDc = 8 + 3 + mod. WIS 16 → mod +3 → DC 14. INT 16 → mod +3 → DC 14.
    expect(cleric.saveDc).toBe(14)
    expect(wizard.saveDc).toBe(14)
    expect(cleric.attackBonus).toBe(6)
    expect(wizard.attackBonus).toBe(6)
  })

  it('multiclass con clase non-caster: solo se incluyen casters', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = ''
    char.level = 8  // 4+4
    char.abilityScores = { str: 16, dex: 12, con: 14, int: 16, wis: 10, cha: 8 }
    char.classes = [
      { classId: 'fighter', subclass: '', level: 4, hitDie: 10 },
      { classId: 'wizard', subclass: '', level: 4, hitDie: 6 },
    ]
    const r = computeSpellcastingCalculationsByClass(char)
    expect(r).toHaveLength(1)
    expect(r[0]!.classId).toBe('wizard')
  })

  it('prioriza entry.spellcastingAbility sobre la del catálogo', () => {
    const char = freshChar()
    char.className = 'wizard'
    char.subclass = ''
    char.level = 5
    char.abilityScores = { str: 8, dex: 14, con: 14, int: 17, wis: 16, cha: 10 }
    // entry indica WIS por si en algún momento la app permite cambiar la
    // ability spellcasting de una clase (variante de mesa).
    char.classes = [
      { classId: 'wizard', subclass: '', level: 5, hitDie: 6, spellcastingAbility: 'wis' },
    ]
    const r = computeSpellcastingCalculationsByClass(char)
    expect(r[0]!.abilityKey).toBe('wis')
  })
})

describe('#120 — computeSpellSlots', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('Salusa Bard lv.10 (Full Caster): 4/3/3/3/2', () => {
    const s = computeSpellSlots(salusa())
    expect(s).not.toBeNull()
    expect(s!.type).toBe('standard')
    expect(s!.casterLabel).toBe('Full Caster')
    expect(s!.slots).toEqual([4, 3, 3, 3, 2])
  })

  it('Paladin lv.5 (Half Caster)', () => {
    const char = freshChar()
    char.className = 'paladin'
    char.level = 5
    const s = computeSpellSlots(char)!
    expect(s.casterLabel).toBe('Half Caster')
    expect(s.slots!.length).toBeGreaterThan(0)
  })

  it('Warlock lv.5: Pact Magic', () => {
    const char = freshChar()
    char.className = 'warlock'
    char.level = 5
    const s = computeSpellSlots(char)
    expect(s).not.toBeNull()
    expect(s!.type).toBe('pact')
    expect(s!.casterLabel).toBe('Pact Magic')
    expect(s!.pactSlots).toBeGreaterThan(0)
    expect(s!.pactSlotLevel).toBeGreaterThan(0)
  })

  it('Fighter lv.5 (no caster): null', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 5
    expect(computeSpellSlots(char)).toBeNull()
  })

  it('PJ sin clase: null', () => {
    const char = freshChar()
    char.className = ''
    expect(computeSpellSlots(char)).toBeNull()
  })
})

describe('#120 — computeCarryingCapacity', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('Salusa STR 8: 120 lbs (54 kg)', () => {
    const c = computeCarryingCapacity(salusa())
    expect(c.totalStr).toBe(8)
    expect(c.capacityLbs).toBe(120)
    expect(c.capacityKg).toBe(54)
    expect(c.pushDragLiftLbs).toBe(240)
    expect(c.pushDragLiftKg).toBe(109)
    expect(c.encumberedAtLbs).toBe(40)
    expect(c.encumberedAtKg).toBe(18)
    expect(c.heavilyEncumberedAtLbs).toBe(80)
    expect(c.heavilyEncumberedAtKg).toBe(36)
  })

  it('STR 18: 270 lbs (122 kg)', () => {
    const char = freshChar()
    char.abilityScores.str = 18
    const c = computeCarryingCapacity(char)
    expect(c.totalStr).toBe(18)
    expect(c.capacityLbs).toBe(270)
    expect(c.capacityKg).toBe(122)
  })

  it('STR con bonos: incluye species + background + ASI', () => {
    const char = freshChar()
    char.abilityScores.str = 10
    char.speciesBonuses = { str: 2 }
    char.backgroundBonuses = { str: 1 }
    char.asiBonuses = { str: 2 }
    const c = computeCarryingCapacity(char)
    expect(c.totalStr).toBe(15)
    expect(c.capacityLbs).toBe(225)
  })
})
