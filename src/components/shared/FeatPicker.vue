<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Feat } from '@/data/dnd5e/feats'
import type { CharacterData } from '@/stores/character'
import { checkFeatPrerequisites } from '@/utils/featPrerequisites'

const props = defineProps<{
  feats: Feat[]
  modelValue: string
  label?: string
  /** Si se pasa, los feats cuyos prerequisitos no se cumplen aparecen
   *  marcados/desactivados (#71). Sin él, no se hace ninguna validación. */
  character?: CharacterData
  /** Cuando hay character: 'hide' oculta los no elegibles, 'mark' los muestra
   *  desactivados con motivo. Default: 'mark'. */
  ineligibleMode?: 'hide' | 'mark'
  /** IDs de feats ya cogidos en otros checkpoints no-repetibles (#137).
   *  No se filtran ni se bloquean: el usuario puede elegirlos igualmente,
   *  pero la fila muestra un warning visible. La regla RAW del PHB 2024 es
   *  que solo los marcados con asterisco (ASI, Elemental Adept, Magic
   *  Initiate, Skilled) son repetibles; el resto deberían cogerse una vez.
   *  El warning recuerda esa regla sin atar al usuario, que puede tener
   *  motivos válidos para repetir (ej. Resilient con habilidad distinta,
   *  que en la mesa se interpreta como repetible aunque RAW no lo sea). */
  duplicateIds?: ReadonlySet<string>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', id: string): void
}>()

const search = ref('')
const catFilter = ref<string>('all')

// #38: la lista arranca cerrada si ya hay feat seleccionado (caso típico:
// el componente se monta tras importar un personaje desde JSON o cargar uno
// guardado). Si no hay nada seleccionado, abre para que el usuario escoja.
const open = ref(!props.modelValue)

// Reabrir/cerrar si el modelValue cambia desde fuera (ej. reset, otro slot).
watch(() => props.modelValue, (newVal, oldVal) => {
  if (!newVal) {
    open.value = true // sin feat → abrir picker
  } else if (!oldVal && newVal) {
    open.value = false // recién asignado externamente → cerrar
  }
})

const categories = computed(() => [...new Set(props.feats.map(f => f.category))].sort())

/** Para cada feat, calcula si el character cumple sus prerequisitos. */
function evalFeat(f: Feat): { eligible: boolean; reasons: string[] } {
  if (!props.character) return { eligible: true, reasons: [] }
  const r = checkFeatPrerequisites(props.character, f)
  return { eligible: r.satisfied, reasons: r.failingClauses }
}

/** Un feat es "duplicado" si ya está cogido en OTRO checkpoint y no es
 *  repetible. La comprobación es por id; los repetibles del catálogo
 *  (Magic Initiate, Skilled, ASI, Elemental Adept) NO se añaden a duplicateIds
 *  por construcción desde el caller (AsiSelector.duplicateFeatIdsFor excluye
 *  también el propio slot, así que no hay falsos positivos). */
function isDuplicate(f: Feat): boolean {
  if (!props.duplicateIds || props.duplicateIds.size === 0) return false
  return props.duplicateIds.has(f.id)
}

const filtered = computed(() => {
  let list = props.feats
  if (catFilter.value !== 'all') list = list.filter(f => f.category === catFilter.value)
  const q = search.value.toLowerCase().trim()
  if (q) list = list.filter(f =>
    f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
  )
  // En modo 'hide', ocultar feats no elegibles — EXCEPTO el actualmente
  // seleccionado, que siempre debe verse aunque ya no cumpla los requisitos.
  if (props.character && props.ineligibleMode === 'hide') {
    list = list.filter(f => f.id === props.modelValue || evalFeat(f).eligible)
  }
  return list
})

const selected = computed(() => props.feats.find(f => f.id === props.modelValue) ?? null)

function selectFeat(id: string) {
  // Bloquear selección de feats no elegibles (a menos que ya estuviera
  // seleccionado — para no atrapar al usuario en un estado inválido).
  if (props.character && id !== props.modelValue) {
    const f = props.feats.find(x => x.id === id)
    if (f && !evalFeat(f).eligible) return
  }
  emit('update:modelValue', id)
  open.value = false   // Colapsar al seleccionar (#38)
}

function clearFeat() {
  emit('update:modelValue', '')
  open.value = true    // Reabrir al limpiar
}

const catLabel: Record<string, string> = {
  'origin': 'Origin',
  'general': 'General',
  'fighting-style': 'Fighting Style',
  'epic-boon': 'Epic Boon',
}
</script>

