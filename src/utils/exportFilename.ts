/**
 * Genera el nombre de archivo por defecto al exportar un personaje a JSON (#98).
 *
 * Formato: "Nombre - clase - lvXX - AAAA-MM-DD-HH24MI.json"
 * Ejemplo: "Cecino - fighter - lv10 - 2026-05-21-2048.json"
 *
 * Si falta algún dato, usa fallbacks:
 *   - Sin nombre → "character"
 *   - Sin clase → omite el segmento
 *   - El nivel siempre se incluye con padding de 2 dígitos (lv01, lv10).
 */

import type { CharacterData } from '@/stores/character'

/** Sanea un string para que sea válido como parte de un nombre de archivo. */
function sanitizeForFilename(s: string): string {
  // Quita caracteres prohibidos en filenames de Windows/macOS/Linux.
  // Mantiene espacios y guiones; reemplaza el resto por '_'.
  return s.replace(/[\\/:*?"<>|]/g, '_').trim()
}

/** Timestamp local AAAA-MM-DD-HHMM (no UTC). */
function timestampNow(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}-${hh}${mm}`
}

export function buildExportFilename(char: CharacterData, now = new Date()): string {
  const parts: string[] = []
  const name = sanitizeForFilename(char.name || 'character')
  parts.push(name)

  if (char.className) {
    parts.push(sanitizeForFilename(char.className))
  }

  const lvl = String(char.level ?? 1).padStart(2, '0')
  parts.push(`lv${lvl}`)

  parts.push(timestampNow(now))

  return parts.join(' - ') + '.json'
}
