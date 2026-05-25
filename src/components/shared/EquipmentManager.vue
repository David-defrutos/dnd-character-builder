<!-- Documento generado el 2026-05-19-2253 — Tarea #9: Gestión de equipo en ficha -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import type { InventoryItem } from '@/stores/character'
import { simpleWeapons, martialWeapons, armor, adventuringGear } from '@/data/dnd5e/equipment'
import { allMagicItems as magicItems, weaponPlusItems, armorPlusItems } from '@/data/dnd5e/magic-items'
import type { MagicItemCategory, MagicItemRarity } from '@/data/dnd5e/magic-items'
import { slotsToUnequip } from '@/utils/armorClassBreakdown'
// #123 — equipItem y attuneItem con reglas extendidas (slot, rings, attunement total)
import { equipItem, attuneItem, isMagicalContainer } from '@/utils/equipSlots'
import InventoryItemRow from './InventoryItemRow.vue'

const characterStore = useCharacterStore()

// ─── Toast feedback (#27) ────────────────────────────────────────────────────
const toastMessage = ref('')
const toastVisible = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toastMessage.value = msg
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastVisible.value = false }, 2500)
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
// #125 — Dos niveles de pestañas:
//   - MainTab: la división principal entre "My Equipment" (gestión) y
//     "Add New" (catálogo + custom).
//   - SubTab: las 4 categorías dentro de "Add New". Solo se ven cuando
//     activeMainTab === 'add-new'.
type MainTab = 'my-equipment' | 'add-new'
type SubTab = 'weapons' | 'armor' | 'magic' | 'gear'
const activeMainTab = ref<MainTab>('my-equipment')
const activeTab = ref<SubTab>('weapons')

// ─── Inventory helpers ───────────────────────────────────────────────────────
function ensureInventory() {
  if (!Array.isArray(characterStore.character.inventory)) {
    characterStore.character.inventory = []
  }
}

function addItem(item: Omit<InventoryItem, 'slotId'>) {
  ensureInventory()
  characterStore.character.inventory!.push({ ...item, slotId: crypto.randomUUID() })
  showToast(`✓ ${item.name} added`)
}

function removeItem(slotId: string) {
  ensureInventory()
  const idx = characterStore.character.inventory!.findIndex(i => i.slotId === slotId)
  if (idx >= 0) characterStore.character.inventory!.splice(idx, 1)
}

// #123 — Togglear equipped usando equipItem (con auto-desplazamiento y notice).
// Mantenemos slotsToUnequip/categorizeForEquip del #118 como fallback para
// items legacy que no caen en mi catálogo de slots (armor genérica, shields).
function toggleEquip(slotId: string) {
  ensureInventory()
  const inv = characterStore.character.inventory!
  const item = inv.find(i => i.slotId === slotId)
  if (!item) return

  if (item.equipped) {
    // Desequipar es siempre seguro.
    item.equipped = false
    showToast(`○ ${item.name} unequipped`)
    return
  }

  // #123 — equipItem aplica las reglas nuevas (slot único, sale de stored
  // automáticamente). Para items que NO tienen slot detectable (armor sin
  // catalogación, shields homebrew sin selectedSlot…), caemos en el camino
  // legacy de slotsToUnequip que sigue cubriendo los casos del #118.
  const result = equipItem(inv, slotId)
  for (const u of result.updates) {
    const target = inv.find(i => i.slotId === u.slotId)
    if (!target) continue
    if (u.equipped !== undefined) target.equipped = u.equipped
    if (u.stored !== undefined) target.stored = u.stored
  }

  // Legacy fallback: si equipItem no detectó slot para items armor/shield
  // genéricos, slotsToUnequip aún sabe gestionarlos.
  const legacy = slotsToUnequip(inv, item)
  for (const sid of legacy) {
    const other = inv.find(i => i.slotId === sid)
    if (other && sid !== slotId) other.equipped = false
  }

  if (result.notice) {
    showToast(result.notice)
  } else {
    showToast(`✓ ${item.name} equipped`)
  }
}

// #123 — Atunear con reglas: máx 3 atunados, máx 2 anillos atunados.
function toggleAttuned(slotId: string) {
  ensureInventory()
  const inv = characterStore.character.inventory!
  const item = inv.find(i => i.slotId === slotId)
  if (!item) return

  if (item.attuned) {
    item.attuned = false
    showToast(`○ ${item.name} unattuned`)
    return
  }

  const result = attuneItem(inv, slotId)
  for (const u of result.updates) {
    const target = inv.find(i => i.slotId === u.slotId)
    if (target && u.attuned !== undefined) target.attuned = u.attuned
  }

  if (result.notice) {
    showToast(result.notice)
  } else {
    showToast(`✦ ${item.name} attuned`)
  }
}

