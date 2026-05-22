<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import { totalHp } from '@/utils/calculations'
import { getClasses } from '@/data'

const { t } = useI18n()
const characterStore = useCharacterStore()

const maxLevel = 20

// ── Subclass selector (for users who skip Step3) ─────────────────────────
const currentClass = computed(() => {
  if (!characterStore.character.className) return null
  return getClasses('dnd5e').find(c => c.id === characterStore.character.className) ?? null
})
const subclassUnlocked = computed(() =>
  !!currentClass.value && characterStore.character.level >= (currentClass.value.subclassLevel ?? 3)
)
const showSubclassSelector = computed(() =>
  subclassUnlocked.value && !!currentClass.value?.subclasses?.length
)


const alignments = [
  'lg', 'ng', 'cg', 'ln', 'tn', 'cn', 'le', 'ne', 'ce'
]




// Whacks level display
// Brawling moves as textarea (one per line)
// Calculate HP when level changes
function updateLevel() {
  const conMod = characterStore.abilityModifiers.con
  const baseHp = totalHp(characterStore.character.hitDie, conMod, characterStore.character.level)
  const toughBonus = characterStore.character.toughHpBonus ?? 0
  characterStore.character.maxHp = baseHp + toughBonus
  characterStore.character.currentHp = characterStore.character.maxHp
}

// Set initial HP
updateLevel()

// Recalcular HP cuando Tough cambia (toughHpBonus se actualiza en AsiSelector)
watch(() => characterStore.character.toughHpBonus, updateLevel)
</script>

<template>
  <section aria-labelledby="details-heading">
    <h2 id="details-heading" class="text-2xl font-bold text-amber-500 mb-6">{{ t('details.title') }}</h2>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="char-name" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.name') }}</label>
        <input id="char-name" v-model="characterStore.character.name" type="text"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none" />
      </div>

      <div>
        <label for="player-name" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.playerName') }}</label>
        <input id="player-name" v-model="characterStore.character.playerName" type="text"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none" />
      </div>

      <div>
        <label for="char-level" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('common.level') }}</label>
        <input id="char-level" v-model.number="characterStore.character.level" type="number" min="1" :max="maxLevel"
          @change="updateLevel"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none" />
      </div>

      <!-- Subclass selector — visible when level ≥ subclassLevel -->
      <div v-if="showSubclassSelector" class="border border-amber-700/40 rounded-lg p-3 bg-stone-800/60">
        <p class="text-sm font-semibold text-amber-400 mb-2">
          {{ currentClass!.subclassName }}
          <span v-if="!characterStore.character.subclass" class="text-amber-600 text-xs ml-1">(required at level {{ currentClass!.subclassLevel ?? 3 }})</span>
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="sub in currentClass!.subclasses"
            :key="sub.id"
            @click="characterStore.character.subclass = sub.id"
            class="px-3 py-1 rounded text-sm transition-colors cursor-pointer"
            :class="characterStore.character.subclass === sub.id
              ? 'bg-amber-600 text-stone-900 font-medium'
              : 'bg-stone-700 text-stone-300 hover:bg-stone-600'"
          >{{ sub.name }}</button>
        </div>
        <p v-if="characterStore.character.subclass" class="text-xs text-stone-500 italic mt-2">
          {{ currentClass!.subclasses.find(s => s.id === characterStore.character.subclass)?.description }}
        </p>
      </div>

      <div>
        <label for="char-alignment" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.alignment') }}</label>
        <select id="char-alignment" v-model="characterStore.character.alignment"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none">
          <option value="">--</option>
          <option v-for="a in alignments" :key="a" :value="a">{{ t(`alignments.${a}`) }}</option>
        </select>
      </div>

      <div>
        <label for="char-age" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.age') }}</label>
        <input id="char-age" v-model="characterStore.character.age" type="text"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none" />
      </div>

      <div>
        <label for="char-height" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.height') }}</label>
        <input id="char-height" v-model="characterStore.character.height" type="text"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none" />
      </div>

      <div>
        <label for="char-weight" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.weight') }}</label>
        <input id="char-weight" v-model="characterStore.character.weight" type="text"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none" />
      </div>

      <div>
        <label for="char-eyes" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.eyes') }}</label>
        <input id="char-eyes" v-model="characterStore.character.eyes" type="text"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none" />
      </div>

      <div>
        <label for="char-hair" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.hair') }}</label>
        <input id="char-hair" v-model="characterStore.character.hair" type="text"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none" />
      </div>

      <div>
        <label for="char-skin" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.skin') }}</label>
        <input id="char-skin" v-model="characterStore.character.skin" type="text"
          class="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 focus:border-amber-500 focus:outline-none" />
      </div>
    </div>

    <div class="mt-6">
      <label for="char-backstory" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.backstory') }}</label>
      <textarea id="char-backstory" v-model="characterStore.character.backstory" rows="5"
        class="w-full bg-stone-800 border border-stone-700 rounded-lg p-3 text-stone-200 text-sm focus:border-amber-500 focus:outline-none" />
    </div>

    <!-- Session Notes -->
    <div class="mt-6">
      <label for="session-notes" class="block text-sm font-semibold text-stone-300 mb-1">{{ t('details.sessionNotes') }}</label>
      <textarea id="session-notes" v-model="characterStore.character.sessionNotes" rows="4"
        :placeholder="t('details.sessionNotesPlaceholder')"
        class="w-full bg-stone-800 border border-stone-700 rounded-lg p-3 text-stone-200 text-sm focus:border-amber-500 focus:outline-none" />
    </div>

    <!-- HP Summary -->
    <div class="mt-6 bg-stone-800 border border-stone-700 rounded-lg p-4">
      <h3 class="font-semibold text-stone-300 mb-2">{{ t('review.hp') }}</h3>
      <div class="flex gap-6 text-sm">
        <div>
          <span class="text-stone-400">{{ t('review.maxHp') }}:</span>
          <span class="text-amber-400 font-bold ml-1">{{ characterStore.character.maxHp }}</span>
        </div>
        <div>
          <span class="text-stone-400">{{ t('review.hitDie') }}:</span>
          <span class="text-stone-200 ml-1">{{ characterStore.character.level }}d{{ characterStore.character.hitDie }}</span>
        </div>
      </div>
    </div>

    <!-- ═══ BRANCALONIA: Brawling & Size ═══ -->
    

    <!-- ═══ APOCALISSE: Mark, Virtue, Sin, Humanity ═══ -->
    

  </section>
</template>
