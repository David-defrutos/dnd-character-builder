// #118 — Cálculo del AC con desglose por fuente. Reemplaza la lógica
// monolítica de computeArmorClass cuando el personaje tiene items
// equipped en el inventario.
//
// Devuelve no solo el total sino también la lista de contribuciones
// (label + valor) para que el Detailed Reference pueda mostrar el
// desglose en una tabla.

import type { CharacterData, InventoryItem } from '@/stores/character'
import type { ArmorInfo } from './calculations'

export interface AcSource {
  /** Etiqueta legible: "Studded Leather Armor (base)", "DEX modifier",
   *  "Cloak of Protection (+1)", "Shield", "Defense Fighting Style". */
  label: string
  /** Valor numérico, positivo o negativo. */
  value: number
}

export interface AcBreakdown {
  sources: AcSource[]
  total: number
}

/**
 * Lookup de items canónicos del catálogo que aportan AC al equiparse.
 * key = nombre del item (lowercased) o id.
 * value = { bonus: número, requiresAttuned: bool, label: si queremos forzar
 *           un texto distinto del nombre del item }
 *
 * Solo se incluyen los items GENÉRICOS (no escudos/armaduras +1/+2/+3
 * que aplican bonus directo al base, ver applyMagicArmorBonus).
 */
const CANONICAL_AC_ITEMS: Record<string, { bonus: number; requiresAttuned: boolean }> = {
  // Cloaks
  'cloak of protection':       { bonus: 1, requiresAttuned: true },
  'cloak-of-protection':       { bonus: 1, requiresAttuned: true },
  // Rings
  'ring of protection':        { bonus: 1, requiresAttuned: true },
  'ring-of-protection':        { bonus: 1, requiresAttuned: true },
  // Bracers (solo aportan si NO se lleva armor; ver computeAcFromBreakdown)
  'bracers of defense':        { bonus: 2, requiresAttuned: true },
  'bracers-of-defense':        { bonus: 2, requiresAttuned: true },
}

/**
 * Devuelve true si el item equipado debería contar para AC.
 * Verifica equipped + (attuned si lo requiere).
 */
function isItemActive(item: InventoryItem): boolean {
  if (!item.equipped) return false
  return true
}

/**
 * Busca un item del inventario que esté equipped y matchee la key
 * canónica. Devuelve el bonus aplicable o 0 si no aplica.
 */
function getCanonicalAcBonus(item: InventoryItem): number {
  const key = (item.name || '').toLowerCase().trim()
  const idKey = (item.itemId || '').toLowerCase().trim()
  const entry = CANONICAL_AC_ITEMS[key] ?? CANONICAL_AC_ITEMS[idKey]
  if (!entry) return 0
  if (entry.requiresAttuned && !item.attuned) return 0
  return entry.bonus
}

/**
 * Detecta el sufijo "+N" en el nombre del item (ej. "Studded Leather +1",
 * "Shield +2"). Devuelve N o 0.
 */
function parseMagicArmorBonus(name: string): number {
  const m = name.match(/\+\s*(\d+)\s*$/)
  return m && m[1] ? parseInt(m[1], 10) : 0
}

/**
 * Calcula el AC con desglose por fuente, basado en los items equipped.
 * Si NO hay ningún armor equipped en inventory, devuelve null para que
 * el caller use el fallback al sistema legacy (char.armor string).
 */
