// Documento generado el 2026-05-20-2020 — milestone 22 (#58 PDF appendix sheet)
//
// Adds extra pages to the character PDF with full-length descriptions that
// don't fit in the AcroForm fields of the official 2024 sheet:
//   - Class Features (and subclass features)
//   - Species Traits + speciesChoices (e.g. Draconic Ancestry: Red — Fire)
//   - Feats (origin + selected ASI feats)
//   - Magic items from the inventory
//   - Per-weapon attack/damage formula (mod + PB + magic)
//
// Pages are added at the end of the existing PDF, so the user keeps a single
// downloadable file. Plain text only — no styling, fonts limited to Helvetica.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { CharacterData } from '@/stores/character'
import { getClassById } from '@/data/dnd5e/classes'
import { getRaceById } from '@/data/dnd5e/races'
import { getFeatById, feats as allFeats } from '@/data/dnd5e/feats'
import { getMagicItemById } from '@/data/dnd5e/magic-items'
import { spells as allSpells } from '@/data/dnd5e/spells'
import { computeWeaponAttack } from './weaponCalc'
import { getLimitedResources } from './resourceUsage'
import { getScalingLevels } from './featureScaling'
import { sanitizeMasteries, getMasteryFor } from './weaponMastery'
import { masteryDescriptions, armor as dnd5eArmorCatalogue } from '@/data/dnd5e/equipment'
import {
  drawTableHeader, drawTableRow, estimateRowLines,
  type TableColumn, type TableRow, type TableLayout,
} from './pdfTable'
import { computeAbilityBreakdown } from './abilityScoreBreakdown'
import { computeAcBreakdown } from './armorClassBreakdown'
import {
  describeAsiFeatChoice, describeOriginFeatChoice, describeFightingStyle,
} from './featChoiceDescription'
import {
  fmtMod,
  computeSavingThrows, computeHitPointsBreakdown, computeMiscellaneous,
  computeSpellcastingCalculations, computeSpellSlots, computeCarryingCapacity,
} from './detailedReferenceCalc'
import { computeCurrentLoad } from './carryingLoad'

// ─── Layout constants ─────────────────────────────────────────────────────
// Las dimensiones de página por defecto (US Letter). El PDF oficial 2024 de
// WotC usa 603x774, así que appendCharacterAppendix() las sobreescribe en
// runtime con las del PDF base — si no, el visor reescala para encajar
// ambos tamaños y la letra del anexo se ve más pequeña de lo previsto.
let PAGE_WIDTH = 612 // US Letter (overridden en appendCharacterAppendix)
let PAGE_HEIGHT = 792
const MARGIN_X = 40
const MARGIN_TOP = 40
const MARGIN_BOTTOM = 40
function contentWidth() { return PAGE_WIDTH - MARGIN_X * 2 }

// Tipografía — afinada en #77 para mejorar legibilidad sin sobrepasar
// las dimensiones de las hojas oficiales (603x774).
const SECTION_HEADER_SIZE = 13
// #114: bajado de 11 a 9 para que los subheaders (Gnomish Cunning, nombre
// del feat en MAGIC INITIATE, nombres de magic items...) no salgan más
// grandes que su descripción. Conserva la negrita y el color gris oscuro.
const SUBSECTION_HEADER_SIZE = 9
const BODY_SIZE = 9
const LINE_HEIGHT = 12      // antes 11: un poco más de aire entre líneas
const SECTION_GAP_TOP = 12  // espacio extra antes de cada SECTION_HEADER
const SECTION_GAP_BOTTOM = 8 // espacio tras la underline antes del primer item
const ITEM_GAP = 6          // gap entre items del mismo grupo (feature, feat...)
const PARAGRAPH_GAP = 3     // gap interno entre párrafos del mismo item

const COLOR_HEADER = rgb(0.45, 0.10, 0.10) // dark red — matches sheet header
const COLOR_BODY = rgb(0.10, 0.10, 0.10)
const COLOR_SUBHEADER = rgb(0.20, 0.20, 0.20)
const COLOR_DIVIDER = rgb(0.75, 0.75, 0.75) // light grey dividers entre items

// ─── Drawing helpers ──────────────────────────────────────────────────────

/** Internal state passed between drawing steps. */
interface DrawState {
  pdf: PDFDocument
  page: PDFPage
  font: PDFFont
  fontBold: PDFFont
  y: number
}

function newPage(state: DrawState): void {
  state.page = state.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  state.y = PAGE_HEIGHT - MARGIN_TOP
}

/** Word-wrap a string to fit within `maxWidth` at the given font/size. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const candidate = current ? current + ' ' + w : w
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current)
      current = w
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Replace characters that StandardFonts.Helvetica can't encode (anything
 * outside WinAnsi / Latin-1). pdf-lib otherwise throws "WinAnsi cannot encode".
 */
function sanitize(text: string): string {
  if (!text) return ''
  return text
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/—|–/g, '-')
    .replace(/…/g, '...')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, '*')
    .replace(/×/g, 'x')
    // Strip any remaining non-Latin1 characters as a last resort.
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, '?')
}

function ensureSpace(state: DrawState, neededLines: number): void {
  const need = neededLines * LINE_HEIGHT
  if (state.y - need < MARGIN_BOTTOM) newPage(state)
}

