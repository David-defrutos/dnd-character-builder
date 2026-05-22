<script setup lang="ts">
// Documento generado el 2026-05-19-2245 — bugfix tarea 12
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import type { AbilityScores, ASIChoice } from '@/stores/character'
import { rollAbilityScores, STANDARD_ARRAY, POINT_BUY_COSTS, pointBuyRemaining } from '@/utils/diceRoller'
import { modifier, formatModifier } from '@/utils/calculations'
import { getAsiLevels, eligibleFeats, aggregateAsiBumps, isEpicBoonLevel, ABILITY_KEYS } from '@/data/dnd5e/asi'
import { getClassById } from '@/data/dnd5e/classes'
import { getFeatById } from '@/data/dnd5e/feats'
import { applyFeatEffects } from '@/utils/featEffects'
import DiceRoller from '@/components/shared/DiceRoller.vue'

const { t } = useI18n()
const characterStore = useCharacterStore()

type Method = 'standard' | 'pointbuy' | 'roll'
const method = ref<Method>('standard')
const abilities: (keyof AbilityScores)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const rolledScores = ref<number[]>([])
const assignedRolls = ref<Record<keyof AbilityScores, number | null>>({
  str: null, dex: null, con: null, int: null, wis: null, cha: null,
})

// Standard Array
const standardAssignment = ref<Record<keyof AbilityScores, number | null>>({
  str: null, dex: null, con: null, int: null, wis: null, cha: null,
})
const availableStandard = computed(() => {
  const used = Object.values(standardAssignment.value).filter(v => v !== null)
  return STANDARD_ARRAY.filter(v => {
    const usedCount = used.filter(u => u === v).length
    const totalCount = STANDARD_ARRAY.filter(s => s === v).length
    return usedCount < totalCount
  })
})

function setStandardScore(ability: keyof AbilityScores, value: number | null) {
  standardAssignment.value[ability] = value
  if (value !== null) {
    characterStore.character.abilityScores[ability] = value
  }
}

// Point Buy
const pointBuyScores = ref<Record<keyof AbilityScores, number>>({
  str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8,
})
const remaining = computed(() => pointBuyRemaining(Object.values(pointBuyScores.value)))

function adjustPointBuy(ability: keyof AbilityScores, delta: number) {
  const newVal = pointBuyScores.value[ability] + delta
  if (newVal < 8 || newVal > 15) return
  const oldCost = POINT_BUY_COSTS[pointBuyScores.value[ability]] ?? 0
  const newCost = POINT_BUY_COSTS[newVal] ?? 0
  if (remaining.value - (newCost - oldCost) < 0) return
  pointBuyScores.value[ability] = newVal
  characterStore.character.abilityScores[ability] = newVal
}

// Roll
const isRolling = ref(false)

function doRoll() {
  const result = rollAbilityScores()
  rolledScores.value = result.totals
  assignedRolls.value = { str: null, dex: null, con: null, int: null, wis: null, cha: null }
  isRolling.value = true
}

function onAnimationDone() {
  isRolling.value = false
}

const availableRolls = computed(() => {
  const usedIndices = new Set(
    Object.values(assignedRolls.value).filter((v): v is number => v !== null)
  )
  return rolledScores.value
    .map((score, index) => ({ index, score }))
    .filter(item => !usedIndices.has(item.index))
})

function assignRoll(ability: keyof AbilityScores, val: string) {
  const index = val === '' ? null : Number(val)
  assignedRolls.value[ability] = index
  if (index !== null && rolledScores.value[index] !== undefined) {
    characterStore.character.abilityScores[ability] = rolledScores.value[index]
  }
}

function totalScore(ability: keyof AbilityScores): number {
  return characterStore.totalAbilityScore(ability)
}

function setMethod(m: Method) {
  method.value = m
  if (m === 'pointbuy') {
    for (const a of abilities) {
      characterStore.character.abilityScores[a] = pointBuyScores.value[a]
    }
  }
}

// ─── ASI / Feat checkpoints (Milestone 10) ─────────────────────────────────

/** Character class chosen in Step 3 (may be empty if user skipped). */
const selectedClass = computed(() => getClassById(characterStore.character.className))

/** Character levels at which an ASI or Epic Boon is granted. */
const asiLevels = computed(() => {
  if (!selectedClass.value) return []
  return getAsiLevels(selectedClass.value.id, characterStore.character.level)
})

/** Reactive working copy of the asiChoices array (one slot per checkpoint). */
const asiChoices = ref<ASIChoice[]>([])

