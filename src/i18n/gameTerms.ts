// gameTerms.ts — stub tras la limpieza de variantes (#75).
//
// HISTÓRICO: Este archivo contenía diccionarios de traducción a italiano para
// pesos, armas, hechizos, clases, razas, etc. Cuando el proyecto se redujo a
// inglés-solo (Sprint A) la función translateGameTerm pasó a retornar 'name'
// si la locale no era 'it'. Como la app solo carga locale 'en' (ver
// i18n/index.ts), todas las ramas italianas eran código muerto.
//
// En #75 se eliminaron los diccionarios y se conservó solo la API pública que
// consumen useGameTerms.ts y otros 9 archivos del proyecto. La función retorna
// siempre el `name` tal cual: cualquier composable que la invoque obtiene el
// término en inglés sin transformación. No se ha cambiado ninguna firma.

export type GameTermCategory =
  | 'weapon'
  | 'armor'
  | 'spell'
  | 'school'
  | 'damageType'
  | 'pack'
  | 'background'
  | 'class'
  | 'race'
  | 'subrace'
  | 'skill'
  | 'proficiency'
  | 'feature'
  | 'trait'
  | 'language'
  | 'subclass'
  | 'equipment'

/**
 * Devuelve el término sin traducir. La app solo soporta inglés; el parámetro
 * `locale`, `category` y `variant` se conservan por compatibilidad de firma con
 * los call-sites existentes (useGameTerms.ts, etc.).
 */
export function translateGameTerm(
  name: string,
  _locale: string,
  _category: GameTermCategory,
  _variant?: string,
): string {
  return name
}
