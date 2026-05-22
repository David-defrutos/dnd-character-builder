<script setup lang="ts">
// FeatChoicesPicker.vue — componente para rellenar las elecciones que pide
// un feat (Skilled, Crafter, Musician, Observant, Keen Mind, Skill Expert).
// Documento generado el 2026-05-20-2215 — #52 fase 2.

import { computed } from 'vue'
import type { Feat, FeatChoice } from '@/data/dnd5e/feats'
import { skills as ALL_SKILLS } from '@/data/dnd5e/skills'
import { ARTISANS_TOOLS, MUSICAL_INSTRUMENTS } from '@/data/dnd5e/proficiencyCatalogues'

const props = defineProps<{
  feat: Feat
  /** Map { choiceId → array de option IDs ya seleccionados }. */
  modelValue: Record<string, string[]>
  /** Skills que el personaje YA tiene (para Skill Expert: solo se puede dar
   *  expertise a una skill ya proficiente). */
  alreadyProficientSkills: readonly string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, string[]>): void
}>()

/** Devuelve las opciones disponibles para una choice según su `kind`. */
function optionsFor(choice: FeatChoice): { id: string; label: string }[] {
  switch (choice.kind) {
    case 'skill-proficiency': {
      const all = ALL_SKILLS.map(s => ({ id: s.id, label: s.name }))
      return choice.restrictTo
        ? all.filter(o => choice.restrictTo!.includes(o.id))
        : all
    }
    case 'skill-expertise': {
      // Solo skills que el personaje YA tiene proficiency.
      return ALL_SKILLS
        .filter(s => props.alreadyProficientSkills.includes(s.id))
        .map(s => ({ id: s.id, label: s.name }))
    }
    case 'artisans-tool':
      return ARTISANS_TOOLS.map(t => ({ id: t, label: t }))
    case 'musical-instrument':
      return MUSICAL_INSTRUMENTS.map(i => ({ id: i, label: i }))
    case 'skill-or-tool': {
      // Skilled: skills (prefijo 'skill:') + Artisan's tools + Musical Instruments + Other tools.
      // Para no inflar la lista, ofrecemos sólo skills + tools comunes.
      const skillOpts = ALL_SKILLS.map(s => ({ id: `skill:${s.id}`, label: `Skill: ${s.name}` }))
      const toolOpts = ARTISANS_TOOLS.map(t => ({ id: `tool:${t}`, label: `Tool: ${t}` }))
      const instrOpts = MUSICAL_INSTRUMENTS.map(i => ({ id: `tool:${i}`, label: `Instrument: ${i}` }))
      const otherTools = [
        "Disguise Kit", "Forgery Kit", "Herbalism Kit", "Navigator's Tools",
        "Poisoner's Kit", "Thieves' Tools", "Cook's Utensils",
      ].map(t => ({ id: `tool:${t}`, label: `Tool: ${t}` }))
      // Dedup por id
      const seen = new Set<string>()
      const out: { id: string; label: string }[] = []
      for (const o of [...skillOpts, ...toolOpts, ...instrOpts, ...otherTools]) {
        if (!seen.has(o.id)) { seen.add(o.id); out.push(o) }
      }
      return out
    }
  }
}

function toggle(choice: FeatChoice, optId: string) {
  const current = { ...props.modelValue }
  const picked = [...(current[choice.id] ?? [])]
  const i = picked.indexOf(optId)
  if (i >= 0) {
    picked.splice(i, 1)
  } else if (picked.length < choice.count) {
    picked.push(optId)
  } else {
    // Ya hay `count` seleccionadas: no añadir más.
    return
  }
  current[choice.id] = picked
  emit('update:modelValue', current)
}

function isChecked(choice: FeatChoice, optId: string): boolean {
  return (props.modelValue[choice.id] ?? []).includes(optId)
}

function isFull(choice: FeatChoice): boolean {
  return ((props.modelValue[choice.id] ?? []).length) >= choice.count
}

function pickedCount(choice: FeatChoice): number {
  return (props.modelValue[choice.id] ?? []).length
}

const choices = computed(() => props.feat.requiresChoices ?? [])
</script>

<template>
  <div v-if="choices.length" class="mt-3 space-y-3 bg-stone-900/30 border border-stone-700/50 rounded p-3">
    <div v-for="choice in choices" :key="choice.id" class="text-xs">
      <div class="flex items-center justify-between mb-1">
        <span class="text-stone-300">{{ choice.label }}</span>
        <span
          :class="pickedCount(choice) >= choice.count ? 'text-emerald-400' : 'text-amber-400'"
          class="font-mono text-[11px]"
        >
          {{ pickedCount(choice) }}/{{ choice.count }}
        </span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-1">
        <label
          v-for="opt in optionsFor(choice)"
          :key="opt.id"
          :class="[
            'flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors text-[11px]',
            isChecked(choice, opt.id)
              ? 'bg-amber-700/40 text-amber-200 border border-amber-600/60'
              : isFull(choice)
                ? 'bg-stone-900/40 text-stone-500 border border-stone-800 cursor-not-allowed'
                : 'bg-stone-800/60 text-stone-300 border border-stone-700 hover:bg-stone-700/60',
          ]"
        >
          <input
            type="checkbox"
            :checked="isChecked(choice, opt.id)"
            :disabled="!isChecked(choice, opt.id) && isFull(choice)"
            @change="toggle(choice, opt.id)"
            class="accent-amber-500"
          />
          <span class="truncate" :title="opt.label">{{ opt.label }}</span>
        </label>
      </div>
      <p
        v-if="choice.kind === 'skill-expertise' && optionsFor(choice).length === 0"
        class="mt-1 text-amber-400/80 text-[11px]"
      >
        ⚠ You need a skill proficiency first to take Expertise. Pick a skill in the Skill Proficiency row above (or via your class/background).
      </p>
    </div>
  </div>
</template>
