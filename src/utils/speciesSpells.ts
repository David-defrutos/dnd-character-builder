/**
 * Aplicación de hechizos y cantrips concedidos por la especie/subraza
 * (Gnomish Lineage, Elven Lineage, Tiefling Legacy, Aasimar Light Bearer, etc.).
 *
 * Bug #105: antes los rasgos como "Forest Gnome → Minor Illusion cantrip" y
 * "Speak with Animals always prepared" se documentaban en `traits[]` pero nunca
 * se materializaban en char.cantrips / char.spellsKnown, así que el jugador
 * no los veía en su ficha ni en el PDF.
 *
 * Modelo:
 *   - char.speciesGrantedCantrips[] — IDs de cantrip concedidos por la raza.
 *   - char.speciesGrantedSpells[]   — IDs de spell concedidos, siempre preparados.
 *
 * Estos arrays son PARALELOS a char.cantrips/char.spellsKnown — NO interfieren
 * con el conteo de máximos por clase. La UI y el PDF los muestran etiquetados
 * con "(Race)" para distinguirlos de los hechizos elegidos manualmente.
 */
import type { CharacterData } from '@/stores/character'
import { getRaceById } from '@/data/dnd5e/races'

/** Recalcula los grants raciales del PJ a partir de su raza/subraza/nivel actuales.
 *  Sobrescribe `speciesGrantedCantrips` y `speciesGrantedSpells`. Debe llamarse:
 *    - al elegir/cambiar raza
 *    - al elegir/cambiar subraza
 *    - al subir de nivel (algunos grants tienen minCharLevel: 3 o 5)
 */
export function recomputeSpeciesGrants(char: CharacterData): void {
  const grantedCantrips: string[] = []
  const grantedSpells: string[] = []

  const race = char.race ? getRaceById(char.race) : undefined
  if (race) {
    // 1. Grants de la raza base (e.g. Tiefling Thaumaturgy, Aasimar Light).
    for (const g of race.spellGrants ?? []) {
      if (g.minCharLevel && char.level < g.minCharLevel) continue
      if (g.kind === 'cantrip') grantedCantrips.push(g.spellId)
      else                      grantedSpells.push(g.spellId)
    }

    // 2. Grants de la subraza/linaje (e.g. Forest Gnome Minor Illusion).
    if (char.subrace) {
      const sub = race.subraces?.find(s => s.id === char.subrace)
      for (const g of sub?.spellGrants ?? []) {
        if (g.minCharLevel && char.level < g.minCharLevel) continue
        if (g.kind === 'cantrip') grantedCantrips.push(g.spellId)
        else                      grantedSpells.push(g.spellId)
      }
    }
  }

  // Dedupe defensivo (algún ID podría aparecer en raza Y subraza).
  char.speciesGrantedCantrips = Array.from(new Set(grantedCantrips))
  char.speciesGrantedSpells   = Array.from(new Set(grantedSpells))
}

/** Reset: limpia los arrays. Útil al cambiar de raza para no dejar restos. */
export function clearSpeciesGrants(char: CharacterData): void {
  char.speciesGrantedCantrips = []
  char.speciesGrantedSpells   = []
}
