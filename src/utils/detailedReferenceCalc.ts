/**
 * #120 — Helpers puros para los cómputos del Detailed Reference del PDF anexo.
 *
 * Toda la lógica de cálculo de las nuevas secciones (Saving Throws, Hit Points,
 * Miscellaneous, Spellcasting Calculations, Spell Slots, Carrying Capacity)
 * vive aquí en funciones puras, separadas del renderizado pdf-lib. Esto
 * permite testar el QUÉ se imprime sin renderizar el PDF entero.
 *
 * Los `draw*` en `pdfAppendix.ts` consumen estas funciones y solo se ocupan
 * del CÓMO (posicionar texto, tablas, etc.).
 */

import type { CharacterData } from '@/stores/character'
import { getClassById } from '@/data/dnd5e/classes'
import {
  FULL_CASTER_SLOTS, HALF_CASTER_SLOTS, THIRD_CASTER_SLOTS, PACT_MAGIC_SLOTS,
} from '@/data/dnd5e/rules'

// ─── Utilidades comunes ──────────────────────────────────────────────────

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export function totalAbilityScore(char: CharacterData, key: AbilityKey): number {
  return (char.abilityScores[key] ?? 10)
    + (char.speciesBonuses?.[key] ?? 0)
    + (char.backgroundBonuses?.[key] ?? 0)
    + (char.asiBonuses?.[key] ?? 0)
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}

export function pbForLevel(lv: number): number {
  return lv >= 17 ? 6 : lv >= 13 ? 5 : lv >= 9 ? 4 : lv >= 5 ? 3 : 2
}

// ─── Saving Throws ───────────────────────────────────────────────────────

export interface SavingThrowRow {
  ability: AbilityKey
  total: number
  isProficient: boolean
  sources: string
}

export function computeSavingThrows(char: CharacterData): SavingThrowRow[] {
  const pb = pbForLevel(char.level || 1)
  const abilities: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  const profs = char.savingThrowProficiencies ?? []
  const featProfs = char.featAddedSavingThrows ?? []
  return abilities.map(a => {
    const mod = abilityModifier(totalAbilityScore(char, a))
    const isProf = profs.includes(a) || featProfs.includes(a)
    const total = mod + (isProf ? pb : 0)
    const sources = isProf
      ? `${a.toUpperCase()} ${fmtMod(mod)}, PB +${pb} (proficient)`
      : `${a.toUpperCase()} ${fmtMod(mod)}`
    return { ability: a, total, isProficient: isProf, sources }
  })
}

// ─── Hit Points ──────────────────────────────────────────────────────────

export interface HpBreakdownRow {
  label: string
  value: number
}

export interface HpBreakdown {
  rows: HpBreakdownRow[]
  total: number
}

export function computeHitPointsBreakdown(char: CharacterData): HpBreakdown | null {
  if (!char.className) return null
  const cls = getClassById(char.className)
  const hitDie = cls?.hitDie ?? char.hitDie ?? 8
  const conMod = abilityModifier(totalAbilityScore(char, 'con'))
  const lv = char.level || 1
  const className = cls?.name ?? char.className

  const rows: HpBreakdownRow[] = []
  // lv.1: max hit die
  rows.push({ label: `${className} lv.1 (max d${hitDie})`, value: hitDie })

  // lv.2..N: average per level
  if (lv >= 2) {
    const avg = Math.floor(hitDie / 2) + 1
    const restLv = lv - 1
    rows.push({ label: `${className} lv.2-${lv} (avg ${avg}/lv x ${restLv})`, value: avg * restLv })
  }

  // CON modifier × level
  rows.push({ label: `CON modifier (${fmtMod(conMod)} x ${lv} lv)`, value: conMod * lv })

  // Tough feat
  if (char.toughHpBonus && char.toughHpBonus > 0) {
    rows.push({ label: `Tough feat (+2 x ${lv} lv)`, value: char.toughHpBonus })
  }

  // Dwarven Toughness
  if (char.race === 'dwarf') {
    rows.push({ label: `Dwarven Toughness (+1 x ${lv} lv)`, value: lv })
  }

  return { rows, total: char.maxHp ?? rows.reduce((s, r) => s + r.value, 0) }
}

// ─── Miscellaneous (Initiative, Passive Perception, Expertise) ───────────

export interface MiscellaneousBlock {
  initiative: string
  passivePerception: string
  expertise?: string  // solo si hay alguna skill con expertise
}

