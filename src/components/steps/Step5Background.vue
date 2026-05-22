<script setup lang="ts">
// Documento generado el 2026-05-19-2143
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import { getBackgrounds } from '@/data'
import type { Background } from '@/data/dnd5e/backgrounds'
import { SKILLS } from '@/data/dnd5e/skills'
import { getFeatById } from '@/data/dnd5e/feats'
import { setOriginFeat } from '@/utils/originFeat'
import { useGameTerms } from '@/composables/useGameTerms'
import LanguagePicker from '@/components/shared/LanguagePicker.vue'

const { t } = useI18n()
const characterStore = useCharacterStore()
const gt = useGameTerms()

type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

/** Translate a background name. */
function bgDisplayName(bg: Background): string {
  if ((bg as any).nameOriginal) return (bg as any).nameOriginal
  return gt.background(bg.name)
}

function skillDisplayName(skillId: string): string {
  const skill = SKILLS.find(s => s.id === skillId)
  return skill ? gt.skill(skill.name) : skillId
}

const backgrounds = computed(() => getBackgrounds(characterStore.character.variant))

// selectedBg: computed puro desde el store — funciona sin onMounted/KeepAlive
const selectedBg = computed((): Background | null => {
  if (!characterStore.character.background) return null
  return backgrounds.value.find(b => b.id === characterStore.character.background) ?? null
})

// ─── Ability Score filter (#21) ──────────────────────────────────────────────
const abilityFilter = ref<AbilityKey | ''>('')
const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const filteredBackgrounds = computed(() => {
  if (!abilityFilter.value) return backgrounds.value
  const ab = abilityFilter.value
  return backgrounds.value.filter(bg => bg.abilityScores?.includes(ab))
})

// 2024 ASI allocation: '2+1' or '1+1+1'.
// In the '2+1' mode, asiTwo holds the ability that gets +2 and asiOne the one that gets +1.
const asiMode = ref<'2+1' | '1+1+1'>('2+1')
const asiTwo = ref<AbilityKey | ''>('')
const asiOne = ref<AbilityKey | ''>('')

const isModern = computed(() => Boolean(selectedBg.value?.abilityScores))

/** Pretty-print an ability key. */
function abilityLabel(k: AbilityKey): string {
  return k.toUpperCase()
}

/** Apply the background's effects to the character store. */
function selectBackground(bg: Background) {
  // #93: actualizar backgroundSkillProficiencies y recalcular la unión con
  // las skills de la clase. Si una skill del nuevo bg colisiona con una de
  // la clase, AVISAR al jugador para que cambie su elección de clase.
  const newBgSkills = [...bg.skillProficiencies]
  characterStore.character.backgroundSkillProficiencies = newBgSkills
  characterStore.character.background = bg.id

  // Si la clase ya había elegido una de las skills que ahora trae el bg,
  // se descarta esa elección de clase (el jugador deberá elegir otra en Step3).
  const classSk = characterStore.character.classSkillProficiencies ?? []
  characterStore.character.classSkillProficiencies =
    classSk.filter(s => !newBgSkills.includes(s))

  // Unión final sin duplicados: bg + class
  const union: string[] = []
  for (const s of newBgSkills) if (!union.includes(s)) union.push(s)
  for (const s of characterStore.character.classSkillProficiencies)
    if (!union.includes(s)) union.push(s)
  characterStore.character.skillProficiencies = union

  // Default ASI selection for 2024 backgrounds.
  if (bg.abilityScores) {
    asiMode.value = '2+1'
    asiTwo.value = bg.abilityScores[0]
    asiOne.value = bg.abilityScores[1]
    applyAsis()
  } else {
    // Trasfondo legacy sin abilityScores — limpiar bonuses anteriores
    characterStore.character.backgroundBonuses = {}
  }

  // Origin Feat: delegar al helper que gestiona el tag idempotentemente (#63).
  setOriginFeat(characterStore.character, bg.originFeat)
}

/** Recompute background-derived ability bonuses based on user's ASI choice. */
function applyAsis() {
  if (!selectedBg.value?.abilityScores) return
  const bonuses: Partial<Record<AbilityKey, number>> = {}
  if (asiMode.value === '2+1') {
    if (asiTwo.value) bonuses[asiTwo.value as AbilityKey] = 2
    if (asiOne.value && asiOne.value !== asiTwo.value) bonuses[asiOne.value as AbilityKey] = 1
  } else {
    for (const ab of selectedBg.value.abilityScores) {
      bonuses[ab as AbilityKey] = 1
    }
  }
  // Guardar los bonuses del trasfondo por separado — siempre reemplaza, nunca acumula.
  characterStore.character.backgroundBonuses = bonuses
}

