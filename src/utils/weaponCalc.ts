// Documento generado el 2026-05-20-1900 — milestone 20 (#53 weapon attack bonus)
//
// Reglas PHB 2024:
//   - Attack roll: d20 + ability_mod + (PB si proficient) + magic_bonus
//   - Damage:     weapon_die + ability_mod + magic_bonus
//
// Ability usado:
//   - Armas con `ammunition` (Crossbows, Bows, etc.) → DEX
//   - Armas con `finesse` → max(STR, DEX)
//   - Resto (Melee no-finesse) → STR
//
// El bonus mágico se extrae del nombre con regex (ej: "Longsword +1" → +1).

import type { CharacterData } from '@/stores/character'
import { modifier, proficiencyBonus } from './calculations'
import { simpleWeapons, martialWeapons, type WeaponData } from '@/data/dnd5e/equipment'
import { getFeatById } from '@/data/dnd5e/feats'
import { getClassById } from '@/data/dnd5e/classes'

const ALL_WEAPONS: readonly WeaponData[] = [...simpleWeapons, ...martialWeapons]

/** Extract magic bonus from a weapon name. "Longsword +2" → 2. No match → 0. */
export function extractMagicBonus(name: string): number {
  const m = name.match(/\+(\d+)\b/)
  return m && m[1] ? parseInt(m[1], 10) : 0
}

/** Strip magic bonus suffix from a name. "Longsword +2" → "Longsword". */
export function stripMagicBonus(name: string): string {
  return name.replace(/\s*\+\d+\s*$/, '').trim()
}

/** Look up the base weapon data by name (case-insensitive, ignores magic bonus). */
export function findWeaponData(name: string): WeaponData | undefined {
  if (!name) return undefined
  const stripped = stripMagicBonus(name).toLowerCase()
  return ALL_WEAPONS.find(w => w.name.toLowerCase() === stripped)
}

/** Returns the ability key (str/dex) to use for an attack with this weapon. */
export function weaponAttackAbility(
  weapon: WeaponData | undefined,
  abilityMods: { str: number; dex: number },
): 'str' | 'dex' {
  if (!weapon) return 'str' // unknown → default
  const props = weapon.properties.map(p => p.toLowerCase())
  const isRanged = props.some(p => p.startsWith('ammunition'))
  if (isRanged) return 'dex'
  const isFinesse = props.includes('finesse')
  if (isFinesse) return abilityMods.dex >= abilityMods.str ? 'dex' : 'str'
  return 'str'
}

/** True if the character is proficient with this weapon.
 *
 *  Checks (in order):
 *    1. char.proficienciesOther (free-text overrides, e.g. racial bonuses).
 *    2. Class weaponProficiencies (single class via char.className, plus
 *       any classes[] entries for multiclass). Class codes:
 *         - 'simple'           → all simple weapons
 *         - 'martial'          → all martial weapons
 *         - 'martial-light'    → martial weapons with the 'light' property (Monk)
 *         - 'martial-finesse'  → martial weapons with the 'finesse' property (Rogue)
 *
 *  Bug #53: antes solo miraba proficienciesOther. Como las clases NO escriben
 *  ahí sus proficiencies (viven en la clase), un Fighter atacando con un
 *  Rapier salía non-proficient → falta PB en el ataque (Cecino lv10 Rapier
 *  daba +3 en vez de +7).
 */
export function isProficientWithWeapon(char: CharacterData, weapon: WeaponData | undefined): boolean {
  if (!weapon) return true // unknown weapon — assume proficient (defensive)

  // 1. proficienciesOther (overrides explícitos, ej. raza/feat).
  const profs = (char.proficienciesOther ?? []).map(p => p.toLowerCase())
  const isMartial = martialWeapons.some(w => w.name === weapon.name)
  if (isMartial && profs.some(p => p.includes('martial weapon'))) return true
  if (!isMartial && profs.some(p => p.includes('simple weapon'))) return true
  if (profs.some(p => p.includes(weapon.name.toLowerCase()))) return true

  // 2. weaponProficiencies de la clase (y multiclase).
  const classIds = new Set<string>()
  if (char.className) classIds.add(char.className)
  for (const entry of char.classes ?? []) {
    if (entry.classId) classIds.add(entry.classId)
  }
  const weaponProps = weapon.properties.map(p => p.toLowerCase())
  const hasLight = weaponProps.includes('light')
  const hasFinesse = weaponProps.includes('finesse')

  for (const id of classIds) {
    const cls = getClassById(id)
    if (!cls) continue
    for (const code of cls.weaponProficiencies) {
      switch (code) {
        case 'simple':
          if (!isMartial) return true
          break
        case 'martial':
          if (isMartial) return true
          break
        case 'martial-light':
          if (isMartial && hasLight) return true
          break
        case 'martial-finesse':
          if (isMartial && hasFinesse) return true
          break
      }
    }
  }

  return false
}

