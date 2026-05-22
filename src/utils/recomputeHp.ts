/**
 * recomputeMaxHp (H8 — auditoría externa 2026-05-21).
 *
 * Calcula el HP máximo del PJ desde cero, agregando:
 *   - HP base por clase y nivel (max hit die a lv.1 + averaged en niveles siguientes)
 *   - Bonus de CON aplicado por nivel
 *   - Bonus del feat Tough (level * 2)
 *   - Bonus del trait Dwarven Toughness (Dwarf): +1 HP por nivel
 *
 * Antes el levelUp() y selectClass() sumaban incrementalmente al maxHp, lo
 * que dejaba el HP inconsistente si después se cambiaba CON, ASI o feats.
 *
 * Llamar esta función después de:
 *   - cambiar el nivel del PJ
 *   - cambiar la clase principal o multiclass
 *   - cambiar CON (vía Step4, ASI, background, species, feat)
 *   - añadir/quitar el feat Tough
 *   - cambiar la raza a/desde Dwarf
 */

import type { CharacterData } from '@/stores/character'
import { hpAtLevel1, hpPerLevel, modifier } from './calculations'
import { getClassById } from '@/data/dnd5e/classes'

/** True si el PJ es Dwarf (cualquier subraza). Dwarven Toughness da +1 HP/nivel. */
function isDwarf(char: CharacterData): boolean {
  return char.race === 'dwarf'
}

/**
 * Total CON modifier including all bonuses (species, background, ASI, feats).
 * Replica la lógica de characterStore.totalBonus('con').
 */
function totalConMod(char: CharacterData): number {
  const sp = char.speciesBonuses?.con ?? 0
  const bg = char.backgroundBonuses?.con ?? 0
  const asi = char.asiBonuses?.con ?? 0
  return modifier((char.abilityScores.con ?? 10) + sp + bg + asi)
}

/**
 * Recalcula char.maxHp desde cero. NO toca char.currentHp salvo si maxHp
 * baja por debajo de él (entonces se ajusta hacia abajo).
 *
 * Devuelve el nuevo maxHp.
 */
export function recomputeMaxHp(char: CharacterData): number {
  const conMod = totalConMod(char)
  let hp = 0

  // Acumular HP por clase. Si hay multiclass (classes[]), usar eso; si no,
  // usar className/level como única clase.
  const classEntries: { classId: string; level: number }[] =
    char.classes && char.classes.length > 0
      ? char.classes.map(c => ({ classId: c.classId, level: c.level }))
      : char.className
        ? [{ classId: char.className, level: char.level }]
        : []

  for (let i = 0; i < classEntries.length; i++) {
    const entry = classEntries[i]!
    const cls = getClassById(entry.classId)
    const hitDie = cls?.hitDie ?? char.hitDie ?? 8
    for (let lv = 1; lv <= entry.level; lv++) {
      if (i === 0 && lv === 1) {
        // Primera clase, lv.1: max hit die + CON mod
        hp += hpAtLevel1(hitDie, conMod)
      } else {
        // Resto: average + CON mod
        hp += hpPerLevel(hitDie, conMod)
      }
    }
  }

  // Tough feat: +2 HP por nivel del PJ.
  if (char.toughHpBonus && char.toughHpBonus > 0) {
    hp += char.toughHpBonus
  }

  // Dwarven Toughness: +1 HP por nivel (Dwarves PHB 2024).
  if (isDwarf(char)) {
    hp += char.level
  }

  char.maxHp = Math.max(hp, 1)
  // Si maxHp baja por debajo del currentHp, ajustar este último para evitar
  // HP "negativo" en el sentido de currentHp > maxHp.
  if (char.currentHp > char.maxHp) {
    char.currentHp = char.maxHp
  }

  return char.maxHp
}
