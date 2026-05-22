// Tests para bug #73 — Sailor duplicado en backgrounds.
//
// Antes del fix, missing-backgrounds.ts incluía un Sailor "legacy 2014"
// con el mismo id que el Sailor del PHB 2024 en backgrounds.ts. La función
// getBackgrounds() filtraba por id 'sailor' y devolvía AMBOS, mostrando
// dos veces el background en el selector de la UI.
//
// El fix: deduplicar por id en la fuente, dando prioridad a baseBackgrounds
// (PHB 2024). Como la UI consume `backgrounds` (directamente o vía
// `getBackgrounds()` que filtra de ese mismo array), basta con asegurar
// que el array merged no contiene duplicados.

import { describe, it, expect } from 'vitest'
import { backgrounds, getBackgroundById } from './backgrounds'

describe('#73 — Sailor duplicado fix', () => {
  it('there is exactly one Sailor in the merged backgrounds array', () => {
    const sailors = backgrounds.filter(b => b.id === 'sailor')
    expect(sailors).toHaveLength(1)
  })

  it('the surviving Sailor is the PHB 2024 version (has originFeat)', () => {
    const sailor = getBackgroundById('sailor')
    expect(sailor).toBeDefined()
    // PHB 2024 version has originFeat; legacy 2014 version did not.
    expect(sailor?.originFeat).toBeDefined()
    expect(sailor?.abilityScores).toBeDefined()
  })

  it('all merged backgrounds have unique ids', () => {
    const ids = backgrounds.map(b => b.id)
    const unique = new Set(ids)
    expect(ids.length).toBe(unique.size)
  })
})