// #123 — Mover un item al/del bloque "stored" (dentro de container mágico).
// stored y equipped son mutuamente excluyentes: al guardar se desequipa.
function toggleStored(slotId: string) {
  ensureInventory()
  const inv = characterStore.character.inventory!
  const item = inv.find(i => i.slotId === slotId)
  if (!item) return
  // #126 — Defensa en profundidad: un container no puede meterse a sí mismo
  // (ni dentro de otro container, por la regla PHB del portal al Astral
  // Plane). La UI ya oculta el botón Store en containers, pero blindamos
  // aquí por si alguien dispara el handler por otra vía.
  if (isMagicalContainer(item) && !item.stored) {
    showToast(`⚠ ${item.name} is a container — it can't be stored inside another container.`)
    return
  }
  if (item.stored) {
    item.stored = false
    showToast(`◀ ${item.name} taken out`)
  } else {
    item.stored = true
    if (item.equipped) item.equipped = false
    showToast(`▶ ${item.name} stored in magical container`)
  }
}

/** Devuelve true si el item puede equiparse.
 *  #130 — Usa resolveSlot del #123 (consulta catálogo) en vez de
 *  categorizeForEquip del #118 (regex sobre nombre), que dejaba sin
 *  botón "Equip" a items con slot declarado pero nombre que no
 *  matcheaba con cloak/cape/mantle/ring (boots, belts, amulets, helmets,
 *  gauntlets...).
 *
 *  Reglas:
 *  - Item con slot declarado en catálogo → equipable.
 *  - Item custom con selectedSlot → equipable.
 *  - Magic item SIN slot declarado (Eyes of Charming, Goggles of...) →
 *    también equipable (slot "libre", sin reglas de unicidad). Cualquier
 *    cosa que haya sido catalogada como magic item se asume "lleva
 *    equipado" porque PHB no enforza unicidad para muchos items.
 *  - Weapon/armor/gear → ya gestionados por su kind.
 *  - Custom sin selectedSlot → NO equipable (es texto libre genérico).
 */
function canBeEquipped(item: InventoryItem): boolean {
  if (item.kind === 'magic') return true   // todos los magic items son equipables
  if (item.kind === 'armor') return true
  if (item.kind === 'weapon') return false  // armas se "empuñan", no se "equipan"
  if (item.kind === 'gear') return false    // gear no se equipa (bedroll, rope...)
  // custom
  return item.selectedSlot !== undefined
}

/**
 * #150 — ¿Requiere attunement esta entrada? Cubre tanto items "mágicos puros"
 * (kind='magic') como weapon/armor con magicItemId (Hand Crossbow +1, etc.).
 */
function itemNeedsAttune(item: InventoryItem): boolean {
  const id = item.kind === 'magic' ? item.itemId : item.magicItemId
  if (!id) return false
  return magicItems.find(m => m.id === id)?.attunement ?? false
}

/**
 * #151 — Convierte "Hand Crossbow" → "hand-crossbow". Helper en script para
 * evitar regex con backslash dentro de template literals en Vue templates,
 * que se escapan inconsistentemente. La versión que estaba en el @click
 * (.replace(/\\s+/g, '-')) NO funcionaba: dejaba los espacios intactos y
 * generaba IDs como "hand crossbow-plus1" que luego no resolvían contra el
 * catálogo mágico.
 */
function kebabName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

const inventoryItems = computed(() => characterStore.character.inventory ?? [])

// #123 — ¿el PJ tiene al menos un container mágico? Necesario para mostrar
// el bloque "In Magical Containers" y el botón "Store".
const hasMagicalContainer = computed(() =>
  inventoryItems.value.some(i => isMagicalContainer(i))
)

// #123 — 3 bloques visuales: equipped, carried, stored.
const equippedItems = computed(() =>
  inventoryItems.value.filter(i => i.equipped && !i.stored)
)
// #158 (F6) — Orden por TIPO y luego nombre. Antes los items aparecían en
// el orden en que se añadieron, lo cual mezclaba weapon/armor/magic/gear
// sin criterio visible. Ahora: weapons primero, luego armor, magic, gear,
// custom; dentro de cada grupo, alfabético por nombre.
const KIND_ORDER: Record<string, number> = {
  weapon: 0, armor: 1, magic: 2, gear: 3, custom: 4,
}
const carriedItems = computed(() =>
  inventoryItems.value
    .filter(i => !i.equipped && !i.stored)
    .slice()  // no mutar el array reactivo original
    .sort((a, b) => {
      const ka = KIND_ORDER[a.kind] ?? 99
      const kb = KIND_ORDER[b.kind] ?? 99
      if (ka !== kb) return ka - kb
      return a.name.localeCompare(b.name)
    })
)
const storedItems = computed(() =>
  inventoryItems.value.filter(i => i.stored)
)