export function computeAcBreakdown(
  char: CharacterData,
  dexMod: number,
  armorCatalogue: readonly ArmorInfo[],
): AcBreakdown | null {
  const inv = char.inventory ?? []
  const equippedItems = inv.filter(isItemActive)
  if (equippedItems.length === 0) return null

  // Buscar armor equipada (kind='armor', name NO contiene "shield")
  const armorItem = equippedItems.find(
    i => i.kind === 'armor' && !/shield/i.test(i.name),
  )
  const shieldItem = equippedItems.find(
    i => i.kind === 'armor' && /shield/i.test(i.name),
  )

  // Si no hay ni armor ni shield ni ningún item con AC bonus equipped,
  // tampoco activamos este flujo (caemos a legacy).
  const anyCanonical = equippedItems.some(i => getCanonicalAcBonus(i) > 0)
  const anyCustom = equippedItems.some(i => (i.customAcBonus ?? 0) > 0)
  if (!armorItem && !shieldItem && !anyCanonical && !anyCustom) return null

  const sources: AcSource[] = []

  // 1. Base AC: armor equipada o unarmored.
  if (armorItem) {
    // Buscar la armor en el catálogo. Quitar el sufijo "+N" para encontrar
    // la armor base (ej. "Studded Leather Armor +1" → "Studded Leather Armor").
    const cleanName = armorItem.name.replace(/\s*\+\s*\d+\s*$/, '').trim()
    const armor = armorCatalogue.find(
      a => a.name.toLowerCase() === cleanName.toLowerCase() && a.type !== 'shield',
    )
    const magicBonus = parseMagicArmorBonus(armorItem.name)
    if (armor) {
      const baseAC = armor.baseAC + magicBonus
      sources.push({ label: `${armorItem.name} (base)`, value: baseAC })
      // DEX modifier según el tipo de armor
      switch (armor.type) {
        case 'light':
          sources.push({ label: 'DEX modifier', value: dexMod })
          break
        case 'medium': {
          const cap = armor.maxDexBonus ?? 2
          const capped = Math.min(dexMod, cap)
          sources.push({ label: `DEX modifier (max +${cap})`, value: capped })
          break
        }
        case 'heavy':
          // Heavy armor ignora DEX. No se añade fuente.
          break
      }
    } else {
      // Armor no reconocida en el catálogo (homebrew). Asumimos base 10
      // + magic bonus + DEX full, como si fuera light. Avisamos con la
      // label.
      sources.push({ label: `${armorItem.name} (unknown, base 10)`, value: 10 + magicBonus })
      sources.push({ label: 'DEX modifier', value: dexMod })
    }
  } else {
    // Unarmored
    sources.push({ label: 'Unarmored (base 10)', value: 10 })
    sources.push({ label: 'DEX modifier', value: dexMod })
  }

  // 2. Shield equipado
  if (shieldItem) {
    const magicBonus = parseMagicArmorBonus(shieldItem.name)
    sources.push({ label: shieldItem.name, value: 2 + magicBonus })
  }

  // 3. Items canónicos con bonus de AC (Cloak/Ring of Protection, Bracers)
  for (const item of equippedItems) {
    // Saltamos armor y shield (ya contados arriba)
    if (item === armorItem || item === shieldItem) continue
    const bonus = getCanonicalAcBonus(item)
    if (bonus > 0) {
      // Bracers of Defense solo cuentan si NO hay armor equipped.
      const isBracers = /bracers of defense/i.test(item.name)
      if (isBracers && armorItem) continue
      const attunedTag = item.attuned ? '' : ''
      sources.push({ label: `${item.name}${attunedTag}`, value: bonus })
    }
  }

  // 4. Custom AC bonus (homebrew items)
  for (const item of equippedItems) {
    if (item === armorItem || item === shieldItem) continue
    const custom = item.customAcBonus ?? 0
    if (custom > 0 && getCanonicalAcBonus(item) === 0) {
      sources.push({ label: `${item.name} (custom)`, value: custom })
    }
  }

  // 5. Defense Fighting Style: +1 AC mientras armor equipada
  if (char.featDefenseACBonus && armorItem) {
    sources.push({ label: 'Defense Fighting Style', value: 1 })
  }

  const total = sources.reduce((acc, s) => acc + s.value, 0)
  return { sources, total: Math.max(1, total) }
}


// ─── Reglas de equipamiento (uniqueness) ─────────────────────────────────
//
// Al togglear "equip" en un item, hay categorías con límite. Estas helpers
// devuelven los slotIds que deben desequiparse para hacer sitio.

export type EquipCategory = 'armor' | 'shield' | 'cloak' | 'ring' | 'other'

const RING_MAX = 2

/**
 * Clasifica un item en su categoría de equipamiento. Usado por las reglas
 * de unicidad.
 */
export function categorizeForEquip(item: InventoryItem): EquipCategory {
  const name = (item.name || '').toLowerCase()
  if (item.kind === 'armor') {
    return /shield/i.test(name) ? 'shield' : 'armor'
  }
  if (/cloak/i.test(name) || /cape/i.test(name) || /mantle/i.test(name)) {
    return 'cloak'
  }
  if (/\bring\b/i.test(name)) {
    return 'ring'
  }
  return 'other'
}

/**
 * Devuelve los slotIds que se deben desequipar al equipar `target`,
 * para no romper las reglas de unicidad. NO muta nada; el caller lo aplica.
 *
 * Reglas:
 * - 1 armor máx.
 * - 1 shield máx.
 * - 1 cloak máx.
 * - 2 rings máx.
 * - resto: sin límite específico (attuned tiene su propio límite, 3).
 */
export function slotsToUnequip(
  inventory: readonly InventoryItem[],
  target: InventoryItem,
): string[] {
  const cat = categorizeForEquip(target)
  if (cat === 'other') return []

  const equippedSame = inventory.filter(
    i => i.slotId !== target.slotId && i.equipped && categorizeForEquip(i) === cat,
  )

  if (cat === 'ring') {
    // Permitimos hasta 2. Si ya hay 2, desequipamos el más antiguo (el
    // primero del array; en la práctica el orden de inventory refleja
    // el orden de adición).
    if (equippedSame.length < RING_MAX) return []
    const toRemove = equippedSame.length - (RING_MAX - 1)
    return equippedSame.slice(0, toRemove).map(i => i.slotId)
  }

  // armor / shield / cloak: max 1 → desequipamos los demás.
  return equippedSame.map(i => i.slotId)
}
