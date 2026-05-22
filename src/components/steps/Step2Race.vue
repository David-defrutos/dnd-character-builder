<script setup lang="ts">
// Documento generado el 2026-05-19-2143
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import { getRaces } from '@/data'
import type { Race } from '@/data/dnd5e/races'
import { formatModifier, feetToMeters } from '@/utils/calculations'
import { useGameTerms } from '@/composables/useGameTerms'
import { recomputeSpeciesGrants } from '@/utils/speciesSpells'

const { t } = useI18n()
const characterStore = useCharacterStore()
const gt = useGameTerms()

const races = computed(() => {
  // #62: ordenar alfabéticamente por el nombre mostrado (después de i18n).
  return [...getRaces(characterStore.character.variant)]
    .sort((a, b) => gt.raceName(a.name).localeCompare(gt.raceName(b.name)))
})

// selectedRace: computed puro desde el store
const selectedRace = computed((): Race | null => {
  if (!characterStore.character.race) return null
  return races.value.find(r => r.id === characterStore.character.race) ?? null
})

const selectedSubrace = ref<string>(characterStore.character.subrace ?? '')

/** A race counts as "2024-style" when it has no racial ASIs (the new PHB model). */
function isModern2024(race: Race): boolean {
  const sum = Object.values(race.abilityBonuses ?? {}).reduce((a, b) => a + (b ?? 0), 0)
  return sum === 0
}

/** Aplica los bonuses de especie y subraza al personaje. */
function applyRaceBonuses(race: Race, subraceId: string) {
  characterStore.character.speciesBonuses = { ...race.abilityBonuses }
  if (subraceId && race.subraces) {
    const sub = race.subraces.find(s => s.id === subraceId)
    if (sub?.abilityBonuses) {
      for (const [key, val] of Object.entries(sub.abilityBonuses)) {
        const k = key as keyof typeof characterStore.character.speciesBonuses
        characterStore.character.speciesBonuses[k] = (characterStore.character.speciesBonuses[k] || 0) + (val || 0)
      }
    }
  }
  // #105: aplicar cantrips/spells de linaje (Gnomish, Elven, Tiefling, Aasimar).
  recomputeSpeciesGrants(characterStore.character)
}

function selectRace(race: Race) {
  // Solo resetear la subraza si se cambia de raza (#47)
  const isSameRace = characterStore.character.race === race.id
  if (!isSameRace || !selectedSubrace.value) {
    selectedSubrace.value = race.subraces?.[0]?.id || ''
  }
  if (!isSameRace) {
    // Las elecciones de la raza anterior no aplican (#57).
    characterStore.character.speciesChoices = {}
  }
  characterStore.character.race = race.id
  characterStore.character.subrace = selectedSubrace.value
  applyRaceBonuses(race, selectedSubrace.value)
  characterStore.character.speed = race.speed
  // #92: PHB 2024 — los idiomas ya no se derivan de la raza. Common + 2
  // adicionales se eligen en el paso Background (LanguagePicker).
}

function selectSubrace(subraceId: string) {
  selectedSubrace.value = subraceId
  characterStore.character.subrace = subraceId
  // Recalcular bonuses sin resetear la subraza (#47)
  if (selectedRace.value) {
    applyRaceBonuses(selectedRace.value, subraceId)
    // H2: si la subraza tiene su propio speed (e.g. Wood Elf 35 ft), aplicarlo;
    // si no, restaurar el speed base de la raza.
    const sub = selectedRace.value.subraces.find(s => s.id === subraceId)
    characterStore.character.speed = sub?.speed ?? selectedRace.value.speed
  }
}

/** Set the chosen option for a species choice (e.g. Dragonborn → Draconic Ancestry). */
function selectSpeciesChoice(choiceId: string, optionId: string) {
  if (!characterStore.character.speciesChoices) {
    characterStore.character.speciesChoices = {}
  }
  characterStore.character.speciesChoices[choiceId] = optionId
}

/** Read the currently chosen option id for a species choice. */
function getSpeciesChoice(choiceId: string): string {
  return characterStore.character.speciesChoices?.[choiceId] ?? ''
}

