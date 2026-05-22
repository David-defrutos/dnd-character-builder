// Documento generado el 2026-05-20-2145 — milestone 23 (#63 origin feat)
//
// Gestión robusta del feat de origen del background. Antes la lógica vivía
// inline en Step5Background.vue y usaba `featuresTraits.startsWith('Feat: ')`,
// lo que podía borrar tags inocentes que también empezaran con "Feat: ".
//
// El nuevo enfoque guarda el id del feat en char.originFeatId (fuente única
// de verdad) y sincroniza el tag "Origin Feat: <name>" en featuresTraits.

import type { CharacterData } from '@/stores/character'
import { getFeatById } from '@/data/dnd5e/feats'
import { syncMagicInitiateChoices } from '@/utils/magicInitiate'

/**
 * Establecer el origin feat del personaje al feat del background nuevo.
 * Si `newFeatId` es undefined, limpia el feat anterior.
 *
 * - Quita SOLO el tag del feat anterior (por id, no por prefijo genérico).
 * - Añade el tag del feat nuevo si lo hay.
 * - Actualiza char.originFeatId como fuente única.
 * - Sincroniza magicInitiateChoices para limpiar elecciones huérfanas (si el
 *   feat anterior era Magic Initiate y el nuevo no lo es).
 */
export function setOriginFeat(char: CharacterData, newFeatId: string | undefined): void {
  // 1. Quitar el tag del feat anterior, si lo había.
  const prevFeatId = char.originFeatId
  if (prevFeatId) {
    const prev = getFeatById(prevFeatId)
    if (prev) {
      const prevTag = `Origin Feat: ${prev.name}`
      char.featuresTraits = char.featuresTraits.filter(f => f !== prevTag)
    }
  }
  // 2. Asignar el nuevo o limpiar.
  if (newFeatId) {
    const feat = getFeatById(newFeatId)
    if (feat) {
      char.originFeatId = newFeatId
      char.featuresTraits.push(`Origin Feat: ${feat.name}`)
    } else {
      char.originFeatId = undefined
    }
  } else {
    char.originFeatId = undefined
  }
  // 3. Sync Magic Initiate choices (drop stale 'origin' entry if applicable).
  syncMagicInitiateChoices(char)
}
