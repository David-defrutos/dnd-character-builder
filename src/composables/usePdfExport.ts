import { ref } from 'vue'
import { PDFDocument } from 'pdf-lib'
import { useCharacterStore } from '@/stores/character'
import type { CharacterData } from '@/stores/character'
import { getDnd2024FieldMapping } from '@/utils/pdfFieldMapping'
import { appendCharacterAppendix } from '@/utils/pdfAppendix'
import { normalizeSpellFieldFonts } from '@/utils/pdfFontNormalize'

export function usePdfExport() {
  const exporting = ref(false)

  /**
   * Export a character to PDF.
   * - Call with no args (or from @click) to export the current store character.
   * - Call exportPdfFor(charData) to export an arbitrary CharacterData.
   */
  async function exportPdf() {
    const characterStore = useCharacterStore()
    return _doExport(characterStore.character)
  }

  async function exportPdfFor(charData: CharacterData) {
    return _doExport(charData)
  }

  async function _doExport(char: CharacterData) {
    exporting.value = true

    try {
      // Brancalonia uses its own (Italian) sheet; everything else uses the
      // official 2024 D&D 5.5 form-fillable sheet.
      const base = import.meta.env.BASE_URL
      const pdfUrl = `${base}pdf/dnd-2024-sheet.pdf`

      const pdfResponse = await fetch(pdfUrl)
      if (!pdfResponse.ok) {
        throw new Error(`No se encontró la plantilla PDF: ${pdfUrl} (${pdfResponse.status})`)
      }
      const pdfBytes = await pdfResponse.arrayBuffer()
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const form = pdfDoc.getForm()

      // #120: corrige inconsistencia de la plantilla oficial 2024 — la fila 2
      // (y parcialmente la 1, 3, 4, 5) tiene /DA apuntando a LibreBaskerville
      // que no está embedido en el PDF; los visores caen a un fallback con
      // métrica distinta y la fuente sale visiblemente más grande. Forzamos
      // QuattrocentoSans,Bold en todos los campos textuales de spells.
      normalizeSpellFieldFonts(pdfDoc)

      const fieldMapping = getDnd2024FieldMapping(char)

      const MAX_FIELD_LENGTH = 1000

      // Campos que necesitan font size reducido cuando tienen mucho contenido
      const COMPACT_FIELDS = new Set([
        'ClassFeatures_L', 'ClassFeatures_R', 'Feats', 'Species_Traits',
        'Languages', 'Weapon_Prof', 'Tool_Prof', 'Features and Traits',
        'Weapon1_Name', 'Weapon2_Name', 'Weapon3_Name',
        'Weapon4_Name', 'Weapon5_Name', 'Weapon6_Name',
      ])

      function autoFontSize(text: string, fieldName: string): number {
        if (!COMPACT_FIELDS.has(fieldName)) return 9
        const lines = text.split('\n').length
        const chars = text.length
        if (chars > 300 || lines > 15) return 5
        if (chars > 150 || lines > 8)  return 6
        if (chars > 80  || lines > 5)  return 7
        if (chars > 40  || lines > 3)  return 8
        return 9
      }

      const skippedFields: string[] = []
      for (const [fieldName, value] of Object.entries(fieldMapping)) {
        try {
          if (typeof value === 'boolean') {
            if (value) {
              const checkbox = form.getCheckBox(fieldName)
              checkbox.check()
            }
          } else if (value) {
            const textField = form.getTextField(fieldName)
            const text = String(value)
            const truncated = text.length > MAX_FIELD_LENGTH ? text.slice(0, MAX_FIELD_LENGTH) : text
            textField.setText(truncated)
            // Aplicar font size automático para evitar desbordamiento (#36)
            try {
              textField.setFontSize(autoFontSize(truncated, fieldName))
            } catch { /* algunos campos no aceptan setFontSize */ }
          }
        } catch {
          skippedFields.push(fieldName)
        }
      }
      if (skippedFields.length > 0) {
        console.warn(`PDF export: ${skippedFields.length} field(s) not found in template:`, skippedFields)
      }

      // #58: añadir página(s) de anexo con descripciones completas.
      await appendCharacterAppendix(pdfDoc, char)

      const filledPdfBytes = await pdfDoc.save()
      const blob = new Blob([filledPdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${char.name || 'character'}-sheet.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('PDF export failed:', error)
      alert('Errore durante l\'esportazione del PDF. Riprova.')
    } finally {
      exporting.value = false
    }
  }

  return { exportPdf, exportPdfFor, exporting }
}
