// Script one-off: normaliza la plantilla base public/pdf/dnd-2024-sheet.pdf
// para que las DAs (/DA) de los campos spell apunten a QuattrocentoSans,Bold
// (en vez de LibreBaskerville-Bold no embedida) DIRECTAMENTE en el archivo,
// no en runtime.
//
// Justificación: el runtime (normalizeSpellFieldFonts en usePdfExport.ts)
// funciona en pdf-lib pero algunos visores externos siguen cacheando o
// recalculando los DAs desde el original, mostrando la fuente rota en filas
// 1-5. Persistir el fix en el archivo base elimina la dependencia del
// comportamiento del visor.
//
// Idempotente: aplicar este script varias veces no rompe nada.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFDocument, PDFName } from 'pdf-lib'
import { normalizeSpellFieldFonts, CANONICAL_SPELL_DA } from '../src/utils/pdfFontNormalize'

async function main() {
  const path = resolve(process.cwd(), 'public/pdf/dnd-2024-sheet.pdf')
  console.log(`Leyendo ${path}…`)
  const buf = readFileSync(path)
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  const doc = await PDFDocument.load(bytes)

  console.log(`Aplicando normalización de DAs (canónica: ${CANONICAL_SPELL_DA})…`)
  const updated = normalizeSpellFieldFonts(doc)
  console.log(`Campos actualizados: ${updated.length} (esperado: 150 = 30 filas × 5 subcampos)`)

  // Verificación: el DA de SName_2 (el peor caso del bug) debe ser canónico.
  const form = doc.getForm()
  const sname2 = form.getFieldMaybe('SName_2')
  if (sname2) {
    const da = sname2.acroField.dict.get(PDFName.of('DA'))
    console.log(`SName_2 /DA tras normalizar: ${da?.toString()}`)
  }

  console.log('Guardando…')
  const saved = await doc.save({ useObjectStreams: false })
  writeFileSync(path, saved)
  console.log(`OK. Nuevo tamaño: ${saved.length} bytes.`)
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
