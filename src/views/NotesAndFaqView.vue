<!--
  NotesAndFaqView.vue — #153

  Pestaña dedicada a editar char.notesAndFaq, un campo de texto libre que
  el jugador puede usar como FAQ personal del PJ: reglas que se olvidan,
  combos del personaje, recordatorios fijos.

  Diseño deliberadamente minimalista: un textarea grande con autosize, el
  nombre del PJ activo arriba como contexto, y un contador de caracteres.
  Sin formato (texto plano). Los saltos de línea se respetan al renderizar
  en el PDF anexo.

  Si no hay PJ activo (slot vacío) mostramos un mensaje y un enlace a la
  lista de personajes en lugar de un textarea inerte.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'

const { t } = useI18n()
const characterStore = useCharacterStore()

const char = computed(() => characterStore.character)
const hasActiveCharacter = computed(() => !!char.value.name && !!char.value.className)

const notes = computed({
  get() { return char.value.notesAndFaq ?? '' },
  set(v: string) { characterStore.character.notesAndFaq = v },
})

const charCount = computed(() => notes.value.length)
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-6">
    <h1 class="text-2xl font-bold text-stone-100 mb-2">{{ t('notesAndFaq.title') }}</h1>
    <p class="text-stone-400 text-sm mb-6">
      {{ t('notesAndFaq.subtitle') }}
    </p>

    <!-- Sin PJ activo: redirigir al usuario -->
    <div v-if="!hasActiveCharacter"
         class="bg-stone-800 border border-stone-700 rounded-lg p-6 text-center">
      <p class="text-stone-300 mb-3">{{ t('notesAndFaq.noActive') }}</p>
      <router-link to="/characters"
                   class="inline-block text-amber-500 hover:text-amber-400 underline">
        {{ t('notesAndFaq.goToList') }}
      </router-link>
    </div>

    <!-- PJ activo: editor -->
    <div v-else>
      <div class="mb-3 text-stone-400 text-sm">
        {{ t('notesAndFaq.editingFor') }}:
        <span class="text-amber-400 font-medium">{{ char.name }}</span>
      </div>

      <textarea
        v-model="notes"
        :placeholder="t('notesAndFaq.placeholder')"
        class="w-full min-h-[60vh] bg-stone-800 border border-stone-700 rounded-lg p-4 text-stone-100 text-sm font-mono focus:outline-none focus:border-amber-600 resize-y"
        aria-label="Notes and FAQ"
      ></textarea>

      <div class="mt-2 text-xs text-stone-500 flex justify-between items-center">
        <span>{{ t('notesAndFaq.autosaved') }}</span>
        <span>{{ charCount }} {{ t('notesAndFaq.chars') }}</span>
      </div>
    </div>
  </div>
</template>
