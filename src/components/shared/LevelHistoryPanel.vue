<script setup lang="ts">
// #117 — Panel de historial de niveles. Muestra una lista de niveles
// guardados como snapshots; click en uno abre un modal con la ficha de
// solo lectura, desde donde se puede pulsar "Reset to this level" para
// restaurar el personaje a ese punto (acción destructiva con confirmación).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import type { LevelSnapshot } from '@/stores/character'
import { restoreToLevel } from '@/utils/levelHistory'

const { t } = useI18n()
const characterStore = useCharacterStore()

const history = computed<LevelSnapshot[]>(
  () => characterStore.character.levelHistory ?? [],
)

const selectedSnapshot = ref<LevelSnapshot | null>(null)
const confirmReset = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

function openSnapshot(s: LevelSnapshot): void {
  selectedSnapshot.value = s
  confirmReset.value = false
}

function closeModal(): void {
  selectedSnapshot.value = null
  confirmReset.value = false
}

function askReset(): void {
  confirmReset.value = true
}

function doReset(): void {
  if (!selectedSnapshot.value) return
  const target = selectedSnapshot.value.level
  const result = restoreToLevel(characterStore.character, target)
  if (result) {
    message.value = {
      type: 'success',
      text: t('history.restoredOk', { level: target }),
    }
    setTimeout(() => { message.value = null }, 5000)
  } else {
    message.value = { type: 'error', text: t('history.restoreError') }
  }
  closeModal()
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}
</script>

<template>
  <section v-if="history.length > 0" class="bg-stone-800 border border-stone-700 rounded-lg p-4 mb-4">
    <h3 class="font-semibold text-stone-300 mb-3 font-gothic">
      {{ t('history.title') }}
    </h3>
    <p class="text-xs text-stone-500 mb-3">{{ t('history.description') }}</p>
    <ul class="flex flex-wrap gap-2" role="list">
      <li v-for="s in history" :key="s.level">
        <button
          @click="openSnapshot(s)"
          class="px-3 py-1.5 bg-stone-700 hover:bg-amber-700 text-stone-200 hover:text-amber-100 rounded transition-colors cursor-pointer text-sm"
          :aria-label="t('history.viewLevel', { level: s.level })"
        >
          Lv.{{ s.level }}
        </button>
      </li>
    </ul>

    <!-- Mensaje tras restaurar -->
    <Transition name="fade">
      <div
        v-if="message"
        :class="[
          'mt-3 p-2 rounded text-sm',
          message.type === 'success' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300',
        ]"
        role="status"
        aria-live="polite"
      >
        {{ message.text }}
      </div>
    </Transition>
  </section>

  <!-- Modal: ficha del snapshot en solo lectura + acciones -->
  <div
    v-if="selectedSnapshot"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="`history-modal-title`"
    @click.self="closeModal"
  >
    <div class="bg-stone-800 border border-stone-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <header class="p-4 border-b border-stone-700 flex items-center justify-between">
        <h2 id="history-modal-title" class="font-bold text-amber-500 font-gothic">
          {{ t('history.snapshotTitle', { level: selectedSnapshot.level, name: selectedSnapshot.snapshot.name || t('common.unnamed') }) }}
        </h2>
        <button
          @click="closeModal"
          class="text-stone-400 hover:text-stone-200 text-2xl leading-none cursor-pointer"
          :aria-label="t('common.cancel')"
        >&times;</button>
      </header>

      <div class="p-4 space-y-3">
        <p class="text-xs text-stone-500">{{ t('history.savedAt') }}: {{ formatDate(selectedSnapshot.snapshotAt) }}</p>

        <!-- Resumen del snapshot (campos clave). No es la ficha completa porque
             eso es lo que ya muestra el Step 9 actual; aquí solo damos
             información suficiente para decidir si restaurar a este nivel. -->
        <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt class="text-stone-500">{{ t('common.level') }}</dt>
          <dd class="text-stone-200">{{ selectedSnapshot.snapshot.level }}</dd>

          <dt class="text-stone-500">{{ t('pdf.charName') }}</dt>
          <dd class="text-stone-200">{{ selectedSnapshot.snapshot.name || '—' }}</dd>

          <dt class="text-stone-500">{{ t('pdf.charClass') }}</dt>
          <dd class="text-stone-200">{{ selectedSnapshot.snapshot.className }}<span v-if="selectedSnapshot.snapshot.subclass"> ({{ selectedSnapshot.snapshot.subclass }})</span></dd>

          <dt class="text-stone-500">{{ t('pdf.charRace') }}</dt>
          <dd class="text-stone-200">{{ selectedSnapshot.snapshot.race }}<span v-if="selectedSnapshot.snapshot.subrace"> ({{ selectedSnapshot.snapshot.subrace }})</span></dd>

          <dt class="text-stone-500">{{ t('common.hp') }}</dt>
          <dd class="text-stone-200">{{ selectedSnapshot.snapshot.maxHp }}</dd>
        </dl>

        <!-- Confirmación destructiva -->
        <div v-if="confirmReset" class="bg-red-900/30 border border-red-700 rounded p-3 text-sm">
          <p class="text-red-300 mb-3">{{ t('history.confirmReset', { level: selectedSnapshot.level, current: characterStore.character.level }) }}</p>
          <div class="flex gap-2">
            <button
              @click="doReset"
              class="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-red-50 rounded font-semibold cursor-pointer text-sm"
            >
              {{ t('history.confirmYes') }}
            </button>
            <button
              @click="confirmReset = false"
              class="px-4 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded cursor-pointer text-sm"
            >
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>

      <footer class="p-4 border-t border-stone-700 flex justify-end gap-2">
        <button
          v-if="!confirmReset && selectedSnapshot.level < characterStore.character.level"
          @click="askReset"
          class="px-4 py-2 bg-red-700 hover:bg-red-600 text-red-50 rounded font-semibold cursor-pointer text-sm"
        >
          {{ t('history.resetButton') }}
        </button>
        <button
          @click="closeModal"
          class="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded cursor-pointer text-sm"
        >
          {{ t('common.close') }}
        </button>
      </footer>
    </div>
  </div>
</template>
