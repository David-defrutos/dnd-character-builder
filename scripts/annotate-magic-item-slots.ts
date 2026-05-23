// Script one-off: anota el campo `slot` y/o `isContainer` en magic-items.ts
// para los ítems con slot identificable por patrón en su id. Cobertura
// pragmática del 80% de casos comunes de juego sin tener que anotar a mano
// las 260+ entradas. Items sin patrón claro quedan sin slot — el sistema
// los trata como "slot desconocido, equipable libremente".

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const path = resolve(process.cwd(), 'src/data/dnd5e/magic-items.ts')
let src = readFileSync(path, 'utf8')

interface Rule {
  match: RegExp        // Match contra el id
  slot?: string        // 'ring' | 'cloak' | etc.
  isContainer?: boolean
}

// Reglas ordenadas: la primera que coincide se aplica.
const RULES: Rule[] = [
  // Containers extradimensionales — sólo estos 3 en el catálogo actual.
  { match: /^bag-of-holding$/, isContainer: true, slot: 'other' },
  { match: /^handy-haversack$/, isContainer: true, slot: 'other' },
  { match: /^portable-hole$/, isContainer: true, slot: 'other' },

  // Anillos
  { match: /^ring-of-/, slot: 'ring' },

  // Capas / mantos / robes
  { match: /^cloak-of-/, slot: 'cloak' },
  { match: /^mantle-of-/, slot: 'cloak' },
  { match: /^robe-of-/, slot: 'cloak' },

  // Botas / sandalias
  { match: /^boots-of-/, slot: 'boots' },
  { match: /^slippers-of-/, slot: 'boots' },
  { match: /^winged-boots$/, slot: 'boots' },

  // Guantes / gauntlets
  { match: /^gauntlets-of-/, slot: 'gloves' },
  { match: /^gloves-of-/, slot: 'gloves' },

  // Cinturones
  { match: /^belt-of-/, slot: 'belt' },

  // Cabeza
  { match: /^circlet-of-/, slot: 'head' },
  { match: /^headband-of-/, slot: 'head' },
  { match: /^helm-of-/, slot: 'head' },
  { match: /^hat-of-/, slot: 'head' },

  // Cuello (amuletos, medallones, broches)
  { match: /^amulet-of-/, slot: 'neck' },
  { match: /^periapt-of-/, slot: 'neck' },
  { match: /^necklace-of-/, slot: 'neck' },
  { match: /^talisman-of-/, slot: 'neck' },
  { match: /^brooch-of-/, slot: 'neck' },
  { match: /^medallion-of-/, slot: 'neck' },
]

// Procesamos cada bloque `{ id: "...", ... }` que NO tenga ya `slot:` o
// `isContainer:` declarados. Buscamos el id, vemos la regla, y si aplica
// añadimos las propiedades justo después de la línea `description: "..."`.

let updatedCount = 0
let containerCount = 0

// Regex captura un bloque que arranca por "    id:" hasta el cierre `}`
// (no greedy). Usamos lookahead para limitar al final del objeto.
src = src.replace(
  /(\{\s*id:\s*"([^"]+)",[\s\S]*?description:\s*"[^"]*",?)(\s*\})/g,
  (_match, head: string, id: string, tail: string) => {
    // Si ya tiene slot o isContainer, no tocamos (idempotente).
    if (/\bslot\s*:/.test(head) || /\bisContainer\s*:/.test(head)) {
      return head + tail
    }
    for (const rule of RULES) {
      if (rule.match.test(id)) {
        let extras = ''
        if (rule.slot) extras += `,\n    slot: "${rule.slot}"`
        if (rule.isContainer) { extras += `,\n    isContainer: true`; containerCount++ }
        updatedCount++
        return head + extras + tail
      }
    }
    return head + tail
  },
)

writeFileSync(path, src)
console.log(`Anotados ${updatedCount} items.`)
console.log(`Containers marcados: ${containerCount}.`)
