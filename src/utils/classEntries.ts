// classEntries.ts — #139 Fase 1 (refactor multiclass).
//
// Helpers para acceder a los campos por clase del CharacterData. Forman la
// capa de abstracción que permite que el resto del código no se entere de si
// el PJ es monoclase o multiclass.
//
// Convenciones:
//   - getPrimaryClass(char)        → primera entrada de classes[] o construida
//                                    a partir de los campos planos.
//   - getClassEntries(char)        → array seguro (nunca undefined ni vacío
//                                    salvo si no hay clase aún).
//   - getTotalLevel(char)          → suma de niveles de todas las entradas.
//   - getCharCantrips(char)        → unión de cantrips conocidos (todos los
//                                    casters del PJ).
//   - getCharSpellsKnown(char)     → unión de spellsKnown (todos los casters).
//   - getClassEntry(char, classId) → entrada por id, o undefined.
//
// DURANTE LA FASE 1 los campos planos del CharacterData (char.cantrips,
// char.spellsKnown, char.asiChoices, etc.) siguen siendo la fuente de verdad
// para los PJs monoclase. Estos helpers DAN PRIORIDAD a classes[] cuando
// existe y tiene los campos nuevos rellenos, pero caen al modelo plano si no.
// Esa convivencia se cierra al final del refactor (Fase 3+).

import type { CharacterData, ClassEntry, ASIChoice } from '@/stores/character'

/**
 * Devuelve la entrada primaria del multiclass.
 *
 * - Si char.classes[] existe y no está vacío → devuelve classes[0].
 * - Si no, sintetiza una entrada con los campos planos del char (modelo viejo).
 * - Si no hay ni classes[] ni className → null (PJ recién creado).
 */
export function getPrimaryClass(char: CharacterData): ClassEntry | null {
  if (char.classes && char.classes.length > 0) {
    return char.classes[0] ?? null
  }
  if (!char.className) return null
  return {
    classId: char.className,
    subclass: char.subclass ?? '',
    level: char.level ?? 1,
    hitDie: char.hitDie ?? 8,
  }
}

/**
 * Devuelve todas las entradas de clase del PJ.
 *
 * - Si char.classes[] tiene contenido → ese array.
 * - Si está vacío pero hay className plano → array de UN elemento construido.
 * - Si no hay nada → array vacío.
 *
 * El array devuelto es de solo-lectura semánticamente: para mutar usa el
 * store. Esta función NO clona — la mutación accidental afectaría al char.
 */
export function getClassEntries(char: CharacterData): readonly ClassEntry[] {
  if (char.classes && char.classes.length > 0) return char.classes
  const primary = getPrimaryClass(char)
  return primary ? [primary] : []
}

/**
 * Suma de niveles de todas las entradas. Para un PJ monoclase devuelve el
 * char.level habitual. Para multiclass es la suma (Fighter 4 + Wizard 4 = 8).
 */
export function getTotalLevel(char: CharacterData): number {
  const entries = getClassEntries(char)
  if (entries.length === 0) return char.level ?? 0
  return entries.reduce((sum, e) => sum + e.level, 0)
}

/**
 * Devuelve la entrada con classId dado, o undefined si no existe.
 */
export function getClassEntry(char: CharacterData, classId: string): ClassEntry | undefined {
  return getClassEntries(char).find(e => e.classId === classId)
}

/**
 * Unión de cantrips conocidos por todas las clases.
 *
 * Resolución:
 *   - Si alguna entrada tiene .cantrips definido → se usa eso, sumando.
 *   - Si NINGUNA entrada tiene .cantrips (modelo viejo no migrado) → cae a
 *     char.cantrips (el array plano global).
 *
 * Se deduplican IDs para evitar contar dos veces un cantrip que aparezca en
 * dos clases (caso raro pero posible si dos clases comparten cantrip).
 */