function drawSectionHeader(state: DrawState, label: string): void {
  ensureSpace(state, 4)
  state.y -= SECTION_GAP_TOP
  const titleBaseline = state.y
  state.page.drawText(sanitize(label), {
    x: MARGIN_X, y: titleBaseline, size: SECTION_HEADER_SIZE,
    font: state.fontBold, color: COLOR_HEADER,
  })
  // #86: en la versión anterior la línea se dibujaba muy pegada al título
  // (~2pt bajo el baseline) y dejaba ~8pt al siguiente contenido, generando
  // un desbalance visual obvio. Ahora la centramos verticalmente entre el
  // descender del título (≈ baseline - 3) y el baseline del siguiente
  // subheader (≈ titleBaseline - SECTION_HEADER_SIZE - SECTION_GAP_BOTTOM).
  // Posición ideal de la línea: titleBaseline - (SECTION_HEADER_SIZE/2 + 1).
  const lineY = titleBaseline - (SECTION_HEADER_SIZE / 2) - 1
  state.page.drawLine({
    start: { x: MARGIN_X, y: lineY },
    end:   { x: PAGE_WIDTH - MARGIN_X, y: lineY },
    thickness: 1,
    color: COLOR_HEADER,
  })
  // Cursor final: justo donde estaría tras el título + gap, sin tocar la línea
  state.y = titleBaseline - SECTION_HEADER_SIZE - SECTION_GAP_BOTTOM
}

function drawSubheader(state: DrawState, label: string): void {
  ensureSpace(state, 2)
  state.page.drawText(sanitize(label), {
    x: MARGIN_X, y: state.y, size: SUBSECTION_HEADER_SIZE,
    font: state.fontBold, color: COLOR_SUBHEADER,
  })
  // #114: gap = font size + 3 (antes era +2). Como ahora el subheader es
  // tamaño body, necesita un poco más de aire para distinguirse visualmente
  // de la descripción que lo sigue.
  state.y -= SUBSECTION_HEADER_SIZE + 3
}

function drawBody(state: DrawState, text: string): void {
  if (!text) return
  const paragraphs = text.split('\n')
  for (const p of paragraphs) {
    const lines = wrap(p, state.font, BODY_SIZE, contentWidth())
    for (const line of lines) {
      ensureSpace(state, 1)
      state.page.drawText(line, {
        x: MARGIN_X, y: state.y, size: BODY_SIZE,
        font: state.font, color: COLOR_BODY,
      })
      state.y -= LINE_HEIGHT
    }
  }
  state.y -= PARAGRAPH_GAP
}

/** Espacio entre items del mismo grupo (feature, feat, magic item...). */
function drawItemGap(state: DrawState): void {
  state.y -= ITEM_GAP
}

// ─── Table helpers (#110) ────────────────────────────────────────────────
// Layout fijo: tipografía uniforme (BODY_SIZE) en toda la tabla, sólo la
// cabecera va en negrita; sin bordes ni rayas; gap entre filas pequeño.

function tableLayout(state: DrawState): TableLayout {
  return {
    size: BODY_SIZE,
    lineHeight: LINE_HEIGHT,
    font: state.font,
    fontBold: state.fontBold,
    marginX: MARGIN_X,
    rowGap: 2,
    cellPaddingX: 2,
  }
}

/**
 * Dibuja una tabla completa (cabecera + filas) calculando espacio antes de
 * cada fila para no cortarlas a medio camino al saltar de página.
 *
 * Sanitiza todas las celdas (igual que drawBody/drawSubheader) para que la
 * fuente Helvetica/WinAnsi de pdf-lib no falle con caracteres unicode como
 * ≤, ≥, —, …, comillas tipográficas, etc.
 */
function drawTable(
  state: DrawState,
  columns: readonly TableColumn[],
  rows: readonly TableRow[],
): void {
  if (!rows.length) return
  const layout = tableLayout(state)
  // Sanitizar cabeceras y celdas para evitar errores de codificación.
  const sanitizedCols: TableColumn[] = columns.map(c => ({ ...c, header: sanitize(c.header) }))
  const sanitizedRows: TableRow[] = rows.map(r => ({
    cells: r.cells.map(c => sanitize(c ?? '')),
  }))
  // Cabecera
  ensureSpace(state, 2)
  state.y = drawTableHeader(state.page, state.y, sanitizedCols, layout)
  // Filas (cada una pide su propio espacio)
  for (const row of sanitizedRows) {
    const lines = estimateRowLines(row, sanitizedCols, layout)
    ensureSpace(state, lines)
    state.y = drawTableRow(state.page, state.y, row, sanitizedCols, layout)
  }
}

// ─── Section builders ─────────────────────────────────────────────────────

// ─── Ability Score breakdown (#109) ─────────────────────────────────────

/**
 * #109 — Tabla con el desglose de cada Ability Score por fuente.
 *   Columnas: Ability | Total | Sources (label + valor, separados por coma)
 * Si una ability solo tiene "Base", también se muestra para que la tabla
 * esté completa con las 6 abilities.
 */
