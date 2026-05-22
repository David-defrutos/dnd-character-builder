/**
 * Martial Caster Alternative — H5 (auditoría externa).
 *
 * PHB 2024:
 *   - Paladin lv.2 Fighting Style: el jugador elige UN Fighting Style feat
 *     O en su lugar "Blessed Warrior": gana 2 cantrips de Cleric usando
 *     CHA como spellcasting ability. Estos cantrips cuentan como Paladin
 *     spells y están siempre preparados.
 *   - Ranger lv.2 Fighting Style: igual, pero la alternativa es "Druidic
 *     Warrior": 2 cantrips de Druid usando WIS como ability.
 *
 * Estas alternativas son EXCLUSIVAS con la elección del Fighting Style
 * feat normal (no puedes tener ambos).
 *
 * Las elecciones se persisten en char.martialCasterAlt:
 *   { source: 'paladin-blessed' | 'ranger-druidic', cantrips: string[] }
 *
 * Los cantrips elegidos se reflejan en char.cantrips (sin tocar el contador
 * de cantrips conocidos por nivel) — los anotamos para que aparezcan en el
 * PDF como "siempre preparados".
 */

import type { CharacterData } from '@/stores/character'

export type MartialCasterAltSource = 'paladin-blessed' | 'ranger-druidic'

export interface MartialCasterAltOption {
  source: MartialCasterAltSource
  label: string
  className: string
  level: number
  /** Clase de la que tomar los cantrips ('cleric' o 'druid'). */
  cantripList: 'cleric' | 'druid'
  /** Cuántos cantrips se eligen. */
  count: number
  /** Texto descriptivo para la UI. */
  description: string
}

export const MARTIAL_CASTER_ALT_OPTIONS: readonly MartialCasterAltOption[] = [
  {
    source: 'paladin-blessed',
    label: 'Blessed Warrior',
    className: 'paladin',
    level: 2,
    cantripList: 'cleric',
    count: 2,
    description: 'Instead of a Fighting Style feat: learn 2 Cleric cantrips. They count as Paladin spells, are always prepared, and use CHA as their spellcasting ability.',
  },
  {
    source: 'ranger-druidic',
    label: 'Druidic Warrior',
    className: 'ranger',
    level: 2,
    cantripList: 'druid',
    count: 2,
    description: 'Instead of a Fighting Style feat: learn 2 Druid cantrips. They count as Ranger spells, are always prepared, and use WIS as their spellcasting ability.',
  },
]

/** Devuelve la opción alt aplicable al PJ actual (si la hay), o null. */
export function getApplicableAltOption(char: CharacterData): MartialCasterAltOption | null {
  return MARTIAL_CASTER_ALT_OPTIONS.find(
    o => o.className === char.className && char.level >= o.level,
  ) ?? null
}

/** Establece la elección Alt: cantrips elegidos. Es exclusivo con fightingStyleFeat. */
export function setMartialCasterAlt(
  char: CharacterData,
  source: MartialCasterAltSource | null,
  cantrips: string[] = [],
): void {
  if (source === null) {
    // Desactivar la alternativa
    char.martialCasterAlt = undefined
    return
  }
  char.martialCasterAlt = { source, cantrips: [...cantrips] }
  // Exclusivo con Fighting Style feat: al activar Alt, borrar el feat.
  char.fightingStyleFeat = undefined
}

/**
 * ¿El PJ ha elegido la alternativa caster en lugar del Fighting Style feat?
 */
export function hasMartialCasterAlt(char: CharacterData): boolean {
  return !!char.martialCasterAlt?.source
}
