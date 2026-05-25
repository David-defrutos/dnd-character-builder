// #159 — Tests para shortCastingTime.

import { describe, it, expect } from 'vitest'
import { shortCastingTime } from './shortCastingTime'

describe('#159 — shortCastingTime', () => {
  it('"Action" se queda igual (cabe en la celda)', () => {
    expect(shortCastingTime('Action')).toBe('Action')
  })

  it('"Action or Ritual" → "Action" (ritual va al checkbox)', () => {
    expect(shortCastingTime('Action or Ritual')).toBe('Action')
  })

  it('"Bonus Action" → "Bonus"', () => {
    expect(shortCastingTime('Bonus Action')).toBe('Bonus')
  })

  it('"Reaction" se queda igual', () => {
    expect(shortCastingTime('Reaction')).toBe('Reaction')
  })

  it('"1 minute" → "1 min"', () => {
    expect(shortCastingTime('1 minute')).toBe('1 min')
  })

  it('"10 minutes" → "10 min"', () => {
    expect(shortCastingTime('10 minutes')).toBe('10 min')
  })

  it('"1 minute or Ritual" → "1 min"', () => {
    expect(shortCastingTime('1 minute or Ritual')).toBe('1 min')
  })

  it('"10 minutes or Ritual" → "10 min"', () => {
    expect(shortCastingTime('10 minutes or Ritual')).toBe('10 min')
  })

  it('"1 hour" → "1 h"', () => {
    expect(shortCastingTime('1 hour')).toBe('1 h')
  })

  it('"8 hours" → "8 h"', () => {
    expect(shortCastingTime('8 hours')).toBe('8 h')
  })

  it('cadena no contemplada se devuelve sin tocar (mejor que estropearla)', () => {
    expect(shortCastingTime('Special, see spell description')).toBe('Special, see spell description')
  })

  it('cadena vacía o nullish se devuelve igual', () => {
    expect(shortCastingTime('')).toBe('')
  })

  it('case-insensitive en sufijo Ritual', () => {
    expect(shortCastingTime('Action or ritual')).toBe('Action')
    expect(shortCastingTime('Action OR RITUAL')).toBe('Action')
  })

  it('trim de espacios extra antes/después del sufijo Ritual', () => {
    expect(shortCastingTime('Action   or Ritual  ')).toBe('Action')
  })

  it('"Bonus Action or Ritual" → "Bonus" (cualquier acción + ritual)', () => {
    expect(shortCastingTime('Bonus Action or Ritual')).toBe('Bonus')
  })
})
