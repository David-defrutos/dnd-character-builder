<script setup lang="ts">
// AsiSelector.vue — ASI / Feat checkpoint selector.
// Standalone: reads/writes characterStore directly.
// Used in Step4Abilities and Step9Review.
//
// #139 Fase 3b — Multiclass: el componente acepta una prop opcional `classId`
// que indica QUÉ clase del PJ está editando este selector. Si no se pasa,
// usa la primaria (classes[0].classId, o el char.className plano si no hay
// classes[] aún). Para multiclass se monta una instancia por clase en
// Step4Abilities y Step9Review (Fase 3c).
//
// IMPORTANTE: los bonos a ability scores son globales del PJ. Por eso
// recomputeBonuses() y applyFeatEffects() reciben TODOS los AsiChoices del
// PJ (vía getAllAsiChoices), no solo los de esta clase. Lo mismo para los
// featuresTraits (las etiquetas "ASI Feat: ...") que listamos.
import { ref, computed, watch, onMounted } from 'vue'
import { useCharacterStore } from '@/stores/character'
import type { ASIChoice } from '@/stores/character'
import { getAsiLevels, eligibleFeats, aggregateAsiBumps, isEpicBoonLevel, ABILITY_KEYS, resolveFeatAbility } from '@/data/dnd5e/asi'
import { getClassById } from '@/data/dnd5e/classes'
import { getFeatById } from '@/data/dnd5e/feats'
import { applyFeatEffects } from '@/utils/featEffects'
import { syncMagicInitiateChoices } from '@/utils/magicInitiate'
import { isAsiSlotLocked } from '@/utils/asiLock'
import {
  getPrimaryClass,
  getClassEntry,
  getAsiChoicesForClass,
  setAsiChoicesForClass,
  getAllAsiChoices,
} from '@/utils/classEntries'
import FeatPicker from '@/components/shared/FeatPicker.vue'
import FeatChoicesPicker from '@/components/shared/FeatChoicesPicker.vue'

/**
 * Prop opcional `classId`: indica para qué clase del PJ es este selector.
 * Si no se pasa (caso default, igual que antes de #139), opera sobre la
 * primaria.
 */
const props = defineProps<{
  classId?: string
}>()

const characterStore = useCharacterStore()

/**
 * #138 — Modo "edición forzada". Cuando el usuario pulsa "Desbloquear edición",
 * los slots locked por nivel (#72) se vuelven editables de nuevo. NO se
 * persiste: al recargar el componente o salir de la pantalla, vuelve a false.
 * Esto evita "olvidar" que estamos en modo desbloqueado.
 *
 * Riesgo conocido: cambiar un slot ya bloqueado puede romper el árbol de
 * prerequisitos (un feat de lv.4 puede haber sido prereq de algo en lv.5+).
 * El usuario asume esa responsabilidad — el aviso textual lo recuerda.
 */
const forceUnlock = ref(false)

/**
 * ID de la clase que controla este selector. Si la prop viene definida,
 * la usamos; si no, caemos a la primaria (getPrimaryClass).
 */
const activeClassId = computed<string>(() => {
  if (props.classId) return props.classId
  const prim = getPrimaryClass(characterStore.character)
  return prim?.classId ?? ''
})

const selectedClass = computed(() => getClassById(activeClassId.value))

/**
 * Nivel del PJ DENTRO de esta clase (no el nivel total).
 *  - Si hay entrada en classes[] para activeClassId → usar entry.level.
 *  - Si no, caer a char.level (modelo viejo no migrado: sin classes[]).
 */
const classLevel = computed<number>(() => {
  const entry = getClassEntry(characterStore.character, activeClassId.value)
  if (entry) return entry.level
  return characterStore.character.level
})

const asiLevels = computed(() => {
  if (!selectedClass.value) return []
  return getAsiLevels(selectedClass.value.id, classLevel.value)
})

const asiChoices = ref<ASIChoice[]>([])

