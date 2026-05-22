// Documento generado el 2026-05-19-2245 — test de regresión tarea 12 (BUG CRÍTICO Step4)
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { getAsiLevels, aggregateAsiBumps, isEpicBoonLevel } from '@/data/dnd5e/asi'
import type { ASIChoice } from '@/stores/character'

describe('Bugfix tarea 12 — Step4 defensiveness', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('totalAbilityScore con bonuses por defecto devuelve la base', () => {
    const store = useCharacterStore()
    expect(() => store.totalAbilityScore('str')).not.toThrow()
    expect(store.totalAbilityScore('str')).toBe(10) // base default
  })

  it('totalAbilityScore suma correctamente con speciesBonuses', () => {
    const store = useCharacterStore()
    store.character.abilityScores.str = 16
    store.character.speciesBonuses = { str: 2 }
    expect(store.totalAbilityScore('str')).toBe(18)
  })

  it('getAsiLevels para fighter nivel 10 devuelve [4, 6, 8]', () => {
    const levels = getAsiLevels('fighter', 10)
    expect(levels).toEqual([4, 6, 8])
  })

  it('getAsiLevels para fighter nivel 20 devuelve todos los ASIs', () => {
    const levels = getAsiLevels('fighter', 20)
    expect(levels).toEqual([4, 6, 8, 12, 14, 16, 19])
  })

  it('isEpicBoonLevel detecta nivel 19 como epic boon', () => {
    expect(isEpicBoonLevel(19)).toBe(true)
    expect(isEpicBoonLevel(4)).toBe(false)
    expect(isEpicBoonLevel(8)).toBe(false)
  })

  it('aggregateAsiBumps acumula correctamente múltiples ASIs', () => {
    const choices: ASIChoice[] = [
      { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] },
      { level: 6, type: 'asi', asiMode: '1+1', asiAbilities: ['str', 'con'] },
      { level: 8, type: 'feat', featId: 'alert' },
    ]
    const bumps = aggregateAsiBumps(choices)
    expect(bumps.str).toBe(3) // +2 en lv4 +1 en lv6
    expect(bumps.con).toBe(1) // +1 en lv6
    expect(bumps.dex).toBeUndefined()
  })

  it('aggregateAsiBumps devuelve {} para lista vacía', () => {
    const bumps = aggregateAsiBumps([])
    expect(Object.keys(bumps)).toHaveLength(0)
  })

  it('aggregateAsiBumps no lanza con asiAbilities undefined (estado corrupto)', () => {
    const choices: ASIChoice[] = [
      { level: 4, type: 'asi', asiMode: '2', asiAbilities: undefined },
    ]
    expect(() => aggregateAsiBumps(choices)).not.toThrow()
  })
})
