<!--
  VersionBadge.vue — #136

  Muestra el código de versión fijo en la esquina inferior-derecha de la
  página. Combina la fecha+hora del build inyectada por Vite con el hash
  del último commit (o un hash basado en timestamp si no hay git, p.ej. al
  arrancar desde un ZIP).

  Las variables vienen de vite.config.ts (define):
    - __BUILD_DATE__: 'YYYY-MM-DD HH:MM' (UTC del momento del build)
    - __BUILD_HASH__: short hash de git o 'nogit-<timestamp36>'

  El badge es muy discreto: gris claro sobre fondo oscuro semi-transparente,
  posición fixed para que no afecte al layout y se mantenga visible siempre.
  Se le puede hacer click para copiar la cadena completa al portapapeles
  (útil al reportar bugs: "estoy en X").
-->
<script setup lang="ts">
import { ref } from 'vue'

declare const __BUILD_DATE__: string
declare const __BUILD_HASH__: string

const buildDate = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'dev'
const buildHash = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev'
const fullLabel = `build ${buildDate} · ${buildHash}`

const copied = ref(false)

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(fullLabel)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    // Navegadores muy antiguos o contextos no-secure: silenciar.
  }
}
</script>

<template>
  <div
    class="version-badge fixed bottom-2 right-2 text-[10px] font-mono leading-none px-2 py-1 rounded bg-stone-900/70 text-stone-500 hover:text-stone-300 border border-stone-700/50 cursor-pointer select-none transition-colors z-50"
    :title="copied ? 'Copiado al portapapeles' : 'Click para copiar'"
    role="status"
    aria-label="Build version"
    @click="copyToClipboard"
  >
    <span v-if="copied">copied!</span>
    <span v-else>{{ buildDate }} · {{ buildHash }}</span>
  </div>
</template>
