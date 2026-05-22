// #110 — Helper genérico para dibujar TABLAS en el PDF anexo (Detailed
// Reference). Tipografía uniforme (BODY_SIZE en todas las celdas, ni
// cabeceras ni negritas), anchos de columna fijos, wrapping en la última
// columna. Se usa en CLASS FEATURES, FEATS y WEAPON ATTACKS.
//
// Diseño:
//   - Cabecera: misma fuente que las filas pero en negrita.
//   - Filas: separadas por un pequeño gap. La última columna hace word-wrap
//     y empuja la altura de la fila.
//   - Sin bordes ni rayas: solo el espaciado guía la lectura.
//
// Las medidas (LINE_HEIGHT, BODY_SIZE, etc.) se pasan como parámetro para
// que pdfAppendix.ts las reutilice de sus propias constantes sin duplicar.

import type { PDFFont, PDFPage } from 'pdf-lib'
import { rgb } from 'pdf-lib'

const COLOR_BODY = rgb(0.10, 0.10, 0.10)
const COLOR_HEADER = rgb(0.30, 0.30, 0.30)

export interface TableColumn {
  /** Cabecera de la columna (ej: "Nivel", "Nombre", "Descripción"). */
  header: string
  /** Ancho fijo en puntos. Si la suma excede contentWidth, el caller lo gestiona. */
  width: number
  /** Alineación horizontal del texto dentro de la celda. */
  align?: 'left' | 'right' | 'center'
}

export interface TableRow {
  /** Una celda por columna, en el mismo orden que las columnas declaradas.
   *  El número de cells debe coincidir con columns.length. */
  cells: string[]
}

export interface TableLayout {
  size: number
  lineHeight: number
  font: PDFFont
  fontBold: PDFFont
  marginX: number
  rowGap: number
  cellPaddingX: number
}

/** Word-wrap a string to fit within maxWidth (replicado de pdfAppendix
 *  para no crear dependencia circular). */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = (text ?? '').split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(trial, size) > maxWidth) {
      if (current) lines.push(current)
      // Si una sola palabra excede, la dejamos overflow (raro).
      current = word
    } else {
      current = trial
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Posición X relativa al inicio de la columna para alinear el texto. */
function textX(text: string, colX: number, colW: number, align: 'left'|'right'|'center', font: PDFFont, size: number): number {
  if (align === 'left') return colX
  const tw = font.widthOfTextAtSize(text, size)
  if (align === 'right') return colX + colW - tw
  return colX + (colW - tw) / 2
}

/**
 * Dibuja la fila de cabeceras y devuelve la nueva Y (debajo del header).
 */
export function drawTableHeader(
  page: PDFPage,
  y: number,
  columns: readonly TableColumn[],
  layout: TableLayout,
): number {
  let cx = layout.marginX
  for (const col of columns) {
    const align = col.align ?? 'left'
    const x = textX(col.header, cx + layout.cellPaddingX, col.width - 2 * layout.cellPaddingX, align, layout.fontBold, layout.size)
    page.drawText(col.header, {
      x, y,
      size: layout.size,
      font: layout.fontBold,
      color: COLOR_HEADER,
    })
    cx += col.width
  }
  return y - layout.lineHeight - layout.rowGap
}

/**
 * Dibuja una fila. La última columna hace word-wrap y devuelve su altura
 * (en líneas). Las demás columnas se dibujan en la PRIMERA línea de esa
 * altura. Devuelve la nueva Y tras la fila.
 *
 * El caller debe asegurarse de tener espacio (ensureSpace en pdfAppendix).
 */
export function drawTableRow(
  page: PDFPage,
  y: number,
  row: TableRow,
  columns: readonly TableColumn[],
  layout: TableLayout,
): number {
  // #114: word-wrap en TODAS las columnas, no solo la última. Antes solo
  // hacía wrap la columna de descripción y las demás se dibujaban en una
  // línea: si el contenido (ej. "Magic Initiate (Cleric: Guidance ...)")
  // excedía el ancho de su columna, se metía físicamente sobre la columna
  // siguiente. La altura de la fila se determina por la columna con más
  // líneas; el resto deja blanco abajo.

  // 1. Word-wrap por columna.
  const wrappedCells: string[][] = columns.map((col, i) => {
    const cellW = col.width - 2 * layout.cellPaddingX
    return wrap(row.cells[i] ?? '', layout.font, layout.size, cellW)
  })

  // 2. Altura de la fila = máximo nº de líneas entre todas las celdas.
  const rowHeightLines = Math.max(1, ...wrappedCells.map(lines => lines.length))

  // 3. Dibujar cada celda alineada arriba (línea 0 en y, siguientes hacia abajo).
  let cx = layout.marginX
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    if (!col) continue
    const cellW = col.width - 2 * layout.cellPaddingX
    const align = col.align ?? 'left'
    const lines = wrappedCells[i] ?? ['']
    for (let li = 0; li < lines.length; li++) {
      const text = lines[li] ?? ''
      const x = textX(text, cx + layout.cellPaddingX, cellW, align, layout.font, layout.size)
      page.drawText(text, {
        x, y: y - li * layout.lineHeight,
        size: layout.size,
        font: layout.font,
        color: COLOR_BODY,
      })
    }
    cx += col.width
  }
  return y - rowHeightLines * layout.lineHeight - layout.rowGap
}

/**
 * Estima el alto que tendrá una fila para poder llamar a ensureSpace
 * ANTES de empezar a dibujarla (y así evitar cortar filas a medio camino).
 * Devuelve el número de LÍNEAS que ocupará (máximo entre todas las celdas
 * tras word-wrap, no solo la última columna — #114).
 */
export function estimateRowLines(
  row: TableRow,
  columns: readonly TableColumn[],
  layout: TableLayout,
): number {
  let maxLines = 1
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    if (!col) continue
    const cellW = col.width - 2 * layout.cellPaddingX
    const lines = wrap(row.cells[i] ?? '', layout.font, layout.size, cellW)
    if (lines.length > maxLines) maxLines = lines.length
  }
  return maxLines
}
