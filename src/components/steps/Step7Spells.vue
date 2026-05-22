<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import { getSpells, getSpellSlots, getCantripsKnown, getSpellsKnownCount, getClasses, getMulticlassSpellSlots, getMaxSpellLevel } from '@/data'
import type { CasterType } from '@/data/dnd5e/classes'
import { useGameTerms } from '@/composables/useGameTerms'
import MagicInitiatePicker from '@/components/shared/MagicInitiatePicker.vue'
import SpellRow from '@/components/shared/SpellRow.vue'
import { getMagicInitiateInstances } from '@/utils/magicInitiate'

const { t } = useI18n()
const characterStore = useCharacterStore()
const gt = useGameTerms()

const allSpells = computed(() => getSpells(characterStore.character.variant))
const allClasses = computed(() => getClasses(characterStore.character.variant))

const isMulticlass = computed(() => (characterStore.character.classes ?? []).length >= 2)

// For multiclass, check if ANY class is a caster
const isCaster = computed(() => {
  if (isMulticlass.value) {
    return characterStore.character.classes.some(entry => {
      const cls = allClasses.value.find(c => c.id === entry.classId)
      return !!cls?.spellcasting
    })
  }
  return !!characterStore.character.spellcastingAbility
})

// Spell slots: use multiclass calculation when multiclassed
const spellSlots = computed(() => {
  if (isMulticlass.value) {
    const classesWithCasterType = characterStore.character.classes.map(entry => {
      const cls = allClasses.value.find(c => c.id === entry.classId)
      return {
        classId: entry.classId,
        level: entry.level,
        casterType: (cls?.spellcasting?.casterType ?? null) as CasterType | null,
      }
    })
    return getMulticlassSpellSlots(classesWithCasterType).slots
  }
  return getSpellSlots(characterStore.character.className, characterStore.character.level)
})

// Pact magic slots (Warlock in multiclass) — shown separately
const pactSlots = computed(() => {
  if (!isMulticlass.value) return {}
  const classesWithCasterType = characterStore.character.classes.map(entry => {
    const cls = allClasses.value.find(c => c.id === entry.classId)
    return {
      classId: entry.classId,
      level: entry.level,
      casterType: (cls?.spellcasting?.casterType ?? null) as CasterType | null,
    }
  })
  return getMulticlassSpellSlots(classesWithCasterType).pactSlots
})

const hasPactSlots = computed(() => Object.keys(pactSlots.value).length > 0)

// Magic Initiate instances (origin feat + ASI feats with grantsMagicInitiate).
// Even non-casters need the picker if they have at least one instance.
const magicInitiateInstances = computed(() =>
  getMagicInitiateInstances(characterStore.character)
)
const hasMagicInitiate = computed(() => magicInitiateInstances.value.length > 0)

// Cantrips: sum from all caster classes for multiclass
const maxCantrips = computed(() => {
  if (isMulticlass.value) {
    let total = 0
    for (const entry of characterStore.character.classes) {
      total += getCantripsKnown(entry.classId, entry.level)
    }
    return total
  }
  return getCantripsKnown(characterStore.character.className, characterStore.character.level)
})

// Spells known: sum from all caster classes for multiclass
const maxSpellsKnown = computed(() => {
  if (isMulticlass.value) {
    let total = 0
    for (const entry of characterStore.character.classes) {
      total += getSpellsKnownCount(entry.classId, entry.level, characterStore.abilityModifiers)
    }
    return total
  }
  return getSpellsKnownCount(characterStore.character.className, characterStore.character.level, characterStore.abilityModifiers)
})

const searchQuery = ref('')
const filterLevel = ref<number | null>(null)

// All class IDs for spell filtering (multiclass includes all classes)
const casterClassIds = computed(() => {
  if (isMulticlass.value) {
    return characterStore.character.classes.map(c => c.classId)
  }
  return [characterStore.character.className]
})

// Nivel máximo de slot disponible para la clase y nivel actuales (#43)
const maxSpellLevelAvailable = computed(() => {
  if (isMulticlass.value) {
    // Multiclass: tomar el máximo entre todas las clases
    return Math.max(0, ...characterStore.character.classes.map(e =>
      getMaxSpellLevel(e.classId, e.level)
    ))
  }
  return getMaxSpellLevel(characterStore.character.className, characterStore.character.level)
})

const availableSpells = computed(() => {
  const classIds = casterClassIds.value
  const maxLv = maxSpellLevelAvailable.value
  return allSpells.value.filter(spell => {
    if (!classIds.some(cls => spell.classes.includes(cls))) return false
    // Restringir al nivel máximo de slot disponible (#43)
    if (spell.level > 0 && spell.level > maxLv) return false
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!spell.name.toLowerCase().includes(q) && !gt.spell(spell.name).toLowerCase().includes(q)) return false
    }
    if (filterLevel.value !== null && spell.level !== filterLevel.value) return false
    return true
  })
})

const cantrips = computed(() => availableSpells.value.filter(s => s.level === 0))
const leveledSpells = computed(() => availableSpells.value.filter(s => s.level > 0))

// Limpiar hechizos guardados que superen el nivel máximo actual (#43)
watch(maxSpellLevelAvailable, (maxLv) => {
  if (maxLv === 0) return
  const validIds = new Set(
    allSpells.value.filter(s => s.level <= maxLv).map(s => s.id)
  )
  const before = characterStore.character.spellsKnown.length
  characterStore.character.spellsKnown =
    characterStore.character.spellsKnown.filter(id => validIds.has(id))
  if (characterStore.character.spellsKnown.length < before) {
    console.log(`[Step7] Removed ${before - characterStore.character.spellsKnown.length} spells above max level ${maxLv}`)
  }
})

