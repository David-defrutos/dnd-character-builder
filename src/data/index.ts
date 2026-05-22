// WSG 3.8: Per-step lazy-load game data with localStorage caching
import type { GameVariant } from '@/stores/app'
import type { AbilityScores } from '@/stores/character'
import type { Race } from './dnd5e/races'
import type { CharacterClass } from './dnd5e/classes'
import type { Background } from './dnd5e/backgrounds'
import type { Spell } from './dnd5e/spells'
import type { EquipmentSet } from './dnd5e/equipment'

// ─── Build Hash for Cache Invalidation ──────────────────────────────────────
declare const __BUILD_HASH__: string
const BUILD_HASH = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev'
const CACHE_PREFIX = `gamedata:v${BUILD_HASH}:`

// ─── localStorage Helpers ───────────────────────────────────────────────────

/** Remove stale cache entries from previous builds.
 *  En dev (BUILD_HASH='dev') borra cualquier entrada `gamedata:*` para forzar
 *  recarga limpia de los datos al añadir campos nuevos (ver bug #57). */
export function sweepStaleCache(): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('gamedata:')) continue
      // En dev borramos todas las entradas; en prod solo las que no coinciden con el build actual.
      if (import.meta.env.DEV || !key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  } catch { /* localStorage not available */ }
}

function lsGet<T>(module: string): T | null {
  // En dev nunca leemos del cache: los datos cambian a menudo y el cache
  // localStorage no se invalida porque BUILD_HASH es siempre 'dev'.
  // Ver bug #57: añadir campos nuevos a races/classes/feats no se reflejaba
  // hasta hacer un hard refresh manual.
  if (import.meta.env.DEV) return null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + module)
    if (raw) return JSON.parse(raw) as T
  } catch { /* parse error or unavailable */ }
  return null
}

function lsSet(module: string, data: unknown): void {
  if (import.meta.env.DEV) return
  try {
    localStorage.setItem(CACHE_PREFIX + module, JSON.stringify(data))
  } catch { /* quota exceeded or unavailable */ }
}

// ─── Per-Module Memory Cache ────────────────────────────────────────────────

// D&D 5e
let _dnd5eRaces: readonly Race[] | null = null
let _dnd5eClasses: readonly CharacterClass[] | null = null
let _dnd5eBackgrounds: readonly Background[] | null = null
let _dnd5eSpells: readonly Spell[] | null = null
let _dnd5eEquipment: EquipmentSet | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _dnd5eGetSpellSlotsForLevel: ((casterType: any, level: number) => Record<number, number>) | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _dnd5eGetMulticlassSpellSlots: ((classes: any[]) => { slots: Record<number, number>; pactSlots: Record<number, number> }) | null = null


// ─── Per-Module Promise Deduplication ───────────────────────────────────────

let _pDnd5eRaces: Promise<void> | null = null
let _pDnd5eClasses: Promise<void> | null = null
let _pDnd5eBackgrounds: Promise<void> | null = null
let _pDnd5eSpells: Promise<void> | null = null
let _pDnd5eEquipment: Promise<void> | null = null
let _pDnd5eRules: Promise<void> | null = null



// ─── D&D 5e Module Loaders ──────────────────────────────────────────────────

function ensureDnd5eRaces(): Promise<void> {
  if (_dnd5eRaces) return Promise.resolve()
  if (_pDnd5eRaces) return _pDnd5eRaces
  // Try localStorage first
  const cached = lsGet<Race[]>('dnd5e-races')
  if (cached) { _dnd5eRaces = cached; return Promise.resolve() }
  _pDnd5eRaces = import('./dnd5e/races').then(m => {
    _dnd5eRaces = m.races
    lsSet('dnd5e-races', m.races)
  })
  return _pDnd5eRaces
}

