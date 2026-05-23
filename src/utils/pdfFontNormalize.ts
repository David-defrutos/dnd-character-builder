/**
 * #120 — Normaliza la /DA (Default Appearance) de los campos spell del PDF
 * oficial 2024 de WotC. La plantilla original tiene una inconsistencia: las
 * filas 1..5 contienen algunas celdas con `/LibreBaskerville-Bold` en vez del
 * estándar `/QuattrocentoSans,Bold`. Como Libre Baskerville NO está embedido
 * en el PDF, los visores caen a un fallback con métrica distinta y la fuente
 * se ve descomunalmente grande (ej. "vicious-mockery" en SName_2 sale ~2x el
 * tamaño esperado).
 *
 * Filas afectadas en el PDF original:
 *   - Fila 1: STime_1, SRange_1
 *   - Fila 2: TODO (SLevel_2, SName_2, STime_2, SRange_2, SNotes_2)
 *   - Filas 3, 4, 5: SLevel_N
 *   - Filas 6-30: correctas (no requieren normalización).
 *
 * Estrategia: tras `pdfDoc.getForm()` y ANTES de rellenar, sobrescribir el
 * /DA de TODOS los campos `S(Level|Name|Time|Range|Notes)_N` (N=1..30) con
 * el DA canónico. Aplicarlo a todos (no solo a los rotos) es idempotente y
 * defensivo: si WotC actualiza la plantilla y rompe más filas, seguimos OK.
 *
 * No tocamos los checkboxes (SC_N, SR_N, SM_N) — no llevan font de texto.
 */

import { PDFDocument, PDFName, PDFString } from 'pdf-lib'

/** Default Appearance estándar usada por la mayoría de campos spell. */
const CANONICAL_DA = '/QuattrocentoSans,Bold 0 Tf 0 g'

/** Subcampos textuales por fila de la tabla de spells. */
const SPELL_TEXT_SUBFIELDS = ['SLevel', 'SName', 'STime', 'SRange', 'SNotes'] as const

/** Número de filas en la tabla de spells del PDF oficial 2024. */
const SPELL_ROW_COUNT = 30

/**
 * Sobrescribe el /DA de todos los campos textuales de la tabla de spells.
 * Devuelve la lista de nombres de campo que se actualizaron (útil para
 * tests de regresión y warnings).
 */
export function normalizeSpellFieldFonts(pdfDoc: PDFDocument): string[] {
  const form = pdfDoc.getForm()
  const updated: string[] = []

  for (let n = 1; n <= SPELL_ROW_COUNT; n++) {
    for (const sub of SPELL_TEXT_SUBFIELDS) {
      const name = `${sub}_${n}`
      const field = form.getFieldMaybe(name)
      if (!field) continue
      try {
        // pdf-lib expone field.acroField.dict — escribimos directamente la DA.
        // Pasamos PDFString.of(CANONICAL_DA) para que pdf-lib serialice como
        // literal string (entre paréntesis), igual que la plantilla original.
        field.acroField.dict.set(PDFName.of('DA'), PDFString.of(CANONICAL_DA))
        updated.push(name)
      } catch {
        // Si por lo que sea no se puede escribir (campo en formato exótico),
        // lo saltamos: peor caso, esa celda se verá con su font roto, pero
        // el resto del PDF sigue rellenándose sin fallar.
      }
    }
  }

  return updated
}

/** Exportado para tests: la DA canónica usada por la normalización. */
export const CANONICAL_SPELL_DA = CANONICAL_DA
