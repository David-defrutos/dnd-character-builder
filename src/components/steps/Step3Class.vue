<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import { getClasses } from '@/data'
import type { CharacterClass, Subclass } from '@/data/dnd5e/classes'
import { SKILLS } from '@/data/dnd5e/skills'
import { useGameTerms } from '@/composables/useGameTerms'
import { devLog } from '@/utils/devLog'
import FightingStylePicker from '@/components/shared/FightingStylePicker.vue'
import ExpertisePicker from '@/components/shared/ExpertisePicker.vue'

const { t } = useI18n()
const characterStore = useCharacterStore()
const gt = useGameTerms()

const variant = computed(() => characterStore.character.variant)

function skillDisplayName(skillId: string): string {
  const skill = SKILLS.find(s => s.id === skillId)
  return skill ? gt.skill(skill.name) : skillId
}

const classes = computed(() => getClasses(characterStore.character.variant))

// ── selectedClass: computed puro desde el store ───────────────────────────
// No usa ref ni hooks de ciclo de vida — siempre refleja el store directamente.
// Esto funciona con KeepAlive, defineAsyncComponent y cualquier orden de carga.
const selectedClass = computed((): CharacterClass | null => {
  if (!characterStore.character.className) return null
  return classes.value.find(c => c.id === characterStore.character.className) ?? null
})

// #93: las skills elegidas via la clase viven en classSkillProficiencies
// (campo separado en el store). Esto permite detectar colisiones con el
// background (backgroundSkillProficiencies) sin perder ninguna fuente.
// `classSkills` es computed sobre el store — no necesita sincronización.
const classSkills = computed(() => characterStore.character.classSkillProficiencies ?? [])
const bgSkills = computed(() => characterStore.character.backgroundSkillProficiencies ?? [])

/** Recalcula skillProficiencies como la unión bg + clase (sin duplicados). */
function rebuildSkillProficiencies() {
  const union: string[] = []
  for (const s of bgSkills.value) if (!union.includes(s)) union.push(s)
  for (const s of classSkills.value) if (!union.includes(s)) union.push(s)
  characterStore.character.skillProficiencies = union
}

function selectClass(cls: CharacterClass) {
  devLog('[Step3]', 'selectClass:', cls.id, '| subclassLevel:', cls.subclassLevel)
  characterStore.character.className = cls.id
  characterStore.character.hitDie = cls.hitDie
  characterStore.character.savingThrowProficiencies = [...cls.savingThrows]
  // H4: copiar proficiencies de armor/weapon/tool al personaje, separadas por
  // origen para poder reemplazarlas si se cambia de clase sin pisar las de
  // feats o las que añada el jugador a mano.
  characterStore.character.classArmorProficiencies = [...cls.armorProficiencies]
  characterStore.character.classWeaponProficiencies = [...cls.weaponProficiencies]
  characterStore.character.classToolProficiencies = [...cls.toolProficiencies]
  // #93: limpiar elecciones de skills al cambiar de clase, pero conservar
  // las del background.
  characterStore.character.classSkillProficiencies = []
  rebuildSkillProficiencies()
  // Reset subclass when changing class
  characterStore.character.subclass = ''

  // Set spellcasting info
  if (cls.spellcasting) {
    characterStore.character.spellcastingClass = cls.id
    characterStore.character.spellcastingAbility = cls.spellcasting.ability
  } else {
    characterStore.character.spellcastingClass = ''
    characterStore.character.spellcastingAbility = ''
  }
}

function selectSubclass(sub: Subclass) {
  devLog('[Step3]', 'selectSubclass:', sub.id, sub.name)
  characterStore.character.subclass = sub.id
}

const subclassUnlocked = computed(() => {
  if (!selectedClass.value) return false
  return characterStore.character.level >= (selectedClass.value.subclassLevel ?? 3)
})

function toggleSkill(skill: string) {
  if (!selectedClass.value) return
  // #93: no permitir tocar skills que ya vienen del background.
  if (bgSkills.value.includes(skill)) return

  const list = characterStore.character.classSkillProficiencies ?? []
  const idx = list.indexOf(skill)
  if (idx >= 0) {
    list.splice(idx, 1)
  } else if (list.length < selectedClass.value.numSkillChoices) {
    list.push(skill)
  }
  characterStore.character.classSkillProficiencies = [...list]
  rebuildSkillProficiencies()
}