// Recompute whenever the player changes their ASI choices.
watch([asiMode, asiTwo, asiOne], () => {
  if (selectedBg.value?.abilityScores) applyAsis()
})

// #40: Si asiTwo cambia al mismo valor que asiOne, auto-seleccionar otro atributo para asiOne
watch(asiTwo, (newTwo) => {
  if (newTwo && newTwo === asiOne.value && selectedBg.value?.abilityScores) {
    const other = selectedBg.value.abilityScores.find(ab => ab !== newTwo)
    if (other) asiOne.value = other as AbilityKey
  }
})

const grantedFeatName = computed(() => {
  if (!selectedBg.value?.originFeat) return ''
  return getFeatById(selectedBg.value.originFeat)?.name ?? ''
})
</script>

<template>
  <section aria-labelledby="background-heading">
    <h2 id="background-heading" class="text-2xl font-bold text-amber-500 mb-6">{{ t('background.title') }}</h2>

    <!-- Ability Score filters (#21) -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="text-xs text-stone-400 mr-1">Filter by ability:</span>
      <button
        @click="abilityFilter = ''"
        class="px-2 py-0.5 rounded text-xs transition-colors cursor-pointer"
        :class="abilityFilter === '' ? 'bg-amber-600 text-stone-900 font-semibold' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'"
      >All</button>
      <button
        v-for="ab in ABILITY_KEYS" :key="ab"
        @click="abilityFilter = abilityFilter === ab ? '' : ab"
        class="px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer"
        :class="abilityFilter === ab ? 'bg-amber-600 text-stone-900 font-semibold' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'"
      >{{ ab.toUpperCase() }}</button>
      <span v-if="abilityFilter" class="text-xs text-stone-500 ml-1">
        {{ filteredBackgrounds.length }} background{{ filteredBackgrounds.length === 1 ? '' : 's' }}
      </span>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="radiogroup" :aria-label="t('background.title')">
      <button
        v-for="bg in filteredBackgrounds"
        :key="bg.id"
        @click="selectBackground(bg)"
        class="bg-stone-800 border-2 rounded-lg p-4 text-left transition-all cursor-pointer"
        :class="[
          characterStore.character.background === bg.id ? 'border-amber-500' : 'border-stone-700 hover:border-stone-600',
          abilityFilter && bg.abilityScores?.includes(abilityFilter) ? 'ring-1 ring-amber-600/40' : ''
        ]"
        role="radio"
        :aria-checked="characterStore.character.background === bg.id"
        :aria-label="bgDisplayName(bg)"
      >
        <h3 class="font-bold text-amber-400">{{ bgDisplayName(bg) }}</h3>
        <p class="text-xs text-stone-500 mt-1">
          {{ bg.skillProficiencies.map(skillDisplayName).join(', ') }}
          <span v-if="bg.abilityScores" class="text-amber-600/70">
            &bull; {{ bg.abilityScores.map(a => a.toUpperCase()).join('/') }}
          </span>
        </p>
        <p v-if="bg.originFeat" class="text-xs text-stone-500 mt-1" :title="getFeatById(bg.originFeat)?.description">
          Origin Feat: <span class="text-amber-500/80">{{ getFeatById(bg.originFeat)?.name }}</span>
        </p>
      </button>
    </div>

    <!-- Background Details -->
    <div v-if="selectedBg" class="mt-6 bg-stone-800 border border-stone-700 rounded-lg p-6">
      <h3 class="text-xl font-bold text-amber-400 mb-3">{{ bgDisplayName(selectedBg) }}</h3>
      <p class="text-stone-400 text-sm mb-4">{{ selectedBg.description }}</p>

      <div class="space-y-3 text-sm">
        <div>
          <h4 class="font-semibold text-stone-300">{{ t('background.skillProficiencies') }}</h4>
          <p class="text-stone-400">{{ selectedBg.skillProficiencies.map(skillDisplayName).join(', ') }}</p>
        </div>
        <div v-if="selectedBg.toolProficiencies.length">
          <h4 class="font-semibold text-stone-300">Tool Proficiencies</h4>
          <p class="text-stone-400">{{ selectedBg.toolProficiencies.join(', ') }}</p>
        </div>

        <!-- 2024: ability score increases from background -->
        <div v-if="isModern && selectedBg.abilityScores" class="border-t border-stone-700/60 pt-3">
          <h4 class="font-semibold text-stone-300 mb-2">Ability Score Increases (PHB 2024)</h4>
          <p class="text-xs text-stone-500 mb-2">
            Choose how to distribute the ASIs for this background's three abilities:
            <strong class="text-stone-300">{{ selectedBg.abilityScores.map(a => a.toUpperCase()).join(', ') }}</strong>.
          </p>
          <div class="flex flex-wrap gap-3 items-center text-xs">
            <label class="flex items-center gap-2">
              <input type="radio" v-model="asiMode" value="2+1" class="accent-amber-500" />
              <span>+2 / +1</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="radio" v-model="asiMode" value="1+1+1" class="accent-amber-500" />
              <span>+1 / +1 / +1</span>
            </label>
          </div>

          <div v-if="asiMode === '2+1'" class="flex flex-wrap gap-3 items-center text-xs mt-3">
            <label>
              <span class="text-stone-400 mr-1">+2 to</span>
              <select v-model="asiTwo" class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200">
                <option v-for="ab in selectedBg.abilityScores" :key="ab" :value="ab">{{ abilityLabel(ab as AbilityKey) }}</option>
              </select>
            </label>
            <label>
              <span class="text-stone-400 mr-1">+1 to</span>
              <select v-model="asiOne" class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200">
                <option v-for="ab in selectedBg.abilityScores" :key="ab" :value="ab" :disabled="ab === asiTwo">
                  {{ abilityLabel(ab as AbilityKey) }}
                </option>
              </select>
            </label>
          </div>
        </div>

        <!-- 2024: Origin Feat -->
        <div v-if="isModern && grantedFeatName" class="border-t border-stone-700/60 pt-3">
          <h4 class="font-semibold text-stone-300">Origin Feat</h4>
          <p class="text-stone-300">{{ grantedFeatName }}</p>
          <p v-if="selectedBg.originFeat" class="text-xs text-stone-500 mt-1">
            {{ getFeatById(selectedBg.originFeat)?.description }}
          </p>
        </div>

        <!-- 2024: Equipment Choice A or B -->
        <div v-if="selectedBg.equipmentChoice" class="border-t border-stone-700/60 pt-3">
          <h4 class="font-semibold text-stone-300 mb-1">Starting Equipment (choose one)</h4>
          <div class="bg-stone-900/40 rounded p-2 mb-2">
            <p class="text-xs text-stone-300"><strong>A.</strong> {{ selectedBg.equipmentChoice.optionA.join(', ') }}</p>
          </div>
          <div class="bg-stone-900/40 rounded p-2">
            <p class="text-xs text-stone-300"><strong>B.</strong> {{ selectedBg.equipmentChoice.optionB }}</p>
          </div>
        </div>

        <!-- Legacy 2014 feature -->
        <div v-if="selectedBg.feature">
          <h4 class="font-semibold text-stone-300">{{ selectedBg.feature.name }}</h4>
          <p class="text-stone-400">{{ selectedBg.feature.description }}</p>
        </div>
      </div>
    </div>

    <!-- Personality -->
    <div class="mt-6 space-y-4">
      <div>
        <label for="personality-traits" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('background.personalityTraits') }}</label>
        <textarea id="personality-traits" v-model="characterStore.character.personalityTraits" rows="2"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg p-3 text-stone-200 text-sm focus:border-amber-500 focus:outline-none" />
      </div>
      <div>
        <label for="ideals" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('background.ideals') }}</label>
        <textarea id="ideals" v-model="characterStore.character.ideals" rows="2"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg p-3 text-stone-200 text-sm focus:border-amber-500 focus:outline-none" />
      </div>
      <div>
        <label for="bonds" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('background.bonds') }}</label>
        <textarea id="bonds" v-model="characterStore.character.bonds" rows="2"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg p-3 text-stone-200 text-sm focus:border-amber-500 focus:outline-none" />
      </div>
      <div>
        <label for="flaws" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('background.flaws') }}</label>
        <textarea id="flaws" v-model="characterStore.character.flaws" rows="2"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg p-3 text-stone-200 text-sm focus:border-amber-500 focus:outline-none" />
      </div>
    </div>

    <!-- #92: Languages (PHB 2024 — Common + 2 chosen) -->
    <LanguagePicker class="mt-6" />

  </section>
</template>