function drawAbilityBreakdown(state: DrawState, char: CharacterData): void {
  const breakdown = computeAbilityBreakdown(char)
  if (!breakdown.length) return

  drawSectionHeader(state, 'Ability Scores')

  const w = contentWidth()
  // #114: columnas estrechas para Ability (3 letras) y Total (2 dígitos).
  const colAbility = 50
  const colTotal = 35
  const colSources = w - colAbility - colTotal

  const columns: readonly TableColumn[] = [
    { header: 'Ability',  width: colAbility },
    { header: 'Total',    width: colTotal, align: 'center' },
    { header: 'Sources',  width: colSources },
  ]
  const rows: TableRow[] = breakdown.map(b => {
    const sources = b.sources
      .map(s => s.label === 'Base' ? `Base ${s.value}` : `${s.label} ${s.value >= 0 ? '+' : ''}${s.value}`)
      .join(', ')
    return { cells: [b.ability.toUpperCase(), String(b.total), sources] }
  })

  drawTable(state, columns, rows)
}

// ─── Armor Class breakdown (#118) ────────────────────────────────────────

/**
 * #118 — Tabla con el desglose del AC por fuente. Solo se dibuja si el PJ
 * tiene items equipped en el inventario (sistema nuevo). Si usa el sistema
 * legacy (char.armor string), no se muestra esta tabla.
 *
 * Columnas: Source | Contribution
 *   "Studded Leather Armor (base)"       12
 *   "DEX modifier"                       +2
 *   "Cloak of Protection"                +1
 *   ────────────────────
 *   Total                                15
 */
function drawArmorClass(state: DrawState, char: CharacterData): void {
  // Calcular dex mod manualmente (el módulo necesita un número, no el char)
  const dexBase = char.abilityScores?.dex ?? 10
  const dexTotal = dexBase
    + (char.speciesBonuses?.dex ?? 0)
    + (char.backgroundBonuses?.dex ?? 0)
    + (char.asiBonuses?.dex ?? 0)
  const dexMod = Math.floor((dexTotal - 10) / 2)

  const breakdown = computeAcBreakdown(char, dexMod, dnd5eArmorCatalogue)
  if (!breakdown) return  // PJ usa sistema legacy

  drawSectionHeader(state, 'Armor Class')

  const w = contentWidth()
  const colSource = w - 80
  const colValue = 80

  const columns: readonly TableColumn[] = [
    { header: 'Source',       width: colSource },
    { header: 'Contribution', width: colValue, align: 'center' },
  ]
  const rows: TableRow[] = breakdown.sources.map(s => ({
    cells: [s.label, s.value >= 0 ? `+${s.value}` : String(s.value)],
  }))
  // Fila total (con tipografía algo distinta — la marcamos prefijando "Total")
  rows.push({ cells: ['Total', String(breakdown.total)] })

  drawTable(state, columns, rows)
}

function drawClassFeatures(state: DrawState, char: CharacterData): void {
  const cls = getClassById(char.className)
  if (!cls) return

  const featuresUpToLevel = cls.features.filter(f => f.level <= char.level)
  const subFeatures = char.subclass
    ? (cls.subclasses.find(s => s.id === char.subclass)?.features ?? [])
        .filter(f => f.level <= char.level)
    : []

  if (!featuresUpToLevel.length && !subFeatures.length) return
  drawSectionHeader(state, 'Class Features')

  // #110: tabla de 3 columnas. UNA FILA POR ESCALADO — si Action Surge
  // aparece en lv.2 y de nuevo en lv.17 (uso extra), serán 2 filas. Si la
  // feature no escala, una sola fila con su nivel base.
  type Row = { level: number; name: string; description: string; isSubclass: boolean }
  const rows: Row[] = []

  const allFeatures = [
    ...featuresUpToLevel.map(f => ({ ...f, isSubclass: false })),
    ...subFeatures.map(f => ({ ...f, isSubclass: true })),
  ]
  for (const f of allFeatures) {
    if (f.scalesWith && cls.progression?.[f.scalesWith]) {
      const scalingLevels = getScalingLevels(cls.progression[f.scalesWith], char.level)
      if (scalingLevels.length > 0) {
        // Una fila por nivel donde la feature aparece o escala.
        for (const lvl of scalingLevels) {
          rows.push({ level: lvl, name: f.name, description: f.description, isSubclass: f.isSubclass })
        }
        continue
      }
    }
    // Sin escalado: una sola fila.
    rows.push({ level: f.level, name: f.name, description: f.description, isSubclass: f.isSubclass })
  }

  // Ordenar por nivel ascendente; ties: subclass features después.
  rows.sort((a, b) => a.level - b.level || Number(a.isSubclass) - Number(b.isSubclass))

  // #114: columna Lv. estrecha (30pt para "20" cabe sobrado). El espacio
  // ahorrado va a la columna Description, que es la que más necesita.
  const w = contentWidth()
  const colLevel = 30
  const colName = Math.round((w - colLevel) * 0.32)
  const colDesc = w - colLevel - colName

  const columns: readonly TableColumn[] = [
    { header: 'Lv.',         width: colLevel },
    { header: 'Feature',     width: colName },
    { header: 'Description', width: colDesc },
  ]
  const tableRows: TableRow[] = rows.map(r => ({
    cells: [
      String(r.level),
      r.name + (r.isSubclass ? ' (sub)' : ''),
      r.description,
    ],
  }))

  drawTable(state, columns, tableRows)
}

