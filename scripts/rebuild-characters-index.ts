/**
 * #123 — Regenera public/characters/index.json escaneando la carpeta.
 *
 * Uso:
 *   npm run rebuild-characters
 *
 * Lee cada *.json (excluyendo index.json) e intenta extraer name+className+
 * level del propio archivo para mostrarlos como etiquetas en el UI sin
 * obligar al usuario a abrir cada PJ.
 *
 * Si un JSON no tiene esos campos (o es inválido), se incluye con name = id
 * del archivo y sin metadata adicional — no se descarta para no esconder
 * archivos al usuario.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

interface IndexEntry {
  file: string         // Nombre del archivo (ej. "salusa-bard-lv10.json")
  name: string         // Nombre del PJ (del JSON o derivado del archivo)
  className?: string
  level?: number
  race?: string
}

const dir = resolve(process.cwd(), 'public/characters')
const indexPath = join(dir, 'index.json')

let files: string[]
try {
  files = readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== 'index.json')
    .sort()
} catch (e) {
  console.error(`No se pudo leer ${dir}: ${(e as Error).message}`)
  process.exit(1)
}

const entries: IndexEntry[] = []
for (const file of files) {
  const path = join(dir, file)
  let entry: IndexEntry = { file, name: file.replace(/\.json$/, '') }
  try {
    const raw = readFileSync(path, 'utf8')
    const data = JSON.parse(raw)
    if (typeof data.name === 'string' && data.name.length > 0) entry.name = data.name
    if (typeof data.className === 'string') entry.className = data.className
    if (typeof data.level === 'number') entry.level = data.level
    if (typeof data.race === 'string') entry.race = data.race
  } catch (e) {
    console.warn(`  ⚠ ${file}: JSON inválido o sin metadata, incluido sin enriquecer.`)
  }
  entries.push(entry)
}

writeFileSync(indexPath, JSON.stringify(entries, null, 2) + '\n')
console.log(`✓ ${indexPath}`)
console.log(`  ${entries.length} character(s) indexed:`)
for (const e of entries) {
  const meta = [e.className, e.level ? `lv.${e.level}` : '', e.race].filter(Boolean).join(' · ')
  console.log(`    • ${e.name}${meta ? ` (${meta})` : ''}`)
}