const attunedCount = computed(() =>
  inventoryItems.value.filter(i =>
    i.attuned && (i.kind === 'magic' || i.magicItemId !== undefined)
  ).length
)

// ─── Weapon catalog filters ──────────────────────────────────────────────────
const allWeapons = [...simpleWeapons, ...martialWeapons]
const weaponSearch = ref('')
const weaponTypeFilter = ref<'all' | 'simple' | 'martial'>('all')
const weaponSortBy = ref<'name' | 'damage' | 'weight' | 'cost'>('name')

const filteredWeapons = computed(() => {
  let list = allWeapons
  if (weaponTypeFilter.value === 'simple') list = list.filter(w => simpleWeapons.includes(w as any))
  if (weaponTypeFilter.value === 'martial') list = list.filter(w => martialWeapons.includes(w as any))
  if (weaponSearch.value.trim()) {
    const q = weaponSearch.value.toLowerCase()
    list = list.filter(w => w.name.toLowerCase().includes(q) || w.mastery.toLowerCase().includes(q) || w.damageType.toLowerCase().includes(q))
  }
  return [...list].sort((a, b) => {
    if (weaponSortBy.value === 'name') return a.name.localeCompare(b.name)
    if (weaponSortBy.value === 'weight') return a.weight - b.weight
    if (weaponSortBy.value === 'cost') return a.costCp - b.costCp
    return 0
  })
})

// ─── Armor catalog filters ───────────────────────────────────────────────────
const armorSearch = ref('')
const armorTypeFilter = ref<'all' | 'light' | 'medium' | 'heavy' | 'shield'>('all')

const filteredArmor = computed(() => {
  let list = [...armor]
  if (armorTypeFilter.value !== 'all') list = list.filter(a => a.type === armorTypeFilter.value)
  if (armorSearch.value.trim()) {
    const q = armorSearch.value.toLowerCase()
    list = list.filter(a => a.name.toLowerCase().includes(q))
  }
  return list.sort((a, b) => a.costCp - b.costCp)
})

// ─── Magic items catalog filters ─────────────────────────────────────────────
const magicSearch = ref('')
const magicCategoryFilter = ref<'all' | MagicItemCategory>('all')
const magicRarityFilter = ref<'all' | MagicItemRarity>('all')
const magicAttunementFilter = ref<'all' | 'yes' | 'no'>('all')
const magicSortBy = ref<'name' | 'rarity'>('name')

const RARITY_ORDER: Record<string, number> = {
  Common: 0, Uncommon: 1, Rare: 2, 'Very Rare': 3, Legendary: 4, Artifact: 5, Varies: 6,
}

// IDs de armas/armaduras +X — se muestran en sus propias pestañas, no en Magic Items
const plusItemIds = new Set([
  ...weaponPlusItems.map(i => i.id),
  ...armorPlusItems.map(i => i.id),
])

const filteredMagic = computed(() => {
  // Excluir armas/armaduras +X: tienen su propio selector en Weapons/Armor
  let list = magicItems.filter(i => !plusItemIds.has(i.id))
  if (magicCategoryFilter.value !== 'all') list = list.filter(i => i.category === magicCategoryFilter.value)
  if (magicRarityFilter.value !== 'all') list = list.filter(i => i.rarity === magicRarityFilter.value)
  if (magicAttunementFilter.value === 'yes') list = list.filter(i => i.attunement)
  if (magicAttunementFilter.value === 'no') list = list.filter(i => !i.attunement)
  if (magicSearch.value.trim()) {
    const q = magicSearch.value.toLowerCase()
    list = list.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
  }
  return [...list].sort((a, b) => {
    if (magicSortBy.value === 'rarity') return (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) || a.name.localeCompare(b.name)
    return a.name.localeCompare(b.name)
  })
})

const magicCategories: MagicItemCategory[] = ['Armor', 'Potion', 'Ring', 'Rod', 'Scroll', 'Staff', 'Wand', 'Weapon', 'Wondrous Item']
const magicRarities: MagicItemRarity[] = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact', 'Varies']

