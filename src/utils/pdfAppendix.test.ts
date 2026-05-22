// Documento generado el 2026-05-20-2020 — milestone 22 (#58)
//
// Tests del módulo pdfAppendix. No podemos extraer texto fácilmente con
// pdf-lib, así que comprobamos que:
//   - La función ejecuta sin lanzar con datos típicos (varios escenarios).
//   - Añade al menos una página al documento.
//   - Genera bytes PDF válidos al guardar.
//   - Acepta sin error características avanzadas (subrace, speciesChoices,
//     magic items, weapons, feats elegidos).

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { appendCharacterAppendix } from '@/utils/pdfAppendix'
import { preloadVariantData } from '@/data'
import type { CharacterData } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

async function newBlankPdf(): Promise<PDFDocument> {
  const pdf = await PDFDocument.create()
  pdf.addPage([612, 792]) // simula la hoja existente
  return pdf
}

describe('Milestone 22 — PDF appendix sheet (#58)', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => setActivePinia(createPinia()))

  it('añade al menos una página al PDF', async () => {
    const pdf = await newBlankPdf()
    const initial = pdf.getPageCount()
    const char = freshChar()
    char.name = 'Test Hero'
    await appendCharacterAppendix(pdf, char)
    expect(pdf.getPageCount()).toBeGreaterThan(initial)
  })

  it('no peta con un personaje vacío', async () => {
    const pdf = await newBlankPdf()
    const char = freshChar()
    await expect(appendCharacterAppendix(pdf, char)).resolves.not.toThrow()
  })

  it('genera bytes PDF válidos al guardar tras el append', async () => {
    const pdf = await newBlankPdf()
    const char = freshChar()
    char.name = 'Cecino'
    await appendCharacterAppendix(pdf, char)
    const bytes = await pdf.save()
    // Cabecera PDF estándar: %PDF-
    expect(bytes.length).toBeGreaterThan(100)
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('procesa un personaje con clase + subclase sin error', async () => {
    const pdf = await newBlankPdf()
    const char = freshChar()
    char.name = 'Aelar'
    char.className = 'fighter'
    char.subclass = 'echo-knight'
    char.level = 5
    await expect(appendCharacterAppendix(pdf, char)).resolves.not.toThrow()
  })

  it('procesa un Dragonborn con Draconic Ancestry (speciesChoices)', async () => {
    const pdf = await newBlankPdf()
    const char = freshChar()
    char.name = 'Drak'
    char.race = 'dragonborn'
    char.speciesChoices = { 'draconic-ancestry': 'red' }
    await expect(appendCharacterAppendix(pdf, char)).resolves.not.toThrow()
  })

  it('procesa armas equipadas — añade sección Weapon Attacks', async () => {
    const pdf = await newBlankPdf()
    const char = freshChar()
    char.name = 'Cecino'
    char.level = 10
    char.abilityScores.dex = 16
    char.proficienciesOther = ['Simple weapons', 'Martial weapons']
    char.inventory = [
      { slotId: 'w1', kind: 'weapon', itemId: 'hand-crossbow', name: 'Hand Crossbow', qty: 1 },
      { slotId: 'w2', kind: 'magic', itemId: 'hand-crossbow-1', name: 'Hand Crossbow +1', qty: 1 },
    ]
    const before = pdf.getPageCount()
    await appendCharacterAppendix(pdf, char)
    expect(pdf.getPageCount()).toBeGreaterThan(before)
  })

  it('procesa magic items del inventory sin error', async () => {
    const pdf = await newBlankPdf()
    const char = freshChar()
    char.inventory = [
      { slotId: 'i1', kind: 'magic', itemId: 'bag-of-holding', name: 'Bag of Holding', qty: 1 },
    ]
    await expect(appendCharacterAppendix(pdf, char)).resolves.not.toThrow()
  })

  it('procesa ASI feats elegidos sin error', async () => {
    const pdf = await newBlankPdf()
    const char = freshChar()
    char.asiChoices = [
      { level: 4, type: 'feat', featId: 'tough' },
      { level: 8, type: 'feat', featId: 'speedy', featAbility: 'dex' },
    ]
    await expect(appendCharacterAppendix(pdf, char)).resolves.not.toThrow()
  })

  it('caso completo: clase + raza + feats + armas + magic items', async () => {
    const pdf = await newBlankPdf()
    const char = freshChar()
    char.name = 'Full Test'
    char.className = 'fighter'
    char.subclass = 'echo-knight'
    char.level = 10
    char.race = 'dragonborn'
    char.speciesChoices = { 'draconic-ancestry': 'red' }
    char.abilityScores.dex = 16
    char.proficienciesOther = ['Martial weapons']
    char.asiChoices = [
      { level: 4, type: 'feat', featId: 'tough' },
    ]
    char.inventory = [
      { slotId: 'w1', kind: 'magic', itemId: 'longsword-1', name: 'Longsword +1', qty: 1 },
    ]
    const before = pdf.getPageCount()
    await appendCharacterAppendix(pdf, char)
    expect(pdf.getPageCount()).toBeGreaterThan(before)
    const bytes = await pdf.save()
    expect(bytes.length).toBeGreaterThan(500)
  })
})
