// Tests para src/utils/featureScaling.ts — bug #84.

import { describe, it, expect } from 'vitest'
import { getScalingLevels, formatScalingLabel } from './featureScaling'

describe('#84 — getScalingLevels', () => {
  it('devuelve [] para columna vacía o undefined', () => {
    expect(getScalingLevels(undefined, 10)).toEqual([])
    expect(getScalingLevels([], 10)).toEqual([])
  })

  it('detecta solo el desbloqueo si no hay upgrades', () => {
    // Wild Shape PHB 2024: 2 desde lv.2, no escala (solo unlimited a lv.20).
    const wildShape = [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    expect(getScalingLevels(wildShape, 10)).toEqual([2])
  })

  it('detecta múltiples upgrades (Second Wind PHB 2024)', () => {
    const sw = [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
    expect(getScalingLevels(sw, 20)).toEqual([1, 4, 10])
  })

  it('respeta el nivel actual (no muestra upgrades futuros)', () => {
    const sw = [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
    expect(getScalingLevels(sw, 3)).toEqual([1])           // antes de lv.4
    expect(getScalingLevels(sw, 4)).toEqual([1, 4])        // recién en lv.4
    expect(getScalingLevels(sw, 9)).toEqual([1, 4])        // antes de lv.10
    expect(getScalingLevels(sw, 10)).toEqual([1, 4, 10])   // recién en lv.10
  })

  it('Rage (Barbarian) — escala en varios niveles', () => {
    const rages = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6]
    expect(getScalingLevels(rages, 20)).toEqual([1, 3, 6, 12, 17])
  })

  it('Channel Divinity Cleric (desbloqueo en lv.2)', () => {
    const cd = [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    expect(getScalingLevels(cd, 5)).toEqual([2])
  })

  it('Channel Divinity Paladin (desbloqueo lv.3, escala lv.11)', () => {
    const cd = [0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
    expect(getScalingLevels(cd, 11)).toEqual([3, 11])
    expect(getScalingLevels(cd, 10)).toEqual([3])
  })

  it('Bardic Inspiration (escala de die: d6 → d8 → d10 → d12)', () => {
    const bardic = ['d6','d6','d6','d6','d8','d8','d8','d8','d8','d10','d10','d10','d10','d10','d12','d12','d12','d12','d12','d12']
    expect(getScalingLevels(bardic, 20)).toEqual([1, 5, 10, 15])
  })

  it('Sneak Attack (escala cada 2 niveles)', () => {
    const sa = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]
    expect(getScalingLevels(sa, 20)).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19])
  })

  it('Martial Arts Die (Monk)', () => {
    const ma = ['1d6','1d6','1d6','1d6','1d8','1d8','1d8','1d8','1d8','1d8','1d10','1d10','1d10','1d10','1d10','1d10','1d12','1d12','1d12','1d12']
    expect(getScalingLevels(ma, 20)).toEqual([1, 5, 11, 17])
  })

  it('si currentLevel > length usa toda la columna', () => {
    const arr = [1, 2, 3]
    expect(getScalingLevels(arr, 100)).toEqual([1, 2, 3])
  })

  it('si currentLevel = 0 devuelve []', () => {
    const arr = [1, 2, 3]
    expect(getScalingLevels(arr, 0)).toEqual([])
  })
})

describe('#84 — formatScalingLabel', () => {
  it('vacío → string vacío', () => {
    expect(formatScalingLabel([])).toBe('')
  })

  it('un solo nivel → "lv.N"', () => {
    expect(formatScalingLabel([1])).toBe('lv.1')
    expect(formatScalingLabel([3])).toBe('lv.3')
  })

  it('dos niveles → "lv.N, scales at lv.M"', () => {
    expect(formatScalingLabel([1, 4])).toBe('lv.1, scales at lv.4')
  })

  it('tres niveles → "lv.N, scales at lv.M and lv.O"', () => {
    expect(formatScalingLabel([1, 4, 10])).toBe('lv.1, scales at lv.4 and lv.10')
  })

  it('cuatro niveles → "..., scales at lv.A, lv.B and lv.C"', () => {
    expect(formatScalingLabel([1, 4, 10, 17])).toBe('lv.1, scales at lv.4, lv.10 and lv.17')
  })

  it('cinco niveles', () => {
    expect(formatScalingLabel([1, 3, 6, 12, 17]))
      .toBe('lv.1, scales at lv.3, lv.6, lv.12 and lv.17')
  })
})
