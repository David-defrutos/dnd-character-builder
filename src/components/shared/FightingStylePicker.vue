<!-- FightingStylePicker.vue — #94 + H5 (auditoría) -->
<!--
  Selector del Fighting Style para Fighter (lv.1), Paladin (lv.2), Ranger (lv.2).

  Paladin y Ranger tienen ADEMÁS una alternativa al Fighting Style feat:
    - Paladin: Blessed Warrior (2 cantrips Cleric)
    - Ranger:  Druidic Warrior (2 cantrips Druid)

  Las dos opciones son EXCLUSIVAS — fightingStyleFeat y martialCasterAlt no
  pueden coexistir. Cambiar de una a la otra borra la anterior.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import {
  getFightingStyleFeats,
  hasFightingStyleFeature,
  getFightingStyleSourceLabel,
} from '@/utils/fightingStyle'
import {
  getApplicableAltOption,
  setMartialCasterAlt,
  hasMartialCasterAlt,
} from '@/utils/martialCasterAlt'
import { getSpells } from '@/data'

const characterStore = useCharacterStore()

const eligible = computed(() => hasFightingStyleFeature(characterStore.character))
const source = computed(() => getFightingStyleSourceLabel(characterStore.character))
const styles = computed(() => getFightingStyleFeats())
const currentFeat = computed(() => characterStore.character.fightingStyleFeat ?? '')

const altOption = computed(() => getApplicableAltOption(characterStore.character))
const altActive = computed(() => hasMartialCasterAlt(characterStore.character))
const altCantrips = computed(() => characterStore.character.martialCasterAlt?.cantrips ?? [])

// Lista de cantrips disponibles según la opción Alt
const availableAltCantrips = computed(() => {
  if (!altOption.value) return []
  const all = getSpells(characterStore.character.variant)
  return all.filter(s => s.level === 0 && s.classes.includes(altOption.value!.cantripList))
})

function selectStyle(featId: string) {
  // Activar Fighting Style feat — desactivar Alt si estaba.
  characterStore.character.martialCasterAlt = undefined
  if (currentFeat.value === featId) {
    // Deseleccionar (para permitir cambio)
    characterStore.character.fightingStyleFeat = undefined
  } else {
    characterStore.character.fightingStyleFeat = featId
  }
}

function activateAlt() {
  if (!altOption.value) return
  setMartialCasterAlt(characterStore.character, altOption.value.source, [])
}

function deactivateAlt() {
  setMartialCasterAlt(characterStore.character, null)
}

function toggleAltCantrip(cantripId: string) {
  if (!altOption.value) return
  const current = altCantrips.value
  let next: string[]
  if (current.includes(cantripId)) {
    next = current.filter(c => c !== cantripId)
  } else if (current.length < altOption.value.count) {
    next = [...current, cantripId]
  } else {
    return  // límite alcanzado
  }
  setMartialCasterAlt(characterStore.character, altOption.value.source, next)
}
</script>

<template>
  <div v-if="eligible" class="bg-stone-800/50 border border-amber-700/30 rounded-lg p-5">
    <h3 class="text-lg font-bold text-amber-400 mb-2">
      Fighting Style
      <span class="text-stone-500 text-xs font-normal">({{ source }})</span>
    </h3>

    <!-- H5: opción Alt (Blessed Warrior / Druidic Warrior) -->
    <div v-if="altOption" class="mb-4">
      <div class="flex items-baseline gap-3 mb-2">
        <button type="button"
          @click="altActive ? deactivateAlt() : activateAlt()"
          class="px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors"
          :class="altActive
            ? 'bg-purple-700 text-purple-100'
            : 'bg-stone-700 text-stone-300 hover:bg-stone-600'">
          {{ altActive ? '✓' : '○' }} {{ altOption.label }} (alternative)
        </button>
        <span class="text-xs text-stone-500">
          Mutually exclusive with the Fighting Style feat below.
        </span>
      </div>
      <p class="text-xs text-stone-400 mb-3">{{ altOption.description }}</p>

      <!-- Selector de cantrips para Alt -->
      <div v-if="altActive" class="bg-stone-900/60 border border-purple-700/30 rounded p-3">
        <h4 class="text-sm font-semibold text-purple-300 mb-2">
          Choose {{ altOption.count }} {{ altOption.cantripList }} cantrips
          <span class="text-stone-500 text-xs font-normal">
            ({{ altCantrips.length }} / {{ altOption.count }})
          </span>
        </h4>
        <div class="flex flex-wrap gap-2">
          <button v-for="spell in availableAltCantrips" :key="spell.id"
            type="button"
            @click="toggleAltCantrip(spell.id)"
            :disabled="!altCantrips.includes(spell.id) && altCantrips.length >= altOption.count"
            class="px-3 py-1 rounded text-xs transition-colors"
            :class="altCantrips.includes(spell.id)
              ? 'bg-purple-600 text-stone-100 font-medium cursor-pointer'
              : altCantrips.length >= altOption.count
                ? 'bg-stone-800 text-stone-600 cursor-not-allowed'
                : 'bg-stone-700 text-stone-300 hover:bg-stone-600 cursor-pointer'"
            :title="spell.description">
            {{ spell.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Fighting Style feats (siempre visibles) -->
    <p class="text-xs text-stone-400 mb-2">
      <template v-if="altOption">Or choose a Fighting Style feat:</template>
      <template v-else>Choose a Fighting Style feat. You can replace it on each Fighter level-up.</template>
    </p>
    <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
      <button v-for="feat in styles" :key="feat.id"
        type="button"
        @click="selectStyle(feat.id)"
        :disabled="altActive"
        class="w-full text-left p-3 rounded border transition-colors"
        :class="altActive
          ? 'bg-stone-900/40 border-stone-800 text-stone-600 cursor-not-allowed'
          : currentFeat === feat.id
            ? 'bg-amber-900/40 border-amber-600 text-amber-100 cursor-pointer'
            : 'bg-stone-900/60 border-stone-700 text-stone-300 hover:bg-stone-700/40 cursor-pointer'">
        <div class="flex items-baseline justify-between">
          <span class="font-semibold text-sm">{{ feat.name }}</span>
          <span v-if="currentFeat === feat.id && !altActive" class="text-xs text-amber-400">✓ selected</span>
        </div>
        <p class="text-xs text-stone-400 mt-1">{{ feat.description }}</p>
      </button>
    </div>
  </div>
</template>
