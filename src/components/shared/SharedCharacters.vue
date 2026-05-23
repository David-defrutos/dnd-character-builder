<!-- #123 — Lista personajes desde public/characters/index.json y permite
     importar cualquiera al store con un click. Útil para tener una librería
     compartida de PJs (los míos, los de mis amigos) accesibles desde el
     móvil sin tener que subir el JSON manualmente. -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCharacterStore } from '@/stores/character'
import { useAppStore } from '@/stores/app'

interface SharedCharacterEntry {
  file: string
  name: string
  className?: string
  level?: number
  race?: string
}

const characterStore = useCharacterStore()
const appStore = useAppStore()

const entries = ref<SharedCharacterEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const expanded = ref(false)

function baseUrl(): string {
  // Vite reemplaza esto en build con BASE_URL (ej. '/dnd-character-builder/').
  return import.meta.env.BASE_URL
}

onMounted(async () => {
  try {
    const res = await fetch(`${baseUrl()}characters/index.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    entries.value = await res.json()
  } catch (e) {
    // Sin index.json es perfectamente válido (carpeta vacía o no desplegada).
    // Solo lo registramos para depuración; no enseñamos error al usuario.
    error.value = (e as Error).message
    entries.value = []
  } finally {
    loading.value = false
  }
})

async function loadCharacter(entry: SharedCharacterEntry) {
  try {
    const res = await fetch(`${baseUrl()}characters/${entry.file}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.text()
    const result = characterStore.importJson(json)
    if (result.warnings.length > 0) {
      message.value = { type: 'success', text: `${entry.name} loaded (${result.warnings.length} warning(s))` }
    } else {
      message.value = { type: 'success', text: `${entry.name} loaded` }
    }
    // Vamos directamente a Review (Step 9 = index 8) si el PJ está a lv.2+.
    // Para PJs nivel 1, dejamos el wizard normal.
    if (characterStore.character.level >= 2) {
      appStore.setStep(8)
    }
    setTimeout(() => { message.value = null }, 3000)
  } catch (e) {
    message.value = { type: 'error', text: `Failed to load ${entry.name}: ${(e as Error).message}` }
  }
}
</script>

<template>
  <section v-if="!loading && entries.length > 0" aria-labelledby="shared-chars-heading"
    class="mb-6 bg-stone-800/50 border border-stone-700 rounded-xl overflow-hidden">

    <button @click="expanded = !expanded"
      class="w-full flex items-center justify-between px-4 py-3 bg-stone-800 hover:bg-stone-700/50 transition-colors cursor-pointer"
      :aria-expanded="expanded">
      <div class="flex items-center gap-3">
        <span class="text-amber-400 text-lg" aria-hidden="true">📂</span>
        <h3 id="shared-chars-heading" class="text-base font-semibold text-amber-400">
          Shared Characters
        </h3>
        <span class="text-xs text-stone-500">({{ entries.length }})</span>
      </div>
      <span class="text-stone-500 text-sm">{{ expanded ? '▾' : '▸' }}</span>
    </button>

    <div v-if="expanded" class="p-4 space-y-2">
      <p class="text-xs text-stone-500 mb-3">
        Load a character from the shared library. Replaces your current character.
      </p>

      <div v-for="entry in entries" :key="entry.file"
        class="flex items-center justify-between gap-3 bg-stone-900 border border-stone-700 rounded-lg px-3 py-2">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-stone-100 text-sm truncate">{{ entry.name }}</div>
          <div class="text-xs text-stone-500">
            <span v-if="entry.className" class="capitalize">{{ entry.className }}</span>
            <span v-if="entry.level"> · lv.{{ entry.level }}</span>
            <span v-if="entry.race" class="capitalize"> · {{ entry.race }}</span>
          </div>
        </div>
        <button @click="loadCharacter(entry)"
          class="shrink-0 px-3 py-1 bg-amber-700 hover:bg-amber-600 text-amber-100 rounded text-xs font-medium transition-colors cursor-pointer">
          Load
        </button>
      </div>

      <div v-if="message"
        class="mt-3 p-2 rounded text-xs"
        :class="message.type === 'success' ? 'bg-emerald-900/40 text-emerald-200' : 'bg-red-900/40 text-red-200'">
        {{ message.text }}
      </div>
    </div>
  </section>
</template>
