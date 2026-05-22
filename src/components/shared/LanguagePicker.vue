<!-- LanguagePicker.vue — #92 -->
<!--
  Selector de idiomas según PHB 2024: cada PJ conoce Common (fijo) + 2 idiomas
  adicionales elegidos a la creación. Standard y Rare se separan visualmente.

  El estado se persiste en `char.languages` (incluyendo Common).
  Llama `ensureCommon()` en mounted para garantizar Common al iniciar.
-->
<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { LANGUAGES } from '@/data/dnd5e/languages'

const characterStore = useCharacterStore()

const EXTRA_SLOTS = 2

/** Garantiza que Common esté en la lista al cargar el componente. */
function ensureCommon() {
  const langs = characterStore.character.languages ?? []
  if (!langs.some(l => l.toLowerCase() === 'common')) {
    characterStore.character.languages = ['Common', ...langs]
  }
}
onMounted(ensureCommon)

const standard = computed(() => LANGUAGES.filter(l => !l.rare && l.id !== 'common'))
const rare = computed(() => LANGUAGES.filter(l => l.rare))

const extrasSelected = computed(() =>
  (characterStore.character.languages ?? []).filter(
    l => l.toLowerCase() !== 'common'
  ),
)
const remaining = computed(() => Math.max(0, EXTRA_SLOTS - extrasSelected.value.length))

function isSelected(name: string): boolean {
  return (characterStore.character.languages ?? []).some(
    l => l.toLowerCase() === name.toLowerCase(),
  )
}

function canToggle(name: string): boolean {
  // Common no se puede quitar. Los demás solo si están seleccionados o quedan slots.
  if (name.toLowerCase() === 'common') return false
  return isSelected(name) || remaining.value > 0
}

function toggle(name: string) {
  if (!canToggle(name)) return
  const list = characterStore.character.languages ?? []
  const idx = list.findIndex(l => l.toLowerCase() === name.toLowerCase())
  if (idx >= 0) {
    list.splice(idx, 1)
  } else {
    list.push(name)
  }
  characterStore.character.languages = [...list]
}
</script>

<template>
  <div class="bg-stone-800/50 border border-amber-700/30 rounded-lg p-5">
    <h3 class="text-lg font-bold text-amber-400 mb-2">
      Languages
      <span class="text-stone-500 text-xs font-normal">
        (Common + {{ extrasSelected.length }} / {{ EXTRA_SLOTS }})
      </span>
    </h3>
    <p class="text-xs text-stone-400 mb-4">
      You know Common plus {{ EXTRA_SLOTS }} additional languages of your choice.
      <span v-if="remaining > 0" class="text-amber-400">
        {{ remaining }} slot{{ remaining === 1 ? '' : 's' }} remaining.
      </span>
    </p>

    <!-- Common (fijo, no toggleable) -->
    <div class="mb-4 inline-block">
      <span class="px-3 py-1 rounded text-xs bg-amber-700 text-amber-100 font-medium">
        Common
      </span>
      <span class="text-stone-500 text-xs ml-2">(always known)</span>
    </div>

    <!-- Standard -->
    <h4 class="text-sm font-semibold text-stone-300 mb-2">Standard</h4>
    <div class="flex flex-wrap gap-2 mb-4">
      <button v-for="lang in standard" :key="lang.id"
        type="button"
        @click="toggle(lang.name)"
        :disabled="!canToggle(lang.name) && !isSelected(lang.name)"
        :title="lang.typicalSpeakers"
        class="px-3 py-1 rounded text-xs transition-colors"
        :class="isSelected(lang.name)
          ? 'bg-amber-600 text-stone-900 font-medium cursor-pointer'
          : canToggle(lang.name)
            ? 'bg-stone-700 text-stone-300 hover:bg-stone-600 cursor-pointer'
            : 'bg-stone-800 text-stone-600 cursor-not-allowed opacity-50'">
        {{ lang.name }}
      </button>
    </div>

    <!-- Rare -->
    <h4 class="text-sm font-semibold text-stone-300 mb-2">
      Rare
      <span class="text-stone-500 text-[10px] ml-2">(usually requires narrative justification or class feature)</span>
    </h4>
    <div class="flex flex-wrap gap-2">
      <button v-for="lang in rare" :key="lang.id"
        type="button"
        @click="toggle(lang.name)"
        :disabled="!canToggle(lang.name) && !isSelected(lang.name)"
        :title="lang.typicalSpeakers"
        class="px-3 py-1 rounded text-xs transition-colors"
        :class="isSelected(lang.name)
          ? 'bg-purple-700 text-purple-100 font-medium cursor-pointer'
          : canToggle(lang.name)
            ? 'bg-stone-700 text-stone-300 hover:bg-stone-600 cursor-pointer'
            : 'bg-stone-800 text-stone-600 cursor-not-allowed opacity-50'">
        {{ lang.name }}
      </button>
    </div>
  </div>
</template>