// Multiclass: only D&D 5e, only if primary class is selected
const canMulticlass = computed(() =>
  variant.value === 'dnd5e' && !!characterStore.character.className
)

const multiclassOptions = computed(() => {
  if (!canMulticlass.value) return []
  const takenIds = new Set(characterStore.character.classes.map(c => c.classId))
  if (takenIds.size === 0) takenIds.add(characterStore.character.className)
  return classes.value.filter(c => !takenIds.has(c.id))
})

const multiclassDisplay = computed(() => {
  const cls_arr = characterStore.character.classes ?? []
  if (cls_arr.length < 2) return ''
  return cls_arr
    .map(c => {
      const cls = classes.value.find(cl => cl.id === c.classId)
      const name = cls ? gt.className(cls.name, variant.value) : c.classId
      return `${name} ${c.level}`
    })
    .join(' / ')
})

const showMulticlassAdd = ref(false)

function addSecondaryClass(clsId: string) {
  characterStore.addMulticlass(clsId)
  showMulticlassAdd.value = false
}

function removeSecondaryClass(clsId: string) {
  characterStore.removeMulticlass(clsId)
}

// Weapon mastery slots for this class at this level (if any).
const weaponMasterySlots = computed(() => {
  if (!selectedClass.value?.weaponMasteryByLevel) return null
  const lvl = Math.max(1, Math.min(20, characterStore.character.level))
  return selectedClass.value.weaponMasteryByLevel[lvl - 1] ?? 0
})

// Pretty-print one progression column for the current level.
function progressionAtLevel(col: (number | string)[] | undefined): string {
  if (!col) return ''
  const lvl = Math.max(1, Math.min(20, characterStore.character.level))
  const v = col[lvl - 1]
  return v === 0 || v === '0' ? '—' : String(v)
}
</script>