function syncAsiChoices() {
  const levels = asiLevels.value
  // #139 Fase 3b: leer los ASIs de ESTA clase (con fallback al plano para
  // PJs no migrados).
  const existing = getAsiChoicesForClass(characterStore.character, activeClassId.value)
  asiChoices.value = levels.map(lvl => {
    const found = existing.find(c => c.level === lvl)
    if (found) {
      const slot = { ...found }
      // Migration: if a feat is selected but featAbility hasn't been resolved
      // (older personajes guardados antes del bug #48 fix), resolve it now.
      if (slot.type === 'feat' && slot.featId) {
        slot.featAbility = resolveFeatAbility(slot.featId, slot.featAbility)
      }
      return slot
    }
    return isEpicBoonLevel(lvl)
      ? { level: lvl, type: 'feat', featId: '' }
      : { level: lvl, type: 'asi', asiMode: '2', asiAbilities: [] }
  })
  if (levels.length > 0) persistChoices()
}

watch(
  [
    () => characterStore.character.className,
    () => characterStore.character.level,
    () => props.classId,
    () => classLevel.value,
  ],
  syncAsiChoices,
)
onMounted(syncAsiChoices)


function recomputeBonuses() {
  // #139 Fase 3b: los bonos a ability scores son del PJ entero, no solo de
  // esta clase. Sumamos los AsiChoices de TODAS las clases del personaje.
  characterStore.character.asiBonuses = aggregateAsiBumps(
    getAllAsiChoices(characterStore.character),
  )
}

function syncFeatTags() {
  if (!Array.isArray(characterStore.character.featuresTraits)) {
    characterStore.character.featuresTraits = []
  }
  const tagPrefix = 'ASI Feat: '
  characterStore.character.featuresTraits =
    characterStore.character.featuresTraits.filter(t => !t.startsWith(tagPrefix))
  // #139 Fase 3b: featuresTraits del PJ contiene los feats de TODAS las
  // clases. Cuando hay varios selectores activos (multiclass), cada uno
  // limpia el prefijo y vuelve a poblarlo con los suyos; pero al hacerlo
  // pisaría los del otro selector. Para evitarlo, repoblamos con TODOS.
  const all = getAllAsiChoices(characterStore.character)
  for (const c of all) {
    if (c.type === 'feat' && c.featId) {
      const feat = getFeatById(c.featId)
      if (feat) characterStore.character.featuresTraits.push(`${tagPrefix}${feat.name} (lv.${c.level})`)
    }
  }
}

function persistChoices() {
  // #139 Fase 3b: escribir los choices de ESTA clase via helper, que también
  // sincroniza char.asiChoices plano si esta es la primaria.
  setAsiChoicesForClass(
    characterStore.character,
    activeClassId.value,
    JSON.parse(JSON.stringify(asiChoices.value)),
  )
  recomputeBonuses()
  syncFeatTags()
  // applyFeatEffects necesita TODOS los choices del PJ, no solo los de esta
  // clase, para que efectos como Alert (initiative prof) o Tough HP se
  // mantengan al persistir desde un selector secundario.
  applyFeatEffects(characterStore.character, getAllAsiChoices(characterStore.character))
  // Limpia magicInitiateChoices huérfanas si el jugador cambió un ASI feat
  // Magic Initiate por otro feat distinto (la elección ya no aplica). #74
  syncMagicInitiateChoices(characterStore.character)
}

function setChoiceType(idx: number, type: 'asi' | 'feat') {
  const slot = asiChoices.value[idx]
  if (!slot) return
  slot.type = type
  if (type === 'asi') {
    slot.asiMode = '2'
    slot.asiAbilities = []
    slot.featId = undefined
    slot.featAbility = undefined
  } else {
    slot.featId = ''
    slot.asiMode = undefined
    slot.asiAbilities = undefined
    slot.featAbility = undefined
  }
  persistChoices()
}

function setAsiMode(idx: number, mode: '2' | '1+1') {
  const slot = asiChoices.value[idx]
  if (!slot) return
  slot.asiMode = mode
  // Reset abilities when mode changes — user must re-pick to confirm.
  slot.asiAbilities = []
  persistChoices()
}