function drawSpeciesTraits(state: DrawState, char: CharacterData): void {
  const race = char.race ? getRaceById(char.race) : undefined
  if (!race) return
  drawSectionHeader(state, 'Species Traits')

  const raceTraits = race.traits ?? []
  raceTraits.forEach((trait, idx) => {
    const colon = trait.indexOf(':')
    if (colon > 0) {
      drawSubheader(state, trait.slice(0, colon))
      drawBody(state, trait.slice(colon + 1).trim())
    } else {
      drawBody(state, trait)
    }
    if (idx < raceTraits.length - 1) drawItemGap(state)
  })

  // Subrace traits
  if (char.subrace) {
    const sub = race.subraces?.find(s => s.id === char.subrace)
    if (sub) {
      drawItemGap(state)
      drawSubheader(state, `Lineage: ${sub.name}`)
      for (const trait of sub.traits ?? []) drawBody(state, '• ' + trait)
    }
  }

  // Species choices (e.g. Dragonborn → Draconic Ancestry)
  if (race.choices?.length && char.speciesChoices) {
    for (const choice of race.choices) {
      const optId = char.speciesChoices[choice.id]
      if (!optId) continue
      const opt = choice.options.find(o => o.id === optId)
      if (!opt) continue
      drawItemGap(state)
      drawSubheader(state, choice.label)
      const detail = opt.details ? ` - ${opt.details}` : ''
      drawBody(state, `${opt.name}${detail}`)
    }
  }
}

function drawFeats(state: DrawState, char: CharacterData): void {
  // #107 + #110: tabla con columnas Nivel | Nombre (+ elección) | Descripción.
  // Origin feats van con nivel 0 (no se cogen en un ASI checkpoint).
  type Row = { level: number; displayName: string; description: string }
  const rows: Row[] = []
  const seenNames = new Set<string>()

  // ASI feats (level-up): nivel = el del checkpoint donde se eligió.
  for (const c of (char.asiChoices ?? [])) {
    if (c.type === 'feat' && c.featId) {
      const f = getFeatById(c.featId)
      if (!f) continue
      // Allow same feat twice if featAbility differs (Resilient (WIS) +
      // Resilient (DEX) son entradas distintas).
      const chosen = describeAsiFeatChoice(c, char)
      const key = chosen ? `${f.name}::${chosen}` : f.name
      if (seenNames.has(key)) continue
      seenNames.add(key)
      rows.push({
        level: c.level,
        displayName: chosen ? `${f.name} (${chosen})` : f.name,
        description: f.description,
      })
    }
  }

  // Origin feats: nivel 0. Vienen tageados en featuresTraits.
  for (const tag of (char.featuresTraits ?? [])) {
    const m = tag.match(/^(?:Origin Feat|Background Feat|Feat):\s*(.+?)(?:\s*\(.*\))?$/i)
    if (!m || !m[1]) continue
    const featName = m[1].trim()
    const f = allFeats.find(x => x.name === featName)
    if (!f) continue
    const chosen = describeOriginFeatChoice(f.id, char)
    const key = chosen ? `${f.name}::${chosen}` : f.name
    if (seenNames.has(key)) continue
    seenNames.add(key)
    rows.push({
      level: 0,
      displayName: chosen ? `${f.name} (${chosen})` : f.name,
      description: f.description,
    })
  }

  // Fighting Style feat (Fighter lv.1, Paladin lv.2, Ranger lv.2). Si el
  // jugador tiene 'archery' guardado, mostramos el nombre + efecto mecánico.
  if (char.fightingStyleFeat) {
    const f = getFeatById(char.fightingStyleFeat)
    if (f) {
      const chosen = describeFightingStyle(char.fightingStyleFeat)
      const key = `Fighting Style: ${f.name}`
      if (!seenNames.has(key)) {
        seenNames.add(key)
        // El nivel del Fighting Style depende de la clase: Fighter lv.1,
        // Paladin/Ranger lv.2. No tenemos ese dato aquí sin recargar la
        // clase; lo etiquetamos como lv.1 (es el caso más común y es
        // informativo, no funcional).
        rows.push({
          level: 1,
          displayName: `Fighting Style: ${f.name}` + (chosen ? ` (${chosen})` : ''),
          description: f.description,
        })
      }
    }
  }

  if (!rows.length) return
  drawSectionHeader(state, 'Feats')

  // Ordenar: origin (lv.0) primero, luego por nivel ASC.
  rows.sort((a, b) => a.level - b.level)

  const w = contentWidth()
  const colLevel = 30
  const colName = Math.round((w - colLevel) * 0.38)
  const colDesc = w - colLevel - colName

  const columns: readonly TableColumn[] = [
    { header: 'Lv.',         width: colLevel },
    { header: 'Feat',        width: colName },
    { header: 'Description', width: colDesc },
  ]
  const tableRows: TableRow[] = rows.map(r => ({
    cells: [String(r.level), r.displayName, r.description],
  }))

  drawTable(state, columns, tableRows)
}

function drawMagicItems(state: DrawState, char: CharacterData): void {
  const magic = (char.inventory ?? []).filter(i => i.kind === 'magic')
  if (!magic.length) return
  drawSectionHeader(state, 'Magic Items')
  magic.forEach((item, idx) => {
    const data = getMagicItemById(item.itemId)
    const attunedTag = item.attuned ? ' [attuned]' : ''
    drawSubheader(state, `${item.name}${attunedTag}`)
    if (data) drawBody(state, data.description)
    if (item.notes) drawBody(state, `Notes: ${item.notes}`)
    if (idx < magic.length - 1) drawItemGap(state)
  })
}

