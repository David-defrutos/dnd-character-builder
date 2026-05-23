// #120 — Tests del normalizador de fuentes en filas spell del PDF oficial.
//
// La plantilla oficial 2024 de WotC tiene inconsistencias en /DA (Default
// Appearance): filas 1-5 contienen algunas celdas con LibreBaskerville-Bold
// en vez del estándar QuattrocentoSans,Bold. La función
// normalizeSpellFieldFonts() debe sobreescribir TODAS las celdas con el DA
// canónico.

import { describe, it, expect, beforeAll } from 'vitest'
import { PDFDocument, PDFName } from 'pdf-lib'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeSpellFieldFonts, CANONICAL_SPELL_DA } from './pdfFontNormalize'

const PDF_PATH = resolve(process.cwd(), 'public/pdf/dnd-2024-sheet.pdf')

let pdfBytes: Uint8Array

beforeAll(() => {
  // readFileSync devuelve un Buffer; convertirlo a Uint8Array (vitest browser
  // environment no acepta Buffer directamente en pdf-lib).
  const buf = readFileSync(PDF_PATH)
  pdfBytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
})

async function loadFreshPdf(): Promise<PDFDocument> {
  return await PDFDocument.load(pdfBytes)
}

function daOf(doc: PDFDocument, fieldName: string): string | null {
  const form = doc.getForm()
  const field = form.getFieldMaybe(fieldName)
  if (!field) return null
  const da = field.acroField.dict.get(PDFName.of('DA'))
  return da ? da.toString() : null
}

describe('#120 — normalizeSpellFieldFonts', () => {
  it('PDF base TIENE el bug: SName_2 usa LibreBaskerville', async () => {
    const doc = await loadFreshPdf()
    const da = daOf(doc, 'SName_2')
    expect(da).toContain('LibreBaskerville')
  })

  it('PDF base TIENE el bug: SLevel_3 usa LibreBaskerville', async () => {
    const doc = await loadFreshPdf()
    const da = daOf(doc, 'SLevel_3')
    expect(da).toContain('LibreBaskerville')
  })

  it('tras normalizar, SName_2 usa QuattrocentoSans (DA canónica)', async () => {
    const doc = await loadFreshPdf()
    normalizeSpellFieldFonts(doc)
    const da = daOf(doc, 'SName_2')
    expect(da).toContain('QuattrocentoSans')
    expect(da).not.toContain('LibreBaskerville')
  })

  it('tras normalizar, TODOS los SName_1..30 usan la DA canónica', async () => {
    const doc = await loadFreshPdf()
    normalizeSpellFieldFonts(doc)
    for (let n = 1; n <= 30; n++) {
      const da = daOf(doc, `SName_${n}`)
      expect(da, `SName_${n} debería usar la DA canónica`).toContain('QuattrocentoSans')
    }
  })

  it('tras normalizar, las 5 subcolumnas spell de todas las filas están homogéneas', async () => {
    const doc = await loadFreshPdf()
    normalizeSpellFieldFonts(doc)
    const subs = ['SLevel', 'SName', 'STime', 'SRange', 'SNotes']
    for (let n = 1; n <= 30; n++) {
      for (const sub of subs) {
        const da = daOf(doc, `${sub}_${n}`)
        expect(da, `${sub}_${n} DA`).toContain('QuattrocentoSans')
      }
    }
  })

  it('devuelve la lista de campos actualizados (30 filas × 5 subcampos = 150)', async () => {
    const doc = await loadFreshPdf()
    const updated = normalizeSpellFieldFonts(doc)
    expect(updated.length).toBe(150)
    expect(updated).toContain('SName_2')
    expect(updated).toContain('STime_1')
  })

  it('CANONICAL_SPELL_DA es la cadena esperada', () => {
    expect(CANONICAL_SPELL_DA).toBe('/QuattrocentoSans,Bold 0 Tf 0 g')
  })

  it('idempotente: aplicar dos veces no rompe nada', async () => {
    const doc = await loadFreshPdf()
    normalizeSpellFieldFonts(doc)
    normalizeSpellFieldFonts(doc)
    const da = daOf(doc, 'SName_2')
    expect(da).toContain('QuattrocentoSans')
  })
})
