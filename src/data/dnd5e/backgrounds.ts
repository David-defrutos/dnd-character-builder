// Documento generado el 2026-05-19-2001
// Backgrounds catalogue.
// The 2024 PHB introduces three new pieces in every background:
//   • abilityScores: three abilities; player picks +2/+1 or 1/1/1
//   • feat:         an Origin Feat (see ./feats.ts)
//   • equipmentChoice: choose between an item package and 50 GP
// All three are marked optional for forward-compatibility with legacy entries.
//
// PHB 2024 base set: Acolyte, Criminal, Sage, Soldier.

export interface BackgroundFeature {
  name: string
  description: string
}

export interface Background {
  id: string
  name: string
  nameOriginal?: string
  description: string
  skillProficiencies: string[]
  toolProficiencies: string[]
  languages: number
  equipment: string[]

  // ── 2024 additions (optional for backwards-compat with legacy data) ────
  /** Three ability scores affected by this background (PHB 2024). */
  abilityScores?: readonly ['str' | 'dex' | 'con' | 'int' | 'wis' | 'cha',
                            'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha',
                            'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha']
  /** ID of the Origin Feat granted by the background (see feats.ts). */
  originFeat?: string
  /** Alternative starting equipment package: full kit (A) or 50 GP (B). */
  equipmentChoice?: {
    optionA: string[]
    optionB: string  // typically "50 GP"
  }

  // ── Legacy (2014) ────────────────────────────────────────────────────────
  /** 2014-style background feature. Optional in 2024; kept for legacy data. */
  feature?: BackgroundFeature
  suggestedCharacteristics?: {
    personalityTraits: string[]
    ideals: string[]
    bonds: string[]
    flaws: string[]
  }
}

import { missingBackgrounds } from './missing-backgrounds'