export interface WeaponAttackInfo {
  /** Name as entered by the user (with magic suffix if any). */
  name: string
  /** Ability used for attack/damage rolls. */
  ability: 'str' | 'dex'
  /** Final attack bonus modifier: ability_mod + PB (if proficient) + magic + archery. */
  attackBonus: number
  /** Damage formula like "1d6 +4 piercing" (mod + magic baked in). */
  damage: string
  /** Magic bonus extracted from the name. */
  magicBonus: number
  /** Whether PB was added (proficiency check). */
  proficient: boolean

  // ── Desglose explícito (#76) para mostrar la fórmula completa ───────────
  /** Numeric ability modifier added to attack and damage rolls. */
  abilityMod: number
  /** Proficiency Bonus added to the attack roll (0 if not proficient). */
  pbBonus: number
  /** Extra ranged attack bonus from Archery fighting style (0 if N/A). */
  archeryBonus: number
  /** Extra damage from Dueling fighting style (0 if N/A). */
  duelingBonus: number
  /** Damage die only (e.g. "1d6"), without modifiers. Empty if no data. */
  damageDie: string
  /** Damage type (e.g. "piercing"). Empty if no data. */
  damageType: string
  /** Numeric total damage modifier: ability_mod + magic + dueling. */
  damageMod: number
}

/** Compute the attack + damage info for a weapon (by name) and a character. */
export function computeWeaponAttack(name: string, char: CharacterData): WeaponAttackInfo {
  const data = findWeaponData(name)
  const magic = extractMagicBonus(name)
  const dexMod = modifier((char.abilityScores?.dex ?? 10) + abilityBonusSum(char, 'dex'))
  const strMod = modifier((char.abilityScores?.str ?? 10) + abilityBonusSum(char, 'str'))
  const ability = weaponAttackAbility(data, { str: strMod, dex: dexMod })
  const abilityMod = ability === 'dex' ? dexMod : strMod
  const pb = proficiencyBonus(char.level)
  const prof = isProficientWithWeapon(char, data)

  // Detect chosen feats that affect weapon attacks/damage.
  // #102: además de los feats ASI, hay que mirar char.fightingStyleFeat
  //       (Fighter lv.1, Paladin lv.2, Ranger lv.2). Antes solo se leía
  //       asiChoices, así que Archery/Dueling escogidos por la feature
  //       Fighting Style no aplicaban el bonus al attack bonus.
  const chosenFeatIds = (char.asiChoices ?? [])
    .filter(c => c.type === 'feat' && c.featId)
    .map(c => c.featId!)
  if (char.fightingStyleFeat) chosenFeatIds.push(char.fightingStyleFeat)
  const isRanged = !!data && data.properties.map(p => p.toLowerCase()).some(p => p.startsWith('ammunition'))
  const isMelee = !!data && !isRanged
  const isVersatileOrTwoHanded = !!data && data.properties.some(p => /versatile|two-handed/i.test(p))

  let archeryBonus = 0
  let duelingBonus = 0
  for (const id of chosenFeatIds) {
    const feat = getFeatById(id)
    if (!feat) continue
    if (feat.rangedAttackBonus && isRanged) archeryBonus += feat.rangedAttackBonus
    if (feat.duelingDamageBonus && isMelee && !isVersatileOrTwoHanded) {
      duelingBonus += feat.duelingDamageBonus
    }
  }

  const attackBonus = abilityMod + (prof ? pb : 0) + magic + archeryBonus

  const die = data?.damage ?? ''
  const dmgTotal = abilityMod + magic + duelingBonus
  const damageType = data?.damageType ?? ''
  const dmgSign = dmgTotal >= 0 ? '+' : '-'
  const dmgStr = die
    ? `${die} ${dmgSign}${Math.abs(dmgTotal)}${damageType ? ' ' + damageType : ''}`
    : ''

  return {
    name,
    ability,
    attackBonus,
    damage: dmgStr,
    magicBonus: magic,
    proficient: prof,
    abilityMod,
    pbBonus: prof ? pb : 0,
    archeryBonus,
    duelingBonus,
    damageDie: die,
    damageType,
    damageMod: dmgTotal,
  }
}

/** Helper: total of species + background + asi bonus on an ability. */
function abilityBonusSum(char: CharacterData, ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'): number {
  return (char.speciesBonuses?.[ability] ?? 0)
    + (char.backgroundBonuses?.[ability] ?? 0)
    + (char.asiBonuses?.[ability] ?? 0)
}
