import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'
import { writeFileSync, appendFileSync, readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

// Build hash for cache invalidation of localStorage game data.
// Tries git first; if git or .git folder are unavailable (e.g. when running
// from a downloaded ZIP), falls back to a timestamp-based hash.
function getBuildHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return `nogit-${Date.now().toString(36).slice(-6)}`
  }
}
const buildHash = getBuildHash()

/**
 * #151 — Extrae el último número de ticket del changelog para mostrarlo en
 * el VersionBadge. Útil para verificar al vistazo si el deploy contiene el
 * último fix sin tener que mirar el hash de git.
 *
 * Parsea la primera línea con formato "YYYY-MM-DD HH:MM · #N — Título".
 * Si falla por cualquier motivo (changelog no existe, formato cambia),
 * devuelve '' y el badge no muestra nada de ticket.
 */
function getLastTicket(): string {
  try {
    const text = readFileSync('./changelog.txt', 'utf-8')
    const match = text.match(/^\d{4}-\d{2}-\d{2}.*?·\s*(#\d+)/m)
    return match?.[1] ?? ''
  } catch {
    return ''
  }
}
const lastTicket = getLastTicket()

export default defineConfig({
  base: '/dnd-character-builder/',
  define: {
    __BUILD_HASH__: JSON.stringify(buildHash),
    __APP_VERSION__: JSON.stringify('2026.05.20'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
    __BUILD_TICKET__: JSON.stringify(lastTicket),
  },
  plugins: [
    // ── Dev logging: browser → fichero dev.log.txt ────────────────────────
    {
      name: 'dev-log',
      apply: 'serve',
      configureServer(server) {
        const logPath = './dev.log.txt'
        writeFileSync(logPath, `=== Dev Log ${new Date().toISOString()} ===\n`)
        console.log(`\x1b[33m[dev-log] Logs en: ${logPath}\x1b[0m`)

        // Registrar ANTES de los otros middlewares de Vite
        server.middlewares.use((req, res, next) => {
          // Interceptar tanto /__log como /dnd-character-builder/__log
          if ((req.url === '/__log' || req.url?.endsWith('/__log')) && req.method === 'POST') {
            let body = ''
            req.on('data', (chunk: Buffer) => { body += chunk.toString() })
            req.on('end', () => {
              try {
                const { tag, msg } = JSON.parse(body)
                const time = new Date().toLocaleTimeString('es-ES', { hour12: false })
                const line = `[${time}] ${tag} ${msg}\n`
                appendFileSync(logPath, line)
                process.stdout.write(`\x1b[36m${line}\x1b[0m`)
              } catch { /* ignorar */ }
              res.statusCode = 204
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end()
            })
            return
          }
          next()
        })
      },
    },
    vue(),
    tailwindcss(),
    VitePWA({
      // #154 — Antes era 'prompt' lo cual NO actualizaba el SW automáticamente
      // y no había UI que confirmara la nueva versión: el usuario veía siempre
      // el bundle viejo cacheado aunque el deploy nuevo estuviera en el servidor.
      // 'autoUpdate' + skipWaiting + clientsClaim hace que al detectar versión
      // nueva al recargar, el SW nuevo tome control inmediatamente sin
      // requerir confirmación. Idóneo para esta app, donde no hay datos en
      // memoria volátiles que perder al recargar.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        name: 'D&D Character Builder',
        short_name: 'DnD Builder',
        description: 'Create and manage your D&D 5e, Brancalonia, and Apocalisse characters',
        theme_color: '#292524',
        background_color: '#1c1917',
        display: 'standalone',
        scope: '/dnd-character-builder/',
        start_url: '/dnd-character-builder/',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // #154 — clientsClaim + skipWaiting: el SW nuevo toma control de los
        // clients abiertos en cuanto se activa, sin esperar a que se cierren
        // todas las pestañas (comportamiento por defecto de los SWs).
        clientsClaim: true,
        skipWaiting: true,
        // #154 — cleanupOutdatedCaches limpia cachés de versiones anteriores
        // al activarse el SW nuevo, evitando que Application > Cache acumule
        // bundles obsoletos consumiendo espacio del navegador.
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:pdf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-templates',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'docs',
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-lib': ['pdf-lib'],
          // WSG 3.3 + 3.8: Game data split per module — loaded on demand per wizard step
          'game-dnd5e-races': ['./src/data/dnd5e/races.ts'],
          'game-dnd5e-classes': ['./src/data/dnd5e/classes.ts'],
          'game-dnd5e-backgrounds': ['./src/data/dnd5e/backgrounds.ts', './src/data/dnd5e/missing-backgrounds.ts'],
          'game-dnd5e-spells': ['./src/data/dnd5e/spells.ts', './src/data/dnd5e/spells-4-9.ts'],
          'game-dnd5e-equipment': ['./src/data/dnd5e/equipment.ts'],
          'game-dnd5e-rules': ['./src/data/dnd5e/rules.ts'],
        },
      },
    },
  },
})
