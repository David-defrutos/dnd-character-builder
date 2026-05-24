/**
 * #139 Fase 6 (M8) — Proficiencies parciales al añadir una clase como multiclass.
 *
 * Regla PHB 2024: "When you gain your first level in a class other than your
 * initial class, you gain only some of the new class's starting proficiencies,
 * as detailed in each class's description in 'Classes'."
 *
 * Las proficiencies se categorizan en 3 grupos:
 *   - armor[]:     IDs de armaduras o categorías ("Light armor", "Medium armor", "Shields")
 *   - weapons[]:   "Martial weapons" o nombres concretos
 *   - tools[]:     "Thieves' Tools", "Musical Instrument (one of choice)"
 *
 * Y choices (opciones que el jugador elige al multiclasar):
 *   - skillFromList?: si el PJ debe elegir una habilidad de la lista de la clase.
 *   - musicalInstrumentChoice?: si el PJ debe elegir un instrumento.
 *
 * La aplicación las añade a char.proficienciesOther — son acumulativas. La
 * gestión avanzada (etiquetar origen, permitir borrado al hacer removeMulticlass)
 * queda para iteración posterior si se necesita.
 */

export interface MulticlassProfs {
  armor: readonly string[]
  weapons: readonly string[]
  tools: readonly string[]
  /** Si > 0, el jugador puede elegir N skills de la lista de la clase. */
  skillFromList?: number
  /** Si true, el jugador elige un instrumento musical concreto. */
  musicalInstrumentChoice?: boolean
}

/**
 * Tabla del PHB 2024 ("As a Multiclass Character" en cada clase).
 */
export const MULTICLASS_PROFS: Record<string, MulticlassProfs> = {
  barbarian: {
    armor: ['Shields'],
    weapons: ['Martial weapons'],
    tools: [],
  },
  bard: {
    armor: ['Light armor'],
    weapons: [],
    tools: [],
    skillFromList: 1,
    musicalInstrumentChoice: true,
  },
  cleric: {
    armor: ['Light armor', 'Medium armor', 'Shields'],
    weapons: [],
    tools: [],
  },
  druid: {
    armor: ['Light armor', 'Shields'],
    weapons: [],
    tools: [],
  },
  fighter: {
    armor: ['Light armor', 'Medium armor', 'Shields'],
    weapons: ['Martial weapons'],
    tools: [],
  },
  monk: {
    armor: [],
    weapons: [],
    tools: [],
  },
  paladin: {
    armor: ['Light armor', 'Medium armor', 'Shields'],
    weapons: ['Martial weapons'],
    tools: [],
  },
  ranger: {
    armor: ['Light armor', 'Medium armor', 'Shields'],
    weapons: ['Martial weapons'],
    tools: [],
    skillFromList: 1,
  },
  rogue: {
    armor: ['Light armor'],
    weapons: [],
    tools: ["Thieves' Tools"],
    skillFromList: 1,
  },
  sorcerer: {
    armor: [],
    weapons: [],
    tools: [],
  },
  warlock: {
    armor: ['Light armor'],
    weapons: [],
    tools: [],
  },
  wizard: {
    armor: [],
    weapons: [],
    tools: [],
  },
}

/**
 * Devuelve las proficiencies otorgadas al añadir `classId` como multiclass.
 * Devuelve `null` si la clase no está en la tabla (no es D&D 5e estándar).
 */
export function getMulticlassProfs(classId: string): MulticlassProfs | null {
  return MULTICLASS_PROFS[classId] ?? null
}