// ─── Adventuring Gear filter (#67) ──────────────────────────────────────────
const gearSearch = ref('')
const gearCategoryFilter = ref<'all' | 'container' | 'light' | 'tool' | 'consumable' | 'utility' | 'survival' | 'clothing'>('all')
const gearSortBy = ref<'name' | 'weight' | 'cost' | 'category'>('name')

const filteredGear = computed(() => {
  let list = [...adventuringGear]
  if (gearCategoryFilter.value !== 'all') list = list.filter(g => g.category === gearCategoryFilter.value)
  if (gearSearch.value.trim()) {
    const q = gearSearch.value.toLowerCase()
    list = list.filter(g => g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q))
  }
  return list.sort((a, b) => {
    if (gearSortBy.value === 'weight') return a.weight - b.weight || a.name.localeCompare(b.name)
    if (gearSortBy.value === 'cost') return a.costCp - b.costCp || a.name.localeCompare(b.name)
    if (gearSortBy.value === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    return a.name.localeCompare(b.name)
  })
})

const gearCategoryLabels: Record<string, string> = {
  container: 'Containers',
  light: 'Light',
  tool: 'Tools',
  consumable: 'Consumables',
  utility: 'Utility',
  survival: 'Survival',
  clothing: 'Clothing',
}

// ─── Custom item ─────────────────────────────────────────────────────────────
const customItemName = ref('')
const customItemNotes = ref('')
const customItemQty = ref(1)
const customItemWeight = ref(0)
// #123 — selector de slot y checkbox container para custom items
const customItemSlot = ref<'' | 'armor' | 'shield' | 'boots' | 'gloves' | 'belt' | 'cloak' | 'head' | 'neck' | 'ring' | 'other'>('')
const customItemIsContainer = ref(false)

function addCustomItem() {
  if (!customItemName.value.trim()) return
  addItem({
    kind: 'custom',
    itemId: '',
    name: customItemName.value.trim(),
    notes: customItemNotes.value.trim() || undefined,
    qty: customItemQty.value,
    weight: Math.max(0, customItemWeight.value || 0),
    selectedSlot: customItemSlot.value || undefined,
    isMagicalContainer: customItemIsContainer.value || undefined,
  })
  customItemName.value = ''
  customItemNotes.value = ''
  customItemQty.value = 1
  customItemWeight.value = 0
  customItemSlot.value = ''
  customItemIsContainer.value = false
}

// ─── Rarity badge colors ─────────────────────────────────────────────────────
function rarityColor(rarity: string): string {
  switch (rarity) {
    case 'Common':    return 'text-stone-400'
    case 'Uncommon':  return 'text-green-400'
    case 'Rare':      return 'text-blue-400'
    case 'Very Rare': return 'text-purple-400'
    case 'Legendary': return 'text-amber-400'
    case 'Artifact':  return 'text-red-400'
    default:          return 'text-stone-400'
  }
}

function rarityBg(rarity: string): string {
  switch (rarity) {
    case 'Common':    return 'bg-stone-700'
    case 'Uncommon':  return 'bg-green-900/60 border border-green-700'
    case 'Rare':      return 'bg-blue-900/60 border border-blue-700'
    case 'Very Rare': return 'bg-purple-900/60 border border-purple-700'
    case 'Legendary': return 'bg-amber-900/60 border border-amber-700'
    case 'Artifact':  return 'bg-red-900/60 border border-red-700'
    default:          return 'bg-stone-700'
  }
}
</script>

