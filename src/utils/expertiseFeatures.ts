/**
 * Expertise features helpers (H5 — auditoría externa 2026-05-21).
 *
 * En PHB 2024 varias clases tienen features que conceden Expertise
 * (doblar PB) en N skills con proficiency:
 *   - Bard lv.2 (Expertise): 2 skills
 *   - Bard lv.10 (Expertise): 2 skills MÁS (distintas de las anteriores)
 *   - Rogue lv.1 (Expertise): 2 skills
 *   - Rogue lv.6 (Expertise): 2 skills MÁS
 *   - Wizard lv.2 (Scholar): 1 skill (la elige y gana proficiency + expertise)
 *     [se modela aparte porque también añade proficiency]
 *
 * Por ahora solo Bard.
 *
 * Las elecciones se persisten en `char.expertiseSources[sourceId]`. El array
 * `char.skillExpertise` se reconstruye como la unión sin duplicados.
 */

import type { CharacterData } from '@/stores/character'

export interface ExpertiseFeature {
  /** ID único: 'bard-lv2', 'bard-lv10', 'rogue-lv1', etc. */
  sourceId: string
  /** Etiqueta legible en la UI. */
  label: string
  /** Clase a la que pertenece. */
  className: string
  /** Nivel a partir del cual está disponible. */
  level: number
  /** Cuántas skills hay que elegir en esta feature. */
  count: number
  /** Si está presente, solo estas skills son elegibles (en lugar de cualquier
   *  skill con proficiency). Útil para Wizard Scholar que limita la elección a
   *  Arcana / History / Investigation / Nature / Religion. */
  skillOptions?: readonly string[]
  /** Si true, elegir una skill aquí AÑADE proficiency en ella (no requiere
   *  proficiency previa). Útil para Wizard Scholar. */
  grantsProficiency?: boolean
}

/** Catálogo de todas las features de Expertise modeladas. */
export const EXPERTISE_FEATURES: readonly ExpertiseFeature[] = [
  { sourceId: 'bard-lv2',   label: 'Bard Expertise (lv.2)',    className: 'bard',  level: 2,  count: 2 },
  { sourceId: 'bard-lv10',  label: 'Bard Expertise (lv.10)',   className: 'bard',  level: 10, count: 2 },
  { sourceId: 'rogue-lv1',  label: 'Rogue Expertise (lv.1)',   className: 'rogue', level: 1,  count: 2 },
  { sourceId: 'rogue-lv6',  label: 'Rogue Expertise (lv.6)',   className: 'rogue', level: 6,  count: 2 },
  {
    sourceId: 'wizard-scholar',
    label: 'Wizard Scholar (lv.2)',
    className: 'wizard',
    level: 2,
    count: 1,
    // PHB 2024: Arcana / History / Investigation / Nature / Religion
    skillOptions: ['arcana', 'history', 'investigation', 'nature', 'religion'] as const,
    grantsProficiency: true,
  },
]

/** Features activas para el PJ actual (clase coincide, nivel alcanzado). */
export function getActiveExpertiseFeatures(char: CharacterData): ExpertiseFeature[] {
  return EXPERTISE_FEATURES.filter(
    f => f.className === char.className && char.level >= f.level,
  )
}

/** Skills ya seleccionadas en OTRAS features de Expertise — no son re-elegibles. */
export function getSkillsBlockedByOtherExpertise(
  char: CharacterData,
  sourceId: string,
): Set<string> {
  const blocked = new Set<string>()
  const sources = char.expertiseSources ?? {}
  for (const [key, skills] of Object.entries(sources)) {
    if (key === sourceId) continue
    for (const s of skills) blocked.add(s)
  }
  return blocked
}

/**
 * Reconstruye `char.skillExpertise` como unión de todos los expertiseSources
 * (sin duplicados). Llamar después de cada cambio en expertiseSources.
 */
export function rebuildSkillExpertise(char: CharacterData): void {
  const union: string[] = []
  const sources = char.expertiseSources ?? {}
  for (const skills of Object.values(sources)) {
    for (const s of skills) {
      if (!union.includes(s)) union.push(s)
    }
  }
  char.skillExpertise = union
}

/** Establece las skills elegidas para una fuente, sanitiza, y reconstruye. */
export function setExpertiseChoice(
  char: CharacterData,
  sourceId: string,
  skills: string[],
): void {
  if (!char.expertiseSources) char.expertiseSources = {}
  // Sanear: dedupe, respetar count (truncar si excede, lo hace la UI),
  // y descartar skills ya elegidas en otras fuentes.
  const blocked = getSkillsBlockedByOtherExpertise(char, sourceId)
  const seen = new Set<string>()
  const clean: string[] = []
  for (const s of skills) {
    if (blocked.has(s) || seen.has(s)) continue
    clean.push(s)
    seen.add(s)
  }

  // H5 (Wizard Scholar): si la feature otorga proficiency, gestionar
  // skillProficiencies. Las skills DESELECCIONADAS de esta fuente (que la
  // feature había añadido a proficiencies) deben quitarse si no provienen
  // de otra fuente. Las NUEVAS skills se añaden a proficiencies si no
  // estaban ya.
  const feature = EXPERTISE_FEATURES.find(f => f.sourceId === sourceId)
  if (feature?.grantsProficiency) {
    const prevForThisSource = char.expertiseSources[sourceId] ?? []
    const removed = prevForThisSource.filter(s => !clean.includes(s))

    // Skills añadidas por esta feature aún tras el cambio: cuáles ya no están
    // → si no las daba el background/clase, quitar de skillProficiencies.
    const bgSkills = char.backgroundSkillProficiencies ?? []
    const clsSkills = char.classSkillProficiencies ?? []
    const fromOtherSource = new Set([...bgSkills, ...clsSkills])

    for (const s of removed) {
      if (!fromOtherSource.has(s) && char.skillProficiencies) {
        char.skillProficiencies = char.skillProficiencies.filter(x => x !== s)
      }
    }
    // Añadir nuevas (si no estaban ya por background/clase, las añadimos)
    if (!char.skillProficiencies) char.skillProficiencies = []
    for (const s of clean) {
      if (!char.skillProficiencies.includes(s)) {
        char.skillProficiencies.push(s)
      }
    }
  }

  char.expertiseSources[sourceId] = clean
  rebuildSkillExpertise(char)
}
