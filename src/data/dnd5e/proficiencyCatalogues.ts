// Documento generado el 2026-05-20-2210 — milestone 25 (#52 fase 2)
// Catálogos de tools/instrumentos que el usuario puede elegir en feats
// como Crafter (3 Artisan's Tools) o Musician (3 Musical Instruments).

export const ARTISANS_TOOLS = [
  "Alchemist's Supplies",
  "Brewer's Supplies",
  "Calligrapher's Supplies",
  "Carpenter's Tools",
  "Cartographer's Tools",
  "Cobbler's Tools",
  "Cook's Utensils",
  "Glassblower's Tools",
  "Jeweler's Tools",
  "Leatherworker's Tools",
  "Mason's Tools",
  "Painter's Supplies",
  "Potter's Tools",
  "Smith's Tools",
  "Tinker's Tools",
  "Weaver's Tools",
  "Woodcarver's Tools",
] as const

export const MUSICAL_INSTRUMENTS = [
  'Bagpipes',
  'Drum',
  'Dulcimer',
  'Flute',
  'Horn',
  'Lute',
  'Lyre',
  'Pan Flute',
  'Shawm',
  'Viol',
] as const

export type ArtisansTool = typeof ARTISANS_TOOLS[number]
export type MusicalInstrument = typeof MUSICAL_INSTRUMENTS[number]