function ensureDnd5eClasses(): Promise<void> {
  if (_dnd5eClasses) return Promise.resolve()
  if (_pDnd5eClasses) return _pDnd5eClasses
  const cached = lsGet<CharacterClass[]>('dnd5e-classes')
  if (cached) { _dnd5eClasses = cached; return Promise.resolve() }
  _pDnd5eClasses = import('./dnd5e/classes').then(m => {
    _dnd5eClasses = m.classes
    lsSet('dnd5e-classes', m.classes)
  })
  return _pDnd5eClasses
}

function ensureDnd5eBackgrounds(): Promise<void> {
  if (_dnd5eBackgrounds) return Promise.resolve()
  if (_pDnd5eBackgrounds) return _pDnd5eBackgrounds
  const cached = lsGet<Background[]>('dnd5e-backgrounds')
  if (cached) { _dnd5eBackgrounds = cached; return Promise.resolve() }
  _pDnd5eBackgrounds = import('./dnd5e/backgrounds').then(m => {
    _dnd5eBackgrounds = m.backgrounds
    lsSet('dnd5e-backgrounds', m.backgrounds)
  })
  return _pDnd5eBackgrounds
}

function ensureDnd5eSpells(): Promise<void> {
  if (_dnd5eSpells) return Promise.resolve()
  if (_pDnd5eSpells) return _pDnd5eSpells
  const cached = lsGet<Spell[]>('dnd5e-spells')
  if (cached) { _dnd5eSpells = cached; return Promise.resolve() }
  _pDnd5eSpells = import('./dnd5e/spells').then(m => {
    _dnd5eSpells = m.spells
    lsSet('dnd5e-spells', m.spells)
  })
  return _pDnd5eSpells
}

function ensureDnd5eEquipment(): Promise<void> {
  if (_dnd5eEquipment) return Promise.resolve()
  if (_pDnd5eEquipment) return _pDnd5eEquipment
  const cached = lsGet<EquipmentSet>('dnd5e-equipment')
  if (cached) { _dnd5eEquipment = cached; return Promise.resolve() }
  _pDnd5eEquipment = import('./dnd5e/equipment').then(m => {
    _dnd5eEquipment = m.equipmentData
    lsSet('dnd5e-equipment', m.equipmentData)
  })
  return _pDnd5eEquipment
}

/** Rules module: functions are NOT cached in localStorage (not serializable) */
function ensureDnd5eRules(): Promise<void> {
  if (_dnd5eGetSpellSlotsForLevel) return Promise.resolve()
  if (_pDnd5eRules) return _pDnd5eRules
  _pDnd5eRules = import('./dnd5e/rules').then(m => {
    _dnd5eGetSpellSlotsForLevel = m.getSpellSlotsForLevel
    _dnd5eGetMulticlassSpellSlots = m.getMulticlassSpellSlots
  })
  return _pDnd5eRules
}

// ─── Step-Based Data Loading ────────────────────────────────────────────────

/**
 * Ensure all data modules needed for a given wizard step are loaded.
 * Also prefetches next step's data (fire-and-forget).
 * WSG 3.8: Load only the data each step actually needs.
 */
export async function ensureStepData(variant: GameVariant, step: number): Promise<void> {
  const loads: Promise<void>[] = []

  switch (step) {
    case 1: // Race
      loads.push(ensureDnd5eRaces())
      break
    case 2: // Class
      loads.push(ensureDnd5eClasses())
      break
    case 3: // Abilities — no data needed
      break
    case 4: // Background
      loads.push(ensureDnd5eBackgrounds())
      break
    case 5: // Equipment
      loads.push(ensureDnd5eEquipment())
      break
    case 6: // Spells
      loads.push(ensureDnd5eSpells(), ensureDnd5eRules(), ensureDnd5eClasses())
      break
    case 7: // Details
      // Races needed for size derivation; classes needed for subclass selector
      loads.push(ensureDnd5eRaces())
      loads.push(ensureDnd5eClasses())
      break
    case 8: // Review — ensure everything
      loads.push(ensureAllForVariant(variant))
      break
  }

  await Promise.all(loads)

  // Prefetch next step (fire-and-forget)
  if (step < 8) {
    ensureStepData(variant, step + 1).catch(() => {})
  }
}