/** #104 — Renderiza un hechizo en el anexo con desglose completo:
 *   Subheader: "<Name> (<Level>, School)  [<source tag>]"
 *   Body line 1: "Casting Time: X  |  Range: Y  |  Duration: Z  |  Components: V/S/M"
 *   Body line 2..: descripción
 */
function drawSpellDetail(
  state: DrawState,
  spellId: string,
  opts: { sourceTag?: string; alwaysPrepared?: boolean } = {},
): void {
  const s = allSpells.find(x => x.id === spellId)
  if (!s) {
    // Spell sin metadatos en el catálogo (defensivo): al menos el id.
    drawSubheader(state, opts.sourceTag ? `${spellId} (${opts.sourceTag})` : spellId)
    return
  }
  const lvlLabel = s.level === 0 ? 'Cantrip' : `Level ${s.level}`
  const tags: string[] = []
  if (opts.sourceTag) tags.push(opts.sourceTag)
  if (opts.alwaysPrepared) tags.push('always prepared')
  const tagSuffix = tags.length ? ` [${tags.join(', ')}]` : ''
  drawSubheader(state, `${s.name} (${lvlLabel}, ${s.school})${tagSuffix}`)
  const meta = `Casting: ${s.castingTime}  |  Range: ${s.range}  |  Duration: ${s.duration}  |  Components: ${s.components}`
  drawBody(state, meta)
  if (s.description) drawBody(state, s.description)
}

/**
 * #105: hechizos y cantrips concedidos por la especie/subraza (Forest Gnome
 * Minor Illusion + Speak with Animals, Drow Faerie Fire, Tiefling Hellish
 * Rebuke, Aasimar Light, etc.). Aparecen en sección dedicada para que el
 * jugador vea claramente que son "siempre preparados" y no consumen slot.
 */
function drawSpeciesSpells(state: DrawState, char: CharacterData): void {
  const cantripIds = char.speciesGrantedCantrips ?? []
  const spellIds   = char.speciesGrantedSpells   ?? []
  if (!cantripIds.length && !spellIds.length) return

  drawSectionHeader(state, 'Species Spells')

  const items: Array<{ id: string; isSpell: boolean }> = [
    ...cantripIds.map(id => ({ id, isSpell: false })),
    ...spellIds.map(id => ({ id, isSpell: true })),
  ]
  items.forEach((it, idx) => {
    drawSpellDetail(state, it.id, {
      sourceTag: 'Species',
      alwaysPrepared: it.isSpell,
    })
    if (idx < items.length - 1) drawItemGap(state)
  })
}

/**
 * #104 — Lista todos los hechizos del personaje (cantrips + spellsKnown de
 * clase) con desglose completo: escuela, casting time, range, duration,
 * components y descripción. Species y Magic Initiate ya tienen sus propias
 * secciones y se excluyen aquí para no duplicar.
 */
function drawCharacterSpells(state: DrawState, char: CharacterData): void {
  const cantripIds = char.cantrips ?? []
  const spellIds   = char.spellsKnown ?? []

  // Excluir cantrips/spells que ya estén cubiertos por otras secciones.
  const raceCantrips = new Set(char.speciesGrantedCantrips ?? [])
  const raceSpells   = new Set(char.speciesGrantedSpells   ?? [])
  const miCantrips   = new Set((char.magicInitiateChoices ?? []).flatMap(m => m.cantrips ?? []))
  const miSpells     = new Set((char.magicInitiateChoices ?? []).map(m => m.levelOneSpell).filter(Boolean) as string[])
  const altCantrips  = new Set(char.martialCasterAlt?.cantrips ?? [])

  const filteredCantrips = cantripIds.filter(id =>
    !raceCantrips.has(id) && !miCantrips.has(id) && !altCantrips.has(id),
  )
  const filteredSpells = spellIds.filter(id => !raceSpells.has(id) && !miSpells.has(id))

  if (!filteredCantrips.length && !filteredSpells.length) return

  drawSectionHeader(state, 'Spells')

  const items: string[] = [...filteredCantrips, ...filteredSpells]
  items.forEach((id, idx) => {
    drawSpellDetail(state, id)
    if (idx < items.length - 1) drawItemGap(state)
  })
}

