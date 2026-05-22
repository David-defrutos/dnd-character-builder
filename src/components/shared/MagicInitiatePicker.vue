<script setup lang="ts">
/**
 * MagicInitiatePicker — selector for the Magic Initiate feat.
 *
 * Renders a section per active Magic Initiate instance (from background and/or
 * ASI feats). Each section lets the player:
 *   1. Pick a spell list (Cleric / Druid / Wizard).
 *   2. Pick 2 cantrips from that list.
 *   3. Pick 1 level-1 spell from that list.
 *
 * Reads/writes characterStore directly (same pattern as AsiSelector).
 * Used in Step7Spells (both for casters and non-casters).
 */
import { computed } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { getSpells } from '@/data'
import {
  getMagicInitiateInstances,
  getMagicInitiateChoice,
  setMagicInitiateChoice,
} from '@/utils/magicInitiate'
import type { Spell } from '@/data/dnd5e/spells'
import SpellRow from './SpellRow.vue'

const characterStore = useCharacterStore()

const instances = computed(() => getMagicInitiateInstances(characterStore.character))

const allSpells = computed(() => getSpells(characterStore.character.variant))

type SpellList = 'cleric' | 'druid' | 'wizard'
const SPELL_LISTS: { id: SpellList; label: string }[] = [
  { id: 'cleric', label: 'Cleric' },
  { id: 'druid', label: 'Druid' },
  { id: 'wizard', label: 'Wizard' },
]

function listCantrips(list: SpellList): Spell[] {
  return allSpells.value.filter(s => s.level === 0 && s.classes.includes(list))
}

function listLevelOne(list: SpellList): Spell[] {
  return allSpells.value.filter(s => s.level === 1 && s.classes.includes(list))
}

function getCurrentList(source: string): SpellList | '' {
  return getMagicInitiateChoice(characterStore.character, source)?.spellList ?? ''
}

function getCurrentCantrips(source: string): string[] {
  return getMagicInitiateChoice(characterStore.character, source)?.cantrips ?? []
}

function getCurrentLevelOne(source: string): string {
  return getMagicInitiateChoice(characterStore.character, source)?.levelOneSpell ?? ''
}

function selectList(source: string, list: SpellList) {
  // Reset cantrips/level-1 if list changes
  const current = getMagicInitiateChoice(characterStore.character, source)
  if (current && current.spellList === list) return
  setMagicInitiateChoice(characterStore.character, source, {
    spellList: list,
    cantrips: [],
    levelOneSpell: '',
  })
}

function toggleCantrip(source: string, spellId: string) {
  const current = getMagicInitiateChoice(characterStore.character, source)
  if (!current) return
  const cantrips = [...current.cantrips]
  const idx = cantrips.indexOf(spellId)
  if (idx >= 0) {
    cantrips.splice(idx, 1)
  } else if (cantrips.length < 2) {
    cantrips.push(spellId)
  } else {
    return // already 2, ignore
  }
  setMagicInitiateChoice(characterStore.character, source, {
    spellList: current.spellList,
    cantrips,
    levelOneSpell: current.levelOneSpell,
  })
}

function setLevelOne(source: string, spellId: string) {
  const current = getMagicInitiateChoice(characterStore.character, source)
  if (!current) return
  setMagicInitiateChoice(characterStore.character, source, {
    spellList: current.spellList,
    cantrips: current.cantrips,
    levelOneSpell: spellId,
  })
}

function isCantripPicked(source: string, spellId: string): boolean {
  return getCurrentCantrips(source).includes(spellId)
}
</script>

<template>
  <div v-if="instances.length > 0" class="space-y-6 mb-6">
    <div
      v-for="inst in instances"
      :key="inst.source"
      class="bg-purple-900/20 border border-purple-700 rounded-lg p-4"
      role="region"
      :aria-label="`Magic Initiate — ${inst.label}`"
    >
      <h3 class="text-lg font-semibold text-purple-300 mb-1">
        ✨ Magic Initiate
      </h3>
      <p class="text-xs text-stone-400 mb-4">{{ inst.label }}</p>

      <!-- Step 1: Spell list -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-stone-300 mb-2">
          1. Choose a spell list:
        </label>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="list in SPELL_LISTS"
            :key="list.id"
            type="button"
            class="px-3 py-1.5 rounded text-sm font-medium border transition-colors"
            :class="getCurrentList(inst.source) === list.id
              ? 'bg-purple-700 border-purple-500 text-white'
              : 'bg-stone-800 border-stone-600 text-stone-300 hover:bg-stone-700'"
            @click="selectList(inst.source, list.id)"
          >
            {{ list.label }}
          </button>
        </div>
      </div>

      <!-- Step 2 & 3: only after list is picked -->
      <template v-if="getCurrentList(inst.source)">
        <!-- Cantrips -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-stone-300 mb-2">
            2. Choose 2 cantrips ({{ getCurrentCantrips(inst.source).length }}/2):
          </label>
          <div class="flex flex-wrap gap-2 max-h-72 overflow-y-auto p-1">
            <SpellRow
              v-for="spell in listCantrips(getCurrentList(inst.source) as SpellList)"
              :key="spell.id"
              :spell="spell"
              :selected="isCantripPicked(inst.source, spell.id)"
              :disabled="getCurrentCantrips(inst.source).length >= 2"
              compact
              @toggle="toggleCantrip(inst.source, spell.id)"
            />
          </div>
        </div>

        <!-- Level 1 spell -->
        <div>
          <label class="block text-sm font-medium text-stone-300 mb-2">
            3. Choose 1 level-1 spell:
          </label>
          <div class="space-y-1 max-h-72 overflow-y-auto pr-1">
            <SpellRow
              v-for="spell in listLevelOne(getCurrentList(inst.source) as SpellList)"
              :key="spell.id"
              :spell="spell"
              :selected="getCurrentLevelOne(inst.source) === spell.id"
              @toggle="setLevelOne(inst.source, getCurrentLevelOne(inst.source) === spell.id ? '' : spell.id)"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
