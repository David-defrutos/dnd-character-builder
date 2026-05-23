/**
 * #123 — Helpers para gestionar la equipación y el attunement de items del
 * inventario aplicando las reglas PHB/DMG 2024:
 *
 *   - 1 ítem por slot físico (armor, shield, boots, gloves, belt, cloak,
 *     head, neck). Al equipar uno nuevo en un slot ocupado, el anterior se
 *     auto-desequipa.
 *   - Anillos sin límite físico (puedes ponerte 10 si quieres) pero solo 2
 *     pueden estar atunados simultáneamente.
 *   - Máximo 3 items atunados en total (regla universal de attunement).
 *
 * Los helpers son puros: reciben el inventory[] actual y devuelven
 * (a) las acciones a aplicar (qué item se equipa/desequipa) y
 * (b) los mensajes a mostrar al usuario.
 *
 * El consumidor (UI) los aplica al store; estos helpers no mutan estado.
 */

import type { InventoryItem, SlotType, CharacterData } from '@/stores/character'
import { getMagicItemById } from '@/data/dnd5e/magic-items'

/** Resuelve el slot de un item del inventario. Devuelve undefined si no se
 *  puede determinar (item sin slot declarado en catálogo y sin selectedSlot
 *  en custom): el item se trata como "freely equippable" sin reglas. */
export function resolveSlot(item: InventoryItem): SlotType | undefined {
  if (item.kind === 'armor') return 'armor'
  if (item.kind === 'weapon') return undefined  // armas no tienen slot único
  if (item.kind === 'magic') {
    const mi = getMagicItemById(item.itemId)
    return mi?.slot
  }
  // #127: gear oficial → no se equipa con reglas slot (bedroll, rope...).
  // Estos items no tienen "slot único" porque puedes llevar tantos como
  // quieras (3 cuerdas, 5 antorchas) sin conflicto.
  if (item.kind === 'gear') return undefined
  // custom
  return item.selectedSlot
}

/** True si el item es un container mágico (no cuenta su contenido). */
export function isMagicalContainer(item: InventoryItem): boolean {
  if (item.kind === 'magic') {
    return getMagicItemById(item.itemId)?.isContainer ?? false
  }
  if (item.kind === 'custom') {
    return item.isMagicalContainer ?? false
  }
  return false
}

/** True si el item es un anillo (para la regla de max 2 attuned rings). */
export function isRing(item: InventoryItem): boolean {
  return resolveSlot(item) === 'ring'
}

// ─── Equipar con auto-desplazamiento ─────────────────────────────────────

export interface EquipResult {
  /** Modificaciones a aplicar al inventario: cada entrada es un slotId con
   *  los cambios a hacer (equipped y/o stored). */
  updates: Array<{ slotId: string; equipped?: boolean; stored?: boolean }>
  /** Mensaje informativo (toast/inline ámbar) si hubo auto-desplazamiento. */
  notice?: string
}

/**
 * Equipar `target`. Si su slot está ocupado por otro item, ese item se
 * auto-desequipa. Si está en 'stored', sale del container al equiparse.
 * Anillos NO tienen límite físico — pueden equiparse N a la vez.
 *
 * Reglas adicionales:
 *   - Armas/armaduras: si shield y two-handed weapon estaban equipados,
 *     no enforzamos el conflicto aquí (queda para el helper de conflictos).
 *     Solo el slot literal se considera.
 */
export function equipItem(inventory: readonly InventoryItem[], targetSlotId: string): EquipResult {
  const target = inventory.find(i => i.slotId === targetSlotId)
  if (!target) return { updates: [] }
  const targetSlot = resolveSlot(target)
  const updates: EquipResult['updates'] = []

  // 1) Si está en container, lo sacamos (no puede estar a la vez stored y equipped).
  if (target.stored) {
    updates.push({ slotId: target.slotId, stored: false })
  }
  // 2) Marcamos como equipado.
  updates.push({ slotId: target.slotId, equipped: true })

  // 3) Slots ocupados se desplazan (excepto rings que permiten varios).
  let notice: string | undefined
  if (targetSlot && targetSlot !== 'ring' && targetSlot !== 'other') {
    const conflict = inventory.find(i =>
      i.slotId !== target.slotId
      && i.equipped
      && resolveSlot(i) === targetSlot
    )
    if (conflict) {
      updates.push({ slotId: conflict.slotId, equipped: false })
      notice = `${conflict.name} unequipped (only one ${targetSlot} can be equipped at a time).`
    }
  }

  // Compactamos updates por slotId.
  const merged = new Map<string, { slotId: string; equipped?: boolean; stored?: boolean }>()
  for (const u of updates) {
    const prev = merged.get(u.slotId) ?? { slotId: u.slotId }
    if (u.equipped !== undefined) prev.equipped = u.equipped
    if (u.stored !== undefined) prev.stored = u.stored
    merged.set(u.slotId, prev)
  }
  return { updates: Array.from(merged.values()), notice }
}

