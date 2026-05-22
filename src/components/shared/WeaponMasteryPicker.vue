<!-- WeaponMasteryPicker.vue — #89 + #97 (UX refactor) -->
<!--
  Selector de armas para Weapon Mastery. Permite agrupar por propiedad
  de mastery y filtrar por nombre, categoría (simple/martial/all) o
  propiedad de mastery (Cleave/Graze/.../all).
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharacterStore } from '@/stores/character'
import {
  getWeaponMasterySlots,
  getEligibleMasteryWeapons,
  sanitizeMasteries,
} from '@/utils/weaponMastery'
import {
  masteryDescriptions,
  simpleWeapons,
  martialWeapons,
  type MasteryProperty,
  type WeaponData,
} from '@/data/dnd5e/equipment'

const characterStore = useCharacterStore()

const slots = computed(() => getWeaponMasterySlots(characterStore.character))
const eligible = computed(() => getEligibleMasteryWeapons(characterStore.character))

const current = computed(() => sanitizeMasteries(characterStore.character))
const filled = computed(() => current.value.length)
const remaining = computed(() => Math.max(0, slots.value - filled.value))

// ── Filtros y agrupación ─────────────────────────────────────────────────
const searchQuery = ref('')
type CategoryFilter = 'all' | 'simple' | 'martial'
const categoryFilter = ref<CategoryFilter>('all')
const masteryFilter = ref<'all' | MasteryProperty>('all')
const groupBy = ref<'none' | 'mastery'>('mastery')

const ALL_MASTERIES: readonly MasteryProperty[] = [
  'Cleave', 'Graze', 'Nick', 'Push', 'Sap', 'Slow', 'Topple', 'Vex',
]

const simpleNames = new Set(simpleWeapons.map(w => w.name))
const martialNames = new Set(martialWeapons.map(w => w.name))

function categoryOf(name: string): CategoryFilter {
  if (simpleNames.has(name)) return 'simple'
  if (martialNames.has(name)) return 'martial'
  return 'all'
}