const baseBackgrounds: readonly Background[] = [
  {
    id: 'acolyte',
    name: 'Acolyte',
    description: 'You have spent your life in the service of a temple to a specific god or pantheon of gods.',
    skillProficiencies: ['insight', 'religion'],
    toolProficiencies: ["Calligrapher's Supplies"],
    languages: 0,
    equipment: ["Calligrapher's Supplies", 'Book (prayers)', 'Holy Symbol', 'Parchment (10 sheets)', 'Robe', '8 GP'],
    abilityScores: ['int', 'wis', 'cha'],
    originFeat: 'magic-initiate',
    equipmentChoice: {
      optionA: ["Calligrapher's Supplies", 'Book (prayers)', 'Holy Symbol', 'Parchment (10 sheets)', 'Robe', '8 GP'],
      optionB: '50 GP',
    },
  },
  {
    // #96: Artisan PHB 2024 — ASI STR/DEX/INT, Crafter feat, Investigation+Persuasion,
    // Artisan's Tools (choose one). PHB 2024 p.178.
    id: 'artisan',
    name: 'Artisan',
    description: 'You spent your formative years working under another artisan, learning a craft that will serve you well for the rest of your life.',
    skillProficiencies: ['investigation', 'persuasion'],
    toolProficiencies: ["Artisan's Tools (choose one)"],
    languages: 0,
    equipment: ["Artisan's Tools (chosen)", 'Pouch', "Maker's Mark Chisel", "Traveler's Clothes", '32 GP'],
    abilityScores: ['str', 'dex', 'int'],
    originFeat: 'crafter',
    equipmentChoice: {
      optionA: ["Artisan's Tools (chosen)", 'Pouch', "Maker's Mark Chisel", "Traveler's Clothes", '32 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'charlatan',
    name: 'Charlatan',
    description: 'Once you were old enough to order an ale, you had a favorite stool in every tavern for miles. You learned to prey on unfortunates seeking comforting lies.',
    skillProficiencies: ['deception', 'sleight-of-hand'],
    toolProficiencies: ['Forgery Kit'],
    languages: 0,
    equipment: ['Forgery Kit', 'Costume', 'Fine Clothes', '15 GP'],
    abilityScores: ['dex', 'con', 'cha'],
    originFeat: 'skilled',
    equipmentChoice: {
      optionA: ['Forgery Kit', 'Costume', 'Fine Clothes', '15 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'criminal',
    name: 'Criminal',
    description: 'You are an experienced criminal with a history of breaking the law.',
    skillProficiencies: ['sleight-of-hand', 'stealth'],
    toolProficiencies: ["Thieves' Tools"],
    languages: 0,
    equipment: ['2 Daggers', "Thieves' Tools", 'Crowbar', '2 Pouches', "Traveler's Clothes", '16 GP'],
    abilityScores: ['dex', 'con', 'int'],
    originFeat: 'alert',
    equipmentChoice: {
      optionA: ['2 Daggers', "Thieves' Tools", 'Crowbar', '2 Pouches', "Traveler's Clothes", '16 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'entertainer',
    name: 'Entertainer',
    description: 'You spent your youth following roving fairs and carnivals, learning music, acrobatics, or recitation in exchange for odd jobs.',
    skillProficiencies: ['acrobatics', 'performance'],
    toolProficiencies: ['Musical Instrument (choose one)'],
    languages: 0,
    equipment: ['Musical Instrument (chosen)', '2 Costumes', 'Mirror', 'Perfume', "Traveler's Clothes", '11 GP'],
    abilityScores: ['str', 'dex', 'cha'],
    originFeat: 'musician',
    equipmentChoice: {
      optionA: ['Musical Instrument (chosen)', '2 Costumes', 'Mirror', 'Perfume', "Traveler's Clothes", '11 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'folk-hero',
    name: 'Folk Hero',
    description: 'You come from a humble social rank, but you are destined for so much more. (Legacy 2014 background — no 2024 ability scores.)',
    skillProficiencies: ['animal-handling', 'survival'],
    toolProficiencies: ["Artisan's Tools (choose one)", 'Vehicles (land)'],
    languages: 0,
    equipment: ["Artisan's Tools (chosen)", 'Shovel', 'Iron Pot', 'Common Clothes', '10 gp'],
  },
  {
    id: 'guard',
    name: 'Guard',
    description: 'Your feet ache remembering countless hours at your post. You were trained to watch for marauders outside the wall and troublemakers within.',
    skillProficiencies: ['athletics', 'perception'],
    toolProficiencies: ['Gaming Set (choose one)'],
    languages: 0,
    equipment: ['Spear', 'Light Crossbow', '20 Bolts', 'Gaming Set (chosen)', 'Hooded Lantern', 'Manacles', 'Quiver', "Traveler's Clothes", '12 GP'],
    abilityScores: ['str', 'int', 'wis'],
    originFeat: 'alert',
    equipmentChoice: {
      optionA: ['Spear', 'Light Crossbow', '20 Bolts', 'Gaming Set (chosen)', 'Hooded Lantern', 'Manacles', 'Quiver', "Traveler's Clothes", '12 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'guide',
    name: 'Guide',
    description: 'You came of age outdoors, far from settled lands, learning to fend for yourself while occasionally guiding nature priests who taught you the fundamentals of wild magic.',
    skillProficiencies: ['stealth', 'survival'],
    toolProficiencies: ["Cartographer's Tools"],
    languages: 0,
    equipment: ['Shortbow', '20 Arrows', "Cartographer's Tools", 'Bedroll', 'Quiver', 'Tent', "Traveler's Clothes", '3 GP'],
    abilityScores: ['dex', 'con', 'wis'],
    originFeat: 'magic-initiate',
    equipmentChoice: {
      optionA: ['Shortbow', '20 Arrows', "Cartographer's Tools", 'Bedroll', 'Quiver', 'Tent', "Traveler's Clothes", '3 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'hermit',
    name: 'Hermit',
    description: 'You lived secluded in a hut or monastery beyond the nearest settlement. Your only companions were forest creatures and occasional visitors with news and supplies.',
    skillProficiencies: ['medicine', 'religion'],
    toolProficiencies: ['Herbalism Kit'],
    languages: 0,
    equipment: ['Quarterstaff', 'Herbalism Kit', 'Bedroll', 'Book (philosophy)', 'Lamp', 'Oil (3 flasks)', "Traveler's Clothes", '16 GP'],
    abilityScores: ['con', 'wis', 'cha'],
    originFeat: 'healer',
    equipmentChoice: {
      optionA: ['Quarterstaff', 'Herbalism Kit', 'Bedroll', 'Book (philosophy)', 'Lamp', 'Oil (3 flasks)', "Traveler's Clothes", '16 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'merchant',
    name: 'Merchant',
    description: 'You were apprenticed to a trader or caravan master, learning the fundamentals of commerce. You traveled broadly, buying and selling goods.',
    skillProficiencies: ['animal-handling', 'persuasion'],
    toolProficiencies: ["Navigator's Tools"],
    languages: 0,
    equipment: ["Navigator's Tools", '2 Pouches', "Traveler's Clothes", '22 GP'],
    abilityScores: ['con', 'int', 'cha'],
    originFeat: 'lucky',
    equipmentChoice: {
      optionA: ["Navigator's Tools", '2 Pouches', "Traveler's Clothes", '22 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'noble',
    name: 'Noble',
    description: 'You were raised in a castle, surrounded by wealth and privilege. Your family of minor aristocrats gave you a first-class education and court experience.',
    skillProficiencies: ['history', 'persuasion'],
    toolProficiencies: ['Gaming Set (choose one)'],
    languages: 0,
    equipment: ['Gaming Set (chosen)', 'Fine Clothes', 'Perfume', '29 GP'],
    abilityScores: ['str', 'int', 'cha'],
    originFeat: 'skilled',
    equipmentChoice: {
      optionA: ['Gaming Set (chosen)', 'Fine Clothes', 'Perfume', '29 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'outlander',
    name: 'Outlander',
    description: 'You grew up in the wilds, far from civilization. (Legacy 2014 background — no 2024 ability scores.)',
    skillProficiencies: ['athletics', 'survival'],
    toolProficiencies: ['Musical Instrument (choose one)'],
    languages: 1,
    equipment: ['Staff', 'Hunting Trap', 'Trophy from animal you killed', "Traveler's Clothes", '10 gp'],
  },
  {
    id: 'sailor',
    name: 'Sailor',
    description: 'You lived as a seafarer, wind at your back and decks swaying beneath your feet.',
    skillProficiencies: ['acrobatics', 'perception'],
    toolProficiencies: ["Navigator's Tools"],
    languages: 0,
    equipment: ['Dagger', "Navigator's Tools", 'Rope', "Traveler's Clothes", '20 GP'],
    abilityScores: ['str', 'dex', 'wis'],
    originFeat: 'tavern-brawler',
    equipmentChoice: {
      optionA: ['Dagger', "Navigator's Tools", 'Rope', "Traveler's Clothes", '20 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'scribe',
    name: 'Scribe',
    description: 'You spent formative years in a scriptorium or government agency, learning to write clearly and produce finely written texts with careful attention to detail.',
    skillProficiencies: ['investigation', 'perception'],
    toolProficiencies: ["Calligrapher's Supplies"],
    languages: 0,
    equipment: ["Calligrapher's Supplies", 'Fine Clothes', 'Lamp', 'Oil (3 flasks)', 'Parchment (12 sheets)', '23 GP'],
    abilityScores: ['dex', 'int', 'wis'],
    originFeat: 'skilled',
    equipmentChoice: {
      optionA: ["Calligrapher's Supplies", 'Fine Clothes', 'Lamp', 'Oil (3 flasks)', 'Parchment (12 sheets)', '23 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'wayfarer',
    name: 'Wayfarer',
    description: 'You grew up on the streets among ill-fated castoffs. You slept where you could and did odd jobs for food, but never lost your pride or hope.',
    skillProficiencies: ['insight', 'stealth'],
    toolProficiencies: ["Thieves' Tools"],
    languages: 0,
    equipment: ['2 Daggers', "Thieves' Tools", 'Gaming Set (any)', 'Bedroll', '2 Pouches', "Traveler's Clothes", '16 GP'],
    abilityScores: ['dex', 'wis', 'cha'],
    originFeat: 'lucky',
    equipmentChoice: {
      optionA: ['2 Daggers', "Thieves' Tools", 'Gaming Set (any)', 'Bedroll', '2 Pouches', "Traveler's Clothes", '16 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'You spent years learning the lore of the multiverse.',
    skillProficiencies: ['arcana', 'history'],
    toolProficiencies: ["Calligrapher's Supplies"],
    languages: 0,
    equipment: ['Quarterstaff', "Calligrapher's Supplies", 'Book (history)', 'Parchment (8 sheets)', 'Robe', '8 GP'],
    abilityScores: ['con', 'int', 'wis'],
    originFeat: 'magic-initiate',
    equipmentChoice: {
      optionA: ['Quarterstaff', "Calligrapher's Supplies", 'Book (history)', 'Parchment (8 sheets)', 'Robe', '8 GP'],
      optionB: '50 GP',
    },
  },
  {
    id: 'soldier',
    name: 'Soldier',
    description: 'War has been your life for as long as you care to remember.',
    skillProficiencies: ['athletics', 'intimidation'],
    toolProficiencies: ['Gaming Set (choose one)'],
    languages: 0,
    equipment: ['Spear', 'Shortbow', '20 Arrows', 'Gaming Set (chosen)', "Healer's Kit", 'Quiver', "Traveler's Clothes", '14 GP'],
    abilityScores: ['str', 'dex', 'con'],
    originFeat: 'savage-attacker',
    equipmentChoice: {
      optionA: ['Spear', 'Shortbow', '20 Arrows', 'Gaming Set (chosen)', "Healer's Kit", 'Quiver', "Traveler's Clothes", '14 GP'],
      optionB: '50 GP',
    },
  },
] as const

/**
 * All backgrounds: SRD core + additional open sources.
 * Deduplicated by id — when both lists define the same id (e.g. 'sailor'),
 * the PHB 2024 version in baseBackgrounds wins. This prevents duplicates from
 * appearing in the UI selector (bug #73).
 */
const baseIds = new Set(baseBackgrounds.map(b => b.id))
const extraBackgrounds = missingBackgrounds.filter(b => !baseIds.has(b.id))
export const backgrounds: readonly Background[] = [...baseBackgrounds, ...extraBackgrounds]

/**
 * PHB 2024 official backgrounds — the 16 backgrounds visible in the UI.
 * Legacy 2014 backgrounds (Folk Hero, Outlander, Exile, Gambler, etc.) are
 * kept in the data for backwards-compatibility but excluded from this list.
 */
const PHB_2024_IDS = [
  'acolyte', 'artisan', 'charlatan', 'criminal', 'entertainer',
  'farmer', 'guard', 'guide', 'hermit', 'merchant',
  'noble', 'sage', 'sailor', 'scribe', 'soldier', 'wayfarer',
]

export const phbBackgrounds: readonly Background[] =
  backgrounds.filter(b => PHB_2024_IDS.includes(b.id))
           .sort((a, b) => a.name.localeCompare(b.name))

export function getBackgroundById(id: string): Background | undefined {
  return backgrounds.find(b => b.id === id)
}