function drawMagicInitiate(state: DrawState, char: CharacterData): void {
  const choices = char.magicInitiateChoices ?? []
  if (!choices.length) return

  // Determinar el header de sección:
  //   - Si al menos uno de los choices proviene del background (source === 'origin'),
  //     pintamos "Origin: <background>" para reflejar que Magic Initiate es el
  //     feat de origin de este personaje (caso típico).
  //   - Si todos provienen de ASI checkpoints (Magic Initiate es repeatable),
  //     mantenemos un título neutro "Magic Initiate".
  const hasOriginSource = choices.some(c => c.source === 'origin')
  const bgName = (char.background ?? '').trim()
  const sectionTitle = hasOriginSource && bgName
    ? `Origin: ${bgName}`
    : 'Magic Initiate'
  drawSectionHeader(state, sectionTitle)

  // Subheader con el nombre del feat y, debajo, su descripción.
  if (hasOriginSource) {
    const featInfo = getFeatById('magic-initiate')
    drawSubheader(state, 'Magic Initiate')
    if (featInfo?.description) {
      drawBody(state, featInfo.description)
      drawItemGap(state)
    }
  }

  choices.forEach((choice, idx) => {
    const sourceLabel = choice.source === 'origin'
      ? 'Background'
      : choice.source.startsWith('asi-')
        ? `Level ${choice.source.slice(4)} feat`
        : choice.source
    const listLabel = choice.spellList.charAt(0).toUpperCase() + choice.spellList.slice(1)
    drawSubheader(state, `${listLabel} list (${sourceLabel})`)

    // Cantrips: usar drawSpellDetail para mostrar escuela/casting/range/
    // duration/components + descripción completa, igual que SPECIES SPELLS.
    for (const cantripId of choice.cantrips) {
      drawSpellDetail(state, cantripId, { sourceTag: 'Magic Initiate' })
      drawItemGap(state)
    }

    // Level-1 spell: igual, con tag adicional "1/long rest free".
    if (choice.levelOneSpell) {
      drawSpellDetail(state, choice.levelOneSpell, {
        sourceTag: 'Magic Initiate, 1/long rest free',
      })
    }
    if (idx < choices.length - 1) drawItemGap(state)
  })
}

function drawWeaponAttacks(state: DrawState, char: CharacterData): void {
  // Collect weapons from inventory (or legacy weapons[]).
  const invWeapons = (char.inventory ?? []).filter(i =>
    i.kind === 'weapon' ||
    (i.kind === 'magic' && /sword|axe|bow|dagger|spear|mace|hammer|rapier|quarterstaff|scimitar|maul|lance|whip|halberd|glaive|crossbow|club|sickle|sling|trident|dart|blowgun|pistol|musket|warhammer|war pick|morningstar|battleaxe|greataxe|greatsword|greatclub|handaxe|javelin|light hammer|longbow|shortbow|shortsword|longsword|flail|pike/i.test(i.name)),
  )
  const names = invWeapons.length > 0
    ? invWeapons.map(i => i.name)
    : (char.weapons ?? []).map(w => w.name)

  if (!names.length) return
  drawSectionHeader(state, 'Weapon Attacks')
  names.forEach((name, idx) => {
    const info = computeWeaponAttack(name, char)
    drawSubheader(state, name)

    // Desglose del ataque (#76): "d20 +N (DEX +3, PB +4, magic +1, Archery +2)"
    const atkParts: string[] = []
    atkParts.push(`${info.ability.toUpperCase()} ${fmt(info.abilityMod)}`)
    if (info.pbBonus > 0) atkParts.push(`PB ${fmt(info.pbBonus)}`)
    else if (!info.proficient) atkParts.push('not proficient: no PB')
    if (info.magicBonus !== 0) atkParts.push(`magic ${fmt(info.magicBonus)}`)
    if (info.archeryBonus !== 0) atkParts.push(`Archery ${fmt(info.archeryBonus)}`)
    drawBody(state, `Attack: d20 ${fmt(info.attackBonus)} (${atkParts.join(', ')})`)

    // Desglose del daño (#76): "1d6 +4 piercing (DEX +3, magic +1, Dueling +2)"
    if (info.damageDie) {
      const dmgParts: string[] = []
      dmgParts.push(`${info.ability.toUpperCase()} ${fmt(info.abilityMod)}`)
      if (info.magicBonus !== 0) dmgParts.push(`magic ${fmt(info.magicBonus)}`)
      if (info.duelingBonus !== 0) dmgParts.push(`Dueling ${fmt(info.duelingBonus)}`)
      drawBody(state, `Damage: ${info.damage} (${dmgParts.join(', ')})`)
    } else {
      drawBody(state, 'Damage: -')
    }
    if (idx < names.length - 1) drawItemGap(state)
  })
}

/** Format a signed number: 3 → "+3", -1 → "-1", 0 → "+0". */
function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

// ─── Weapon Masteries (#89) ───────────────────────────────────────────────

/**
 * #110 — Tabla con las armas dominadas: Arma | Mastery | Descripción.
 * Si el PJ no tiene maestrías elegidas, se omite la sección.
 */
function drawWeaponMasteries(state: DrawState, char: CharacterData): void {
  const masteries = sanitizeMasteries(char)
  if (!masteries.length) return

  drawSectionHeader(state, 'Weapon Masteries')

  const w = contentWidth()
  const colWeapon = Math.round(w * 0.28)
  const colMastery = Math.round(w * 0.15)
  const colDesc = w - colWeapon - colMastery

  const columns: readonly TableColumn[] = [
    { header: 'Weapon',       width: colWeapon },
    { header: 'Mastery',      width: colMastery },
    { header: 'Description',  width: colDesc },
  ]
  const rows: TableRow[] = masteries.map(weaponName => {
    const prop = getMasteryFor(weaponName)
    const desc = prop && masteryDescriptions[prop as keyof typeof masteryDescriptions]
      ? masteryDescriptions[prop as keyof typeof masteryDescriptions]
      : ''
    return { cells: [weaponName, prop ?? '—', desc] }
  })

  drawTable(state, columns, rows)
}

// ─── Resource usage table (#78, rediseñado en #111) ──────────────────────