// ─── Atunear con cascada de reglas ───────────────────────────────────────

export interface AttuneResult {
  updates: Array<{ slotId: string; attuned?: boolean }>
  notice?: string
}

/**
 * Atunear `target`. Aplica en cascada:
 *   1. Si el item es un anillo y ya hay 2 anillos atunados → el anillo
 *      atunado más antiguo (primer slot en el orden del array) se desatúa.
 *   2. Si tras lo anterior hay 3 items atunados ya y se va a añadir uno
 *      más → el item atunado más antiguo (no el recién atuneado) se desatúa.
 *
 * "Más antiguo" = primer item en el orden actual del array de inventory.
 * Aproximación FIFO sin tracking de timestamps; el usuario reordena items
 * en la UI si quiere otro criterio.
 */
export function attuneItem(inventory: readonly InventoryItem[], targetSlotId: string): AttuneResult {
  const target = inventory.find(i => i.slotId === targetSlotId)
  if (!target) return { updates: [] }
  const updates: AttuneResult['updates'] = [{ slotId: target.slotId, attuned: true }]
  const notices: string[] = []

  // 1) Si es anillo: comprobar max 2 atuneados.
  if (isRing(target)) {
    const otherAttunedRings = inventory.filter(i =>
      i.slotId !== target.slotId
      && i.attuned
      && isRing(i)
    )
    if (otherAttunedRings.length >= 2) {
      // Desatuneamos el más antiguo (primer ring en el array).
      const oldest = otherAttunedRings[0]!
      updates.push({ slotId: oldest.slotId, attuned: false })
      notices.push(`${oldest.name} unattuned (maximum 2 attuned rings).`)
    }
  }

  // 2) Comprobar max 3 atuneados total (después de la cascada de anillos).
  const removedByRing = new Set(
    updates.filter(u => u.attuned === false).map(u => u.slotId)
  )
  const otherAttuned = inventory.filter(i =>
    i.slotId !== target.slotId
    && i.attuned
    && !removedByRing.has(i.slotId)
  )
  if (otherAttuned.length >= 3) {
    const oldest = otherAttuned[0]!
    updates.push({ slotId: oldest.slotId, attuned: false })
    notices.push(`${oldest.name} unattuned (maximum 3 attuned items).`)
  }

  return {
    updates,
    notice: notices.length > 0 ? notices.join(' ') : undefined,
  }
}

// ─── Diagnóstico (informativo, no muta estado) ───────────────────────────

export interface SlotConflict {
  slot: SlotType
  items: InventoryItem[]
  limit: number
}

/** Devuelve los slots con MÁS items equipados de los permitidos. Idealmente
 *  vacío tras pasar por equipItem(), pero útil para detectar inventarios
 *  importados con configuración inconsistente. */
export function getEquippedConflicts(char: CharacterData): SlotConflict[] {
  const inv = char.inventory ?? []
  const bySlot = new Map<SlotType, InventoryItem[]>()
  for (const item of inv) {
    if (!item.equipped) continue
    const s = resolveSlot(item)
    if (!s || s === 'ring' || s === 'other') continue  // rings & other: sin límite físico
    const arr = bySlot.get(s) ?? []
    arr.push(item)
    bySlot.set(s, arr)
  }
  const conflicts: SlotConflict[] = []
  for (const [slot, items] of bySlot.entries()) {
    if (items.length > 1) conflicts.push({ slot, items, limit: 1 })
  }
  return conflicts
}

export interface AttunementSummary {
  attunedCount: number
  attunedRingCount: number
  maxTotal: number
  maxRings: number
  exceedsTotal: boolean
  exceedsRings: boolean
}

export function getAttunementSummary(char: CharacterData): AttunementSummary {
  const inv = char.inventory ?? []
  const attuned = inv.filter(i => i.attuned)
  const rings = attuned.filter(isRing)
  return {
    attunedCount: attuned.length,
    attunedRingCount: rings.length,
    maxTotal: 3,
    maxRings: 2,
    exceedsTotal: attuned.length > 3,
    exceedsRings: rings.length > 2,
  }
}