/** Load all data for a variant (used by Step 9 / Review and random char) */
async function ensureAllForVariant(_variant: GameVariant): Promise<void> {
  const loads: Promise<void>[] = [
    ensureDnd5eRaces(), ensureDnd5eClasses(), ensureDnd5eBackgrounds(),
    ensureDnd5eSpells(), ensureDnd5eEquipment(), ensureDnd5eRules(),
  ]

  await Promise.all(loads)
}

// ─── Public API: Preload (backward compat) ──────────────────────────────────

/**
 * Preload all data needed for a given variant.
 * Convenience wrapper — delegates to ensureStepData(variant, 8).
 */
export async function preloadVariantData(variant: GameVariant): Promise<void> {
  await ensureAllForVariant(variant)
}

/** Check if variant data is already cached (all modules) */
export function isVariantLoaded(variant: GameVariant): boolean {
  const dnd5eLoaded = !!_dnd5eRaces && !!_dnd5eClasses && !!_dnd5eBackgrounds
    && !!_dnd5eSpells && !!_dnd5eEquipment && !!_dnd5eGetSpellSlotsForLevel
  switch (variant) {
    default:
      return dnd5eLoaded
  }
}

// ─── Races ──────────────────────────────────────────────────────────────────

export function getRaces(variant: GameVariant): readonly Race[] {
  switch (variant) {
    default: return _dnd5eRaces ?? []
  }
}

// ─── Classes ────────────────────────────────────────────────────────────────

export function getClasses(variant: GameVariant): readonly CharacterClass[] {
  if (!_dnd5eClasses) return []

  switch (variant) {
    default:
      return _dnd5eClasses
  }
}

// ─── Subclasses (Brancalonia-specific) ──────────────────────────────────────

// ─── Backgrounds ────────────────────────────────────────────────────────────

export function getBackgrounds(variant: GameVariant): readonly Background[] {
  switch (variant) {
    default: {
      // Return only the 16 PHB 2024 backgrounds for the UI.
      // Legacy backgrounds (Folk Hero, Outlander, Exile, etc.) are preserved
      // in the full backgrounds array for backwards-compatibility.
      const all = _dnd5eBackgrounds ?? []
      const PHB_IDS = new Set([
        'acolyte', 'artisan', 'charlatan', 'criminal', 'entertainer',
        'farmer', 'guard', 'guide', 'hermit', 'merchant',
        'noble', 'sage', 'sailor', 'scribe', 'soldier', 'wayfarer',
      ])
      return all.filter(b => PHB_IDS.has(b.id)).sort((a, b) => a.name.localeCompare(b.name))
    }
  }
}

// ─── Rules ──────────────────────────────────────────────────────────────────

export interface VariantRules {
  maxLevel: number
  currencyStandard: 'gold' | 'silver'
  shortRestDuration: string
  longRestDuration: string
}

const dnd5eRulesData: VariantRules = {
  maxLevel: 20, currencyStandard: 'gold',
  shortRestDuration: '1 hour', longRestDuration: '8 hours',
}

export function getRules(variant: GameVariant): VariantRules {
  switch (variant) {
    default: return dnd5eRulesData
  }
}

// ─── Max Level ──────────────────────────────────────────────────────────────

export function getMaxLevel(variant: GameVariant): number {
  return getRules(variant).maxLevel
}

// ─── Equipment ──────────────────────────────────────────────────────────────

export function getEquipment(_variant: GameVariant): EquipmentSet {
  return _dnd5eEquipment ?? { simpleWeapons: [], martialWeapons: [], armor: [], packs: [] }
}

// ─── Spells ─────────────────────────────────────────────────────────────────

export function getSpells(_variant: GameVariant): readonly Spell[] {
  return _dnd5eSpells ?? []
}

export function getSpellSlots(className: string, level: number): Record<number, number> {
  if (!_dnd5eClasses || !_dnd5eGetSpellSlotsForLevel) return {}
  const cls = _dnd5eClasses.find(c => c.id === className)
  if (!cls?.spellcasting) return {}
  return _dnd5eGetSpellSlotsForLevel(cls.spellcasting.casterType, level)
}

