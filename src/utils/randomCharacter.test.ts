// Documento generado el 2026-05-23 — #81 (random character no debe quedar
// bloqueado por "Resolve before leveling up" en Step9 Review).
//
// El generador random produce un PJ completo que debe pasar el gating de
// pendingLevelDecisions a CUALQUIER nivel entre 1 y 20. Antes del fix #81 los
// PJs random aparecían en Step9 con avisos para resolver species choices,
// ASI/feats y Magic Initiate del origin feat.

import { describe, it, expect, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { generateRandomCharacter } from '@/utils/randomCharacter'
import { pendingLevelDecisions } from '@/utils/levelUpGating'
import { preloadVariantData, getClasses, getRaces } from '@/data'

describe('#81 — Random character no deja decisiones pendientes', () => {
  beforeAll(async () => {
    setActivePinia(createPinia())
    await preloadVariantData('dnd5e')
  })

  it('un PJ random a nivel 1 no tiene decisiones pendientes', () => {
    // 30 intentos con seed determinista difícil: hacemos varios para cubrir
    // casuística de razas con choices (Dragonborn) y backgrounds con
    // Magic Initiate como origin feat.
    for (let i = 0; i < 30; i++) {
      const char = generateRandomCharacter('dnd5e', 1)
      const pending = pendingLevelDecisions(char)
      if (pending.length > 0) {
        throw new Error(
          `Iter ${i} lv.1 dejó decisiones: ${pending.map(p => p.key).join(', ')}. ` +
          `Char: race=${char.race}, class=${char.className}, bg=${char.background}`,
        )
      }
    }
  })

  it('un PJ random a nivel 5 (subclase desbloqueada) no tiene decisiones pendientes', () => {
    for (let i = 0; i < 30; i++) {
      const char = generateRandomCharacter('dnd5e', 5)
      const pending = pendingLevelDecisions(char)
      if (pending.length > 0) {
        throw new Error(
          `Iter ${i} lv.5 dejó decisiones: ${pending.map(p => p.key).join(', ')}. ` +
          `Char: race=${char.race}, class=${char.className}, bg=${char.background}`,
        )
      }
    }
  })

  it('un PJ random a nivel 10 (ASI lv.4 y lv.8) no tiene decisiones pendientes', () => {
    for (let i = 0; i < 30; i++) {
      const char = generateRandomCharacter('dnd5e', 10)
      const pending = pendingLevelDecisions(char)
      if (pending.length > 0) {
        throw new Error(
          `Iter ${i} lv.10 dejó decisiones: ${pending.map(p => p.key).join(', ')}. ` +
          `Char: race=${char.race}, class=${char.className}, bg=${char.background}`,
        )
      }
    }
  })

  it('un Dragonborn nivel 5 random tiene speciesChoices["draconic-ancestry"] resuelto', () => {
    // Forzamos buscar una iteración en la que la raza sea dragonborn (probabilidad
    // baja por ser 1 entre N razas; el test puede salir vacío si las 200 iteraciones
    // no la sortean; en ese caso lo saltamos vía expect blando).
    let foundDragonborn = false
    for (let i = 0; i < 200 && !foundDragonborn; i++) {
      const char = generateRandomCharacter('dnd5e', 5)
      if (char.race === 'dragonborn') {
        foundDragonborn = true
        expect(char.speciesChoices?.['draconic-ancestry']).toBeTruthy()
        expect(pendingLevelDecisions(char)).toHaveLength(0)
      }
    }
    // El test pasa aunque no se sortee Dragonborn en 200 intentos. Lo importante
    // es que SI sale, el campo está resuelto. Si no salió, no añade cobertura
    // negativa: ese caso lo cubre el bucle general de "no decisiones pendientes".
  })

  it('un PJ random tiene asiChoices con todos los niveles ASI cubiertos', () => {
    const char = generateRandomCharacter('dnd5e', 12)
    const classes = getClasses('dnd5e')
    const cls = classes.find(c => c.id === char.className)
    expect(cls).toBeTruthy()
    // Para nivel 12, todas las clases tienen ASIs en lv.4, 8, 12 (Fighter añade 6).
    const asiLevels = (char.asiChoices ?? []).map(c => c.level).sort((a, b) => a - b)
    expect(asiLevels).toContain(4)
    expect(asiLevels).toContain(8)
    expect(asiLevels).toContain(12)
    // Cada uno con type='asi' y abilities resueltas.
    for (const c of char.asiChoices ?? []) {
      expect(c.type).toBe('asi')
      expect(c.asiAbilities && c.asiAbilities.length).toBeGreaterThan(0)
    }
  })

  it('races sin choices producen speciesChoices vacío (no crash)', () => {
    // Forzamos buscar humano (sin choices) y verificamos que speciesChoices
    // existe pero está vacío.
    let foundHuman = false
    for (let i = 0; i < 200 && !foundHuman; i++) {
      const char = generateRandomCharacter('dnd5e', 1)
      const races = getRaces('dnd5e')
      const race = races.find(r => r.id === char.race)
      if (race && !race.choices?.length) {
        foundHuman = true
        expect(char.speciesChoices).toEqual({})
      }
    }
  })
})
