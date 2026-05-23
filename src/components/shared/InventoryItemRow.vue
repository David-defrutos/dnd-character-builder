<!-- #123 — Fila de inventario, reutilizable en los 3 bloques (equipped/carried/stored).
     Extraído del listado plano original de EquipmentManager.vue. El padre
     (EquipmentManager) provee las funciones via inject; alternativa más simple
     usada aquí: emits para que el padre aplique los handlers.

     Botones visibles según el bloque:
       - equipped: [Unequip] [Store] (solo si hay container)
       - carried:  [Equip] [Attune] [Store] (solo si hay container)
       - stored:   [Take out]
     Los botones Equip/Attune solo aparecen si tiene sentido para el item
     (canBeEquipped / requiresAttunement).
-->
<script setup lang="ts">
import type { InventoryItem } from '@/stores/character'
import type { MagicItemRarity } from '@/data/dnd5e/magic-items'
import { allMagicItems as magicItems } from '@/data/dnd5e/magic-items'

defineProps<{
  item: InventoryItem
  block: 'equipped' | 'carried' | 'stored'
  /** True si el PJ tiene algún container mágico en el inventario; necesario
   *  para decidir si mostrar el botón "Store". */
  hasContainer: boolean
  /** True si el item es candidato a equiparse (no es "other"). */
  canEquip: boolean
  /** True si requires attunement según el catálogo. */
  needsAttune: boolean
  /** #126 — True si ESTE item es un container mágico. Un container no
   *  puede meterse a sí mismo, así que el botón "Store" no debe aparecer. */
  isContainer: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-equip', slotId: string): void
  (e: 'toggle-attune', slotId: string): void
  (e: 'toggle-stored', slotId: string): void
  (e: 'remove', slotId: string): void
  (e: 'qty-decrement', slotId: string): void
  (e: 'qty-increment', slotId: string): void
}>()

function rarityColor(rarity: MagicItemRarity): string {
  switch (rarity) {
    case 'Common':    return 'text-stone-400'
    case 'Uncommon':  return 'text-emerald-400'
    case 'Rare':      return 'text-blue-400'
    case 'Very Rare': return 'text-purple-400'
    case 'Legendary': return 'text-amber-400'
    case 'Artifact':  return 'text-red-400'
    default:          return 'text-stone-400'
  }
}

function rarityBg(rarity: MagicItemRarity): string {
  switch (rarity) {
    case 'Common':    return 'bg-stone-800'
    case 'Uncommon':  return 'bg-emerald-950/50'
    case 'Rare':      return 'bg-blue-950/50'
    case 'Very Rare': return 'bg-purple-950/50'
    case 'Legendary': return 'bg-amber-950/50'
    case 'Artifact':  return 'bg-red-950/50'
    default:          return 'bg-stone-800'
  }
}
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-lg px-3 py-2"
    :class="item.kind === 'magic'
      ? rarityBg(magicItems.find(m => m.id === item.itemId)?.rarity ?? 'Common')
      : 'bg-stone-800'"
  >
    <!-- Kind badge -->
    <span class="shrink-0 text-xs px-1.5 py-0.5 rounded mt-0.5"
      :class="{
        'bg-red-900 text-red-300': item.kind === 'weapon',
        'bg-blue-900 text-blue-300': item.kind === 'armor',
        'bg-purple-900 text-purple-300': item.kind === 'magic',
        'bg-green-900 text-green-300': item.kind === 'gear',
        'bg-stone-700 text-stone-300': item.kind === 'custom',
      }">
      {{ item.kind }}
    </span>

    <!-- Name + notes + action buttons -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-medium text-stone-100 text-sm">{{ item.name }}</span>
        <!-- #126 — Badge Container: deja claro que ESTE item es el container -->
        <span v-if="isContainer" class="text-xs px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200"
          title="Magical container — its contents don't count for encumbrance">
          📦 Container
        </span>
        <!-- Rarity for magic items -->
        <span v-if="item.kind === 'magic'" class="text-xs"
          :class="rarityColor(magicItems.find(m => m.id === item.itemId)?.rarity ?? 'Common')">
          {{ magicItems.find(m => m.id === item.itemId)?.rarity }}
        </span>

        <!-- Attune (solo si necesita attunement; nunca en bloque stored) -->
        <button v-if="needsAttune && block !== 'stored'"
          @click="emit('toggle-attune', item.slotId)"
          class="text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors"
          :class="item.attuned ? 'bg-amber-700 text-amber-100' : 'bg-stone-700 text-stone-400 hover:bg-stone-600'"
          :title="item.attuned ? 'Attuned — click to remove' : 'Not attuned — click to attune'">
          {{ item.attuned ? '✦ Attuned' : '○ Attune' }}
        </button>

        <!-- Equip (solo en carried; en equipped el botón es "Unequip") -->
        <button v-if="canEquip && block === 'carried'"
          @click="emit('toggle-equip', item.slotId)"
          class="text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors bg-stone-700 text-stone-400 hover:bg-stone-600"
          title="Equip">
          ○ Equip
        </button>
        <button v-if="block === 'equipped'"
          @click="emit('toggle-equip', item.slotId)"
          class="text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors bg-emerald-700 text-emerald-100"
          title="Click to unequip">
          ✓ Equipped
        </button>

        <!-- Store / Take out (solo si hay container Y el propio item NO es container) -->
        <button v-if="hasContainer && !isContainer && block !== 'stored'"
          @click="emit('toggle-stored', item.slotId)"
          class="text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors bg-stone-700 text-purple-300 hover:bg-purple-900/50"
          title="Move to magical container">
          ▶ Store
        </button>
        <button v-if="block === 'stored'"
          @click="emit('toggle-stored', item.slotId)"
          class="text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors bg-purple-900/50 text-purple-200 hover:bg-purple-800/50"
          title="Take out of magical container">
          ◀ Take out
        </button>
      </div>

      <!-- Notes (editable) -->
      <input v-model="item.notes"
        class="mt-1 w-full bg-transparent text-stone-400 text-xs placeholder-stone-600 outline-none border-b border-transparent hover:border-stone-600 focus:border-amber-600 transition-colors"
        placeholder="Notes (charges, condition…)" />

      <!-- Weight (custom items) -->
      <label v-if="item.kind === 'custom'" class="mt-1 flex items-center gap-2 text-xs text-stone-500">
        <span>Weight (lbs)</span>
        <input v-model.number="item.weight" type="number" min="0" step="0.25"
          class="w-20 bg-stone-900 border border-stone-700 rounded px-2 py-0.5 text-xs text-stone-200" />
      </label>
    </div>

    <!-- Qty -->
    <div class="flex items-center gap-1 shrink-0">
      <button @click="emit('qty-decrement', item.slotId)"
        class="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs cursor-pointer flex items-center justify-center">−</button>
      <span class="text-stone-300 text-sm w-4 text-center">{{ item.qty ?? 1 }}</span>
      <button @click="emit('qty-increment', item.slotId)"
        class="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs cursor-pointer flex items-center justify-center">+</button>
    </div>

    <!-- Remove -->
    <button @click="emit('remove', item.slotId)"
      class="shrink-0 text-stone-600 hover:text-red-400 transition-colors text-lg leading-none cursor-pointer mt-0.5"
      title="Remove">×</button>
  </div>
</template>