function setAsiAbility(idx: number, slotIdx: number, val: string) {
  const slot = asiChoices.value[idx]
  if (!slot?.asiAbilities) return
  // H7: descartar la asignación si supera el cap (20 normal, 30 Epic Boon).
  if (val) {
    const bump = slot.asiMode === '2' ? 2 : 1
    if (wouldExceedCap(idx, val, bump)) return
  }
  // Fill intermediate empty slots so we never have `undefined` in the array.
  while (slot.asiAbilities.length < slotIdx) {
    slot.asiAbilities.push('' as typeof ABILITY_KEYS[number])
  }
  slot.asiAbilities[slotIdx] = val as typeof ABILITY_KEYS[number]
  persistChoices()
}

function setFeatId(idx: number, featId: string) {
  const slot = asiChoices.value[idx]
  if (!slot) return
  slot.featId = featId
  // Auto-resolve the +1 ability bonus granted by the feat:
  // - single-option feats → assign automatically
  // - multi-option feats  → leave undefined (user picks via selector)
  slot.featAbility = resolveFeatAbility(featId, slot.featAbility)
  // Limpiar featChoices al cambiar de feat — las elecciones del feat anterior
  // ya no aplican (#52 fase 2).
  slot.featChoices = {}
  persistChoices()
}

function setFeatAbility(idx: number, ab: string) {
  const slot = asiChoices.value[idx]
  if (!slot) return
  slot.featAbility = ab as typeof ABILITY_KEYS[number]
  persistChoices()
}

function setFeatChoices(idx: number, choices: Record<string, string[]>) {
  const slot = asiChoices.value[idx]
  if (!slot) return
  slot.featChoices = choices
  persistChoices()
}

/**
 * #137 — IDs de feats no-repetibles ya cogidos en otros checkpoints. Se le
 * pasan al FeatPicker para que muestre el aviso "ya cogido" sin bloquear.
 * - Excluye el slot pasado (no se marca a sí mismo).
 * - Excluye los feats marcados como `repeatable` en el catálogo (ASI,
 *   Elemental Adept, Magic Initiate, Skilled).
 * - Si dos slots distintos llevan el MISMO feat no-repetible, ambos verán el
 *   aviso, lo cual es exactamente lo deseado: el usuario sabe que tiene que
 *   cambiar uno de los dos.
 */
function duplicateFeatIdsFor(idx: number): Set<string> {
  const out = new Set<string>()
  asiChoices.value.forEach((slot, i) => {
    if (i === idx) return
    if (slot.type !== 'feat' || !slot.featId) return
    const feat = getFeatById(slot.featId)
    if (!feat || feat.repeatable) return
    out.add(slot.featId)
  })
  return out
}

const overCapAbilities = computed(() => {
  const offenders: string[] = []
  for (const k of ABILITY_KEYS) {
    const total = (characterStore.character.abilityScores[k] ?? 10) + characterStore.totalBonus(k)
    if (total > 20) offenders.push(k.toUpperCase())
  }
  return offenders
})

/**
 * H7 — calcula si asignar `bump` a `ab` en el slot `idx` haría que la
 * habilidad supere el cap (20 normal, 30 Epic Boon).
 *
 * Importante: hay que EXCLUIR el bump que el propio slot está aportando
 * ahora mismo a esa habilidad, para no contarlo dos veces al re-asignar.
 */
function wouldExceedCap(idx: number, ab: string, bump: number): boolean {
  const slot = asiChoices.value[idx]
  if (!slot) return false
  const cap = isEpicBoonLevel(slot.level) ? 30 : 20
  const k = ab as keyof typeof characterStore.character.abilityScores
  // Bump que este slot está aportando ahora mismo a `ab` (a descontar):
  let currentSlotBump = 0
  if (slot.type === 'asi' && slot.asiAbilities) {
    if (slot.asiMode === '2' && slot.asiAbilities[0] === ab) currentSlotBump = 2
    else if (slot.asiMode === '1+1') {
      if (slot.asiAbilities[0] === ab) currentSlotBump += 1
      if (slot.asiAbilities[1] === ab) currentSlotBump += 1
    }
  }
  const base = (characterStore.character.abilityScores[k] ?? 10)
                + characterStore.totalBonus(k)
                - currentSlotBump
  return (base + bump) > cap
}

