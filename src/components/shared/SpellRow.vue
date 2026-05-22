<!-- SpellRow.vue — #91 -->
<!--
  Fila reutilizable para selectores de hechizos. Muestra nombre + metadatos
  resumidos a la izquierda, badge de nivel + flecha de acordeón a la derecha.
  Click en la fila selecciona/deselecciona. Click en la flecha despliega el
  acordeón con escuela, casting time, range, components, duration y descripción.

  Usos: Step7Spells (creación), MagicInitiatePicker, Step9Review (level-up).
-->
<script setup lang="ts">
import { ref } from 'vue'
import type { Spell } from '@/data/dnd5e/spells'
import { useGameTerms } from '@/composables/useGameTerms'

defineProps<{
  spell: Spell
  selected: boolean
  disabled?: boolean
  /** Si true → estilo botón pequeño (cantrips). Si false → fila ancha. */
  compact?: boolean
}>()

const emit = defineEmits<{ (e: 'toggle'): void }>()

const expanded = ref(false)
const gt = useGameTerms()

function onRowClick() {
  emit('toggle')
}

function onChevronClick(e: MouseEvent) {
  e.stopPropagation()
  expanded.value = !expanded.value
}
</script>

<template>
  <!-- Variante compact (cantrips, pills horizontales) -->
  <div v-if="compact" class="inline-flex flex-col">
    <div class="flex items-stretch">
      <button type="button"
        @click="onRowClick"
        :disabled="disabled && !selected"
        :aria-pressed="selected"
        class="px-3 py-1 rounded-l text-xs transition-colors cursor-pointer"
        :class="selected
          ? 'bg-amber-600 text-stone-900 font-medium'
          : disabled
            ? 'bg-stone-800 text-stone-600 cursor-not-allowed'
            : 'bg-stone-700 text-stone-300 hover:bg-stone-600'">
        {{ gt.spell(spell.name) }}
      </button>
      <button type="button"
        @click="onChevronClick"
        :aria-expanded="expanded"
        aria-label="Toggle details"
        class="px-1.5 rounded-r text-xs cursor-pointer transition-colors"
        :class="selected
          ? 'bg-amber-700 hover:bg-amber-800 text-amber-100'
          : 'bg-stone-800 hover:bg-stone-700 text-stone-400'">
        {{ expanded ? '▾' : '▸' }}
      </button>
    </div>
    <div v-if="expanded" class="mt-1 mb-1 p-2 bg-stone-900 border border-stone-700 rounded text-xs text-stone-400 max-w-xs">
      <p class="text-stone-500">
        <strong>{{ gt.school(spell.school) }}</strong>
        · {{ spell.castingTime }}
        · {{ spell.range }}
        · {{ spell.duration }}
      </p>
      <p class="mt-1.5 text-stone-300">{{ spell.description }}</p>
    </div>
  </div>

  <!-- Variante fila ancha (leveled spells) -->
  <div v-else class="w-full">
    <button type="button"
      @click="onRowClick"
      :disabled="disabled && !selected"
      :aria-pressed="selected"
      class="w-full text-left px-3 py-2 rounded text-sm transition-colors cursor-pointer flex items-center justify-between"
      :class="selected
        ? 'bg-amber-600/20 border border-amber-600 text-stone-200'
        : disabled
          ? 'bg-stone-800 text-stone-600 border border-stone-800 cursor-not-allowed'
          : 'bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700'">
      <span class="flex-1 min-w-0">
        <span class="font-medium">{{ gt.spell(spell.name) }}</span>
        <span class="text-stone-500 ml-2 text-xs">
          {{ spell.level === 0 ? 'Cantrip' : `Lv.${spell.level}` }} · {{ gt.school(spell.school) }}
        </span>
      </span>
      <span class="text-xs text-stone-500 mr-3 shrink-0">{{ spell.castingTime }}</span>
      <span @click.stop="onChevronClick"
        role="button" tabindex="0"
        @keydown.enter.stop.prevent="onChevronClick($event as unknown as MouseEvent)"
        @keydown.space.stop.prevent="onChevronClick($event as unknown as MouseEvent)"
        :aria-expanded="expanded"
        aria-label="Toggle details"
        class="text-stone-400 hover:text-amber-400 px-1 shrink-0">
        {{ expanded ? '▾' : '▸' }}
      </span>
    </button>
    <div v-if="expanded" class="mt-1 mb-2 ml-3 p-3 bg-stone-900 border-l-2 border-amber-700/50 rounded-r text-sm text-stone-400">
      <p class="text-xs text-stone-500 mb-2">
        <strong class="text-stone-400">{{ gt.school(spell.school) }}</strong>
        · {{ spell.castingTime }}
        · {{ spell.range }}
        · {{ spell.components }}
        · {{ spell.duration }}
      </p>
      <p class="text-stone-300">{{ spell.description }}</p>
    </div>
  </div>
</template>