function toggleCantrip(spellId: string) {
  const idx = characterStore.character.cantrips.indexOf(spellId)
  if (idx >= 0) {
    characterStore.character.cantrips.splice(idx, 1)
  } else if (characterStore.character.cantrips.length < maxCantrips.value) {
    characterStore.character.cantrips.push(spellId)
  }
}

function toggleSpell(spellId: string) {
  const idx = characterStore.character.spellsKnown.indexOf(spellId)
  if (idx >= 0) {
    characterStore.character.spellsKnown.splice(idx, 1)
  } else if (characterStore.character.spellsKnown.length < maxSpellsKnown.value) {
    characterStore.character.spellsKnown.push(spellId)
  }
}

</script>

<template>
  <section aria-labelledby="spells-heading">
    <h2 id="spells-heading" class="text-2xl font-bold text-amber-500 mb-6">{{ t('spells.title') }}</h2>

    <!-- Magic Initiate picker — always visible if the character has at least one
         Magic Initiate instance, even for non-casters (e.g. Fighter with Sailor
         background that has Magic Initiate as origin feat). -->
    <MagicInitiatePicker v-if="hasMagicInitiate" />

    <div v-if="!isCaster && !hasMagicInitiate" class="text-center py-12 text-stone-500" role="status">
      <p class="text-lg">{{ isMulticlass ? t('spells.notACasterMulticlass') : t('spells.notACaster') }}</p>
      <p class="text-sm mt-2">{{ t('spells.pressNext') }}</p>
    </div>

    <div v-else-if="!isCaster && hasMagicInitiate" class="text-center py-4 text-stone-500" role="status">
      <p class="text-sm">{{ t('spells.pressNext') }}</p>
    </div>

    <template v-else>
      <!-- Spell Slots Summary -->
      <div class="bg-stone-800 border border-stone-700 rounded-lg p-4 mb-6" role="region" :aria-label="t('spells.spellSlots')">
        <div class="flex flex-wrap gap-4 text-sm">
          <div v-if="characterStore.character.spellcastingAbility">
            <span class="text-stone-400">{{ t('spells.spellcastingAbility') }}:</span>
            <span class="text-amber-400 font-medium ml-1">{{ characterStore.character.spellcastingAbility.toUpperCase() }}</span>
          </div>
          <div v-for="(slots, level) in spellSlots" :key="level">
            <span class="text-stone-400">Lv.{{ level }}:</span>
            <span class="text-amber-400 font-medium ml-1">{{ slots }} slot</span>
          </div>
        </div>
        <!-- Pact Magic slots (Warlock multiclass) -->
        <div v-if="hasPactSlots" class="flex flex-wrap gap-4 text-sm mt-2 pt-2 border-t border-stone-700">
          <div class="text-purple-400 font-medium">{{ t('spells.pactMagic') }}:</div>
          <div v-for="(slots, level) in pactSlots" :key="'pact-' + level">
            <span class="text-stone-400">Lv.{{ level }}:</span>
            <span class="text-purple-400 font-medium ml-1">{{ slots }} slot</span>
          </div>
        </div>
      </div>

      <!-- Search & Filter -->
      <div class="flex gap-3 mb-4">
        <label for="spell-search" class="sr-only">{{ t('common.search') }}</label>
        <input id="spell-search" v-model="searchQuery" :placeholder="t('common.search')"
          class="flex-1 bg-stone-700 text-stone-200 rounded px-3 py-2 text-sm" />
        <label for="spell-level-filter" class="sr-only">{{ t('spells.allLevels') }}</label>
        <select id="spell-level-filter" v-model="filterLevel" class="bg-stone-700 text-stone-200 rounded px-3 py-2 text-sm" :aria-label="t('spells.allLevels')">
          <option :value="null">{{ t('spells.allLevels') }}</option>
          <option :value="0">{{ t('spells.cantrips') }}</option>
          <option v-for="l in 9" :key="l" :value="l">{{ t('spells.level', { level: l }) }}</option>
        </select>
      </div>

      <!-- Cantrips -->
      <div class="mb-6">
        <h3 id="cantrips-heading" class="text-lg font-semibold text-stone-300 mb-2">
          {{ t('spells.cantrips') }}
          <span class="text-sm text-stone-500" aria-live="polite">({{ characterStore.character.cantrips.length }}/{{ maxCantrips }})</span>
        </h3>
        <div class="flex flex-wrap gap-2" role="group" :aria-label="t('spells.cantrips')">
          <SpellRow
            v-for="spell in cantrips"
            :key="spell.id"
            :spell="spell"
            :selected="characterStore.character.cantrips.includes(spell.id)"
            :disabled="characterStore.character.cantrips.length >= maxCantrips"
            compact
            @toggle="toggleCantrip(spell.id)"
          />
        </div>
      </div>

      <!-- Leveled Spells -->
      <div>
        <h3 id="spells-known-heading" class="text-lg font-semibold text-stone-300 mb-2">
          {{ t('spells.knownSpells') }}
          <span class="text-sm text-stone-500" aria-live="polite">({{ characterStore.character.spellsKnown.length }}/{{ maxSpellsKnown }})</span>
        </h3>
        <div class="space-y-1" role="group" :aria-label="t('spells.knownSpells')">
          <SpellRow
            v-for="spell in leveledSpells"
            :key="spell.id"
            :spell="spell"
            :selected="characterStore.character.spellsKnown.includes(spell.id)"
            :disabled="characterStore.character.spellsKnown.length >= maxSpellsKnown"
            @toggle="toggleSpell(spell.id)"
          />
        </div>
      </div>

      <!-- #91: Spell details ahora se ven en el acordeón de cada SpellRow -->
    </template>

  </section>
</template>