function titleCaseSkill(id: string): string {
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function computeMiscellaneous(char: CharacterData): MiscellaneousBlock {
  const pb = pbForLevel(char.level || 1)
  const dexMod = abilityModifier(totalAbilityScore(char, 'dex'))
  const wisMod = abilityModifier(totalAbilityScore(char, 'wis'))

  // Initiative
  let initiative: string
  if (char.featInitiativeProf) {
    const total = dexMod + pb
    initiative = `Initiative: DEX ${fmtMod(dexMod)} + PB +${pb} (Alert feat) = ${fmtMod(total)}`
  } else {
    initiative = `Initiative: DEX ${fmtMod(dexMod)} = ${fmtMod(dexMod)}`
  }

  // Passive Perception
  const percProf = (char.skillProficiencies ?? []).includes('perception')
  const percExpert = (char.skillExpertise ?? []).includes('perception')
  const parts = [`10`, `WIS ${fmtMod(wisMod)}`]
  let percTotal = 10 + wisMod
  if (percProf) { parts.push(`PB +${pb} (proficient)`); percTotal += pb }
  if (percExpert) { parts.push(`PB +${pb} (expertise)`); percTotal += pb }
  const passivePerception = `Passive Perception: ${parts.join(' + ')} = ${percTotal}`

  // Skills with Expertise
  const expertSkills = (char.skillExpertise ?? []).map(titleCaseSkill)
  const expertise = expertSkills.length > 0
    ? `Skills with Expertise: ${expertSkills.join(', ')} (Proficiency Bonus counted twice = +${pb * 2}).`
    : undefined

  return { initiative, passivePerception, expertise }
}

// ─── Spellcasting Calculations ───────────────────────────────────────────

export interface SpellcastingCalculations {
  abilityLine: string
  saveDcLine: string
  attackBonusLine: string
  abilityKey: AbilityKey
  saveDc: number
  attackBonus: number
}

const ABILITY_FULL_NAME: Record<AbilityKey, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
}

export function computeSpellcastingCalculations(char: CharacterData): SpellcastingCalculations | null {
  const sAbility = char.spellcastingAbility as AbilityKey | undefined
  if (!sAbility) return null
  const pb = pbForLevel(char.level || 1)
  const sMod = abilityModifier(totalAbilityScore(char, sAbility))
  const fullName = ABILITY_FULL_NAME[sAbility]
  const ABILITY = sAbility.toUpperCase()
  const saveDc = 8 + pb + sMod
  const atk = pb + sMod
  return {
    abilityKey: sAbility,
    saveDc,
    attackBonus: atk,
    abilityLine: `Spellcasting Ability: ${fullName} (${ABILITY} ${fmtMod(sMod)})`,
    saveDcLine: `Spell Save DC: 8 + PB +${pb} + ${ABILITY} ${fmtMod(sMod)} = ${saveDc}`,
    attackBonusLine: `Spell Attack Bonus: PB +${pb} + ${ABILITY} ${fmtMod(sMod)} = ${fmtMod(atk)}`,
  }
}

// ─── Spell Slots ─────────────────────────────────────────────────────────

export interface SpellSlotsByLevel {
  type: 'standard' | 'pact'
  /** Para 'standard': slots por nivel de hechizo 1-9 (índice 0 = nivel 1). */
  slots?: readonly number[]
  /** Para 'pact': N slots todos del mismo nivel. */
  pactSlots?: number
  pactSlotLevel?: number
  /** Etiqueta humana: "Full Caster", "Half Caster", "Pact Magic", etc. */
  casterLabel: string
}

export function computeSpellSlots(char: CharacterData): SpellSlotsByLevel | null {
  if (!char.className) return null
  const cls = getClassById(char.className)
  const casterType = cls?.spellcasting?.casterType
  if (!casterType) return null
  const lv = char.level || 1

  if (casterType === 'full') {
    const slots = FULL_CASTER_SLOTS[lv - 1] ?? []
    if (!slots.length) return null
    return { type: 'standard', slots, casterLabel: 'Full Caster' }
  }
  if (casterType === 'half') {
    const slots = HALF_CASTER_SLOTS[lv - 1] ?? []
    if (!slots.length) return null
    return { type: 'standard', slots, casterLabel: 'Half Caster' }
  }
  if (casterType === 'third') {
    const slots = THIRD_CASTER_SLOTS[lv - 1] ?? []
    if (!slots.length) return null
    return { type: 'standard', slots, casterLabel: 'Third Caster' }
  }
  if (casterType === 'pact') {
    const pact = PACT_MAGIC_SLOTS[lv - 1]
    if (!pact) return null
    return {
      type: 'pact',
      pactSlots: pact.slots,
      pactSlotLevel: pact.slotLevel,
      casterLabel: 'Pact Magic',
    }
  }
  return null
}

// ─── Carrying Capacity ───────────────────────────────────────────────────

export interface CarryingCapacity {
  capacityLbs: number
  capacityKg: number
  pushDragLiftLbs: number
  pushDragLiftKg: number
  encumberedAtLbs: number
  encumberedAtKg: number
  heavilyEncumberedAtLbs: number
  heavilyEncumberedAtKg: number
  /** STR usado para el cálculo, ya incluyendo bonos species/background/ASI. */
  totalStr: number
}

/** Conversión libra → kilo (1 lb = 0.4536 kg), redondeo al entero. */
export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.4536)
}

export function computeCarryingCapacity(char: CharacterData): CarryingCapacity {
  const totalStr = totalAbilityScore(char, 'str')
  const capacityLbs = totalStr * 15
  const pushDragLiftLbs = totalStr * 30
  const encumberedAtLbs = totalStr * 5
  const heavilyEncumberedAtLbs = totalStr * 10
  return {
    capacityLbs, capacityKg: lbsToKg(capacityLbs),
    pushDragLiftLbs, pushDragLiftKg: lbsToKg(pushDragLiftLbs),
    encumberedAtLbs, encumberedAtKg: lbsToKg(encumberedAtLbs),
    heavilyEncumberedAtLbs, heavilyEncumberedAtKg: lbsToKg(heavilyEncumberedAtLbs),
    totalStr,
  }
}
