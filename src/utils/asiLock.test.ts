// Tests para src/utils/asiLock.ts — bug #72.
//
// La regla es estricta: locked iff characterLevel > slotLevel.
// - characterLevel == slotLevel → editable (acabas de llegar al nivel)
// - characterLevel < slotLevel → editable (data inconsistente, no atrapar al user)
// - characterLevel > slotLevel → locked (ya pasaste el checkpoint)

import { describe, it, expect } from 'vitest'
import { isAsiSlotLocked } from './asiLock'

describe('#72 — isAsiSlotLocked', () => {
  it('slot exactamente en el nivel actual: editable', () => {
    expect(isAsiSlotLocked(4, 4)).toBe(false)
    expect(isAsiSlotLocked(19, 19)).toBe(false)
  })

  it('slot por encima del nivel actual: editable (data inconsistente, fail-open)', () => {
    expect(isAsiSlotLocked(4, 3)).toBe(false)
    expect(isAsiSlotLocked(8, 4)).toBe(false)
  })

  it('slot por debajo del nivel actual: bloqueado', () => {
    expect(isAsiSlotLocked(4, 5)).toBe(true)
    expect(isAsiSlotLocked(4, 10)).toBe(true)
    expect(isAsiSlotLocked(4, 20)).toBe(true)
  })

  it('caso típico fighter lv6 con slots en 4 y 6', () => {
    expect(isAsiSlotLocked(4, 6)).toBe(true)  // ya pasó lv5
    expect(isAsiSlotLocked(6, 6)).toBe(false) // recién llegó a lv6
  })

  it('caso límite: lv1 sin slots aún', () => {
    expect(isAsiSlotLocked(4, 1)).toBe(false)
  })
})