/** Muestra "STR 14 → 16" para el atributo y bonus dados. */
function abilityPreview(ab: string, bonus: number): string {
  const k = ab as keyof typeof characterStore.character.abilityScores
  const current = (characterStore.character.abilityScores[k] ?? 10) + characterStore.totalBonus(k)
  return `${ab.toUpperCase()} ${current} → ${current + bonus}`
}

/**
 * For a feat-type slot, returns the list of ability options granted by its
 * ASI bonus when there are multiple choices (e.g. Crusher: STR or CON).
 * Returns empty array if the feat has no asiBonus or only one fixed option
 * (in those cases no selector is needed).
 */
function featAsiOptions(featId: string | undefined): readonly string[] {
  if (!featId) return []
  const feat = getFeatById(featId)
  if (!feat?.asiBonus) return []
  if (feat.asiBonus.abilities.length <= 1) return []
  return feat.asiBonus.abilities
}

/** Returns the Feat object for a slot, or null. Used by FeatChoicesPicker. */
function featOf(featId: string | undefined) {
  return featId ? getFeatById(featId) ?? null : null
}

/**
 * Para Skill Expert: las skills en las que el personaje YA es proficient
 * (de clase/raza/background), EXCLUYENDO las que añadiría este mismo feat
 * (la regla pide "una skill que YA tengas", no la que vas a coger ahora).
 */
/**
 * #138 — ¿Hay al menos un slot locked por nivel? Si no, el botón de
 * desbloquear no aparece (no tiene nada que hacer).
 *
 * #139 Fase 3b: usar classLevel (nivel del PJ DENTRO de esta clase), no
 * char.level total. Un slot lv.4 de Wizard solo está locked si Wizard
 * pasó de nivel 4, no si el PJ total subió.
 */
const hasLockedSlots = computed(() =>
  asiChoices.value.some(slot => isAsiSlotLocked(slot.level, classLevel.value))
)

/**
 * #72 — Un slot ASI queda bloqueado cuando el personaje YA ha subido al
 * siguiente nivel después de ese checkpoint. Ver @/utils/asiLock.
 *
 * #138 — Cuando forceUnlock está activo (botón "Desbloquear edición"),
 * todos los slots quedan editables independientemente del nivel.
 *
 * #139 Fase 3b: usar classLevel para multiclass-awareness.
 */
function isSlotLocked(slotLevel: number): boolean {
  if (forceUnlock.value) return false
  return isAsiSlotLocked(slotLevel, classLevel.value)
}

const alreadyProficientSkills = computed((): readonly string[] => {
  const ownProfs = characterStore.character.skillProficiencies ?? []
  const fromThisFeat = characterStore.character.featAddedSkillProficiencies ?? []
  return ownProfs.filter(s => !fromThisFeat.includes(s))
})
</script>

