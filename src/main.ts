import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import i18n, { initI18n } from './i18n'
import { sweepStaleCache } from './data'
import './style.css'

// ── MONITOR GLOBAL (solo en desarrollo) ─────────────────────────────────────
declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string

const APP_VER = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
const BUILD_DT = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '?'

function monLog(msg: string) {
  if (!import.meta.env.DEV) return
  const ts = new Date().toLocaleTimeString('es-ES', { hour12: false })
  const line = `[${ts}] ${msg}`
  console.log('[MONITOR]', line)
  try {
    const arr = JSON.parse(localStorage.getItem('__devlog') ?? '[]')
    arr.push(line)
    localStorage.setItem('__devlog', JSON.stringify(arr.slice(-300)))
  } catch {}
}

if (import.meta.env.DEV) {
  try {
    localStorage.setItem('__devlog', JSON.stringify([
      `=== v${APP_VER} build:${BUILD_DT} session:${new Date().toISOString()} ===`
    ]))
  } catch { /* localStorage bloqueado o lleno — no crítico */ }
  console.log(`=== APP INIT v${APP_VER} (${BUILD_DT}) ===`)
}
// ───────────────────────────────────────────────────────────────────────────

// GitHub Pages SPA redirect: restore path from 404.html redirect query param
const params = new URLSearchParams(window.location.search)
const rawRedirectRoute = params.get('route')
// Validate: only allow alphanumeric, slashes, hyphens, dots (no protocol, no //, no external URLs)
const SAFE_ROUTE_RE = /^[a-zA-Z0-9/_\-.]+(#[a-zA-Z0-9_-]*)?$/
const redirectRoute = rawRedirectRoute && SAFE_ROUTE_RE.test(rawRedirectRoute) && rawRedirectRoute.length < 2000
  ? rawRedirectRoute
  : null
if (redirectRoute) {
  const cleanUrl = window.location.pathname
  window.history.replaceState(null, '', cleanUrl + '#restored')
}

async function bootstrap() {
  // WSG 3.8: Clean up stale game data cache from previous builds
  sweepStaleCache()

  // WSG 3.8: Load only the active locale before mounting (non-active loaded on demand)
  await initI18n()

  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)

  const app = createApp(App)
  app.use(pinia)
  app.use(router)
  app.use(i18n)

  // Navigate to restored route after mount (GitHub Pages SPA)
  if (redirectRoute) {
    router.isReady().then(() => {
      router.replace('/' + redirectRoute)
    })
  }

  // Global Vue error handler
  app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue error]', info, err)
  }

  app.mount('#app')

  // ── WATCH GLOBAL (solo en desarrollo) ─────────────────────────────────────
  if (import.meta.env.DEV) {
    import('@/stores/character').then(({ useCharacterStore }) => {
    import('@/stores/app').then(({ useAppStore }) => {
      import('@/data').then(({ getClasses }) => {
        import('vue').then(({ watch }) => {
          const charStore = useCharacterStore()
          const appStore = useAppStore()

          const stepNames = ['Variant','Species','Class','Abilities','Background','Equipment','Spells','Details','Review']

          monLog(`INIT | v${APP_VER} | step:${appStore.currentStep}(${stepNames[appStore.currentStep]}) | cls:${charStore.character.className} | lv:${charStore.character.level} | sub:${charStore.character.subclass} | species:${charStore.character.race} | bg:${charStore.character.background}`)

          watch(() => charStore.character.level, (v, old) => {
            const cls = getClasses(charStore.character.variant).find(c => c.id === charStore.character.className)
            const subLv = cls?.subclassLevel ?? 3
            const classesLoaded = getClasses(charStore.character.variant).length
            monLog(`LEVEL ${old}→${v} | cls:${charStore.character.className} | sub:"${charStore.character.subclass}" | subclassLevel:${subLv} | unlocked:${v >= subLv} | classesLoaded:${classesLoaded}`)
          })

          watch(() => charStore.character.className, (v, old) => {
            monLog(`CLASS "${old}"→"${v}" | lv:${charStore.character.level} | step:${appStore.currentStep}`)
          })

          watch(() => charStore.character.subclass, (v, old) => {
            monLog(`SUBCLASS "${old}"→"${v}" | cls:${charStore.character.className} | lv:${charStore.character.level}`)
          })

          watch(() => appStore.currentStep, (v, old) => {
            const classesLoaded = getClasses(charStore.character.variant).length
            monLog(`STEP ${old}(${stepNames[old]??'?'})→${v}(${stepNames[v]??'?'}) | cls:${charStore.character.className} | lv:${charStore.character.level} | sub:"${charStore.character.subclass}" | classesLoaded:${classesLoaded}`)
          })

          watch(() => charStore.character.race, (v) => {
            monLog(`RACE →"${v}"`)
          })

          watch(() => charStore.character.background, (v) => {
            monLog(`BACKGROUND →"${v}"`)
          })
        })
      })
    })
  }) // fin import stores/character
  } // fin if DEV
  // ─────────────────────────────────────────────────────────────────────────
}

bootstrap()
