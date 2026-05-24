/**
 * #150 — Migración silenciosa de InventoryItem para weapon/armor +N.
 *
 * Antes (bug), al añadir un Hand Crossbow +1 desde el catálogo mágico se
 * guardaba con `kind: 'magic'` y `itemId: 'hand-crossbow-plus1'`. Eso hacía
 * que la app lo etiquetara con badge "magic" morado y mostrara botón "Equip"
 * en vez de tratarlo como arma normal.
 *
 * Ahora se guarda con `kind: 'weapon'` (o 'armor') + `magicItemId` opcional
 * apuntando al ID en magic-items.ts para conservar rarity, attunement y
 * descripción.
 *
 * Esta migración convierte las entradas viejas al formato nuevo, in-place.
 * Reconoce los IDs por sufijo `-plus1/2/3`. PJs sin estas entradas no se
 * tocan. Idempotente: si ya está migrada, no hace nada.
 */

import type { CharacterData, InventoryItem } from '@/stores/character'

const PLUS_SUFFIX = /-plus(1|2|3)$/

/**
 * Devuelve true si el ID es un weaponPlus o armorPlus de magic-items.ts.
 * El formato generado por la fábrica es `<nombre-en-kebab>-plus<bonus>`.
 */
function isPlusId(magicItemId: string): boolean {
  return PLUS_SUFFIX.test(magicItemId)
}

/**
 * De un magic item ID tipo 'hand-crossbow-plus1' o 'plate-armor-plus2',
 * extrae el nombre del arma/armadura tal y como aparece en su catálogo
 * (con capitalización). Lista cerrada para no equivocarse con names raros.
 */
const PLUS_NAMES_TO_KIND: Record<string, { name: string; kind: 'weapon' | 'armor' }> = {
  // Armas (PLUS_WEAPONS en magic-items.ts)
  'battleaxe': { name: 'Battleaxe', kind: 'weapon' },
  'dagger': { name: 'Dagger', kind: 'weapon' },
  'flail': { name: 'Flail', kind: 'weapon' },
  'glaive': { name: 'Glaive', kind: 'weapon' },
  'greataxe': { name: 'Greataxe', kind: 'weapon' },
  'greatsword': { name: 'Greatsword', kind: 'weapon' },
  'halberd': { name: 'Halberd', kind: 'weapon' },
  'hand-crossbow': { name: 'Hand Crossbow', kind: 'weapon' },
  'handaxe': { name: 'Handaxe', kind: 'weapon' },
  'heavy-crossbow': { name: 'Heavy Crossbow', kind: 'weapon' },
  'lance': { name: 'Lance', kind: 'weapon' },
  'light-crossbow': { name: 'Light Crossbow', kind: 'weapon' },
  'longsword': { name: 'Longsword', kind: 'weapon' },
  'maul': { name: 'Maul', kind: 'weapon' },
  'morningstar': { name: 'Morningstar', kind: 'weapon' },
  'pike': { name: 'Pike', kind: 'weapon' },
  'quarterstaff': { name: 'Quarterstaff', kind: 'weapon' },
  'rapier': { name: 'Rapier', kind: 'weapon' },
  'scimitar': { name: 'Scimitar', kind: 'weapon' },
  'shortsword': { name: 'Shortsword', kind: 'weapon' },
  'spear': { name: 'Spear', kind: 'weapon' },
  'trident': { name: 'Trident', kind: 'weapon' },
  'warhammer': { name: 'Warhammer', kind: 'weapon' },
  'war-pick': { name: 'War Pick', kind: 'weapon' },
  'whip': { name: 'Whip', kind: 'weapon' },
  'longbow': { name: 'Longbow', kind: 'weapon' },
  'shortbow': { name: 'Shortbow', kind: 'weapon' },
  // Armaduras (PLUS_ARMOR en magic-items.ts)
  'leather-armor': { name: 'Leather Armor', kind: 'armor' },
  'studded-leather-armor': { name: 'Studded Leather Armor', kind: 'armor' },
  'hide-armor': { name: 'Hide Armor', kind: 'armor' },
  'chain-shirt': { name: 'Chain Shirt', kind: 'armor' },
  'scale-mail': { name: 'Scale Mail', kind: 'armor' },
  'breastplate': { name: 'Breastplate', kind: 'armor' },
  'half-plate-armor': { name: 'Half Plate Armor', kind: 'armor' },
  'ring-mail': { name: 'Ring Mail', kind: 'armor' },
  'chain-mail': { name: 'Chain Mail', kind: 'armor' },
  'splint-armor': { name: 'Splint Armor', kind: 'armor' },
  'plate-armor': { name: 'Plate Armor', kind: 'armor' },
  'shield': { name: 'Shield', kind: 'armor' },
}

/**
 * Migra UNA entrada de inventory. Devuelve true si la migró, false si no
 * tenía nada que cambiar.
 */
function migrateInventoryItem(item: InventoryItem): boolean {
  if (item.kind !== 'magic') return false
  if (!isPlusId(item.itemId)) return false
  // Extraer la parte previa al sufijo -plusN
  const base = item.itemId.replace(PLUS_SUFFIX, '')
  const entry = PLUS_NAMES_TO_KIND[base]
  if (!entry) return false
  // Reescribir: kind real, itemId apuntando al nombre base, magicItemId al ID antiguo.
  ;(item as InventoryItem).magicItemId = item.itemId
  ;(item as InventoryItem).itemId = entry.name
  ;(item as InventoryItem).kind = entry.kind
  // `attuned` lo respetamos si estaba (weapon/armor mágicas pueden requerir).
  return true
}

/**
 * Recorre el inventory del PJ y migra todas las entradas weapon/armor +N
 * antiguas. Idempotente.
 */
export function migrateInventoryPlusItems(char: CharacterData): number {
  if (!Array.isArray(char.inventory)) return 0
  let migrated = 0
  for (const item of char.inventory) {
    if (migrateInventoryItem(item)) migrated++
  }
  return migrated
}
