/**
 * Feature scaling helpers (bug #84).
 *
 * Dada una feature que escala según una columna de class.progression,
 * detecta los niveles del personaje (1..currentLevel) donde el valor de
 * la columna cambia respecto al nivel anterior — esos son los niveles
 * donde la feature "sube".
 *
 * Convención: el primer valor distinto de 0/null (o el primero a secas
 * si todos son no-null) marca el desbloqueo inicial. Los siguientes
 * cambios marcan upgrades.
 *
 * Ej. secondWind PHB 2024: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4]
 *   - lv.1: 2 (desbloqueo)
 *   - lv.4: sube de 2 a 3
 *   - lv.10: sube de 3 a 4
 *   → para un PJ lv.10: [1, 4, 10]
 *   → para un PJ lv.8 (sin haber llegado a lv.10): [1, 4]
 *
 * Devuelve solo niveles ≤ currentLevel, en orden ascendente.
 */

export function getScalingLevels(
  progressionColumn: readonly (number | string)[] | undefined,
  currentLevel: number,
): number[] {
  if (!progressionColumn?.length) return []
  const levels: number[] = []
  let prevValue: number | string | null = null
  const max = Math.min(currentLevel, progressionColumn.length)

  for (let i = 0; i < max; i++) {
    const lvl = i + 1
    const val = progressionColumn[i]!
    // Considerar 0 como "no desbloqueado" (ej. channelDivinity[0] = 0)
    if (prevValue === null) {
      // Primer desbloqueo: solo si el valor es "real" (no 0 / no string vacío)
      const isUnlocked = typeof val === 'number' ? val > 0 : !!val
      if (isUnlocked) {
        levels.push(lvl)
        prevValue = val
      }
    } else if (val !== prevValue) {
      levels.push(lvl)
      prevValue = val
    }
  }

  return levels
}

/**
 * Formatea los niveles de escalado para mostrar en el header de una feature.
 *
 * - Si solo hay un nivel (el de desbloqueo, sin upgrades visibles): `lv.N`
 * - Si hay 2 niveles: `lv.N, scales at lv.M`
 * - Si hay 3+ niveles: `lv.N, scales at lv.M and lv.O` (último con "and")
 *
 * Ej:
 *   formatScalingLabel([1])         → "lv.1"
 *   formatScalingLabel([1, 4])      → "lv.1, scales at lv.4"
 *   formatScalingLabel([1, 4, 10])  → "lv.1, scales at lv.4 and lv.10"
 *   formatScalingLabel([1, 4, 10, 17]) → "lv.1, scales at lv.4, lv.10 and lv.17"
 */
export function formatScalingLabel(levels: number[]): string {
  if (levels.length === 0) return ''
  if (levels.length === 1) return `lv.${levels[0]}`
  const [first, ...rest] = levels
  if (rest.length === 1) return `lv.${first}, scales at lv.${rest[0]}`
  const last = rest[rest.length - 1]
  const middle = rest.slice(0, -1).map(l => `lv.${l}`).join(', ')
  return `lv.${first}, scales at ${middle} and lv.${last}`
}