<template>
  <section aria-labelledby="class-heading">
    <h2 id="class-heading" class="text-2xl font-bold text-amber-500 mb-6">{{ t('class.title') }}</h2>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" role="radiogroup" :aria-label="t('class.title')">
      <button
        v-for="cls in classes"
        :key="cls.id"
        @click="selectClass(cls)"
        class="bg-stone-800 border-2 rounded-lg p-3 text-left transition-all cursor-pointer"
        :class="characterStore.character.className === cls.id ? 'border-amber-500' : 'border-stone-700 hover:border-stone-600'"
        role="radio"
        :aria-checked="characterStore.character.className === cls.id"
        :aria-label="gt.className(cls.name, variant)"
      >
        <h3 class="font-bold text-amber-400 text-sm">{{ gt.className(cls.name, variant) }}</h3>
        <p class="text-xs text-stone-500 mt-1">d{{ cls.hitDie }} &bull; {{ cls.primaryAbility.map((a: string) => a.toUpperCase()).join(', ') }}</p>
      </button>
    </div>

    <!-- Class Details -->
    <div v-if="selectedClass" class="mt-6 bg-stone-800 border border-stone-700 rounded-lg p-6">
      <h3 class="text-xl font-bold text-amber-400 mb-3">{{ gt.className(selectedClass.name, variant) }}</h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <h4 class="font-semibold text-stone-300 mb-1">{{ t('class.hitDie') }}</h4>
          <p class="text-stone-400">d{{ selectedClass.hitDie }}</p>
        </div>
        <div>
          <h4 class="font-semibold text-stone-300 mb-1">{{ t('class.savingThrows') }}</h4>
          <p class="text-stone-400">{{ selectedClass.savingThrows.map(s => s.toUpperCase()).join(', ') }}</p>
        </div>
        <div>
          <h4 class="font-semibold text-stone-300 mb-1">{{ t('class.proficiencies') }}</h4>
          <p class="text-stone-400 text-xs">
            {{ selectedClass.armorProficiencies.map(p => gt.proficiency(p)).join(', ') }}<br>
            {{ selectedClass.weaponProficiencies.map(p => gt.proficiency(p)).join(', ') }}
          </p>
        </div>
        <div v-if="selectedClass.spellcasting">
          <h4 class="font-semibold text-stone-300 mb-1">{{ t('spells.spellcastingAbility') }}</h4>
          <p class="text-stone-400">{{ selectedClass.spellcasting.ability.toUpperCase() }} ({{ selectedClass.spellcasting.casterType }})</p>
        </div>
      </div>

      <!-- Skill Selection — #93 -->
      <div class="mt-4">
        <h4 class="font-semibold text-stone-300 mb-2">
          {{ t('class.skillChoices', { count: selectedClass.numSkillChoices }) }}
          <span class="text-stone-500">({{ classSkills.length }}/{{ selectedClass.numSkillChoices }})</span>
        </h4>
        <p v-if="bgSkills.length" class="text-xs text-stone-500 mb-2">
          Skills already from your background are unselectable here. Choose
          {{ selectedClass.numSkillChoices }} of the others.
        </p>
        <div class="flex flex-wrap gap-2" role="group" :aria-label="t('class.skillChoices', { count: selectedClass.numSkillChoices })">
          <button
            v-for="skill in selectedClass.skillChoices"
            :key="skill"
            @click="toggleSkill(skill)"
            :disabled="bgSkills.includes(skill) || (!classSkills.includes(skill) && classSkills.length >= selectedClass.numSkillChoices)"
            :title="bgSkills.includes(skill) ? 'Already from background — pick another' : ''"
            class="px-3 py-1 rounded text-xs transition-colors"
            :class="bgSkills.includes(skill)
              ? 'bg-stone-900 text-stone-600 border border-stone-700 cursor-not-allowed line-through'
              : classSkills.includes(skill)
                ? 'bg-amber-600 text-stone-900 font-medium cursor-pointer'
                : classSkills.length >= selectedClass.numSkillChoices
                  ? 'bg-stone-800 text-stone-600 cursor-not-allowed'
                  : 'bg-stone-700 text-stone-300 hover:bg-stone-600 cursor-pointer'"
            :aria-pressed="classSkills.includes(skill)"
            :aria-disabled="bgSkills.includes(skill) || (!classSkills.includes(skill) && classSkills.length >= selectedClass.numSkillChoices)"
          >
            {{ skillDisplayName(skill) }}
            <span v-if="bgSkills.includes(skill)" class="text-[10px] ml-1">(bg)</span>
          </button>
        </div>
      </div>

      <!-- #94: Fighting Style (Fighter/Paladin/Ranger) -->
      <FightingStylePicker class="mt-4" />

      <!-- H5: Expertise (Bard/Rogue/Wizard Scholar) -->
      <ExpertisePicker class="mt-4" />

      <!-- Features -->
      <div v-if="selectedClass.features?.length" class="mt-4">
        <h4 class="font-semibold text-stone-300 mb-2">{{ t('class.features') }}</h4>
        <div class="space-y-2">
          <div v-for="feature in selectedClass.features.filter(f => f.level <= characterStore.character.level)" :key="feature.name" class="text-sm">
            <span class="text-amber-400 font-medium">Lv.{{ feature.level }}:</span>
            <span class="text-stone-400 ml-1">{{ gt.feature(feature.name) }}</span>
            <p v-if="feature.description" class="text-stone-500 text-xs ml-4">{{ feature.description }}</p>
          </div>
        </div>
      </div>

      <!-- 2024 Class Progression Table (per-level columns) -->
      <div v-if="selectedClass.progression" class="mt-4 border-t border-stone-700/60 pt-3">
        <h4 class="font-semibold text-stone-300 mb-2">
          Class Progression
          <span class="text-stone-500 text-xs">at level {{ characterStore.character.level }}</span>
        </h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div v-for="(col, name) in selectedClass.progression" :key="name" class="bg-stone-900/40 rounded px-2 py-1">
            <span class="text-stone-500">{{ name }}: </span>
            <span class="text-amber-400 font-medium">{{ progressionAtLevel(col) }}</span>
          </div>
        </div>
      </div>

      <!-- 2024 Weapon Mastery slots -->
      <div v-if="weaponMasterySlots !== null && weaponMasterySlots > 0" class="mt-4 border-t border-stone-700/60 pt-3">
        <h4 class="font-semibold text-stone-300 mb-1">Weapon Mastery</h4>
        <p class="text-xs text-stone-500">
          You can use the mastery property of <strong class="text-amber-400">{{ weaponMasterySlots }}</strong>
          weapon{{ weaponMasterySlots === 1 ? '' : 's' }} in which you are proficient.
          Change them on a long rest.
        </p>
      </div>

      <!-- 2024 Subclass selector (at level 3+) -->
      <div v-if="selectedClass.subclasses?.length" class="mt-4 border-t border-stone-700/60 pt-3">
        <h4 class="font-semibold text-stone-300 mb-2">
          {{ selectedClass.subclassName }}
          <span v-if="!subclassUnlocked" class="text-stone-500 text-xs">
            — unlocks at level {{ selectedClass.subclassLevel }}
          </span>
        </h4>
        <div v-if="subclassUnlocked" class="space-y-2">
          <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="selectedClass.subclassName">
            <button
              v-for="sub in selectedClass.subclasses"
              :key="sub.id"
              @click="selectSubclass(sub)"
              class="px-3 py-1 rounded text-sm transition-colors cursor-pointer"
              :class="characterStore.character.subclass === sub.id
                ? 'bg-amber-600 text-stone-900 font-medium'
                : 'bg-stone-700 text-stone-300 hover:bg-stone-600'"
              role="radio"
              :aria-checked="characterStore.character.subclass === sub.id"
            >
              {{ sub.name }}
            </button>
          </div>
          <!-- Selected subclass details -->
          <div v-if="characterStore.character.subclass" class="bg-stone-900/40 rounded p-3 mt-2">
            <p class="text-xs text-stone-400 italic mb-2">
              {{ selectedClass.subclasses.find(s => s.id === characterStore.character.subclass)?.description }}
            </p>
            <div class="space-y-1">
              <div
                v-for="f in (selectedClass.subclasses.find(s => s.id === characterStore.character.subclass)?.features ?? []).filter(f => f.level <= characterStore.character.level)"
                :key="f.id"
                class="text-xs"
              >
                <span class="text-amber-400 font-medium">Lv.{{ f.level }}:</span>
                <span class="text-stone-300 ml-1">{{ f.name }}</span>
                <p v-if="f.description" class="text-stone-500 ml-4">{{ f.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Multiclass (D&D 5e only) -->
    <div v-if="canMulticlass" class="mt-6 bg-stone-800 border border-purple-700/30 rounded-lg p-4" role="region" :aria-label="t('class.multiclass')">
      <h3 class="font-semibold text-purple-400 mb-3">{{ t('class.multiclass') }}</h3>

      <!-- Current multiclass breakdown -->
      <div v-if="(characterStore.character.classes ?? []).length >= 2" class="mb-3">
        <p class="text-stone-300 text-sm font-medium mb-2">{{ multiclassDisplay }} ({{ t('common.level') }} {{ characterStore.character.level }})</p>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="entry in characterStore.character.classes"
            :key="entry.classId"
            class="flex items-center gap-2 bg-stone-700 rounded px-3 py-1.5 text-sm"
          >
            <span class="text-amber-400 font-medium">
              {{ classes.find(c => c.id === entry.classId) ? gt.className(classes.find(c => c.id === entry.classId)!.name, variant) : entry.classId }}
            </span>
            <span class="text-stone-400">Lv.{{ entry.level }}</span>
            <span class="text-stone-500 text-xs">(d{{ entry.hitDie }})</span>
            <!-- Remove button (only for secondary classes) -->
            <button
              v-if="entry.classId !== characterStore.character.classes[0]?.classId"
              @click="removeSecondaryClass(entry.classId)"
              class="text-red-400 hover:text-red-300 text-xs ml-1 cursor-pointer"
              :aria-label="t('class.removeClass')"
            >✕</button>
          </div>
        </div>
      </div>

      <!-- Add class button/selector -->
      <div v-if="!showMulticlassAdd">
        <button
          @click="showMulticlassAdd = true"
          class="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-purple-100 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          :disabled="multiclassOptions.length === 0"
        >
          <span aria-hidden="true">+</span> {{ t('class.addClass') }}
        </button>
      </div>
      <div v-else>
        <p class="text-stone-400 text-sm mb-2">{{ t('class.selectClassToAdd') }}:</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            v-for="cls in multiclassOptions"
            :key="cls.id"
            @click="addSecondaryClass(cls.id)"
            class="bg-stone-700 hover:bg-stone-600 border border-stone-600 rounded-lg p-2 text-left transition-colors cursor-pointer"
          >
            <span class="text-amber-400 text-sm font-medium">{{ gt.className(cls.name, variant) }}</span>
            <span class="text-stone-500 text-xs ml-1">(d{{ cls.hitDie }})</span>
          </button>
        </div>
        <button
          @click="showMulticlassAdd = false"
          class="mt-2 text-stone-500 hover:text-stone-400 text-sm cursor-pointer"
        >{{ t('common.cancel') }}</button>
      </div>
    </div>

  </section>
</template>
