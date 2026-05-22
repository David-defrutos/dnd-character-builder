// Documento generado el 2026-05-19-2221
// English-only setup. The Italian locale (and the language switcher that
// allowed picking it) were removed in Sprint A — this app is for private
// use by an English-speaking table.
//
// We still go through vue-i18n so existing $t() / useI18n() calls work
// unchanged across the codebase.

import { createI18n } from 'vue-i18n'

const activeMessagesPromise = import('./locales/en.json').then(m => m.default)

// Create i18n with empty messages — populated before app mount via initI18n()
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {},
  missingWarn: false,
  fallbackWarn: false,
})

/**
 * Initialize i18n with the English messages.
 * Must be called (and awaited) before app.mount().
 */
export async function initI18n(): Promise<void> {
  const messages = await activeMessagesPromise
  i18n.global.setLocaleMessage('en', messages)
  // Re-enable warnings now that messages are loaded
  i18n.global.missingWarn = true
  i18n.global.fallbackWarn = true
}

/**
 * Kept for API compatibility with any caller that still expects it.
 * No-op: only the English locale is shipped now.
 */
export async function loadLocale(_locale: string): Promise<void> {
  return
}

export default i18n