/**
 * #111 — Tabla final con recursos limitados que el jugador puede ir tachando
 * en la mesa. Cuatro columnas: Nombre | Fuente | Usos máx | Usos restantes
 * (casillas en blanco para tachar a mano).
 *
 * Diseño:
 *   - Sin líneas separadoras entre filas (causaban tachado del texto, #111).
 *   - Tipografía uniforme (BODY_SIZE) coherente con las demás tablas de #110.
 *   - "Remaining" se renderiza como hueco — el jugador anota a mano. Las
 *     versiones anteriores dibujaban N checkboxes (1 por uso); con la nueva
 *     columna "Fuente" no caben, y un único hueco grande es más práctico
 *     porque permite escribir números (3/5 usados) en vez de marcar uno a uno.
 */
function drawResourceTable(state: DrawState, char: CharacterData): void {
  const rows = getLimitedResources(char)
  if (!rows.length) return

  drawSectionHeader(state, 'Limited-Use Resources')

  const w = contentWidth()
  const colName = Math.round(w * 0.30)
  const colSource = Math.round(w * 0.30)
  const colMax = Math.round(w * 0.15)
  const colRemaining = w - colName - colSource - colMax

  const columns: readonly TableColumn[] = [
    { header: 'Resource',  width: colName },
    { header: 'Source',    width: colSource },
    { header: 'Max',       width: colMax,       align: 'center' },
    { header: 'Remaining', width: colRemaining, align: 'left' },
  ]
  const tableRows: TableRow[] = rows.map(r => {
    // pdf-lib StandardFonts.Helvetica no codifica '∞' (sanitize lo pasaría a '?').
    // Para el caso de Wild Shape lv.20 (uses=999) usamos texto plano "Unlimited".
    const maxNum = r.uses >= 999 ? 'Unlimited' : String(r.uses)
    const maxStr = r.unit ? `${maxNum} ${r.unit}` : maxNum
    return {
      cells: [
        r.name,
        r.source ?? '',
        maxStr,
        // Espacio en blanco para que el jugador apunte a mano.
        // El subrayado punteado se dibuja después (no es parte del texto).
        '',
      ],
    }
  })

  // Dibujar la tabla normal (sin líneas separadoras intra-fila).
  drawTable(state, columns, tableRows)

  // Para que la columna "Remaining" sea visualmente reconocible como zona
  // de escritura, dibujamos un guion bajo discreto bajo cada celda de esa
  // columna. Esto NO tacha texto porque la celda está vacía.
  // (Cálculo de Y aproximado: drawTable ya bajó state.y; reconstruimos hacia
  // arriba con altura de fila base = LINE_HEIGHT + rowGap.)
  const layout = tableLayout(state)
  const rowFullHeight = layout.lineHeight + layout.rowGap
  // Posición X de la columna "Remaining"
  const xRemaining = MARGIN_X + colName + colSource + colMax + layout.cellPaddingX
  const remainingWidth = colRemaining - 2 * layout.cellPaddingX
  // Recorremos las filas (la última está al nivel actual de state.y + rowGap;
  // las anteriores están encima).
  let y = state.y + rowFullHeight
  for (let i = tableRows.length - 1; i >= 0; i--) {
    // Hueco subrayado fino bajo la celda
    state.page.drawLine({
      start: { x: xRemaining, y: y - 1 },
      end:   { x: xRemaining + remainingWidth, y: y - 1 },
      thickness: 0.3,
      color: COLOR_DIVIDER,
    })
    y += rowFullHeight
  }
}

// ─── #120 — Detailed Reference: nuevas secciones ────────────────────────
// Los cálculos viven en `detailedReferenceCalc.ts`; aquí solo se renderizan.

/** Saving Throws: tabla de las 6 abilities con desglose. */
function drawSavingThrows(state: DrawState, char: CharacterData): void {
  const rows = computeSavingThrows(char)

  drawSectionHeader(state, 'Saving Throws')

  const w = contentWidth()
  const colAbility = 60
  const colTotal = 50
  const colSources = w - colAbility - colTotal

  const columns: readonly TableColumn[] = [
    { header: 'Ability', width: colAbility },
    { header: 'Total',   width: colTotal, align: 'center' },
    { header: 'Sources', width: colSources },
  ]
  const tableRows: TableRow[] = rows.map(r => ({
    cells: [r.ability.toUpperCase(), fmtMod(r.total), r.sources],
  }))

  drawTable(state, columns, tableRows)
}

/** Hit Points: cálculo Max HP por fuente. */
function drawHitPoints(state: DrawState, char: CharacterData): void {
  const bd = computeHitPointsBreakdown(char)
  if (!bd) return

  drawSectionHeader(state, 'Hit Points')

  const w = contentWidth()
  const colSource = w - 80
  const colValue = 80

  const columns: readonly TableColumn[] = [
    { header: 'Source',       width: colSource },
    { header: 'Contribution', width: colValue, align: 'center' },
  ]

  const rows: TableRow[] = bd.rows.map(r => ({
    cells: [r.label, String(r.value)],
  }))
  rows.push({ cells: ['Total Max HP', String(bd.total)] })

  drawTable(state, columns, rows)
}

/** Miscellaneous: Initiative, Passive Perception, Skills with Expertise. */
function drawMiscellaneous(state: DrawState, char: CharacterData): void {
  const m = computeMiscellaneous(char)

  drawSectionHeader(state, 'Miscellaneous')

  const lines = [m.initiative, m.passivePerception]
  if (m.expertise) lines.push(m.expertise)
  drawBody(state, lines.join('\n'))
}

