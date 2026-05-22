// Tests para H8 (auditoría externa): recomputeMaxHp recalcula desde cero
// y mantiene maxHp coherente al cambiar CON, Tough o nivel.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { preloadVariantData } from '@/data'
import { recomputeMaxHp } from './recomputeHp'

describe('H8 — recomputeMaxHp', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Fighter lv.1 CON 14 → 10 HP base (d10 + CON+2)', () => {
    const store = useCharacterStore()
    store.character.className = 'fighter'
    store.character.hitDie = 10
    store.character.level = 1
    store.character.abilityScores.con = 14
    recomputeMaxHp(store.character)
    expect(store.character.maxHp).toBe(12)  // 10 + 2 CON
  })

  it('Fighter lv.5 CON 14 → 38 HP (10+2 + 4×(6+2))', () => {
    const store = useCharacterStore()
    store.character.className = 'fighter'
    store.character.hitDie = 10
    store.character.level = 5
    store.character.abilityScores.con = 14
    recomputeMaxHp(store.character)
    // lv.1: 10+2=12. lv.2-5: 4 × (5+1+2)=32. Total=44
    // Espera, hpPerLevel = floor(10/2)+1+2 = 6+2 = 8
    // 12 + 4*8 = 44
    expect(store.character.maxHp).toBe(44)
  })

  it('Wizard lv.1 CON 12 → 7 HP (d6 + CON+1)', () => {
    const store = useCharacterStore()
    store.character.className = 'wizard'
    store.character.hitDie = 6
    store.character.level = 1
    store.character.abilityScores.con = 12
    recomputeMaxHp(store.character)
    expect(store.character.maxHp).toBe(7)
  })

  it('Cambiar CON recalcula maxHp correctamente', () => {
    const store = useCharacterStore()
    store.character.className = 'fighter'
    store.character.hitDie = 10
    store.character.level = 5
    store.character.abilityScores.con = 14
    recomputeMaxHp(store.character)
    const beforeBoost = store.character.maxHp  // 44

    // Subo CON a 16 (mod +3, +1 por nivel)
    store.character.abilityScores.con = 16
    recomputeMaxHp(store.character)
    // lv.1: 10+3=13. lv.2-5: 4 × (6+3)=36. Total=49
    expect(store.character.maxHp).toBe(49)
    expect(store.character.maxHp).toBeGreaterThan(beforeBoost)
  })

  it('Feat Tough añade +2 HP por nivel del PJ', () => {
    const store = useCharacterStore()
    store.character.className = 'fighter'
    store.character.hitDie = 10
    store.character.level = 5
    store.character.abilityScores.con = 14
    recomputeMaxHp(store.character)
    const sinTough = store.character.maxHp  // 44

    // Activar Tough
    store.character.toughHpBonus = 10  // lv 5 × 2
    recomputeMaxHp(store.character)
    expect(store.character.maxHp).toBe(sinTough + 10)

    // Desactivar Tough (cambiar de feat)
    store.character.toughHpBonus = 0
    recomputeMaxHp(store.character)
    expect(store.character.maxHp).toBe(sinTough)
  })

  it('Dwarven Toughness suma +1 HP por nivel', () => {
    const store = useCharacterStore()
    store.character.className = 'fighter'
    store.character.hitDie = 10
    store.character.level = 5
    store.character.abilityScores.con = 14
    store.character.race = 'dwarf'
    recomputeMaxHp(store.character)
    // 44 + 5 (Dwarf bonus) = 49
    expect(store.character.maxHp).toBe(49)
  })

  it('currentHp se ajusta hacia abajo si maxHp baja por debajo', () => {
    const store = useCharacterStore()
    store.character.className = 'fighter'
    store.character.hitDie = 10
    store.character.level = 5
    store.character.abilityScores.con = 16
    recomputeMaxHp(store.character)
    store.character.currentHp = store.character.maxHp  // 49 (10+3 + 4*(6+3))

    // Bajo CON drásticamente
    store.character.abilityScores.con = 8  // mod -1
    recomputeMaxHp(store.character)
    // Nuevo maxHp: 10-1 + 4*(6-1) = 9 + 20 = 29
    expect(store.character.maxHp).toBe(29)
    expect(store.character.currentHp).toBe(29)  // ajustado
  })

  it('currentHp NO sube si maxHp sube (mantenemos el daño)', () => {
    const store = useCharacterStore()
    store.character.className = 'fighter'
    store.character.hitDie = 10
    store.character.level = 5
    store.character.abilityScores.con = 14
    recomputeMaxHp(store.character)
    store.character.currentHp = 20  // herido

    // Subo CON, maxHp crece
    store.character.abilityScores.con = 16
    recomputeMaxHp(store.character)
    expect(store.character.maxHp).toBe(49)
    expect(store.character.currentHp).toBe(20)  // sigue herido
  })

  it('Sin clase: maxHp = 1 (defensivo)', () => {
    const store = useCharacterStore()
    store.character.className = ''
    store.character.level = 0
    recomputeMaxHp(store.character)
    expect(store.character.maxHp).toBe(1)
  })
})
