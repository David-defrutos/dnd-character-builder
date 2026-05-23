<script setup lang="ts">
import { defineAsyncComponent, computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useCharacterStore } from '@/stores/character'
import { ensureStepData } from '@/data'
import { getClassById } from '@/data/dnd5e/classes'
import { hasFightingStyleFeature } from '@/utils/fightingStyle'
import { hasMartialCasterAlt } from '@/utils/martialCasterAlt'
import { getActiveExpertiseFeatures } from '@/utils/expertiseFeatures'
import { pendingLevelDecisions } from '@/utils/levelUpGating'
import StepNavigation from '@/components/layout/StepNavigation.vue'
import { devLog } from '@/utils/devLog'

const { t } = useI18n()
const appStore = useAppStore()
const characterStore = useCharacterStore()

// #116 — A partir de nivel 2, los Steps 1-8 desaparecen y solo se muestra
// el Step 9 (Review). El wizard de creación es exclusivo para nivel 1; una
// vez el PJ sube de nivel, todas las decisiones se gestionan desde Review.
const REVIEW_STEP = 8
const isLockedToReview = computed(() => characterStore.character.level >= 2)

// Si por cualquier vía (URL directa, navegación lateral, datos cargados) el
// PJ está a lv.2+ y el currentStep no es Review, forzamos Review.
watch(
  () => [isLockedToReview.value, appStore.currentStep] as const,
  ([locked, step]) => {
    if (locked && step !== REVIEW_STEP) {
      appStore.setStep(REVIEW_STEP)
    }
  },
  { immediate: true },
)

// WSG 3.8: Preload data for current step when builder opens (for returning users past Step 1)
onMounted(async () => {
  const variant = characterStore.character.variant
  if (variant) {
    await ensureStepData(variant, appStore.currentStep)
  }
})

// WSG 3.8: Defer loading of non-critical resources — lazy load wizard steps
const steps = [
  defineAsyncComponent(() => import('@/components/steps/Step1Variant.vue')),
  defineAsyncComponent(() => import('@/components/steps/Step2Race.vue')),
  defineAsyncComponent(() => import('@/components/steps/Step3Class.vue')),
  defineAsyncComponent(() => import('@/components/steps/Step4Abilities.vue')),
  defineAsyncComponent(() => import('@/components/steps/Step5Background.vue')),
  defineAsyncComponent(() => import('@/components/steps/Step6Equipment.vue')),
  defineAsyncComponent(() => import('@/components/steps/Step7Spells.vue')),
  defineAsyncComponent(() => import('@/components/steps/Step8Details.vue')),
  defineAsyncComponent(() => import('@/components/steps/Step9Review.vue')),
]

const stepKeys = ['variant', 'race', 'class', 'abilities', 'background', 'equipment', 'spells', 'details', 'review']

// ─── Step Validation ──────────────────────────────────────────────────────
const validationMessage = ref('')
const isLoadingStep = ref(false)

/** Devuelve un mensaje específico si falta algo en Step 2 (Class), o null si OK.
 *  #93: el wizard debe bloquear el avance si la clase no tiene completas sus
 *  elecciones obligatorias: skills de clase, Fighting Style (cuando aplica) y
 *  Expertise (Bard/Rogue/Wizard Scholar cuando la clase y nivel lo activan). */
function classStepValidationError(): string | null {
  const char = characterStore.character
  if (!char.className) return t('validation.selectClass')

  const cls = getClassById(char.className)
  if (!cls) return null  // Defensivo

  // 1. Class skills: número exacto requerido.
  const classSkillsCount = (char.classSkillProficiencies ?? []).length
  if (classSkillsCount < cls.numSkillChoices) {
    const missing = cls.numSkillChoices - classSkillsCount
    return t('validation.missingClassSkills', { count: missing })
  }

  // 2. Fighting Style: si la clase tiene la feature, exigir feat o Alt.
  if (hasFightingStyleFeature(char)) {
    const hasFeat = !!char.fightingStyleFeat
    const hasAlt = hasMartialCasterAlt(char)
    if (!hasFeat && !hasAlt) {
      return t('validation.missingFightingStyle')
    }
  }

  // 3. Expertise: cada feature activa debe tener `count` skills elegidas.
  const expertiseFeatures = getActiveExpertiseFeatures(char)
  for (const feat of expertiseFeatures) {
    const chosen = (char.expertiseSources?.[feat.sourceId] ?? []).length
    if (chosen < feat.count) {
      return t('validation.missingExpertise', { label: feat.label, count: feat.count - chosen })
    }
  }

  return null
}

/** Bug A: devuelve mensaje específico si el PJ tiene species choices pendientes
 *  (ej. Dragonborn → Draconic Ancestry). El wizard ya no debe dejar pasar el
 *  Step 2 (Race) sin haberlas resuelto, porque la única UI para escogerlas
 *  vive en ese paso. Reusa pendingLevelDecisions filtrando por key. */
function raceStepValidationError(): string | null {
  const char = characterStore.character
  if (!char.race) return t('validation.selectRace')
  const speciesPending = pendingLevelDecisions(char).filter(p =>
    p.key.startsWith('species-choice-')
  )
  if (speciesPending.length > 0) {
    return speciesPending[0]!.message
  }
  return null
}