<template>
  <div class="space-y-2">
    <p class="text-stone-400 text-xs">{{ label ?? 'Choose a feat:' }}</p>

    <!-- Feat seleccionado (#38: colapsa la lista) -->
    <div v-if="selected" class="bg-amber-900/20 border border-amber-700/40 rounded p-2 text-xs">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1">
          <span class="font-semibold text-amber-400">{{ selected.name }}</span>
          <span class="text-stone-500 ml-2">{{ catLabel[selected.category] ?? selected.category }}</span>
          <p v-if="selected.prerequisite" class="text-stone-500 mt-0.5">Req: {{ selected.prerequisite }}</p>
          <p class="text-stone-400 mt-1 italic">{{ selected.description }}</p>
          <p v-if="isDuplicate(selected)" class="mt-1.5 text-amber-400 bg-amber-950/40 border border-amber-700/40 rounded px-2 py-1">
            ⚠ Este feat ya está cogido en otro nivel y no es repetible según el PHB 2024.
            Solo Ability Score Improvement, Elemental Adept, Magic Initiate y Skilled son repetibles.
          </p>
        </div>
        <div class="flex gap-2 shrink-0">
          <button @click="open = !open"
            class="text-xs text-amber-500 hover:text-amber-300 cursor-pointer whitespace-nowrap">
            {{ open ? '▲ Cerrar' : '✎ Cambiar' }}
          </button>
          <button @click="clearFeat"
            class="text-xs text-red-400 hover:text-red-300 cursor-pointer">✕</button>
        </div>
      </div>
    </div>

    <!-- Buscador + filtro (siempre visible si no hay selección, oculto si hay y está cerrado) -->
    <template v-if="!selected || open">
      <div class="flex gap-2">
        <input v-model="search" type="text" placeholder="Search feats…"
          class="flex-1 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 placeholder-stone-500 focus:border-amber-500 focus:outline-none" />
        <select v-model="catFilter"
          class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 cursor-pointer">
          <option value="all">All categories</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ catLabel[cat] ?? cat }}</option>
        </select>
      </div>

      <div class="max-h-48 overflow-y-auto border border-stone-700 rounded bg-stone-900/60">
        <p v-if="filtered.length === 0" class="text-xs text-stone-500 p-3 text-center">No feats match</p>
        <button v-for="f in filtered" :key="f.id"
          @click="selectFeat(f.id)"
          :disabled="!!character && f.id !== modelValue && !evalFeat(f).eligible"
          :title="character && !evalFeat(f).eligible ? evalFeat(f).reasons.join(' • ') : undefined"
          class="w-full text-left px-3 py-2 transition-colors border-b border-stone-800/50 last:border-0"
          :class="[
            f.id === modelValue ? 'bg-amber-900/30' : '',
            character && f.id !== modelValue && !evalFeat(f).eligible
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:bg-stone-700 cursor-pointer',
          ]">
          <div class="flex items-baseline gap-2">
            <span class="text-sm font-medium" :class="f.id === modelValue ? 'text-amber-400' : 'text-stone-200'">
              {{ f.name }}
            </span>
            <span class="text-xs px-1 rounded"
              :class="{
                'bg-green-900/50 text-green-400': f.category === 'origin',
                'bg-stone-700 text-stone-400': f.category === 'general',
                'bg-blue-900/50 text-blue-400': f.category === 'fighting-style',
                'bg-purple-900/50 text-purple-400': f.category === 'epic-boon',
              }">
              {{ catLabel[f.category] ?? f.category }}
            </span>
            <span v-if="character && !evalFeat(f).eligible" class="text-[10px] px-1 rounded bg-red-900/40 text-red-400">
              ✕ requirements
            </span>
            <span v-if="isDuplicate(f)" class="text-[10px] px-1 rounded bg-amber-900/40 text-amber-400" title="Ya seleccionado en otro nivel y este feat no es repetible">
              ⚠ ya cogido
            </span>
          </div>
          <p v-if="f.prerequisite" class="text-xs mt-0.5"
             :class="character && !evalFeat(f).eligible ? 'text-red-400/80' : 'text-stone-500'">
            {{ f.prerequisite }}
          </p>
          <p class="text-xs text-stone-500 mt-0.5 line-clamp-2">{{ f.description }}</p>
        </button>
      </div>
      <p class="text-xs text-stone-600">{{ filtered.length }} feat{{ filtered.length === 1 ? '' : 's' }}</p>
    </template>
  </div>
</template>