export function getCharCantrips(char: CharacterData): string[] {
  const entries = getClassEntries(char)
  const anyDefined = entries.some(e => e.cantrips !== undefined)
  if (!anyDefined) {
    return [...(char.cantrips ?? [])]
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const e of entries) {
    for (const id of e.cantrips ?? []) {
      if (!seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
  }
  return out
}

/**
 * Unión de hechizos preparados/conocidos por todas las clases.
 *
 * Misma lógica que getCharCantrips: si alguna entrada tiene spellsKnown
 * definido, se agrega; si no, cae a char.spellsKnown plano.
 */
export function getCharSpellsKnown(char: CharacterData): string[] {
  const entries = getClassEntries(char)
  const anyDefined = entries.some(e => e.spellsKnown !== undefined)
  if (!anyDefined) {
    return [...(char.spellsKnown ?? [])]
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const e of entries) {
    for (const id of e.spellsKnown ?? []) {
      if (!seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
  }
  return out
}

/**
 * #139 Fase 4a — Devuelve sólo las entradas de clases que tienen
 * spellcasting (cualquier tipo: full, half, third, warlock, none).
 *
 * Para resolver "es caster" necesitamos consultar el catálogo de clases, ya
 * que la entrada del PJ solo guarda IDs. Por eso este helper acepta el
 * catálogo como segundo argumento (lo inyecta el caller; así no creamos
 * dependencia circular con @/data).
 *
 * Devuelve pares (ClassEntry, ability) para uso directo en UI: la ability
 * viene de la entrada si está definida (modelo nuevo) o del catálogo
 * (fallback para PJs no migrados).
 */
export function getCasterClasses(
  char: CharacterData,
  classCatalog: ReadonlyArray<{ id: string; spellcasting: { ability: string } | null }>,
): Array<{ entry: ClassEntry; ability: string }> {
  const out: Array<{ entry: ClassEntry; ability: string }> = []
  for (const entry of getClassEntries(char)) {
    const cls = classCatalog.find(c => c.id === entry.classId)
    if (!cls?.spellcasting) continue
    const ability = entry.spellcastingAbility ?? cls.spellcasting.ability
    out.push({ entry, ability })
  }
  return out
}

/**
 * #139 Fase 4a — Lectura de hechizos preparados/conocidos de UNA clase.
 *
 *  - Si la entrada en classes[] tiene spellsKnown definido → ese array.
 *  - Si es la primaria y no está definido → cae a char.spellsKnown plano.
 *  - Si no es la primaria → array vacío (no hay forma de saber cuáles le
 *    pertenecen sin etiqueta — durante la transición Fase 4, todos los
 *    hechizos en el plano se consideran de la primaria).
 */
export function getSpellsKnownForClass(char: CharacterData, classId: string): string[] {
  const entry = getClassEntry(char, classId)
  if (entry?.spellsKnown !== undefined) return entry.spellsKnown
  const primary = getPrimaryClass(char)
  if (primary?.classId === classId && char.spellsKnown) {
    return char.spellsKnown
  }
  return []
}

/**
 * #139 Fase 4a — Escritura de hechizos de UNA clase.
 *
 * Mantiene sincronía con char.spellsKnown plano si es la primaria, para que
 * el código antiguo (Step9 review, PDF, gating) que aún lee el plano siga
 * viéndolo coherente.
 */
export function setSpellsKnownForClass(
  char: CharacterData,
  classId: string,
  spells: string[],
): void {
  if (!char.classes) char.classes = []
  const entry = char.classes.find(e => e.classId === classId)
  if (!entry) {
    if (char.className === classId) {
      migrateCharacterToClassEntries(char)
      const created = char.classes.find(e => e.classId === classId)
      if (created) created.spellsKnown = [...spells]
    }
    return
  }
  entry.spellsKnown = [...spells]
  const primary = char.classes[0]
  if (primary && primary.classId === classId) {
    char.spellsKnown = [...spells]
  }
}

/**
 * #139 Fase 4a — Lectura de cantrips de UNA clase. Semántica idéntica a
 * getSpellsKnownForClass.
 */
export function getCantripsForClass(char: CharacterData, classId: string): string[] {
  const entry = getClassEntry(char, classId)
  if (entry?.cantrips !== undefined) return entry.cantrips
  const primary = getPrimaryClass(char)
  if (primary?.classId === classId && char.cantrips) {
    return char.cantrips
  }
  return []
}

/**
 * #139 Fase 4a — Escritura de cantrips de UNA clase. Semántica idéntica a
 * setSpellsKnownForClass.
 */
export function setCantripsForClass(
  char: CharacterData,
  classId: string,
  cantrips: string[],
): void {
  if (!char.classes) char.classes = []
  const entry = char.classes.find(e => e.classId === classId)
  if (!entry) {
    if (char.className === classId) {
      migrateCharacterToClassEntries(char)
      const created = char.classes.find(e => e.classId === classId)
      if (created) created.cantrips = [...cantrips]
    }
    return
  }
  entry.cantrips = [...cantrips]
  const primary = char.classes[0]
  if (primary && primary.classId === classId) {
    char.cantrips = [...cantrips]
  }
}

/**
 * Todas las ASIChoice del PJ, ordenadas por nivel de la entrada. Si la
 * entrada no tiene asiChoices definido se cae al char.asiChoices plano.
 *
 * Para multiclass, los ASIs de Fighter aparecen con su nivel del Fighter
 * (4, 6, 8, 12, 14, 16, 19) y los de Wizard con su nivel del Wizard
 * (4, 8, 12, 16, 19). Cuidado: en ambos puede haber un slot lv.4 distinto.
 * Esto se resuelve en Fase 3 cuando el AsiSelector itere por clase.
 */
export function getAllAsiChoices(char: CharacterData): ASIChoice[] {
  const entries = getClassEntries(char)
  const anyDefined = entries.some(e => e.asiChoices !== undefined)
  if (!anyDefined) {
    return [...(char.asiChoices ?? [])]
  }
  const out: ASIChoice[] = []
  for (const e of entries) {
    out.push(...(e.asiChoices ?? []))
  }
  return out
}

/**
 * #139 Fase 3a — devuelve los ASIChoice que pertenecen a la clase indicada.
 *
 * Si la entrada para `classId` tiene `asiChoices` definido → ese array.
 * Si no, y `classId` coincide con la clase primaria → cae a `char.asiChoices`
 * plano (modelo viejo no migrado todavía).
 * Si no hay entrada para ese classId → array vacío.
 *
 * El array devuelto NO está clonado; mutarlo modifica el char. Para escritura
 * usar `setAsiChoicesForClass`.
 */
export function getAsiChoicesForClass(char: CharacterData, classId: string): ASIChoice[] {
  const entry = getClassEntry(char, classId)
  if (entry?.asiChoices !== undefined) return entry.asiChoices
  // Fallback: si es la clase primaria y char.asiChoices existe, esos son los suyos.
  const primary = getPrimaryClass(char)
  if (primary?.classId === classId && char.asiChoices) {
    return char.asiChoices
  }
  return []
}

/**
 * #139 Fase 3a — escribe el array completo de ASIChoices para una clase.
 *
 * Mantiene la sincronía con `char.asiChoices` plano si la clase es la
 * primaria, para que el código antiguo (gating, PDF, recomputeMaxHp, etc.)
 * que aún lee el plano siga viéndolo coherente.
 *
 * Comportamiento:
 *   - Si existe entrada en `classes[]` para `classId` → escribe `asiChoices`
 *     ahí.
 *   - Si `classId` es la primaria → también escribe `char.asiChoices` (mismo
 *     contenido).
 *   - Si NO existe entrada (caso muy raro: classId desconocido) → no-op.
 *
 * Nota: para multiclass, char.asiChoices contiene SOLO los de la primaria.
 * Es código de transición; se eliminará el plano en Fase 6.
 */
export function setAsiChoicesForClass(
  char: CharacterData,
  classId: string,
  choices: ASIChoice[],
): void {
  if (!char.classes) char.classes = []
  const entry = char.classes.find(e => e.classId === classId)
  if (!entry) {
    // Clase no presente en classes[]: si es la primaria histórica
    // (char.className) creamos la entrada con la migración.
    if (char.className === classId) {
      migrateCharacterToClassEntries(char)
      const created = char.classes.find(e => e.classId === classId)
      if (created) created.asiChoices = [...choices]
    }
    return
  }
  entry.asiChoices = [...choices]
  // Sincronía con plano si es la primaria.
  const primary = char.classes[0]
  if (primary && primary.classId === classId) {
    char.asiChoices = [...choices]
  }
}

/**
 * Migración silenciosa (#139, Fase 1): si el char tiene los campos planos
 * (className, subclass, level…) pero classes[] está vacío o no existe,
 * sintetiza classes[0] con los datos planos. Idempotente.
 *
 * Después de migrar, los campos planos siguen existiendo (compatibilidad).
 * La fuente de verdad para los nuevos campos (asiChoices por clase, cantrips
 * por clase, etc.) pasa a vivir en classes[0].
 *
 * NO modifica char.level (suma de niveles vs nivel plano). En monoclase son
 * iguales; en multiclass YA estaba sincronizado por addMulticlass.
 *
 * Se llama al cargar PJ desde localStorage (loadCharacter en el store) y al
 * importar JSON externo (importJson).
 *
 * @returns true si hubo migración, false si no hizo falta.
 */
export function migrateCharacterToClassEntries(char: CharacterData): boolean {
  // Si ya hay classes[] con contenido, no tocar nada. Es responsabilidad de
  // fases posteriores ir rellenando los campos nuevos por clase a medida que
  // se editan; aquí solo nos preocupa el caso "PJ viejo guardado sin classes[]".
  if (char.classes && char.classes.length > 0) {
    return false
  }
  if (!char.className) {
    // PJ sin clase elegida aún (Step1 o Step2). No migrar; dejamos el
    // classes[] vacío para que se rellene al elegir clase en Step3.
    return false
  }
  if (!char.classes) {
    char.classes = []
  }
  char.classes.push({
    classId: char.className,
    subclass: char.subclass ?? '',
    level: char.level ?? 1,
    hitDie: char.hitDie ?? 8,
    // Volcamos los campos planos al primer slot. La lectura agregada
    // (getCharCantrips etc.) los seguirá viendo igual.
    asiChoices: char.asiChoices ? [...char.asiChoices] : undefined,
    spellcastingAbility: char.spellcastingAbility as ClassEntry['spellcastingAbility'] | undefined,
    cantrips: char.cantrips ? [...char.cantrips] : undefined,
    spellsKnown: char.spellsKnown ? [...char.spellsKnown] : undefined,
    // magicInitiateChoices del char NO se vuelcan: el origin feat sigue
    // siendo global. Los magic initiate por ASI los llevarán los AsiChoices
    // de la entrada al migrarlos en Fase 3.
    weaponMasteries: char.weaponMasteries ? [...char.weaponMasteries] : undefined,
  })
  return true
}