/** Sync the working copy from store (safe to call any time after mount). */
function syncAsiChoices() {
  try {
    const levels = asiLevels.value
    const existing = characterStore.character.asiChoices ?? []
    const next: ASIChoice[] = levels.map(lvl => {
      const found = existing.find(c => c.level === lvl)
      if (found) return { ...found }
      return isEpicBoonLevel(lvl)
        ? { level: lvl, type: 'feat', featId: '' }
        : { level: lvl, type: 'asi', asiMode: '2', asiAbilities: [] }
    })
    asiChoices.value = next
    if (levels.length > 0) persistChoices()
  } catch (err) {
    console.error('[Step4] syncAsiChoices error:', err)
  }
}

/** Re-sync when class or level changes (NOT immediate — init is in onMounted). */
watch(
  [() => characterStore.character.className, () => characterStore.character.level],
  syncAsiChoices,
)

onMounted(syncAsiChoices)

/** Persist current choices into the store + recalculate asiBonuses. */
function persistChoices() {
  try {
    characterStore.character.asiChoices = JSON.parse(JSON.stringify(asiChoices.value))
    recomputeBonuses()
    syncFeatTags()
    applyFeatEffects(characterStore.character, asiChoices.value)
  } catch (err) {
    console.error('[Step4] persistChoices error:', err)
  }
}

function recomputeBonuses() {
  characterStore.character.asiBonuses = aggregateAsiBumps(asiChoices.value)
}

/** Reflect chosen feats in featuresTraits without duplicates. */
function syncFeatTags() {
  // Guard: ensure featuresTraits is always an array.
  if (!Array.isArray(characterStore.character.featuresTraits)) {
    characterStore.character.featuresTraits = []
  }
  // Remove all previously inserted ASI-derived feat tags.
  const tagPrefix = 'ASI Feat: '
  characterStore.character.featuresTraits =
    characterStore.character.featuresTraits.filter(t => !t.startsWith(tagPrefix))
  for (const c of asiChoices.value) {
    if (c.type === 'feat' && c.featId) {
      const feat = getFeatById(c.featId)
      if (feat) {
        characterStore.character.featuresTraits.push(`${tagPrefix}${feat.name} (lv.${c.level})`)
      }
    }
  }
}

function setChoiceType(idx: number, type: 'asi' | 'feat') {
  const slot = asiChoices.value[idx]
  if (!slot) return
  slot.type = type
  if (type === 'asi') {
    slot.asiMode = '2'
    slot.asiAbilities = []
    slot.featId = undefined
  } else {
    slot.featId = ''
    slot.asiMode = undefined
    slot.asiAbilities = undefined
  }
  persistChoices()
}

function setAsiMode(idx: number, mode: '2' | '1+1') {
  const slot = asiChoices.value[idx]
  if (!slot) return
  slot.asiMode = mode
  // Reset abilities — user must re-pick to confirm.
  slot.asiAbilities = []
  persistChoices()
}

function setAsiAbility(idx: number, slotIdx: number, val: string) {
  const slot = asiChoices.value[idx]
  if (!slot?.asiAbilities) return
  const k = val as typeof ABILITY_KEYS[number]
  while (slot.asiAbilities.length < slotIdx) {
    slot.asiAbilities.push('' as typeof ABILITY_KEYS[number])
  }
  slot.asiAbilities[slotIdx] = k
  persistChoices()
}

function setFeatId(idx: number, featId: string) {
  const slot = asiChoices.value[idx]
  if (!slot) return
  slot.featId = featId
  persistChoices()
}

function eligibleFeatsForLevel(level: number) {
  return eligibleFeats(level, selectedClass.value)
}

/** Warn if any ability score would exceed the cap after applying ASIs.
 *  Regular ASIs cap at 20; Epic Boon levels cap at 30. */
const overCapAbilities = computed(() => {
  const hasEpicBoon = asiChoices.value.some(s => isEpicBoonLevel(s.level) && s.type === 'asi')
  const cap = hasEpicBoon ? 30 : 20
  const offenders: string[] = []
  for (const k of ABILITY_KEYS) {
    const total = (characterStore.character.abilityScores[k] ?? 10)
      + characterStore.totalBonus(k as any)
    if (total > cap) offenders.push(k.toUpperCase())
  }
  return offenders
})
</script>

