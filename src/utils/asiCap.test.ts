// Tests para H7 (auditoría externa): el cap 20 (30 en Epic Boon) debe
// IMPEDIR la asignación, no solo avisar visualmente.
//
// La lógica está en wouldExceedCap() de AsiSelector.vue. Estos tests
// replican esa lógica de forma pura para validarla.

import { describe, it, expect } from 'vitest'

// Helper que replica wouldExceedCap sin depender de Pinia/Vue.
// Equivale a la función del componente.
function wouldExceedCap(
  base: number,
  bumpsAlreadyAppliedFromThisSlot: number,
  newBump: number,
  isEpicBoon: boolean,
): boolean {
  const cap = isEpicBoon ? 30 : 20
  return (base - bumpsAlreadyAppliedFromThisSlot + newBump) > cap
}

describe('H7 — cap 20 / 30 impide asignación', () => {
  it('STR 18 + ASI +2 → 20 OK (en el límite)', () => {
    expect(wouldExceedCap(18, 0, 2, false)).toBe(false)
  })

  it('STR 19 + ASI +2 → 21 BLOQUEADO', () => {
    expect(wouldExceedCap(19, 0, 2, false)).toBe(true)
  })

  it('STR 20 + ASI +1 → 21 BLOQUEADO', () => {
    expect(wouldExceedCap(20, 0, 1, false)).toBe(true)
  })

  it('STR 20 (ya con +2 del propio slot) + reasignar a misma STR +2 → no se cuenta dos veces', () => {
    // El slot ya aplicaba +2 a STR (18 base + 2 = 20). Al re-elegir STR +2,
    // descontamos el bump previo. Result: 18 + 2 = 20. OK.
    expect(wouldExceedCap(20, 2, 2, false)).toBe(false)
  })

  it('Epic Boon: STR 22 + 4 → 26 OK (cap 30)', () => {
    expect(wouldExceedCap(22, 0, 4, true)).toBe(false)
  })

  it('Epic Boon: STR 29 + 2 → 31 BLOQUEADO', () => {
    expect(wouldExceedCap(29, 0, 2, true)).toBe(true)
  })

  it('Caso típico: STR 19 con +1+1 ASI mode (un +1 dejaría 20)', () => {
    // Base = 19. Aplicar +1 → 20. OK.
    expect(wouldExceedCap(19, 0, 1, false)).toBe(false)
  })

  it('Caso típico: STR 20 con +1+1 ASI mode (un +1 dejaría 21)', () => {
    // Ya en 20. +1 → 21. BLOQUEADO.
    expect(wouldExceedCap(20, 0, 1, false)).toBe(true)
  })

  it('STR 19, modo +1+1 ya aplicaba +1 a STR; reasignar a otra ability y volver a STR +1 → OK', () => {
    // Quita el +1 (vuelve a 18) y vuelve a poner +1 → 19. OK porque el cap
    // se aplicaría sobre 18+1=19.
    expect(wouldExceedCap(19, 1, 1, false)).toBe(false)
  })
})
