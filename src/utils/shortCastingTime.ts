/**
 * #159 — Abrevia la cadena castingTime del catálogo para encajarla en el
 * campo `STime_N` del formulario PDF, que es estrecho y aplica auto-shrink
 * agresivo con cualquier cosa más larga de ~7 caracteres.
 *
 * El checkbox `SR_N` (Ritual) se sigue marcando aparte en pdfFieldMapping
 * cuando la castingTime original contiene "Ritual", así que la información
 * de ritual NO se pierde aunque la quitemos del texto visible.
 *
 * Transformaciones acordadas:
 *   "Action"               → "Action"      (sin cambio, cabe)
 *   "Action or Ritual"     → "Action"      (la R va en checkbox)
 *   "Bonus Action"         → "Bonus"
 *   "Reaction"             → "Reaction"    (sin cambio, cabe)
 *   "1 minute"             → "1 min"
 *   "1 minute or Ritual"   → "1 min"       (la R va en checkbox)
 *   "10 minutes"           → "10 min"
 *   "1 hour"               → "1 h"
 *   "8 hours"              → "8 h"
 *
 * Para cualquier cadena que no encaje con un patrón conocido, devuelve el
 * original sin tocar (mejor que estropearlo silenciosamente). El usuario
 * verá el auto-shrink solo en casos que aún no contemplamos.
 */
export function shortCastingTime(s: string): string {
  if (!s) return s

  // Limpia el sufijo "or Ritual" — el checkbox lo recoge aparte.
  const withoutRitual = s.replace(/\s+or\s+Ritual\s*$/i, '').trim()

  // Patrones cortos: "Bonus Action" → "Bonus"
  if (/^Bonus\s+Action$/i.test(withoutRitual)) return 'Bonus'

  // Minutos: "N minute" / "N minutes" → "N min"
  const minMatch = withoutRitual.match(/^(\d+)\s+minutes?$/i)
  if (minMatch) return `${minMatch[1]} min`

  // Horas: "N hour" / "N hours" → "N h"
  const hourMatch = withoutRitual.match(/^(\d+)\s+hours?$/i)
  if (hourMatch) return `${hourMatch[1]} h`

  // Action, Reaction y todo lo demás corto se queda como está.
  return withoutRitual
}