/** Nivel máximo de slot de conjuro disponible para una clase y nivel dados.
 *  Devuelve 0 si la clase no tiene magia o todavía no tiene slots. */
export function getMaxSpellLevel(className: string, level: number): number {
  const slots = getSpellSlots(className, level)
  const levels = Object.keys(slots)
    .map(Number)
    .filter(lv => (slots[lv] ?? 0) > 0)
  return levels.length > 0 ? Math.max(...levels) : 0
}

export function getCantripsKnown(className: string, level: number): number {
  if (!_dnd5eClasses) return 0
  const cls = _dnd5eClasses.find(c => c.id === className)
  if (!cls?.spellcasting) return 0
  const idx = Math.min(level - 1, cls.spellcasting.cantripsKnown.length - 1)
  return cls.spellcasting.cantripsKnown[idx] ?? 0
}

/**
 * Número de hechizos preparados según las tablas PHB 2024.
 *
 * H1 fix: antes calculaba `abilityMod + level` (fórmula 5e 2014), pero el
 * PHB 2024 dice explícitamente que cada clase tiene su propia columna fija
 * en la tabla de progresión. Las tablas ya estaban en classes.ts
 * (paladinPrepared, bardPrepared, etc.) pero esta función las ignoraba.
 *
 * Para "spells known" puros (clases con `spellsKnown` array — Warlock en
 * algunas variantes), se sigue leyendo del array.
 *
 * Se mantiene la firma con `abilityModifiers` por compatibilidad con
 * llamadores, aunque ya no se usa para preparados.
 */
export function getSpellsKnownCount(
  className: string,
  level: number,
  _abilityModifiers: Record<keyof AbilityScores, number>,
): number {
  if (!_dnd5eClasses) return 0
  const cls = _dnd5eClasses.find(c => c.id === className)
  if (!cls?.spellcasting) return 0

  if (cls.spellcasting.preparedCaster) {
    // PHB 2024: leer de la tabla progression.preparedSpells de la clase.
    const table = cls.progression?.preparedSpells
    if (!table || !table.length) return 0
    const idx = Math.max(0, Math.min(level - 1, table.length - 1))
    return Number(table[idx] ?? 0)
  }
  if (cls.spellcasting.spellsKnown) {
    const idx = Math.min(level - 1, cls.spellcasting.spellsKnown.length - 1)
    return cls.spellcasting.spellsKnown[idx] ?? 0
  }
  return 0
}

// ─── Multiclass Spell Slots (redirected from dnd5e/rules) ──────────────────

/**
 * Get multiclass spell slots. Wraps the function from dnd5e/rules
 * so step components don't need direct imports.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMulticlassSpellSlots(
  classes: { classId: string; level: number; casterType: any }[],
): { slots: Record<number, number>; pactSlots: Record<number, number> } {
  if (!_dnd5eGetMulticlassSpellSlots) return { slots: {}, pactSlots: {} }
  return _dnd5eGetMulticlassSpellSlots(classes)
}


// ─── Languages ──────────────────────────────────────────────────────────────

const DND5E_LANGUAGES = [
  'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish',
  'Goblin', 'Halfling', 'Orc', 'Abyssal', 'Celestial',
  'Draconic', 'Deep Speech', 'Infernal', 'Primordial',
  'Sylvan', 'Undercommon',
]

export function getAvailableLanguages(variant: GameVariant): string[] {
  switch (variant) {
    default:
      return DND5E_LANGUAGES
  }
}

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** @internal Reset all caches — for testing only */
export function _resetCaches(): void {
  _dnd5eRaces = _dnd5eClasses = _dnd5eBackgrounds = _dnd5eSpells = null
  _dnd5eEquipment = null
  _dnd5eGetSpellSlotsForLevel = _dnd5eGetMulticlassSpellSlots = null
  _pDnd5eRaces = _pDnd5eClasses = _pDnd5eBackgrounds = _pDnd5eSpells = _pDnd5eEquipment = _pDnd5eRules = null
}
