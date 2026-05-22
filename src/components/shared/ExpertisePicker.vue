<!-- ExpertisePicker.vue — H5 (auditoría externa) -->
<!--
  Renderiza un selector por cada feature de Expertise activa para el PJ
  (Bard lv.2, Bard lv.10, etc.). El jugador elige N skills de entre las
  que ya tiene proficiency. Las skills elegidas en una feature no son
  re-elegibles en otra (PHB 2024).
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { SKILLS } from '@/data/dnd5e/skills'
import { useGameTerms } from '@/composables/useGameTerms'
import {
  getActiveExpertiseFeatures,
  getSkillsBlockedByOtherExpertise,
  setExpertiseChoice,
  type ExpertiseFeature,
} from '@/utils/expertiseFeatures'

const characterStore = useCharacterStore()
const gt = useGameTerms()

const features = computed(() => getActiveExpertiseFeatures(characterStore.character))

function skillName(skillId: string): string {
  const s = SKILLS.find(x => x.id === skillId)
  return s ? gt.skill(s.name) : skillId
}

/** Skills con proficiency del PJ. */
const proficientSkills = computed(() =>
  characterStore.character.skillProficiencies ?? [],
)

/** Skills elegibles para una feature dada:
 *  - Si la feature define skillOptions, esas son las opciones (Wizard Scholar).
 *  - Si no, las skills proficient del PJ (Bard, Rogue).
 */
function eligibleSkillsFor(feat: ExpertiseFeature): string[] {
  if (feat.skillOptions) return [...feat.skillOptions]
  return proficientSkills.value
}

/** ¿Esta feature requiere que el PJ tenga proficiencies para mostrarse? */
function showProficiencyWarning(feat: ExpertiseFeature): boolean {
  // Si la feature otorga proficiency, no necesitamos aviso (las skills son
  // elegibles aunque el PJ no tenga ninguna).
  if (feat.grantsProficiency) return false
  return proficientSkills.value.length === 0
}

function selectedFor(sourceId: string): string[] {
  return characterStore.character.expertiseSources?.[sourceId] ?? []
}

function isBlockedByOther(sourceId: string, skill: string): boolean {
  return getSkillsBlockedByOtherExpertise(characterStore.character, sourceId).has(skill)
}

function toggle(sourceId: string, skill: string, count: number) {
  const current = selectedFor(sourceId)
  if (current.includes(skill)) {
    setExpertiseChoice(
      characterStore.character,
      sourceId,
      current.filter(s => s !== skill),
    )
  } else if (current.length < count) {
    setExpertiseChoice(
      characterStore.character,
      sourceId,
      [...current, skill],
    )
  }
}
</script>

<template>
  <div v-if="features.length" class="bg-stone-800/50 border border-purple-700/30 rounded-lg p-5">
    <h3 class="text-lg font-bold text-purple-400 mb-2">Expertise</h3>

    <div v-for="feat in features" :key="feat.sourceId" class="mb-5 last:mb-0">
      <h4 class="font-semibold text-stone-300 mb-1">
        {{ feat.label }}
        <span class="text-stone-500 text-xs font-normal">
          ({{ selectedFor(feat.sourceId).length }} / {{ feat.count }})
        </span>
      </h4>
      <p class="text-xs text-stone-400 mb-2">
        <template v-if="feat.grantsProficiency">
          Choose {{ feat.count }} skill. You gain proficiency in it (if you didn't have it already) and PB is doubled.
        </template>
        <template v-else>
          Choose {{ feat.count }} of your proficient skills. Your PB is doubled for ability checks with them.
        </template>
      </p>

      <p v-if="showProficiencyWarning(feat)" class="text-xs text-amber-400 mb-2">
        ⚠ You have no skill proficiencies yet. Pick class/background skills first.
      </p>

      <div v-if="eligibleSkillsFor(feat).length" class="flex flex-wrap gap-2">
        <button v-for="skill in eligibleSkillsFor(feat)" :key="skill"
          type="button"
          @click="toggle(feat.sourceId, skill, feat.count)"
          :disabled="isBlockedByOther(feat.sourceId, skill)
            || (!selectedFor(feat.sourceId).includes(skill)
                && selectedFor(feat.sourceId).length >= feat.count)"
          :title="isBlockedByOther(feat.sourceId, skill) ? 'Already chosen in another Expertise feature' : ''"
          class="px-3 py-1 rounded text-xs transition-colors"
          :class="isBlockedByOther(feat.sourceId, skill)
            ? 'bg-stone-900 text-stone-600 border border-stone-700 cursor-not-allowed line-through'
            : selectedFor(feat.sourceId).includes(skill)
              ? 'bg-purple-600 text-stone-100 font-medium cursor-pointer'
              : selectedFor(feat.sourceId).length >= feat.count
                ? 'bg-stone-800 text-stone-600 cursor-not-allowed'
                : 'bg-stone-700 text-stone-300 hover:bg-stone-600 cursor-pointer'">
          {{ skillName(skill) }}
        </button>
      </div>
    </div>
  </div>
</template>