const filteredWeapons = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return eligible.value
    .filter(w => {
      if (q && !w.name.toLowerCase().includes(q)) return false
      if (categoryFilter.value !== 'all' && categoryOf(w.name) !== categoryFilter.value) return false
      if (masteryFilter.value !== 'all' && w.mastery !== masteryFilter.value) return false
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

/** Agrupado por mastery property, ordenado alfabéticamente dentro de cada grupo. */
const groupedWeapons = computed(() => {
  const groups = new Map<MasteryProperty, WeaponData[]>()
  for (const m of ALL_MASTERIES) groups.set(m, [])
  for (const w of filteredWeapons.value) {
    groups.get(w.mastery)!.push(w)
  }
  return ALL_MASTERIES
    .map(m => ({ mastery: m, weapons: groups.get(m)! }))
    .filter(g => g.weapons.length > 0)
})

// ── Acciones ─────────────────────────────────────────────────────────────
function toggle(weaponName: string) {
  if (!characterStore.character.weaponMasteries) {
    characterStore.character.weaponMasteries = []
  }
  const list = characterStore.character.weaponMasteries
  const idx = list.indexOf(weaponName)
  if (idx >= 0) {
    list.splice(idx, 1)
  } else if (list.length < slots.value) {
    list.push(weaponName)
  }
}

function isSelected(name: string) {
  return current.value.includes(name)
}

function canSelect(name: string) {
  return isSelected(name) || filled.value < slots.value
}

function resetFilters() {
  searchQuery.value = ''
  categoryFilter.value = 'all'
  masteryFilter.value = 'all'
}
</script>

<template>
  <div v-if="slots > 0" class="bg-stone-800/50 border border-amber-700/30 rounded-lg p-5">
    <h3 class="text-lg font-bold text-amber-400 mb-2">
      Weapon Mastery
      <span class="text-stone-500 text-xs font-normal">
        ({{ filled }} / {{ slots }} weapons)
      </span>
    </h3>
    <p class="text-xs text-stone-400 mb-3">
      Choose {{ slots }} weapon{{ slots === 1 ? '' : 's' }} you have proficiency with.
      Each grants its mastery property when you attack with it. You can change
      one weapon on each Long Rest.
      <span v-if="remaining > 0" class="text-amber-400">
        {{ remaining }} slot{{ remaining === 1 ? '' : 's' }} remaining.
      </span>
    </p>

    <!-- Filtros -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
      <input v-model="searchQuery"
        type="text"
        placeholder="Search weapon name…"
        class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 placeholder-stone-500 focus:border-amber-500 focus:outline-none sm:col-span-2" />
      <select v-model="categoryFilter"
        class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 cursor-pointer">
        <option value="all">All types</option>
        <option value="simple">Simple</option>
        <option value="martial">Martial</option>
      </select>
      <select v-model="masteryFilter"
        class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 cursor-pointer">
        <option value="all">All masteries</option>
        <option v-for="m in ALL_MASTERIES" :key="m" :value="m">{{ m }}</option>
      </select>
    </div>

    <div class="flex items-center justify-between mb-2 text-xs">
      <label class="flex items-center gap-2 text-stone-400 cursor-pointer">
        <input type="checkbox"
          :checked="groupBy === 'mastery'"
          @change="groupBy = (groupBy === 'mastery' ? 'none' : 'mastery')"
          class="accent-amber-500" />
        Group by mastery
      </label>
      <button v-if="searchQuery || categoryFilter !== 'all' || masteryFilter !== 'all'"
        type="button"
        @click="resetFilters"
        class="text-amber-500 hover:text-amber-400 cursor-pointer underline">
        Clear filters
      </button>
    </div>

    <!-- Lista agrupada por mastery -->
    <div v-if="groupBy === 'mastery'" class="max-h-96 overflow-y-auto pr-1 space-y-3">
      <div v-for="group in groupedWeapons" :key="group.mastery">
        <h4 class="text-xs font-semibold text-amber-500 mb-1.5 sticky top-0 bg-stone-800/95 py-1 -mx-1 px-1 rounded">
          {{ group.mastery }}
          <span class="text-stone-500 font-normal ml-1">— {{ masteryDescriptions[group.mastery] }}</span>
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button v-for="w in group.weapons" :key="w.name"
            type="button"
            @click="toggle(w.name)"
            :disabled="!canSelect(w.name)"
            class="text-left px-3 py-2 rounded transition-colors border"
            :class="[
              isSelected(w.name)
                ? 'bg-amber-900/40 border-amber-600 text-amber-100'
                : 'bg-stone-900/60 border-stone-700 text-stone-300 hover:bg-stone-700/60',
              !canSelect(w.name) && !isSelected(w.name) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ]">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-sm font-medium">{{ w.name }}</span>
              <span class="text-[10px] uppercase text-stone-500 shrink-0">{{ categoryOf(w.name) }}</span>
            </div>
            <p class="text-[11px] text-stone-500 mt-0.5">{{ w.damage }} {{ w.damageType }}</p>
          </button>
        </div>
      </div>
      <p v-if="groupedWeapons.length === 0" class="text-xs text-stone-500 italic">
        No weapons match the current filters.
      </p>
    </div>

    <!-- Lista plana (sin agrupar) -->
    <div v-else class="max-h-96 overflow-y-auto pr-1">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button v-for="w in filteredWeapons" :key="w.name"
          type="button"
          @click="toggle(w.name)"
          :disabled="!canSelect(w.name)"
          class="text-left px-3 py-2 rounded transition-colors border"
          :class="[
            isSelected(w.name)
              ? 'bg-amber-900/40 border-amber-600 text-amber-100'
              : 'bg-stone-900/60 border-stone-700 text-stone-300 hover:bg-stone-700/60',
            !canSelect(w.name) && !isSelected(w.name) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
          ]">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-sm font-medium">{{ w.name }}</span>
            <span class="text-xs px-1.5 py-0.5 rounded shrink-0"
              :class="isSelected(w.name) ? 'bg-amber-700/60 text-amber-100' : 'bg-stone-800 text-stone-400'">
              {{ w.mastery }}
            </span>
          </div>
          <p class="text-[11px] text-stone-500 mt-0.5">
            <span class="uppercase tracking-wide mr-1">{{ categoryOf(w.name) }}</span>
            · {{ w.damage }} {{ w.damageType }}
          </p>
        </button>
      </div>
      <p v-if="filteredWeapons.length === 0" class="text-xs text-stone-500 italic">
        No weapons match the current filters.
      </p>
    </div>
  </div>
</template>
