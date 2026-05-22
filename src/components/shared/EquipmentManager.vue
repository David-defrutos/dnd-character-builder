<!-- Documento generado el 2026-05-19-2253 — Tarea #9: Gestión de equipo en ficha -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import type { InventoryItem } from '@/stores/character'
import { simpleWeapons, martialWeapons, armor, adventuringGear } from '@/data/dnd5e/equipment'
import { allMagicItems as magicItems, weaponPlusItems, armorPlusItems } from '@/data/dnd5e/magic-items'
import type { MagicItemCategory, MagicItemRarity } from '@/data/dnd5e/magic-items'

const characterStore = useCharacterStore()

// ─── Toast feedback (#27) ────────────────────────────────────────────────────
const toastMessage = ref('')
const toastVisible = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toastMessage.value = msg
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastVisible.value = false }, 2000)
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
type Tab = 'weapons' | 'armor' | 'magic' | 'gear' | 'inventory'
const activeTab = ref<Tab>('inventory')

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

function updateItem(slotId: string, patch: Partial<InventoryItem>) {
  ensureInventory()
  const item = characterStore.character.inventory!.find(i => i.slotId === slotId)
  if (item) Object.assign(item, patch)
}

const inventoryItems = computed(() => characterStore.character.inventory ?? [])

const attunedCount = computed(() =>
  inventoryItems.value.filter(i => i.kind === 'magic' && i.attuned).length
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

function addCustomItem() {
  if (!customItemName.value.trim()) return
  addItem({ kind: 'custom', itemId: '', name: customItemName.value.trim(), notes: customItemNotes.value.trim() || undefined, qty: customItemQty.value })
  customItemName.value = ''
  customItemNotes.value = ''
  customItemQty.value = 1
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

    <!-- Tabs -->
    <div class="flex border-b border-stone-700 bg-stone-800/50">
      <button v-for="tab in (['inventory', 'weapons', 'armor', 'gear', 'magic'] as Tab[])" :key="tab"
        @click="activeTab = tab"
        class="px-4 py-2 text-sm font-medium transition-colors cursor-pointer capitalize"
        :class="activeTab === tab
          ? 'text-amber-400 border-b-2 border-amber-400 bg-stone-900/50'
          : 'text-stone-400 hover:text-stone-200'">
        {{ tab === 'magic' ? 'Magic Items' : tab === 'gear' ? 'Gear' : tab.charAt(0).toUpperCase() + tab.slice(1) }}
      </button>
    </div>

    <!-- ── TAB: INVENTORY ─────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'inventory'" class="p-4">
      <div v-if="inventoryItems.length === 0" class="text-center py-8 text-stone-500 text-sm">
        No items yet. Browse the tabs to add weapons, armor, or magic items.
      </div>

      <div v-else class="space-y-2 mb-4">
        <div v-for="item in inventoryItems" :key="item.slotId"
          class="flex items-start gap-3 rounded-lg px-3 py-2"
          :class="item.kind === 'magic' ? rarityBg(magicItems.find(m => m.id === item.itemId)?.rarity ?? 'Common') : 'bg-stone-800'">

          <!-- Kind badge -->
          <span class="shrink-0 text-xs px-1.5 py-0.5 rounded mt-0.5"
            :class="{
              'bg-red-900 text-red-300': item.kind === 'weapon',
              'bg-blue-900 text-blue-300': item.kind === 'armor',
              'bg-purple-900 text-purple-300': item.kind === 'magic',
              'bg-stone-700 text-stone-300': item.kind === 'custom',
            }">
            {{ item.kind }}
          </span>

          <!-- Name + notes -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-stone-100 text-sm">{{ item.name }}</span>
              <!-- Rarity for magic items -->
              <span v-if="item.kind === 'magic'" class="text-xs"
                :class="rarityColor(magicItems.find(m => m.id === item.itemId)?.rarity ?? 'Common')">
                {{ magicItems.find(m => m.id === item.itemId)?.rarity }}
              </span>
              <!-- Attunement toggle -->
              <button v-if="item.kind === 'magic' && magicItems.find(m => m.id === item.itemId)?.attunement"
                @click="updateItem(item.slotId, { attuned: !item.attuned })"
                class="text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                :class="item.attuned ? 'bg-amber-700 text-amber-100' : 'bg-stone-700 text-stone-400 hover:bg-stone-600'"
                :title="item.attuned ? 'Attuned — click to remove' : 'Not attuned — click to attune'">
                {{ item.attuned ? '✦ Attuned' : '○ Attune' }}
              </button>
            </div>
            <!-- Notes (editable) -->
            <input v-model="item.notes"
              class="mt-1 w-full bg-transparent text-stone-400 text-xs placeholder-stone-600 outline-none border-b border-transparent hover:border-stone-600 focus:border-amber-600 transition-colors"
              placeholder="Notes (charges, condition…)" />
          </div>

          <!-- Qty -->
          <div class="flex items-center gap-1 shrink-0">
            <button @click="item.qty = Math.max(1, (item.qty ?? 1) - 1)"
              class="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs cursor-pointer flex items-center justify-center">−</button>
            <span class="text-stone-300 text-sm w-4 text-center">{{ item.qty ?? 1 }}</span>
            <button @click="item.qty = (item.qty ?? 1) + 1"
              class="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs cursor-pointer flex items-center justify-center">+</button>
          </div>

          <!-- Remove -->
          <button @click="removeItem(item.slotId)"
            class="shrink-0 text-stone-600 hover:text-red-400 transition-colors text-lg leading-none cursor-pointer mt-0.5"
            title="Remove">×</button>
        </div>
      </div>

      <!-- Custom item adder -->
      <div class="border-t border-stone-700 pt-3">
        <p class="text-xs text-stone-500 mb-2">Add a custom item</p>
        <div class="flex gap-2">
          <input v-model="customItemName" @keyup.enter="addCustomItem"
            class="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-600"
            placeholder="Item name" />
          <input v-model="customItemNotes"
            class="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-600"
            placeholder="Notes (optional)" />
          <input v-model.number="customItemQty" type="number" min="1"
            class="w-14 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-200 text-center" />
          <button @click="addCustomItem"
            class="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-stone-900 rounded text-sm font-semibold cursor-pointer">+</button>
        </div>
      </div>
    </div>

    <!-- ── TAB: WEAPONS ───────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'weapons'" class="p-4">
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
              @click="addItem({ kind: 'magic', itemId: `${wpn.name.toLowerCase().replace(/\\s+/g,'-')}-plus${bonus}`, name: `${wpn.name} +${bonus}`, qty: 1, attuned: false })"
              class="px-1.5 py-1 rounded text-xs font-mono cursor-pointer bg-stone-700 text-amber-400 hover:bg-amber-700 hover:text-stone-900 transition-colors"
              :title="`Add ${wpn.name} +${bonus} to inventory`">+{{ bonus }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── TAB: ARMOR ─────────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'armor'" class="p-4">
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
              @click="addItem({ kind: 'magic', itemId: `${arm.name.toLowerCase().replace(/\\s+/g,'-')}-plus${bonus}`, name: `${arm.name} +${bonus}`, qty: 1, attuned: false })"
              class="px-1.5 py-1 rounded text-xs font-mono cursor-pointer bg-stone-700 text-blue-400 hover:bg-blue-700 hover:text-stone-900 transition-colors"
              :title="`Add ${arm.name} +${bonus} to inventory`">+{{ bonus }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── TAB: MAGIC ITEMS ───────────────────────────────────────────────── -->
    <div v-if="activeTab === 'magic'" class="p-4">
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
    <div v-if="activeTab === 'gear'" class="p-4">
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
        <button v-for="g in filteredGear" :key="g.name"
          @click="addItem({ kind: 'custom', itemId: '', name: g.name, qty: 1, notes: g.description })"
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
