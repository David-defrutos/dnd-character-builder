/**
 * Catálogo de idiomas estándar y raros del PHB 2024 (Capítulo 2).
 *
 * Regla del PHB 2024: cada personaje conoce **Common + 2 idiomas adicionales**
 * elegidos a la creación (en lugar del sistema de 5e 2014 donde los idiomas
 * venían determinados por raza y background).
 *
 * Languages "Rare" están marcados con `rare: true`; típicamente requieren
 * justificación narrativa o se obtienen como feature de clase (Druid: Druidic,
 * Rogue: Thieves' Cant). El builder permite elegirlos sin restricción extra,
 * la justificación queda al jugador y a la mesa.
 */

export interface LanguageInfo {
  id: string
  name: string
  /** Si true: rare (origin esotérico, suele necesitar narrativa). */
  rare?: boolean
  /** Descripción de los hablantes típicos. */
  typicalSpeakers: string
}

export const LANGUAGES: readonly LanguageInfo[] = [
  // ─── Standard Languages (PHB 2024) ────────────────────────────────────
  { id: 'common',              name: 'Common',              typicalSpeakers: 'Most common folk' },
  { id: 'common-sign-language',name: 'Common Sign Language',typicalSpeakers: 'Used widely as a silent alternative to Common' },
  { id: 'draconic',            name: 'Draconic',            typicalSpeakers: 'Dragons, dragonborn, kobolds' },
  { id: 'dwarvish',            name: 'Dwarvish',            typicalSpeakers: 'Dwarves' },
  { id: 'elvish',              name: 'Elvish',              typicalSpeakers: 'Elves' },
  { id: 'giant',               name: 'Giant',               typicalSpeakers: 'Giants, goliaths, ogres' },
  { id: 'gnomish',             name: 'Gnomish',             typicalSpeakers: 'Gnomes' },
  { id: 'goblin',              name: 'Goblin',              typicalSpeakers: 'Goblinoids' },
  { id: 'halfling',            name: 'Halfling',            typicalSpeakers: 'Halflings' },
  { id: 'orc',                 name: 'Orc',                 typicalSpeakers: 'Orcs' },

  // ─── Rare Languages (PHB 2024) ────────────────────────────────────────
  { id: 'abyssal',     name: 'Abyssal',          rare: true, typicalSpeakers: 'Demons' },
  { id: 'celestial',   name: 'Celestial',        rare: true, typicalSpeakers: 'Celestials' },
  { id: 'deep-speech', name: 'Deep Speech',      rare: true, typicalSpeakers: 'Aberrations' },
  { id: 'druidic',     name: 'Druidic',          rare: true, typicalSpeakers: 'Druids (class secret)' },
  { id: 'infernal',    name: 'Infernal',         rare: true, typicalSpeakers: 'Devils' },
  { id: 'primordial',  name: 'Primordial',       rare: true, typicalSpeakers: 'Elementals (Aquan, Auran, Ignan, Terran dialects)' },
  { id: 'sylvan',      name: 'Sylvan',           rare: true, typicalSpeakers: 'Fey creatures' },
  { id: 'thieves-cant',name: "Thieves' Cant",    rare: true, typicalSpeakers: 'Rogues (class secret)' },
  { id: 'undercommon', name: 'Undercommon',      rare: true, typicalSpeakers: 'Underworld traders' },
]

export function getLanguageById(id: string): LanguageInfo | undefined {
  return LANGUAGES.find(l => l.id === id)
}

/** Lookup por nombre (case-insensitive). Útil para migrar listas que tenían
 *  los idiomas como strings ('Common', 'Giant'). */
export function getLanguageByName(name: string): LanguageInfo | undefined {
  const lower = name.toLowerCase().trim()
  return LANGUAGES.find(l => l.name.toLowerCase() === lower)
}