<template>
  <div class="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden relative">

    <!-- Toast feedback (#27) -->
    <Transition name="toast">
      <div v-if="toastVisible"
        class="absolute top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-green-700 text-green-100 text-sm font-medium shadow-lg pointer-events-none whitespace-nowrap">
        {{ toastMessage }}
      </div>
    </Transition>

    <!-- Header -->
    <div class="bg-stone-800 border-b border-stone-700 px-4 py-3 flex items-center justify-between">
      <h3 class="text-lg font-bold text-amber-400 flex items-center gap-2">
        ⚔️ Equipment &amp; Inventory
      </h3>
      <div class="flex items-center gap-3 text-sm">
        <span class="text-stone-400">
          <span class="text-stone-200 font-medium">{{ inventoryItems.length }}</span> items
        </span>
        <span class="text-stone-400" :class="attunedCount >= 3 ? 'text-amber-400' : ''">
          <span class="font-medium" :class="attunedCount >= 3 ? 'text-amber-400' : 'text-stone-200'">{{ attunedCount }}</span>/3 attuned
        </span>
      </div>
    </div>

    <!-- #125 — MAIN TABS (My Equipment / Add New) -->
    <div class="flex border-b border-stone-700 bg-stone-800/50">
      <button
        @click="activeMainTab = 'my-equipment'"
        class="px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
        :class="activeMainTab === 'my-equipment'
          ? 'text-amber-400 border-b-2 border-amber-400 bg-stone-900/50'
          : 'text-stone-400 hover:text-stone-200'">
        My Equipment
      </button>
      <button
        @click="activeMainTab = 'add-new'"
        class="px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
        :class="activeMainTab === 'add-new'
          ? 'text-amber-400 border-b-2 border-amber-400 bg-stone-900/50'
          : 'text-stone-400 hover:text-stone-200'">
        Add New
      </button>
    </div>

    <!-- #125 — SUB-TABS (solo dentro de "Add New") -->
    <div v-if="activeMainTab === 'add-new'" class="flex border-b border-stone-700 bg-stone-900/30">
      <button v-for="tab in (['weapons', 'armor', 'gear', 'magic'] as SubTab[])" :key="tab"
        @click="activeTab = tab"
        class="px-4 py-2 text-xs font-medium transition-colors cursor-pointer capitalize"
        :class="activeTab === tab
          ? 'text-amber-400 border-b-2 border-amber-400 bg-stone-900/50'
          : 'text-stone-500 hover:text-stone-300'">
        {{ tab === 'magic' ? 'Magic Items' : tab === 'gear' ? 'Gear' : tab.charAt(0).toUpperCase() + tab.slice(1) }}
      </button>
    </div>

    <!-- ── MAIN TAB: MY EQUIPMENT ──────────────────────────────────────────── -->
    <div v-if="activeMainTab === 'my-equipment'" class="p-4">
      <div v-if="inventoryItems.length === 0" class="text-center py-8 text-stone-500 text-sm">
        No items yet. Switch to "Add New" to browse weapons, armor, gear, or magic items.
      </div>

      <div v-else class="space-y-4 mb-4">
        <!-- #123 — Bloque 1: EQUIPPED -->
        <section v-if="equippedItems.length > 0">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2 pb-1 border-b border-stone-700">
            Equipped <span class="text-stone-500 font-normal">({{ equippedItems.length }})</span>
          </h4>
          <div class="space-y-2">
            <InventoryItemRow
              v-for="item in equippedItems" :key="item.slotId"
              :item="item"
              block="equipped"
              :hasContainer="hasMagicalContainer"
              :canEquip="canBeEquipped(item)"
              :needsAttune="itemNeedsAttune(item)"
              :isContainer="isMagicalContainer(item)"
              @toggle-equip="toggleEquip"
              @toggle-attune="toggleAttuned"
              @toggle-stored="toggleStored"
              @remove="removeItem"
              @qty-decrement="(sid) => { const it = inventoryItems.find(i => i.slotId === sid); if (it) it.qty = Math.max(1, (it.qty ?? 1) - 1) }"
              @qty-increment="(sid) => { const it = inventoryItems.find(i => i.slotId === sid); if (it) it.qty = (it.qty ?? 1) + 1 }"
            />
          </div>
        </section>

        <!-- #123 — Bloque 2: CARRIED -->
        <section v-if="carriedItems.length > 0">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2 pb-1 border-b border-stone-700">
            Carried <span class="text-stone-500 font-normal">({{ carriedItems.length }})</span>
          </h4>
          <div class="space-y-2">
            <InventoryItemRow
              v-for="item in carriedItems" :key="item.slotId"
              :item="item"
              block="carried"
              :hasContainer="hasMagicalContainer"
              :canEquip="canBeEquipped(item)"
              :needsAttune="itemNeedsAttune(item)"
              :isContainer="isMagicalContainer(item)"
              @toggle-equip="toggleEquip"
              @toggle-attune="toggleAttuned"
              @toggle-stored="toggleStored"
              @remove="removeItem"
              @qty-decrement="(sid) => { const it = inventoryItems.find(i => i.slotId === sid); if (it) it.qty = Math.max(1, (it.qty ?? 1) - 1) }"
              @qty-increment="(sid) => { const it = inventoryItems.find(i => i.slotId === sid); if (it) it.qty = (it.qty ?? 1) + 1 }"
            />
          </div>
        </section>

        <!-- #123 — Bloque 3: STORED — solo si hay container mágico -->
        <section v-if="hasMagicalContainer || storedItems.length > 0">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-2 pb-1 border-b border-stone-700">
            In Magical Containers <span class="text-stone-500 font-normal">({{ storedItems.length }})</span>
            <span class="ml-2 text-stone-500 font-normal normal-case">— does not count for encumbrance</span>
          </h4>
          <div v-if="storedItems.length === 0" class="text-xs text-stone-600 italic py-2">
            Move items here to keep them in your container (Bag of Holding, Handy Haversack, etc.).
          </div>
          <div v-else class="space-y-2">
            <InventoryItemRow
              v-for="item in storedItems" :key="item.slotId"
              :item="item"
              block="stored"
              :hasContainer="hasMagicalContainer"
              :canEquip="canBeEquipped(item)"
              :needsAttune="itemNeedsAttune(item)"
              :isContainer="isMagicalContainer(item)"
              @toggle-equip="toggleEquip"
              @toggle-attune="toggleAttuned"
              @toggle-stored="toggleStored"
              @remove="removeItem"
              @qty-decrement="(sid) => { const it = inventoryItems.find(i => i.slotId === sid); if (it) it.qty = Math.max(1, (it.qty ?? 1) - 1) }"
              @qty-increment="(sid) => { const it = inventoryItems.find(i => i.slotId === sid); if (it) it.qty = (it.qty ?? 1) + 1 }"
            />
          </div>
        </section>
      </div>
    </div>
    <!-- ↑ Fin del MAIN TAB: MY EQUIPMENT -->

    <!-- #125 — Custom item adder: vive bajo "Add New" porque ES la
         interfaz de creación de items. Visible en cualquier sub-tab.
         #157 (F5) — Reescrito de fila flex a grid con LABELS visibles encima.
         Antes solo había placeholders en gris claro y campos como Weight
         pasaban desapercibidos. -->
    <div v-if="activeMainTab === 'add-new'" class="p-4 border-t border-stone-700">
      <p class="text-sm text-stone-300 font-medium mb-3">Add a custom item</p>
      <div class="grid grid-cols-2 sm:grid-cols-12 gap-3">
        <!-- Name (ancho amplio) -->
        <div class="col-span-2 sm:col-span-4">
          <label for="custom-name" class="block text-xs text-stone-400 mb-1">Name</label>
          <input id="custom-name" v-model="customItemName" @keyup.enter="addCustomItem"
            class="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200"
            placeholder="e.g. Rope, hempen (25 ft)" />
        </div>
        <!-- Notes -->
        <div class="col-span-2 sm:col-span-3">
          <label for="custom-notes" class="block text-xs text-stone-400 mb-1">Notes <span class="text-stone-600">(optional)</span></label>
          <input id="custom-notes" v-model="customItemNotes"
            class="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200"
            placeholder="Charges, condition…" />
        </div>
        <!-- Quantity -->
        <div class="col-span-1 sm:col-span-1">
          <label for="custom-qty" class="block text-xs text-stone-400 mb-1">Qty</label>
          <input id="custom-qty" v-model.number="customItemQty" type="number" min="1"
            class="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 text-center" />
        </div>
        <!-- Weight -->
        <div class="col-span-1 sm:col-span-2">
          <label for="custom-weight" class="block text-xs text-stone-400 mb-1">Weight (lbs)</label>
          <input id="custom-weight" v-model.number="customItemWeight" type="number" min="0" step="0.25"
            class="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 text-center"
            placeholder="0" />
        </div>
        <!-- Add button -->
        <div class="col-span-2 sm:col-span-2 flex items-end">
          <button @click="addCustomItem"
            class="w-full px-3 py-1 bg-amber-600 hover:bg-amber-500 text-stone-900 rounded text-sm font-semibold cursor-pointer">
            Add item
          </button>
        </div>
      </div>
      <!-- #123 — slot + container, ahora con label propio también -->
      <div class="grid grid-cols-2 sm:grid-cols-12 gap-3 mt-3">
        <div class="col-span-1 sm:col-span-3">
          <label for="custom-slot" class="block text-xs text-stone-400 mb-1">Slot <span class="text-stone-600">(if equippable)</span></label>
          <select id="custom-slot" v-model="customItemSlot"
            class="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200">
            <option value="">None</option>
            <option value="armor">Armor</option>
            <option value="shield">Shield</option>
            <option value="boots">Boots</option>
            <option value="gloves">Gloves</option>
            <option value="belt">Belt</option>
            <option value="cloak">Cloak</option>
            <option value="head">Head</option>
            <option value="neck">Neck</option>
            <option value="ring">Ring</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="col-span-1 sm:col-span-9 flex items-end">
          <label class="flex items-center gap-2 text-xs text-stone-400 cursor-pointer">
            <input v-model="customItemIsContainer" type="checkbox"
              class="bg-stone-800 border-stone-700" />
            <span>Magical container (extradimensional, contents don't add weight)</span>
          </label>
        </div>
      </div>
    </div>

    <!-- ── TAB: WEAPONS ───────────────────────────────────────────────────── -->
    <div v-if="activeMainTab === 'add-new' && activeTab === 'weapons'" class="p-4">
      <!-- Filters -->
      <div class="flex flex-wrap gap-2 mb-3">
        <input v-model="weaponSearch"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-600 flex-1 min-w-32"
          placeholder="Search weapons…" />
        <select v-model="weaponTypeFilter"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 cursor-pointer">
          <option value="all">All types</option>
          <option value="simple">Simple</option>
          <option value="martial">Martial</option>
        </select>
        <select v-model="weaponSortBy"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 cursor-pointer">
          <option value="name">Sort: Name</option>
          <option value="damage">Sort: Damage</option>
          <option value="weight">Sort: Weight</option>
          <option value="cost">Sort: Cost</option>
        </select>
      </div>

      <p class="text-xs text-stone-500 mb-2">{{ filteredWeapons.length }} weapons — click name to add, or +1/+2/+3 for magic version.</p>

      <div class="space-y-1 max-h-80 overflow-y-auto pr-1">
        <div v-for="wpn in filteredWeapons" :key="wpn.name" class="flex items-center gap-1">
          <button
            @click="addItem({ kind: 'weapon', itemId: wpn.name, name: wpn.name, qty: 1 })"
            class="flex-1 flex items-center gap-3 px-3 py-2 rounded bg-stone-800 hover:bg-stone-700 transition-colors cursor-pointer text-left">
            <span class="flex-1 text-sm font-medium text-stone-200">{{ wpn.name }}</span>
            <span class="text-xs text-red-300 w-10 text-center">{{ wpn.damage }}</span>
            <span class="text-xs text-stone-500 w-16 text-right">{{ wpn.damageType }}</span>
            <span class="text-xs px-1.5 py-0.5 rounded bg-stone-700 text-amber-300 w-14 text-center">{{ wpn.mastery }}</span>
          </button>
          <div class="flex gap-0.5">
            <button v-for="bonus in [1,2,3]" :key="bonus"
              @click="addItem({ kind: 'weapon', itemId: wpn.name, name: `${wpn.name} +${bonus}`, qty: 1, magicItemId: `${kebabName(wpn.name)}-plus${bonus}` })"
              class="px-1.5 py-1 rounded text-xs font-mono cursor-pointer bg-stone-700 text-amber-400 hover:bg-amber-700 hover:text-stone-900 transition-colors"
              :title="`Add ${wpn.name} +${bonus} to inventory`">+{{ bonus }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── TAB: ARMOR ─────────────────────────────────────────────────────── -->
    <div v-if="activeMainTab === 'add-new' && activeTab === 'armor'" class="p-4">
      <div class="flex flex-wrap gap-2 mb-3">
        <input v-model="armorSearch"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-600 flex-1 min-w-32"
          placeholder="Search armor…" />
        <select v-model="armorTypeFilter"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 cursor-pointer">
          <option value="all">All types</option>
          <option value="light">Light</option>
          <option value="medium">Medium</option>
          <option value="heavy">Heavy</option>
          <option value="shield">Shield</option>
        </select>
      </div>

      <p class="text-xs text-stone-500 mb-2">{{ filteredArmor.length }} items — click name to add, or +1/+2/+3 for magic version.</p>

      <div class="space-y-1 max-h-80 overflow-y-auto pr-1">
        <div v-for="arm in filteredArmor" :key="arm.name" class="flex items-center gap-1">
          <button
            @click="addItem({ kind: 'armor', itemId: arm.name, name: arm.name, qty: 1 })"
            class="flex-1 flex items-center gap-3 px-3 py-2 rounded bg-stone-800 hover:bg-stone-700 transition-colors cursor-pointer text-left">
            <span class="flex-1 text-sm font-medium text-stone-200">{{ arm.name }}</span>
            <span class="text-xs px-1.5 py-0.5 rounded bg-stone-700 text-blue-300 w-14 text-center capitalize">{{ arm.type }}</span>
            <span class="text-xs text-green-300 w-12 text-center">AC {{ arm.baseAC }}</span>
            <span v-if="arm.stealthDisadvantage" class="text-xs text-red-400 w-20 text-center">Stealth disadv.</span>
            <span v-else class="w-20"></span>
          </button>
          <div class="flex gap-0.5">
            <button v-for="bonus in [1,2,3]" :key="bonus"
              @click="addItem({ kind: 'armor', itemId: arm.name, name: `${arm.name} +${bonus}`, qty: 1, magicItemId: `${kebabName(arm.name)}-plus${bonus}` })"
              class="px-1.5 py-1 rounded text-xs font-mono cursor-pointer bg-stone-700 text-blue-400 hover:bg-blue-700 hover:text-stone-900 transition-colors"
              :title="`Add ${arm.name} +${bonus} to inventory`">+{{ bonus }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── TAB: MAGIC ITEMS ───────────────────────────────────────────────── -->
    <div v-if="activeMainTab === 'add-new' && activeTab === 'magic'" class="p-4">
      <!-- Filters row 1 -->
      <div class="flex flex-wrap gap-2 mb-2">
        <input v-model="magicSearch"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-600 flex-1 min-w-32"
          placeholder="Search magic items…" />
        <select v-model="magicSortBy"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 cursor-pointer">
          <option value="name">Sort: Name</option>
          <option value="rarity">Sort: Rarity</option>
        </select>
      </div>
      <!-- Filters row 2 -->
      <div class="flex flex-wrap gap-2 mb-3">
        <select v-model="magicCategoryFilter"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 cursor-pointer">
          <option value="all">All categories</option>
          <option v-for="cat in magicCategories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <select v-model="magicRarityFilter"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 cursor-pointer">
          <option value="all">All rarities</option>
          <option v-for="r in magicRarities" :key="r" :value="r">{{ r }}</option>
        </select>
        <select v-model="magicAttunementFilter"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 cursor-pointer">
          <option value="all">Attunement: any</option>
          <option value="yes">Requires attunement</option>
          <option value="no">No attunement</option>
        </select>
      </div>

      <p class="text-xs text-stone-500 mb-2">{{ filteredMagic.length }} items — click to add to inventory</p>

      <div class="space-y-1 max-h-80 overflow-y-auto pr-1">
        <button v-for="item in filteredMagic" :key="item.id"
          @click="addItem({ kind: 'magic', itemId: item.id, name: item.name, qty: 1, attuned: false })"
          class="w-full flex items-start gap-3 px-3 py-2 rounded transition-colors cursor-pointer text-left"
          :class="rarityBg(item.rarity)">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-stone-100">{{ item.name }}</span>
              <span class="text-xs" :class="rarityColor(item.rarity)">{{ item.rarity }}</span>
              <span v-if="item.attunement" class="text-xs text-amber-400">✦ Attunement</span>
            </div>
            <p class="text-xs text-stone-400 mt-0.5">{{ item.description }}</p>
          </div>
          <span class="shrink-0 text-xs px-1.5 py-0.5 rounded bg-stone-800/80 text-stone-400">{{ item.category }}</span>
        </button>
      </div>
    </div>

    <!-- ── TAB: GEAR (Adventuring Gear) — #67 ─────────────────────────────── -->
    <div v-if="activeMainTab === 'add-new' && activeTab === 'gear'" class="p-4">
      <!-- Filters -->
      <div class="flex flex-wrap gap-2 mb-3">
        <input v-model="gearSearch"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-600 flex-1 min-w-32"
          placeholder="Search gear…" />
        <select v-model="gearCategoryFilter"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 cursor-pointer">
          <option value="all">All categories</option>
          <option v-for="(label, key) in gearCategoryLabels" :key="key" :value="key">{{ label }}</option>
        </select>
        <select v-model="gearSortBy"
          class="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 cursor-pointer">
          <option value="name">Sort: Name</option>
          <option value="category">Sort: Category</option>
          <option value="weight">Sort: Weight</option>
          <option value="cost">Sort: Cost</option>
        </select>
      </div>

      <p class="text-xs text-stone-500 mb-2">{{ filteredGear.length }} items — click to add to inventory</p>

      <div class="space-y-1 max-h-80 overflow-y-auto pr-1">
        <button v-for="g in filteredGear" :key="g.id"
          @click="addItem({ kind: 'gear', itemId: g.id, name: g.name, qty: 1, notes: g.description })"
          class="w-full flex items-start gap-3 px-3 py-2 rounded transition-colors cursor-pointer text-left bg-stone-800 hover:bg-stone-700">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-stone-100">{{ g.name }}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-stone-700 text-stone-400">{{ gearCategoryLabels[g.category] }}</span>
            </div>
            <p v-if="g.description" class="text-xs text-stone-400 mt-0.5">{{ g.description }}</p>
          </div>
          <div class="shrink-0 text-right text-xs text-stone-500">
            <div>{{ g.costLabel }}</div>
            <div v-if="g.weight > 0">{{ g.weight }} lb</div>
          </div>
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(-6px); }
</style>