<template>
  <div v-if="asiLevels.length > 0" class="bg-stone-800/50 border border-amber-700/30 rounded-lg p-5">
    <h3 class="text-lg font-bold text-amber-400 mb-2">
      <span v-if="props.classId && selectedClass">
        Level-up choices — {{ selectedClass.name }}
      </span>
      <span v-else>Level-up choices</span>
      <span class="text-stone-500 text-xs font-normal">
        ({{ asiLevels.length }} ASI/Feat checkpoint{{ asiLevels.length === 1 ? '' : 's' }} at level {{ classLevel }})
      </span>
    </h3>
    <p class="text-xs text-stone-400 mb-4">
      Each checkpoint lets you increase ability scores or take a feat.
      Fighter gets extras at 6 and 14; Rogue at 10. Epic Boon at 19.
    </p>

    <div v-if="overCapAbilities.length" class="mb-4 bg-red-900/20 border border-red-700/40 rounded p-2 text-xs text-red-300">
      ⚠ Cap exceeded for: <strong>{{ overCapAbilities.join(', ') }}</strong>. Scores cap at 20 (Epic Boons at 30).
    </div>

    <!-- #138 — Botón "Desbloquear edición" cuando hay slots bloqueados por
         nivel. Permite corregir un feat ya cogido en un nivel pasado.
         Riesgo asumido por el usuario: cambiar un feat puede invalidar
         prerequisitos de feats posteriores; la app no revalida en cascada. -->
    <div v-if="hasLockedSlots" class="mb-4 flex items-start justify-between gap-3 flex-wrap"
         :class="forceUnlock ? 'bg-amber-900/30 border border-amber-700/40 rounded p-2' : ''">
      <div class="flex-1 text-xs">
        <p v-if="forceUnlock" class="text-amber-300">
          ⚠ <strong>Edición desbloqueada.</strong> Cambiar feats de niveles pasados
          puede romper la coherencia del personaje (un feat puede haber sido
          prerequisito de decisiones posteriores). La app no revalida automáticamente.
        </p>
        <p v-else class="text-stone-500">
          Algunos slots están bloqueados porque el personaje ya subió de nivel.
        </p>
      </div>
      <button @click="forceUnlock = !forceUnlock"
        class="px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors shrink-0"
        :class="forceUnlock
          ? 'bg-amber-600 text-stone-900 hover:bg-amber-500'
          : 'bg-stone-700 text-stone-300 hover:bg-stone-600 border border-stone-600'">
        {{ forceUnlock ? '🔓 Bloquear de nuevo' : '🔒 Desbloquear edición' }}
      </button>
    </div>

    <div class="space-y-3">
      <div v-for="(slot, idx) in asiChoices" :key="`asi-${slot.level}`"
           class="bg-stone-900/40 rounded p-3 relative"
           :class="isSlotLocked(slot.level) ? 'opacity-60' : ''">
        <!-- #72: candado cuando el slot quedó bloqueado al subir de nivel -->
        <div v-if="isSlotLocked(slot.level)"
             class="absolute top-2 right-2 text-xs text-stone-400 flex items-center gap-1 bg-stone-800/80 px-2 py-0.5 rounded"
             :title="`Locked: character is already level ${classLevel}. Choices made at level ${slot.level} can no longer be changed.`">
          🔒 Locked
        </div>
        <!-- Capa que captura clics sobre todos los controles cuando está locked.
             Mantiene los valores visibles y permite tooltips, pero impide editar. -->
        <div v-if="isSlotLocked(slot.level)" class="absolute inset-0 z-10 cursor-not-allowed" aria-hidden="true"></div>

        <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
          <span class="text-sm font-medium text-amber-400">
            Level {{ slot.level }}
            <span v-if="isEpicBoonLevel(slot.level)" class="text-xs text-amber-600/80 ml-1">(Epic Boon)</span>
          </span>
          <div v-if="!isEpicBoonLevel(slot.level)" class="flex gap-2 text-xs">
            <button @click="setChoiceType(idx, 'asi')" class="px-2 py-1 rounded transition-colors cursor-pointer"
              :class="slot.type === 'asi' ? 'bg-amber-600 text-stone-900 font-medium' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'">
              Ability Score Improvement
            </button>
            <button @click="setChoiceType(idx, 'feat')" class="px-2 py-1 rounded transition-colors cursor-pointer"
              :class="slot.type === 'feat' ? 'bg-amber-600 text-stone-900 font-medium' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'">
              Feat
            </button>
          </div>
        </div>

        <!-- ASI controls -->
        <div v-if="slot.type === 'asi'" class="flex flex-wrap gap-3 items-center text-xs">
          <label class="flex items-center gap-2">
            <input type="radio" :checked="slot.asiMode === '2'" @change="setAsiMode(idx, '2')" class="accent-amber-500" />
            <span>+2 to one</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="radio" :checked="slot.asiMode === '1+1'" @change="setAsiMode(idx, '1+1')" class="accent-amber-500" />
            <span>+1 to two</span>
          </label>
          <template v-if="slot.asiMode === '2'">
            <label>
              <span class="text-stone-400 mr-1">+2 to</span>
              <select :value="slot.asiAbilities?.[0] ?? ''"
                @change="setAsiAbility(idx, 0, ($event.target as HTMLSelectElement).value)"
                class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200">
                <option value="" disabled>— Choose —</option>
                <option v-for="ab in ABILITY_KEYS" :key="ab" :value="ab"
                  :disabled="wouldExceedCap(idx, ab, 2)">{{ abilityPreview(ab, 2) }}{{ wouldExceedCap(idx, ab, 2) ? ' (cap)' : '' }}</option>
              </select>
            </label>
          </template>
          <template v-else>
            <label>
              <span class="text-stone-400 mr-1">+1 to</span>
              <select :value="slot.asiAbilities?.[0] ?? ''"
                @change="setAsiAbility(idx, 0, ($event.target as HTMLSelectElement).value)"
                class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200">
                <option value="" disabled>— Choose —</option>
                <option v-for="ab in ABILITY_KEYS" :key="ab" :value="ab"
                  :disabled="wouldExceedCap(idx, ab, 1)">{{ abilityPreview(ab, 1) }}{{ wouldExceedCap(idx, ab, 1) ? ' (cap)' : '' }}</option>
              </select>
            </label>
            <label>
              <span class="text-stone-400 mr-1">+1 to</span>
              <select :value="slot.asiAbilities?.[1] ?? ''"
                @change="setAsiAbility(idx, 1, ($event.target as HTMLSelectElement).value)"
                class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200">
                <option value="" disabled>— Choose —</option>
                <option v-for="ab in ABILITY_KEYS" :key="ab" :value="ab"
                  :disabled="ab === slot.asiAbilities?.[0] || wouldExceedCap(idx, ab, 1)">{{ abilityPreview(ab, 1) }}{{ wouldExceedCap(idx, ab, 1) ? ' (cap)' : '' }}</option>
              </select>
            </label>
          </template>
        </div>

        <!-- Feat controls -->
        <div v-else class="text-xs">
          <FeatPicker
            :feats="eligibleFeats(slot.level, selectedClass ?? undefined)"
            :model-value="slot.featId ?? ''"
            :label="isEpicBoonLevel(slot.level) ? 'Choose an Epic Boon:' : 'Choose a feat:'"
            :character="characterStore.character"
            :duplicate-ids="duplicateFeatIdsFor(idx)"
            ineligible-mode="mark"
            @update:model-value="setFeatId(idx, $event)"
          />
          <!-- ASI ability picker for feats with multiple ASI options (e.g. Crusher: STR or CON) -->
          <div v-if="featAsiOptions(slot.featId).length > 0" class="mt-3 flex flex-wrap items-center gap-2">
            <span class="text-stone-400">Bonus +1 to:</span>
            <select :value="slot.featAbility ?? ''"
              @change="setFeatAbility(idx, ($event.target as HTMLSelectElement).value)"
              class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200">
              <option value="" disabled>— Choose an ability —</option>
              <option v-for="ab in featAsiOptions(slot.featId)" :key="ab" :value="ab">
                {{ abilityPreview(ab, 1) }}
              </option>
            </select>
            <span v-if="!slot.featAbility" class="text-amber-400/80 text-[11px]">
              ⚠ Pick an ability to apply the +1 bonus
            </span>
          </div>
          <!-- Feat-specific choices (Skilled, Crafter, Musician, Observant,
               Keen Mind, Skill Expert) — #52 fase 2. -->
          <FeatChoicesPicker
            v-if="featOf(slot.featId)?.requiresChoices?.length"
            :feat="featOf(slot.featId)!"
            :model-value="slot.featChoices ?? {}"
            :already-proficient-skills="alreadyProficientSkills"
            @update:model-value="setFeatChoices(idx, $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
