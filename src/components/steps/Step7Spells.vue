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

/**
 * #146 — Max level POR CLASE caster. Antes existía un único
 * maxSpellLevelAvailable global que tomaba el MÁXIMO entre todas las
 * clases, lo cual permitía elegir hechizos de una clase secundaria por
 * encima de su propio progreso. Ejemplo: Ranger 4 / Wizard 5, Aid es
 * un hechizo Ranger nivel 2; Ranger 4 NO debería poder aprenderlo
 * (Ranger 4 = max nivel 1). El bug aparecía porque maxSpellLevelAvailable
 * = max(1, 3) = 3 ≥ 2 y Aid pasaba el filtro.
 *
 * Fix: cada hechizo se evalúa contra el max level de cada clase que lo
 * tenga en su lista. Un hechizo es elegible si EXISTE alguna clase caster
 * que (a) lo tenga en su lista y (b) tenga max-level ≥ spell.level.
 */
const maxSpellLevelByClass = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {}
  const entries = characterStore.character.classes ?? []
  if (entries.length === 0) {
    out[characterStore.character.className] = getMaxSpellLevel(
      characterStore.character.className,
      characterStore.character.level,
    )
    return out
  }
  for (const e of entries) {
    out[e.classId] = getMaxSpellLevel(e.classId, e.level)
  }
  return out
})

/** Sigue siendo útil para UI agregada (máximo absoluto, p.ej. cabecera). */
const maxSpellLevelAvailable = computed(() =>
  Math.max(0, ...Object.values(maxSpellLevelByClass.value)),
)

/**
 * Comprueba si el hechizo es elegible para alguna clase caster del PJ
 * respetando el límite por clase. Cantrips (level=0) siempre pasan si
 * la clase los tiene en su lista (no hay max-level para cantrips).
 */
function isSpellEligible(spell: { level: number; classes: readonly string[] }): boolean {
  for (const cid of casterClassIds.value) {
    if (!spell.classes.includes(cid)) continue
    if (spell.level === 0) return true  // cantrip: con que la clase lo tenga, vale
    const maxLv = maxSpellLevelByClass.value[cid] ?? 0
    if (spell.level <= maxLv) return true
  }
  return false
}

const availableSpells = computed(() => {
  return allSpells.value.filter(spell => {
    if (!isSpellEligible(spell)) return false
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

// Limpiar hechizos guardados que ya no sean elegibles según el límite por
// clase (#43, refinado en #146). Se ejecuta cuando cambia el max de
// cualquier clase (es decir, cuando el PJ sube de nivel en cualquier clase).
watch(maxSpellLevelByClass, () => {
  const before = characterStore.character.spellsKnown.length
  characterStore.character.spellsKnown =
    characterStore.character.spellsKnown.filter(id => {
      const spell = allSpells.value.find(s => s.id === id)
      if (!spell) return true  // hechizo desconocido, no tocamos
      return isSpellEligible(spell)
    })
  if (characterStore.character.spellsKnown.length < before) {
    console.log(`[Step7] Removed ${before - characterStore.character.spellsKnown.length} spells no longer eligible per-class`)
  }
}, { deep: true })

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

/**
 * #139 Fase 4c — Breakdown del cupo de hechizos por clase caster en
 * multiclass. La selección de hechizos en Step7 todavía vive en char.spellsKnown
 * agregado (la separación por clase llega en una fase posterior); aquí solo
 * informamos al usuario de cuántos hechizos ha asignado a cada clase para
 * que sepa si está respetando el límite de cada una.
 *
 * Atribución de cada hechizo a una clase: la PRIMERA clase caster del PJ
 * cuya spell list contenga ese hechizo. Si Cleric y Wizard ambos tienen
 * Bless, se atribuye al Cleric (primaria). Es heurístico — el modelo final
 * (Fases 5/6) etiquetará cada hechizo con su classId al elegirlo.
 */
const spellBreakdownByClass = computed(() => {
  if (!isMulticlass.value) return []
  const casterEntries = characterStore.character.classes.filter(e => {
    const cls = allClasses.value.find(c => c.id === e.classId)
    return !!cls?.spellcasting
  })
  if (casterEntries.length < 2) return []
  const counts = new Map<string, number>()
  for (const e of casterEntries) counts.set(e.classId, 0)
  for (const spellId of characterStore.character.spellsKnown ?? []) {
    const spell = allSpells.value.find(s => s.id === spellId)
    if (!spell) continue
    for (const e of casterEntries) {
      if (spell.classes.includes(e.classId)) {
        counts.set(e.classId, (counts.get(e.classId) ?? 0) + 1)
        break
      }
    }
  }
  return casterEntries.map(e => {
    const cls = allClasses.value.find(c => c.id === e.classId)
    const max = getSpellsKnownCount(e.classId, e.level, characterStore.abilityModifiers)
    const have = counts.get(e.classId) ?? 0
    return {
      classId: e.classId,
      className: cls?.name ?? e.classId,
      have,
      max,
      over: have > max,
    }
  })
})

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
            :disabled="!characterStore.character.cantrips.includes(spell.id) && characterStore.character.cantrips.length >= maxCantrips"
            compact
            @toggle="toggleCantrip(spell.id)"
          />
        </div>
      </div>

      <!-- #139 Fase 4c (M6) — Breakdown del cupo por clase caster en multiclass.
           Informativo, no bloqueante. La selección sigue contando contra el
           cupo TOTAL agregado; este panel solo avisa si una clase concreta
           supera su propio límite, lo cual viola RAW (cada clase tiene su
           propio prepared limit). Se mostrará un mejor flujo en Fase 5+
           cuando los hechizos lleven etiqueta de clase. -->
      <div v-if="spellBreakdownByClass.length > 0" class="mb-3 bg-stone-800/50 border border-stone-700 rounded p-2 text-xs">
        <p class="text-stone-400 mb-1.5 font-medium">{{ t('spells.byClass') }}</p>
        <div class="space-y-0.5">
          <div v-for="b in spellBreakdownByClass" :key="`bd-${b.classId}`"
               class="flex items-center gap-2">
            <span class="text-amber-500 min-w-20">{{ b.className }}:</span>
            <span :class="b.over ? 'text-red-400 font-medium' : 'text-stone-300'">
              {{ b.have }}/{{ b.max }}
            </span>
            <span v-if="b.over" class="text-red-400 text-[10px]">⚠ {{ t('spells.overLimit') }}</span>
          </div>
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
            :disabled="!characterStore.character.spellsKnown.includes(spell.id) && characterStore.character.spellsKnown.length >= maxSpellsKnown"
            @toggle="toggleSpell(spell.id)"
          />
        </div>
      </div>

      <!-- #91: Spell details ahora se ven en el acordeón de cada SpellRow -->
    </template>

  </section>
</template>