/** Spellcasting Calculations: Ability, Save DC, Attack Bonus. */
function drawSpellcastingCalculations(state: DrawState, char: CharacterData): void {
  const c = computeSpellcastingCalculations(char)
  if (!c) return

  drawSectionHeader(state, 'Spellcasting Calculations')
  drawBody(state, [c.abilityLine, c.saveDcLine, c.attackBonusLine].join('\n'))
}

/** Spell Slots: tabla con slots por nivel según casterType. */
function drawSpellSlots(state: DrawState, char: CharacterData): void {
  const data = computeSpellSlots(char)
  if (!data) return
  const cls = getClassById(char.className)
  const className = cls?.name ?? char.className
  const lv = char.level || 1

  if (data.type === 'pact') {
    drawSectionHeader(state, `Spell Slots (${className} — Pact Magic lv.${lv})`)
    const cols: readonly TableColumn[] = [
      { header: 'Slots', width: 80, align: 'center' },
      { header: 'Slot Level', width: contentWidth() - 80, align: 'center' },
    ]
    const rows: TableRow[] = [{ cells: [String(data.pactSlots ?? 0), `Level ${data.pactSlotLevel ?? 1}`] }]
    drawTable(state, cols, rows)
    return
  }

  const slots = data.slots ?? []
  if (!slots.length) return

  drawSectionHeader(state, `Spell Slots (${className} — ${data.casterLabel} lv.${lv})`)

  const w = contentWidth()
  const cols: readonly TableColumn[] = [
    { header: 'Level', width: 80, align: 'center' },
    { header: 'Slots', width: w - 80, align: 'left' },
  ]
  const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
  const rows: TableRow[] = slots.map((n, i) => ({ cells: [ordinals[i] ?? `${i + 1}th`, String(n)] }))
  drawTable(state, cols, rows)
}

/** Carrying Capacity: STR × 15 lbs, push/drag/lift, encumbered thresholds. */
function drawCarryingCapacity(state: DrawState, char: CharacterData): void {
  const c = computeCarryingCapacity(char)
  // #121 — Current Load real basada en char.inventory[]
  const load = computeCurrentLoad(char)

  drawSectionHeader(state, 'Carrying Capacity')

  const lines = [
    `Carrying Capacity: STR ${c.totalStr} x 15 = ${c.capacityLbs} lbs (${c.capacityKg} kg)`,
    `Push, Drag, or Lift: ${c.pushDragLiftLbs} lbs (${c.pushDragLiftKg} kg) — 2x capacity`,
    `Encumbered: more than ${c.encumberedAtLbs} lbs (${c.encumberedAtKg} kg) — STR x 5`,
    `Heavily Encumbered: more than ${c.heavilyEncumberedAtLbs} lbs (${c.heavilyEncumberedAtKg} kg) — STR x 10`,
    // #121 — 3 filas con la carga real, calculada del inventario.
    `Current Load: ${load.total} lbs (${load.totalKg} kg)`,
    `Capacity used: ${load.capacityUsedPct}%`,
    `Status: ${load.status}`,
  ]
  drawBody(state, lines.join('\n'))
}

// ─── Public entry point ───────────────────────────────────────────────────

/**
 * Adds appendix page(s) to the given PDFDocument with full-length character info.
 * Call this AFTER filling the AcroForm but BEFORE saving.
 */
export async function appendCharacterAppendix(
  pdfDoc: PDFDocument,
  char: CharacterData,
): Promise<void> {
  // Hereda las dimensiones de la primera página del PDF base. El PDF oficial
  // 2024 de WotC mide 603x774 (no US Letter). Si dejamos el anexo en US Letter
  // hardcoded, los visores reescalan ambos tamaños para encajar y la letra
  // del anexo se ve ~2% más pequeña de lo previsto en los tests de fuente.
  const firstPage = pdfDoc.getPage(0)
  if (firstPage) {
    const { width, height } = firstPage.getSize()
    PAGE_WIDTH = width
    PAGE_HEIGHT = height
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  const state: DrawState = {
    pdf: pdfDoc,
    page,
    font,
    fontBold,
    y: PAGE_HEIGHT - MARGIN_TOP,
  }

  // Title at the top of the first appendix page.
  state.page.drawText(sanitize(`${char.name || 'Character'} - Detailed Reference`), {
    x: MARGIN_X, y: state.y, size: 16, font: fontBold, color: COLOR_HEADER,
  })
  state.y -= 22

  drawAbilityBreakdown(state, char)
  drawSavingThrows(state, char)                 // #120
  drawArmorClass(state, char)
  drawHitPoints(state, char)                    // #120
  drawMiscellaneous(state, char)                // #120 (Init + Passive + Expertise)
  drawSpeciesTraits(state, char)
  drawMagicInitiate(state, char)     // "Origin: <background>" — sube aquí
  drawClassFeatures(state, char)
  drawFeats(state, char)
  drawSpeciesSpells(state, char)
  drawSpellcastingCalculations(state, char)     // #120
  drawSpellSlots(state, char)                   // #120
  drawCharacterSpells(state, char)
  drawMagicItems(state, char)
  drawWeaponAttacks(state, char)
  drawWeaponMasteries(state, char)
  drawCarryingCapacity(state, char)             // #120
  drawResourceTable(state, char)
}