function bonusString(bonuses: Record<string, number>): string {
  return Object.entries(bonuses)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k.toUpperCase()} ${formatModifier(v)}`)
    .join(', ')
}
</script>

<template>
  <section aria-labelledby="race-heading">
    <h2 id="race-heading" class="text-2xl font-bold text-amber-500 mb-6">{{ t('race.title') }}</h2>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="radiogroup" :aria-label="t('race.title')">
      <button
        v-for="race in races"
        :key="race.id"
        @click="selectRace(race)"
        class="bg-stone-800 border-2 rounded-lg p-4 text-left transition-all cursor-pointer"
        :class="characterStore.character.race === race.id ? 'border-amber-500' : 'border-stone-700 hover:border-stone-600'"
        role="radio"
        :aria-checked="characterStore.character.race === race.id"
        :aria-label="gt.raceName(race.name)"
      >
        <h3 class="font-bold text-amber-400">{{ gt.raceName(race.name) }}</h3>
        <p v-if="!isModern2024(race)" class="text-xs text-stone-400 mt-1">{{ bonusString(race.abilityBonuses) }}</p>
        <p class="text-xs text-stone-500 mt-1">
          {{ t('race.speed') }}: {{ feetToMeters(race.speed) }}m &bull; {{ race.size }}
          <span v-if="race.darkvision" class="text-amber-600/70"> &bull; Darkvision {{ race.darkvision }} ft</span>
        </p>
      </button>
    </div>

    <!-- Race Details -->
    <div v-if="selectedRace" class="mt-6 bg-stone-800 border border-stone-700 rounded-lg p-6">
      <h3 class="text-xl font-bold text-amber-400 mb-3">{{ gt.raceName(selectedRace.name) }}</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div v-if="!isModern2024(selectedRace)">
          <h4 class="font-semibold text-stone-300 mb-1">{{ t('race.abilityBonuses') }}</h4>
          <p class="text-stone-400">{{ bonusString(selectedRace.abilityBonuses) }}</p>
        </div>
        <div>
          <h4 class="font-semibold text-stone-300 mb-1">{{ t('race.speed') }}</h4>
          <p class="text-stone-400">{{ feetToMeters(selectedRace.speed) }}m ({{ selectedRace.speed }} ft)</p>
        </div>
        <div>
          <h4 class="font-semibold text-stone-300 mb-1">{{ t('race.size') }}</h4>
          <p class="text-stone-400">{{ selectedRace.size }}</p>
        </div>
        <div v-if="selectedRace.darkvision">
          <h4 class="font-semibold text-stone-300 mb-1">Darkvision</h4>
          <p class="text-stone-400">{{ selectedRace.darkvision }} ft</p>
        </div>
      </div>

      <div v-if="selectedRace.traits.length" class="mt-4">
        <h4 class="font-semibold text-stone-300 mb-1">{{ t('race.traits') }}</h4>
        <ul class="text-stone-400 text-sm space-y-1">
          <li v-for="trait in selectedRace.traits" :key="trait">&bull; {{ gt.trait(trait) }}</li>
        </ul>
      </div>

      <!-- Subraces / Lineages / Legacies -->
      <div v-if="selectedRace.subraces && selectedRace.subraces.length > 0" class="mt-4">
        <h4 class="font-semibold text-stone-300 mb-2">
          {{ selectedRace.id === 'elf' ? 'Elven Lineage' :
             selectedRace.id === 'tiefling' ? 'Fiendish Legacy' :
             selectedRace.id === 'gnome' ? 'Gnomish Lineage' :
             t('race.subrace') }}
        </h4>
        <div class="flex gap-2 flex-wrap" role="radiogroup" :aria-label="t('race.subrace')">
          <button
            v-for="sub in selectedRace.subraces"
            :key="sub.id"
            @click="selectSubrace(sub.id)"
            class="px-3 py-1 rounded text-sm transition-colors cursor-pointer"
            :class="selectedSubrace === sub.id ? 'bg-amber-600 text-stone-900' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'"
            role="radio"
            :aria-checked="selectedSubrace === sub.id"
          >
            {{ gt.subraceName(sub.name) }}
          </button>
        </div>
        <div v-if="selectedSubrace" class="mt-3">
          <ul class="text-stone-400 text-xs space-y-1">
            <li v-for="trait in (selectedRace.subraces.find(s => s.id === selectedSubrace)?.traits ?? [])" :key="trait">
              &bull; {{ trait }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Species choices (e.g. Dragonborn — Draconic Ancestry) -->
      <div v-if="selectedRace.choices && selectedRace.choices.length > 0" class="mt-4 space-y-4">
        <div v-for="choice in selectedRace.choices" :key="choice.id">
          <h4 class="font-semibold text-stone-300 mb-1">
            {{ choice.label }}
            <span v-if="!getSpeciesChoice(choice.id)" class="text-amber-500 text-xs font-normal ml-1">— required</span>
          </h4>
          <p v-if="choice.description" class="text-xs text-stone-500 mb-2">{{ choice.description }}</p>
          <div class="flex gap-2 flex-wrap" role="radiogroup" :aria-label="choice.label">
            <button
              v-for="opt in choice.options"
              :key="opt.id"
              @click="selectSpeciesChoice(choice.id, opt.id)"
              class="px-3 py-1 rounded text-sm transition-colors cursor-pointer"
              :class="getSpeciesChoice(choice.id) === opt.id ? 'bg-amber-600 text-stone-900' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'"
              role="radio"
              :aria-checked="getSpeciesChoice(choice.id) === opt.id"
            >
              {{ opt.name }}<span v-if="opt.details" class="text-xs opacity-75 ml-1">({{ opt.details }})</span>
            </button>
          </div>
        </div>
      </div>
    </div>

  </section>
</template>