<template>
  <section aria-labelledby="abilities-heading">
    <h2 id="abilities-heading" class="text-2xl font-bold text-amber-500 mb-6">{{ t('abilities.title') }}</h2>

    <!-- Method Selection -->
    <div class="flex gap-2 mb-6" role="radiogroup" :aria-label="t('abilities.method')">
      <button
        v-for="m in (['standard', 'pointbuy', 'roll'] as Method[])"
        :key="m"
        @click="setMethod(m)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        :class="method === m ? 'bg-amber-600 text-stone-900' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'"
        role="radio"
        :aria-checked="method === m"
      >
        {{ t(`abilities.${m === 'pointbuy' ? 'pointBuy' : m === 'standard' ? 'standardArray' : 'roll'}`) }}
      </button>
    </div>

    <!-- Point Buy remaining -->
    <div v-if="method === 'pointbuy'" class="mb-4 text-sm font-medium"
      :class="remaining >= 0 ? 'text-green-400' : 'text-red-400'">
      {{ t('abilities.pointsRemaining', { points: remaining }) }}
    </div>

    <!-- Roll button -->
    <div v-if="method === 'roll'" class="mb-4">
      <div class="flex gap-3 items-center">
        <button
          @click="doRoll"
          :disabled="isRolling"
          class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-900 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span v-if="isRolling" class="inline-flex items-center gap-1">
            <span class="animate-spin inline-block w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full" aria-hidden="true"></span>
            {{ t('abilities.rollDice') }}
          </span>
          <span v-else><span aria-hidden="true">🎲</span> {{ t('abilities.rollDice') }}</span>
        </button>
        <button v-if="rolledScores.length && !isRolling"
          @click="doRoll"
          class="px-3 py-2 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-lg text-sm transition-colors cursor-pointer"
        ><span aria-hidden="true">🔄</span> {{ t('abilities.reroll') }}</button>
      </div>
      <div v-if="rolledScores.length" class="mt-3">
        <DiceRoller :scores="rolledScores" :rolling="isRolling" @animation-done="onAnimationDone" />
      </div>
    </div>

    <!-- Ability Score Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="ability in abilities"
        :key="ability"
        class="bg-stone-800 border border-stone-700 rounded-lg p-4"
      >
        <h4 class="font-bold text-amber-400 text-sm uppercase mb-3">{{ t(`abilities.${ability}`) }}</h4>

        <!-- Standard Array -->
        <div v-if="method === 'standard'">
          <select
            :value="standardAssignment[ability]"
            @change="setStandardScore(ability, Number(($event.target as HTMLSelectElement).value) || null)"
            class="w-full bg-stone-700 text-stone-200 rounded px-2 py-1 text-sm"
            :aria-label="t(`abilities.${ability}`)"
          >
            <option :value="null">--</option>
            <option v-for="v in availableStandard" :key="v" :value="v"
              :selected="standardAssignment[ability] === v">{{ v }}</option>
            <option v-if="standardAssignment[ability] !== null" :value="standardAssignment[ability]">
              {{ standardAssignment[ability] }} (current)
            </option>
          </select>
        </div>

        <!-- Point Buy -->
        <div v-else-if="method === 'pointbuy'" class="flex items-center gap-3" role="group" :aria-label="t(`abilities.${ability}`)">
          <button @click="adjustPointBuy(ability, -1)"
            :aria-label="`${t(`abilities.${ability}`)} -1`"
            class="w-8 h-8 bg-stone-700 hover:bg-stone-600 rounded text-stone-300 font-bold cursor-pointer">-</button>
          <span class="text-xl font-bold text-stone-200 w-8 text-center" aria-live="polite">{{ pointBuyScores[ability] }}</span>
          <button @click="adjustPointBuy(ability, 1)"
            :aria-label="`${t(`abilities.${ability}`)} +1`"
            class="w-8 h-8 bg-stone-700 hover:bg-stone-600 rounded text-stone-300 font-bold cursor-pointer">+</button>
          <span class="text-xs text-stone-500">({{ POINT_BUY_COSTS[pointBuyScores[ability]] ?? 0 }} pts)</span>
        </div>

        <!-- Roll Assignment (index-based to handle duplicate rolled values) -->
        <div v-else-if="method === 'roll'">
          <select
            :value="assignedRolls[ability] ?? ''"
            @change="assignRoll(ability, ($event.target as HTMLSelectElement).value)"
            class="w-full bg-stone-700 text-stone-200 rounded px-2 py-1 text-sm"
            :aria-label="t(`abilities.${ability}`)"
          >
            <option value="">--</option>
            <option v-for="item in availableRolls" :key="item.index" :value="item.index">{{ item.score }}</option>
            <option v-if="assignedRolls[ability] !== null" :value="assignedRolls[ability]">
              {{ rolledScores[assignedRolls[ability]!] }} (current)
            </option>
          </select>
        </div>

        <!-- Calculated Values -->
        <div class="mt-3 flex items-center justify-between text-xs text-stone-400">
          <div>
            <span v-if="characterStore.totalBonus(ability as any) !== 0" class="text-green-400">
              {{ t('abilities.racialBonus') }}: {{ formatModifier(characterStore.totalBonus(ability as any) || 0) }}
            </span>
          </div>
          <div class="text-right">
            <div class="text-stone-300">{{ t('abilities.total') }}: <strong class="text-lg text-amber-400">{{ totalScore(ability) }}</strong></div>
            <div>{{ t('abilities.modifier') }}: <strong>{{ formatModifier(modifier(totalScore(ability))) }}</strong></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── ASI / Feat Checkpoints (Milestone 10) ──────────────────────── -->
    <div v-if="asiLevels.length > 0" class="mt-8 bg-stone-800/50 border border-amber-700/30 rounded-lg p-5">
      <h3 class="text-lg font-bold text-amber-400 mb-2">
        Level-up choices
        <span class="text-stone-500 text-xs font-normal">
          ({{ asiLevels.length }} ASI/Feat checkpoint{{ asiLevels.length === 1 ? '' : 's' }} at level {{ characterStore.character.level }})
        </span>
      </h3>
      <p class="text-xs text-stone-400 mb-4">
        In the 2024 rules, every class gets an Ability Score Improvement at levels 4, 8, 12 and 16,
        plus an Epic Boon at 19. <strong>Fighter</strong> gets two extras (6 and 14);
        <strong>Rogue</strong> gets one extra at 10. At each checkpoint you can bump your scores
        or take a feat instead.
      </p>

      <div v-if="overCapAbilities.length" class="mb-4 bg-red-900/20 border border-red-700/40 rounded p-2 text-xs text-red-300">
        ⚠ Cap exceeded for: <strong>{{ overCapAbilities.join(', ') }}</strong>.
        2024 rules cap regular ability scores at 20 (Epic Boons can go to 30).
      </div>

      <div class="space-y-3">
        <div
          v-for="(slot, idx) in asiChoices"
          :key="`asi-${slot.level}`"
          class="bg-stone-900/40 rounded p-3"
        >
          <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
            <span class="text-sm font-medium text-amber-400">
              Level {{ slot.level }}
              <span v-if="isEpicBoonLevel(slot.level)" class="text-xs text-amber-600/80 ml-1">(Epic Boon)</span>
            </span>
            <div v-if="!isEpicBoonLevel(slot.level)" class="flex gap-2 text-xs">
              <button
                @click="setChoiceType(idx, 'asi')"
                class="px-2 py-1 rounded transition-colors cursor-pointer"
                :class="slot.type === 'asi' ? 'bg-amber-600 text-stone-900 font-medium' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'"
              >Ability Score Improvement</button>
              <button
                @click="setChoiceType(idx, 'feat')"
                class="px-2 py-1 rounded transition-colors cursor-pointer"
                :class="slot.type === 'feat' ? 'bg-amber-600 text-stone-900 font-medium' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'"
              >Feat</button>
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
                <select
                  :value="slot.asiAbilities?.[0] ?? ''"
                  @change="setAsiAbility(idx, 0, ($event.target as HTMLSelectElement).value)"
                  class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200"
                >
                  <option value="" disabled>— Choose —</option>
                  <option v-for="ab in ABILITY_KEYS" :key="ab" :value="ab">{{ ab.toUpperCase() }}</option>
                </select>
              </label>
            </template>
            <template v-else>
              <label>
                <span class="text-stone-400 mr-1">+1 to</span>
                <select
                  :value="slot.asiAbilities?.[0] ?? ''"
                  @change="setAsiAbility(idx, 0, ($event.target as HTMLSelectElement).value)"
                  class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200"
                >
                  <option value="" disabled>— Choose —</option>
                  <option v-for="ab in ABILITY_KEYS" :key="ab" :value="ab">{{ ab.toUpperCase() }}</option>
                </select>
              </label>
              <label>
                <span class="text-stone-400 mr-1">+1 to</span>
                <select
                  :value="slot.asiAbilities?.[1] ?? ''"
                  @change="setAsiAbility(idx, 1, ($event.target as HTMLSelectElement).value)"
                  class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200"
                >
                  <option value="" disabled>— Choose —</option>
                  <option v-for="ab in ABILITY_KEYS" :key="ab" :value="ab"
                    :disabled="ab === slot.asiAbilities?.[0]">
                    {{ ab.toUpperCase() }}
                  </option>
                </select>
              </label>
            </template>
          </div>

          <!-- Feat controls -->
          <div v-else class="text-xs">
            <label class="block mb-1 text-stone-400">
              {{ isEpicBoonLevel(slot.level) ? 'Choose an Epic Boon:' : 'Choose a feat:' }}
            </label>
            <select
              :value="slot.featId ?? ''"
              @change="setFeatId(idx, ($event.target as HTMLSelectElement).value)"
              class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200 w-full max-w-md"
            >
              <option value="">— pick one —</option>
              <option v-for="f in eligibleFeatsForLevel(slot.level)" :key="f.id" :value="f.id">
                {{ f.name }}<span v-if="f.category !== 'origin'"> ({{ f.category }})</span>
              </option>
            </select>
            <p v-if="slot.featId" class="mt-2 text-stone-500 italic">
              {{ getFeatById(slot.featId)?.description }}
            </p>
          </div>
        </div>
      </div>
    </div>

  </section>
</template>
