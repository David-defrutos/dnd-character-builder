<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AppHeader from '@/components/layout/AppHeader.vue'
import HelpPanel from '@/components/shared/HelpPanel.vue'
import { useTheme } from '@/composables/useTheme'

const { t } = useI18n()
const showCookieBanner = ref(false)

// Initialize theme — applies data-theme attribute on <html>
useTheme()

onMounted(() => {
  if (!localStorage.getItem('gdpr-accepted')) {
    showCookieBanner.value = true
  }
})

function acceptGdpr() {
  localStorage.setItem('gdpr-accepted', '1')
  showCookieBanner.value = false
}
</script>

<template>
  <div class="min-h-screen bg-stone-900 text-stone-100 flex flex-col">
    <!-- Skip to content link for keyboard users -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-stone-900 focus:rounded focus:font-semibold"
    >
      Skip to content
    </a>
    <AppHeader />
    <HelpPanel />
    <main id="main-content" class="w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 max-w-[1600px] mx-auto" role="main">
      <router-view />
    </main>
    <!-- Footer removed for private/personal use (no donation, no external links). -->

    <!-- GDPR Cookie Banner -->
    <div
      v-if="showCookieBanner"
      class="fixed bottom-0 left-0 right-0 bg-stone-800 border-t border-amber-700/30 p-4 z-50 shadow-lg"
      role="alertdialog"
      aria-labelledby="gdpr-title"
      aria-describedby="gdpr-desc"
    >
      <div class="container mx-auto flex flex-col sm:flex-row items-center gap-4 max-w-4xl">
        <p id="gdpr-desc" class="text-sm text-stone-300 flex-1">
          {{ t('gdpr.banner') }}
        </p>
        <button
          @click="acceptGdpr"
          class="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer text-sm"
        >
          {{ t('gdpr.accept') }}
        </button>
      </div>
    </div>
  </div>
</template>