/** Bug A: devuelve mensaje específico si quedan cantrips/spells pendientes
 *  para el nivel actual. Si el PJ no es caster (cls.spellcasting === null),
 *  pendingLevelDecisions no emite estas keys y la validación pasa.
 *  Resuelve el caso original: wizard dejaba pasar Step 7 con 0/3 cantrips,
 *  luego al subir de nivel el PJ quedaba atrapado en Review (#116 + Bug B). */
function spellsStepValidationError(): string | null {
  const char = characterStore.character
  const pending = pendingLevelDecisions(char).filter(p =>
    p.key === 'cantrips' || p.key === 'spells-known' || p.key === 'spells-prepared'
  )
  if (pending.length > 0) {
    return pending[0]!.message
  }
  return null
}

/** Returns whether the current step has all required data filled in */
const isCurrentStepValid = computed((): boolean => {
  const char = characterStore.character
  switch (appStore.currentStep) {
    case 0: return !!char.variant             // Variant selected
    case 1: return raceStepValidationError() === null  // Bug A: + species choices
    case 2: return classStepValidationError() === null  // #93
    case 3: return true                       // Abilities always valid (defaults)
    case 4: return !!char.background          // Background selected
    case 5: return true                       // Equipment optional
    case 6: return spellsStepValidationError() === null  // Bug A: cantrips/spells
    case 7: return true                       // Details optional
    default: return true
  }
})

/** Map step index to validation i18n key */
function validationKey(step: number): string {
  switch (step) {
    case 1: return 'validation.selectRace'
    case 2: return 'validation.selectClass'
    case 4: return 'validation.selectBackground'
    default: return 'validation.completeStep'
  }
}

async function tryNextStep() {
  if (!isCurrentStepValid.value) {
    // Mensajes específicos por step. Más informativos que el genérico.
    if (appStore.currentStep === 1) {
      // Bug A: Step 2 Race puede fallar por race vacío o por species choice.
      validationMessage.value = raceStepValidationError() ?? t(validationKey(1))
    } else if (appStore.currentStep === 2) {
      // #93
      validationMessage.value = classStepValidationError() ?? t(validationKey(2))
    } else if (appStore.currentStep === 6) {
      // Bug A: Step 7 Spells — mensaje directo de pendingLevelDecisions.
      validationMessage.value = spellsStepValidationError() ?? t(validationKey(6))
    } else {
      validationMessage.value = t(validationKey(appStore.currentStep))
    }
    return
  }
  validationMessage.value = ''

  // WSG 3.8: Load only the data the next step needs before transitioning
  const nextStep = appStore.currentStep + 1
  const variant = characterStore.character.variant
  devLog('[Builder]', '→', nextStep, '| cls:', characterStore.character.className, '| lv:', characterStore.character.level)
  if (variant) {
    isLoadingStep.value = true
    await ensureStepData(variant, nextStep)
    isLoadingStep.value = false
  }
  appStore.nextStep()
}

async function goPrevStep() {
  validationMessage.value = ''
  const prevStep = appStore.currentStep - 1
  const variant = characterStore.character.variant
  devLog('[Builder]', '←', prevStep, '| cls:', characterStore.character.className, '| lv:', characterStore.character.level)
  if (variant) {
    await ensureStepData(variant, prevStep)
  }
  appStore.prevStep()
}
</script>

<template>
  <div class="w-full">
    <!-- #116: barra de pasos solo en lv.1 (creación). En lv.2+ todo es Review. -->
    <StepNavigation v-if="!isLockedToReview" />

    <!-- Live region for screen readers announcing step changes -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {{ t('common.stepProgress', { current: appStore.currentStep + 1, total: appStore.totalSteps }) }}:
      {{ t(`steps.${stepKeys[appStore.currentStep]}`) }}
    </div>

    <KeepAlive>
      <component :is="steps[appStore.currentStep]" />
    </KeepAlive>

    <!-- Validation warning -->
    <div
      v-if="validationMessage"
      class="mt-4 p-3 bg-amber-900/30 border border-amber-700 text-amber-300 rounded-lg text-sm flex items-center gap-2"
      role="alert"
    >
      <span aria-hidden="true">⚠️</span>
      {{ validationMessage }}
    </div>

    <!-- #116: navegación Back/Next solo en wizard (lv.1). Lv.2+ no la necesita. -->
    <nav v-if="!isLockedToReview" class="flex justify-between mt-8" :aria-label="t('common.stepProgress', { current: appStore.currentStep + 1, total: appStore.totalSteps })">
      <button
        v-if="appStore.currentStep > 0"
        @click="goPrevStep"
        :disabled="isLoadingStep"
        class="px-6 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
        :aria-label="`${t('common.back')}: ${t(`steps.${stepKeys[appStore.currentStep - 1]}`)}`"
      >
        {{ t('common.back') }}
      </button>
      <div v-else></div>

      <button
        v-if="appStore.currentStep < appStore.totalSteps - 1"
        @click="tryNextStep"
        :disabled="isLoadingStep"
        class="px-6 py-2 bg-amber-600 text-stone-900 font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-wait"
        :class="isCurrentStepValid && !isLoadingStep ? 'hover:bg-amber-500' : 'opacity-60'"
        :aria-label="`${t('common.next')}: ${t(`steps.${stepKeys[appStore.currentStep + 1]}`)}`"
        :aria-disabled="!isCurrentStepValid || isLoadingStep"
      >
        <span v-if="isLoadingStep" class="inline-flex items-center gap-2">
          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ t('common.next') }}
        </span>
        <span v-else>{{ t('common.next') }}</span>
      </button>
    </nav>
  </div>
</template>
