/**
 * #139 Fase 6 (M7) — Prerequisitos de habilidad para multiclass.
 *
 * Regla PHB 2024 pág. 36 ("Multiclassing > Prerequisites"):
 *
 *   "To qualify for a new class, you must have a score of at least 13 in
 *    the primary ability of the new class and your current classes."
 *
 * Si la clase tiene varias primary abilities (Ranger: DEX o WIS), basta con
 * cumplir UNA de ellas — RAW dice "the primary ability", interpretándose como
 * cualquiera de las listadas.
 *
 * Los ability scores que cuentan son los TOTALES (base + species + background
 * + ASI bonuses), no la base inicial. Si un PJ alcanza WIS 13 mediante un
 * ASI a nivel 4, puede entonces multiclasar a Druid.
 */

import type { CharacterData } from '@/stores/character'
import type { CharacterClass, AbilityKey } from '@/data/dnd5e/classes'
import { getClassEntries } from './classEntries'

export interface MulticlassPrereqResult {
  /** True si se cumplen TODOS los prereqs. */
  satisfied: boolean
  /** Lista de violaciones: "Wizard requires INT 13 (you have 11)". Vacío si OK. */
  failures: string[]
}

const ABILITY_NAMES: Record<AbilityKey, string> = {
  str: 'STR', dex: 'DEX', con: 'CON',
  int: 'INT', wis: 'WIS', cha: 'CHA',
}

/** Suma base + species + background + asi (no incluye magic items). */
function totalAbilityScore(char: CharacterData, k: AbilityKey): number {
  const base = char.abilityScores[k] ?? 10
  const species = char.speciesBonuses?.[k] ?? 0
  const bg = char.backgroundBonuses?.[k] ?? 0
  const asi = char.asiBonuses?.[k] ?? 0
  return base + species + bg + asi
}

/**
 * Comprueba si una clase pasa los prereqs de "primary ability ≥ 13".
 * Devuelve null si pasa, o el nombre de la ability requerida si no.
 *
 * Si la clase tiene varias primary abilities, basta con que UNA pase.
 */
function checkClassPrereq(
  char: CharacterData,
  cls: CharacterClass,
): { ok: true } | { ok: false; ability: AbilityKey; have: number } {
  const primaryAbils = cls.primaryAbility ?? []
  if (primaryAbils.length === 0) return { ok: true }  // clase sin primary ability declarada
  // ¿Alguna de las primary abilities llega a 13?
  for (const k of primaryAbils) {
    if (totalAbilityScore(char, k) >= 13) return { ok: true }
  }
  // Ninguna llega — reportamos la primera de la lista como la "esperada".
  const k = primaryAbils[0]!
  return { ok: false, ability: k, have: totalAbilityScore(char, k) }
}

/**
 * Comprueba si el PJ puede añadir `newClass` como multiclass.
 *
 * La regla aplica a:
 *   - Las clases YA presentes en classes[] (las "current classes" del PHB).
 *   - La nueva clase que se quiere añadir.
 *
 * @param char    PJ actual.
 * @param newCls  Catálogo de la clase nueva.
 * @param allClasses  Catálogo de TODAS las clases (para resolver primary
 *   ability de las que ya tiene el PJ).
 */
export function multiclassPrereqsSatisfied(
  char: CharacterData,
  newCls: CharacterClass,
  allClasses: readonly CharacterClass[],
): MulticlassPrereqResult {
  const failures: string[] = []

  // 1. Prereqs de las clases ya presentes en el PJ.
  const entries = getClassEntries(char)
  for (const entry of entries) {
    const cls = allClasses.find(c => c.id === entry.classId)
    if (!cls) continue
    const r = checkClassPrereq(char, cls)
    if (!r.ok) {
      failures.push(
        `${cls.name} requires ${ABILITY_NAMES[r.ability]} 13 (you have ${r.have})`,
      )
    }
  }

  // 2. Prereq de la clase nueva.
  const rNew = checkClassPrereq(char, newCls)
  if (!rNew.ok) {
    failures.push(
      `${newCls.name} requires ${ABILITY_NAMES[rNew.ability]} 13 (you have ${rNew.have})`,
    )
  }

  return { satisfied: failures.length === 0, failures }
}
