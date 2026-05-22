/**
 * Fighting Style helpers (bug #94).
 *
 * D&D 2024:
 *   - Fighter lv.1: gana Fighting Style feat. Cambiable en cada subida de nivel.
 *   - Paladin lv.2: gana Fighting Style feat (o "Blessed Warrior").
 *   - Ranger lv.2: gana Fighting Style feat.
 *   - Champion (Fighter subclass) lv.7: feature "Additional Fighting Style"
 *     (segunda elección — no se modela aquí; queda como TODO).
 *
 * Este módulo provee:
 *   - getFightingStyleFeats(): catálogo (los feats con category='fighting-style')
 *   - hasFightingStyleFeature(char): true si el PJ es elegible
 *   - getFightingStyleSourceLabel(char): "Fighter lv.1", "Paladin lv.2", etc.
 */

import type { CharacterData } from '@/stores/character'
import { feats } from '@/data/dnd5e/feats'

export function getFightingStyleFeats() {
  return feats.filter(f => f.category === 'fighting-style')
}

/** Devuelve la clase + nivel mínimo cuando aplica, o null. */
export function getFightingStyleSource(char: CharacterData):
  | { className: string; level: number }
  | null
{
  const c = char.className
  const lvl = char.level
  if (c === 'fighter' && lvl >= 1) return { className: 'Fighter', level: 1 }
  if (c === 'paladin' && lvl >= 2) return { className: 'Paladin', level: 2 }
  if (c === 'ranger'  && lvl >= 2) return { className: 'Ranger',  level: 2 }
  return null
}

export function hasFightingStyleFeature(char: CharacterData): boolean {
  return getFightingStyleSource(char) !== null
}

export function getFightingStyleSourceLabel(char: CharacterData): string {
  const src = getFightingStyleSource(char)
  return src ? `${src.className} lv.${src.level}` : ''
}
