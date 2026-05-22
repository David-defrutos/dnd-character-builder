/** Calculate ability modifier from score */
export function modifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

/** Calculate proficiency bonus from character level */
export function proficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2
}

/** Calculate HP at level 1 */
export function hpAtLevel1(hitDie: number, conMod: number): number {
  return hitDie + conMod
}

/** Calculate HP gain per level (using average) */
export function hpPerLevel(hitDie: number, conMod: number): number {
  return Math.floor(hitDie / 2) + 1 + conMod
}

/** Calculate total HP at a given level */
export function totalHp(hitDie: number, conMod: number, level: number): number {
  if (level <= 0) return 0
  const first = hpAtLevel1(hitDie, conMod)
  const rest = (level - 1) * hpPerLevel(hitDie, conMod)
  return Math.max(first + rest, 1)
}

/** Calculate base AC (unarmored) */
export function baseAC(dexMod: number): number {
  return 10 + dexMod
}

/**
 * Calculate the character's Armor Class taking equipped armor into account.
 *
 * Rules (PHB 2024):
 *   - No armor:    10 + DEX
 *   - Light armor: baseAC + DEX
 *   - Medium armor: baseAC + min(DEX, maxDexBonus)  // usually 2
 *   - Heavy armor: baseAC (DEX irrelevant)
 *   - Shield: +2 on top
 *
 * Looks up the armor by name from a provided catalogue. Returns the
 * unarmored value if the name isn't found.
 */
export interface ArmorInfo {
  name: string
  type: 'light' | 'medium' | 'heavy' | 'shield'
  baseAC: number
  maxDexBonus: number | null
}

export function computeArmorClass(
  dexMod: number,
  armorName: string,
  hasShield: boolean,
  armorCatalogue: readonly ArmorInfo[],
): number {
  let ac = 10 + dexMod // default: unarmored

  if (armorName) {
    const armor = armorCatalogue.find(
      a => a.name.toLowerCase() === armorName.toLowerCase() && a.type !== 'shield',
    )
    if (armor) {
      switch (armor.type) {
        case 'light':
          ac = armor.baseAC + dexMod
          break
        case 'medium': {
          const cap = armor.maxDexBonus ?? 2
          ac = armor.baseAC + Math.min(dexMod, cap)
          break
        }
        case 'heavy':
          ac = armor.baseAC
          break
      }
    }
  }

  if (hasShield) ac += 2
  return ac
}

/** Calculate spell save DC */
export function spellSaveDC(profBonus: number, abilityMod: number): number {
  return 8 + profBonus + abilityMod
}

/** Calculate spell attack bonus */
export function spellAttackBonus(profBonus: number, abilityMod: number): number {
  return profBonus + abilityMod
}

/** Format modifier as string (+N or -N) */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

/** Convert feet to meters (D&D metric: 5ft = 1.5m) */
export function feetToMeters(feet: number): string {
  const meters = feet * 0.3
  // Clean up floating-point: 9.000000001 → 9, 7.5 → 7.5
  return Number.isInteger(meters) ? String(meters) : meters.toFixed(1).replace(/\.0$/, '')
}
