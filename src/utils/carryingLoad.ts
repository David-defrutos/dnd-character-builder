/**
 * #121 — Cálculo del peso transportado por el PJ (Current Load).
 *
 * Reúne el peso de cada item de char.inventory[] resolviendo:
 *   - weapons/armor: lookup en src/data/dnd5e/equipment.ts por itemId
 *   - magic items: lookup en src/data/dnd5e/magic-items.ts por itemId
 *   - custom items: item.weight (introducido por el usuario en el UI)
 *
 * La capacidad teórica y la conversión lbs→kg se importan de
 * src/utils/detailedReferenceCalc.ts para evitar duplicar la fuente de verdad
 * (el Detailed Reference del PDF anexo usa los mismos cálculos).
 */
import type { CharacterData, InventoryItem } from '@/stores/character'
import { getArmorByName, getWeaponByName, getGearById } from '@/data/dnd5e/equipment'
import { getMagicItemById } from '@/data/dnd5e/magic-items'
import { lbsToKg, computeCarryingCapacity, totalAbilityScore } from './detailedReferenceCalc'

// Re-export para que consumidores que importaban lbsToKg desde aquí
// (ej. tests de #121) sigan funcionando sin tocar nada.
export { lbsToKg }

export type CarryingLoadStatus = 'Unencumbered' | 'Encumbered' | 'Heavily Encumbered'

export interface CarryingLoadBreakdownItem {
  slotId: string
  kind: InventoryItem['kind']
  name: string
  qty: number
  unitWeight: number
  totalWeight: number
}

export interface CarryingLoadResult {
  total: number
  totalKg: number
  /** Capacidad bruta en libras (STR × 15). Replica el campo capacityLbs del
   *  Detailed Reference, expuesto aquí como `capacity` por compatibilidad con
   *  el código que ya consumía esta utilidad (Step9Review, smoke tests). */
  capacity: number
  capacityUsedPct: number
  status: CarryingLoadStatus
  breakdown: CarryingLoadBreakdownItem[]
  /** #123 — Desglose por bloque del inventario.
   *  - equippedLbs: peso de items con `equipped: true`. CUENTAN para Current Load.
   *  - carriedLbs: peso de items sin equipped y sin stored. CUENTAN.
   *  - storedLbs: peso de items con `stored: true` (dentro de containers
   *    mágicos). NO CUENTAN (regla extradimensional PHB 2024). */
  equippedLbs: number
  carriedLbs: number
  storedLbs: number
}

export function computeCarryingLoadStatus(total: number, char: CharacterData): CarryingLoadStatus {
  const strength = Math.max(0, totalAbilityScore(char, 'str'))
  if (total > strength * 10) return 'Heavily Encumbered'
  if (total > strength * 5) return 'Encumbered'
  return 'Unencumbered'
}

function itemUnitWeight(item: InventoryItem): number {
  if (item.kind === 'weapon') return getWeaponByName(item.itemId)?.weight ?? 0
  if (item.kind === 'armor') return getArmorByName(item.itemId)?.weight ?? 0
  if (item.kind === 'magic') return getMagicItemById(item.itemId)?.weight ?? 0
  // #127: gear oficial → lookup en adventuringGear por id.
  if (item.kind === 'gear') return getGearById(item.itemId)?.weight ?? 0
  // custom: peso declarado por el usuario.
  return item.weight ?? 0
}

export function computeCurrentLoad(char: CharacterData): CarryingLoadResult {
  const breakdown: CarryingLoadBreakdownItem[] = []
  let equippedLbs = 0
  let carriedLbs = 0
  let storedLbs = 0
  for (const item of char.inventory ?? []) {
    const qty = Math.max(1, Number.isFinite(item.qty) ? item.qty : 1)
    const unitWeight = Math.max(0, itemUnitWeight(item))
    const totalWeight = unitWeight * qty
    if (totalWeight <= 0) continue
    breakdown.push({
      slotId: item.slotId,
      kind: item.kind,
      name: item.name,
      qty,
      unitWeight,
      totalWeight,
    })
    // #123 — Clasificar por bloque. stored y equipped son mutuamente
    // excluyentes lógicamente; si por error ambos están a true (PJ importado
    // inconsistente), priorizamos stored (más conservador para encumbrance:
    // no penalizar al PJ por una inconsistencia de datos).
    if (item.stored) storedLbs += totalWeight
    else if (item.equipped) equippedLbs += totalWeight
    else carriedLbs += totalWeight
  }
  // El TOTAL para encumbrance es equipped + carried (stored NO cuenta).
  const total = equippedLbs + carriedLbs
  // Reutilizamos la fuente de verdad: capacityLbs del Detailed Reference.
  const capacity = computeCarryingCapacity(char).capacityLbs
  return {
    total,
    totalKg: lbsToKg(total),
    capacity,
    capacityUsedPct: capacity > 0 ? Math.round((total / capacity) * 100) : 0,
    status: computeCarryingLoadStatus(total, char),
    breakdown,
    equippedLbs,
    carriedLbs,
    storedLbs,
  }
}
