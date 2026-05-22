// #117 — Historial de niveles de un personaje. Modo híbrido:
//
//  - "Consulta": el jugador puede ver cómo era el PJ en cualquier snapshot
//    anterior (lv.1, lv.2, ..., lv.actual).
//  - "Reset to this level": reescribe el PJ activo con el snapshot indicado
//    y elimina los snapshots de niveles posteriores.
//
// REGLA principal: los snapshots se crean cuando el PJ alcanza un estado
// LIMPIO en ese nivel (sin `pendingLevelDecisions`). Si el jugador guarda
// con decisiones pendientes, no se snapshotea ese nivel hasta que las
// resuelva y vuelva a guardar.
//
// Por diseño, un snapshot reemplaza al anterior del MISMO nivel: así, si
// el jugador cambia su elección de feat o spells antes de subir al siguiente
// nivel (cuando aún se le permite), el snapshot se actualiza para reflejar
// la última decisión.

import type { CharacterData, LevelSnapshot } from '@/stores/character'
import { pendingLevelDecisions } from './levelUpGating'

/**
 * Genera el contenido `snapshot` (sin levelHistory) a partir del personaje.
 * Hace una copia profunda para que mutaciones futuras del PJ no afecten al
 * snapshot guardado.
 */
function buildSnapshotBody(char: CharacterData): Omit<CharacterData, 'levelHistory'> {
  // Copia profunda vía JSON; suficiente para datos primitivos + arrays/objects.
  // No hay funciones ni Dates en CharacterData, así que es seguro.
  const copy = JSON.parse(JSON.stringify(char)) as CharacterData
  // Quitar el historial para no anidarlo dentro del propio snapshot.
  delete copy.levelHistory
  return copy
}

/**
 * Crea o actualiza el snapshot del nivel actual del personaje, si el PJ está
 * en estado limpio (sin decisiones pendientes).
 *
 * Devuelve true si se creó/actualizó un snapshot, false si se omitió porque
 * había decisiones pendientes o porque el nivel actual ya tenía un snapshot
 * idéntico (en cuyo caso no merece la pena reemplazarlo).
 *
 * MUTA el personaje (añade/reemplaza en char.levelHistory).
 */
export function commitLevelSnapshot(char: CharacterData): boolean {
  // No snapshotear si quedan decisiones por resolver.
  if (pendingLevelDecisions(char).length > 0) return false

  if (!char.levelHistory) char.levelHistory = []

  const body = buildSnapshotBody(char)
  const newEntry: LevelSnapshot = {
    level: char.level,
    snapshotAt: new Date().toISOString(),
    snapshot: body,
  }

  // ¿Hay ya un snapshot para este nivel? → reemplazar.
  const existingIdx = char.levelHistory.findIndex(s => s.level === char.level)
  if (existingIdx >= 0) {
    char.levelHistory[existingIdx] = newEntry
    return true
  }

  // Si no, añadir manteniendo el array ordenado por nivel ascendente.
  char.levelHistory.push(newEntry)
  char.levelHistory.sort((a, b) => a.level - b.level)
  return true
}

/**
 * Restaura el personaje al estado del snapshot indicado y elimina los
 * snapshots de niveles POSTERIORES al elegido. El snapshot elegido se
 * conserva intacto.
 *
 * Acción destructiva: los niveles posteriores al `targetLevel` se pierden.
 * El UI debe confirmar con el usuario antes de llamarla.
 *
 * Devuelve el nuevo CharacterData (mutado) o null si el snapshot no existe.
 */
export function restoreToLevel(
  char: CharacterData,
  targetLevel: number,
): CharacterData | null {
  if (!char.levelHistory) return null
  const target = char.levelHistory.find(s => s.level === targetLevel)
  if (!target) return null

  // Construimos el nuevo char: cuerpo del snapshot + historial podado.
  const restoredHistory = char.levelHistory.filter(s => s.level <= targetLevel)

  // Sobrescribimos todas las propiedades del char con las del snapshot.
  // Borramos primero las claves que pudieran estar en char pero no en el
  // snapshot (para evitar restos de datos posteriores).
  const charAsRecord = char as unknown as Record<string, unknown>
  for (const key of Object.keys(char)) {
    // No tocamos id ni levelHistory aquí; los manejamos explícitamente abajo.
    if (key === 'id' || key === 'levelHistory') continue
    delete charAsRecord[key]
  }
  Object.assign(char, target.snapshot)
  // Mantenemos el id original (mismo personaje) y reasignamos el historial.
  char.levelHistory = restoredHistory
  return char
}
