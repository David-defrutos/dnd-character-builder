// Documento generado el 2026-05-23-1258
// D&D 2024 (SRD 5.2.1) — Weapons, armor and equipment packs.
//
// Changes vs 2014 SRD:
//   • Every weapon now has a Mastery property (Cleave, Graze, Nick, Push, Sap,
//     Slow, Topple, Vex). Only usable if the character has a Weapon Mastery
//     feature for the weapon (Barbarian, Fighter, Paladin, Ranger, Rogue;
//     others gain access via the Weapon Master feat).
//   • Costs and weights updated to 2024 values.
//   • Two new firearms (Musket, Pistol) added as Martial Ranged.
//   • Studded Leather AC: 12 (unchanged); Padded loses the AC penalty wording.
//   • Armor costs match the 2024 PHB.

export type MasteryProperty = 'Cleave' | 'Graze' | 'Nick' | 'Push' | 'Sap'
                            | 'Slow' | 'Topple' | 'Vex'

export interface WeaponData {
  name: string
  damage: string
  damageType: string
  properties: string[]
  /** 2024 Weapon Mastery property (always set for SRD 5.2.1 weapons). */
  mastery: MasteryProperty
  weight: number
  /** Cost in copper pieces (for easy comparison). */
  costCp: number
  costLabel: string
}

export interface ArmorData {
  name: string
  type: 'light' | 'medium' | 'heavy' | 'shield'
  baseAC: number
  maxDexBonus: number | null
  stealthDisadvantage: boolean
  weight: number
  strengthReq: number
  costCp: number
  costLabel: string
}

export interface EquipmentPack {
  name: string
  items: string[]
}

/** Pieza de equipo general (adventuring gear) — no es arma ni armadura. */
export interface GearItem {
  id: string
  name: string
  /** Categoría para agrupar/filtrar en la UI. */
  category: 'container' | 'light' | 'tool' | 'consumable' | 'utility' | 'survival' | 'clothing'
  /** Peso en libras. 0 para items sin peso significativo. */
  weight: number
  /** Coste en cobres para comparación. */
  costCp: number
  /** Coste formateado al estilo PHB ("5 GP", "2 SP"). */
  costLabel: string
  /** Descripción breve / mecánica clave. */
  description?: string
}

export interface EquipmentSet {
  simpleWeapons: WeaponData[]
  martialWeapons: WeaponData[]
  armor: ArmorData[]
  packs: EquipmentPack[]
}

// ─── Mastery property descriptions (handy for tooltips in the UI) ────────────
export const masteryDescriptions: Record<MasteryProperty, string> = {
  Cleave:  'On a hit with a melee attack, make a second melee attack against a different creature within 5 ft of the first and within your reach. No ability mod added to that second attack’s damage. Once per turn.',
  Graze:   'If your attack misses, you still deal damage equal to your ability modifier. Same damage type as the weapon.',
  Nick:    'When you make the extra attack from the Light property, you can make it as part of the Attack action instead of as a Bonus Action. Once per turn.',
  Push:    'On a hit, push the creature up to 10 ft straight away from you if it is Large or smaller.',
  Sap:     'On a hit, the target has Disadvantage on its next attack roll before the start of your next turn.',
  Slow:    'On a hit dealing damage, reduce the target\'s Speed by 10 ft until the start of your next turn (does not stack with itself).',
  Topple:  'On a hit, target makes a CON save (DC 8 + ability mod + PB) or has the Prone condition.',
  Vex:     'On a hit dealing damage, you have Advantage on your next attack roll against the same target before the end of your next turn.',
}

// ─── Simple Weapons ──────────────────────────────────────────────────────────
export const simpleWeapons: readonly WeaponData[] = [
  // Simple Melee
  { name: 'Club',         damage: '1d4', damageType: 'bludgeoning', properties: ['light'],                                       mastery: 'Slow',   weight: 2,    costCp: 10,    costLabel: '1 SP' },
  { name: 'Dagger',       damage: '1d4', damageType: 'piercing',    properties: ['finesse', 'light', 'thrown (20/60)'],          mastery: 'Nick',   weight: 1,    costCp: 200,   costLabel: '2 GP' },
  { name: 'Greatclub',    damage: '1d8', damageType: 'bludgeoning', properties: ['two-handed'],                                  mastery: 'Push',   weight: 10,   costCp: 20,    costLabel: '2 SP' },
  { name: 'Handaxe',      damage: '1d6', damageType: 'slashing',    properties: ['light', 'thrown (20/60)'],                     mastery: 'Vex',    weight: 2,    costCp: 500,   costLabel: '5 GP' },
  { name: 'Javelin',      damage: '1d6', damageType: 'piercing',    properties: ['thrown (30/120)'],                             mastery: 'Slow',   weight: 2,    costCp: 50,    costLabel: '5 SP' },
  { name: 'Light Hammer', damage: '1d4', damageType: 'bludgeoning', properties: ['light', 'thrown (20/60)'],                     mastery: 'Nick',   weight: 2,    costCp: 200,   costLabel: '2 GP' },
  { name: 'Mace',         damage: '1d6', damageType: 'bludgeoning', properties: [],                                              mastery: 'Sap',    weight: 4,    costCp: 500,   costLabel: '5 GP' },
  { name: 'Quarterstaff', damage: '1d6', damageType: 'bludgeoning', properties: ['versatile (1d8)'],                             mastery: 'Topple', weight: 4,    costCp: 20,    costLabel: '2 SP' },
  { name: 'Sickle',       damage: '1d4', damageType: 'slashing',    properties: ['light'],                                       mastery: 'Nick',   weight: 2,    costCp: 100,   costLabel: '1 GP' },
  { name: 'Spear',        damage: '1d6', damageType: 'piercing',    properties: ['thrown (20/60)', 'versatile (1d8)'],           mastery: 'Sap',    weight: 3,    costCp: 100,   costLabel: '1 GP' },
  // Simple Ranged
  { name: 'Dart',           damage: '1d4', damageType: 'piercing',    properties: ['finesse', 'thrown (20/60)'],                              mastery: 'Vex',  weight: 0.25, costCp: 5,    costLabel: '5 CP' },
  { name: 'Light Crossbow', damage: '1d8', damageType: 'piercing',    properties: ['ammunition (80/320; bolt)', 'loading', 'two-handed'],     mastery: 'Slow', weight: 5,    costCp: 2500, costLabel: '25 GP' },
  { name: 'Shortbow',       damage: '1d6', damageType: 'piercing',    properties: ['ammunition (80/320; arrow)', 'two-handed'],               mastery: 'Vex',  weight: 2,    costCp: 2500, costLabel: '25 GP' },
  { name: 'Sling',          damage: '1d4', damageType: 'bludgeoning', properties: ['ammunition (30/120; bullet)'],                            mastery: 'Slow', weight: 0,    costCp: 10,   costLabel: '1 SP' },
]

// ─── Martial Weapons ─────────────────────────────────────────────────────────
export const martialWeapons: readonly WeaponData[] = [
  // Martial Melee
  { name: 'Battleaxe',   damage: '1d8',  damageType: 'slashing',    properties: ['versatile (1d10)'],                                     mastery: 'Topple', weight: 4,  costCp: 1000,  costLabel: '10 GP' },
  { name: 'Flail',       damage: '1d8',  damageType: 'bludgeoning', properties: [],                                                       mastery: 'Sap',    weight: 2,  costCp: 1000,  costLabel: '10 GP' },
  { name: 'Glaive',      damage: '1d10', damageType: 'slashing',    properties: ['heavy', 'reach', 'two-handed'],                         mastery: 'Graze',  weight: 6,  costCp: 2000,  costLabel: '20 GP' },
  { name: 'Greataxe',    damage: '1d12', damageType: 'slashing',    properties: ['heavy', 'two-handed'],                                  mastery: 'Cleave', weight: 7,  costCp: 3000,  costLabel: '30 GP' },
  { name: 'Greatsword',  damage: '2d6',  damageType: 'slashing',    properties: ['heavy', 'two-handed'],                                  mastery: 'Graze',  weight: 6,  costCp: 5000,  costLabel: '50 GP' },
  { name: 'Halberd',     damage: '1d10', damageType: 'slashing',    properties: ['heavy', 'reach', 'two-handed'],                         mastery: 'Cleave', weight: 6,  costCp: 2000,  costLabel: '20 GP' },
  { name: 'Lance',       damage: '1d10', damageType: 'piercing',    properties: ['heavy', 'reach', 'two-handed (unless mounted)'],        mastery: 'Topple', weight: 6,  costCp: 1000,  costLabel: '10 GP' },
  { name: 'Longsword',   damage: '1d8',  damageType: 'slashing',    properties: ['versatile (1d10)'],                                     mastery: 'Sap',    weight: 3,  costCp: 1500,  costLabel: '15 GP' },
  { name: 'Maul',        damage: '2d6',  damageType: 'bludgeoning', properties: ['heavy', 'two-handed'],                                  mastery: 'Topple', weight: 10, costCp: 1000,  costLabel: '10 GP' },
  { name: 'Morningstar', damage: '1d8',  damageType: 'piercing',    properties: [],                                                       mastery: 'Sap',    weight: 4,  costCp: 1500,  costLabel: '15 GP' },
  { name: 'Pike',        damage: '1d10', damageType: 'piercing',    properties: ['heavy', 'reach', 'two-handed'],                         mastery: 'Push',   weight: 18, costCp: 500,   costLabel: '5 GP' },
  { name: 'Rapier',      damage: '1d8',  damageType: 'piercing',    properties: ['finesse'],                                              mastery: 'Vex',    weight: 2,  costCp: 2500,  costLabel: '25 GP' },
  { name: 'Scimitar',    damage: '1d6',  damageType: 'slashing',    properties: ['finesse', 'light'],                                     mastery: 'Nick',   weight: 3,  costCp: 2500,  costLabel: '25 GP' },
  { name: 'Shortsword',  damage: '1d6',  damageType: 'piercing',    properties: ['finesse', 'light'],                                     mastery: 'Vex',    weight: 2,  costCp: 1000,  costLabel: '10 GP' },
  { name: 'Trident',     damage: '1d8',  damageType: 'piercing',    properties: ['thrown (20/60)', 'versatile (1d10)'],                   mastery: 'Topple', weight: 4,  costCp: 500,   costLabel: '5 GP' },
  { name: 'Warhammer',   damage: '1d8',  damageType: 'bludgeoning', properties: ['versatile (1d10)'],                                     mastery: 'Push',   weight: 5,  costCp: 1500,  costLabel: '15 GP' },
  { name: 'War Pick',    damage: '1d8',  damageType: 'piercing',    properties: ['versatile (1d10)'],                                     mastery: 'Sap',    weight: 2,  costCp: 500,   costLabel: '5 GP' },
  { name: 'Whip',        damage: '1d4',  damageType: 'slashing',    properties: ['finesse', 'reach'],                                     mastery: 'Slow',   weight: 3,  costCp: 200,   costLabel: '2 GP' },
  // Martial Ranged
  { name: 'Blowgun',        damage: '1',    damageType: 'piercing', properties: ['ammunition (25/100; needle)', 'loading'],                          mastery: 'Vex',  weight: 1,  costCp: 1000,  costLabel: '10 GP' },
  { name: 'Hand Crossbow',  damage: '1d6',  damageType: 'piercing', properties: ['ammunition (30/120; bolt)', 'light', 'loading'],                   mastery: 'Vex',  weight: 3,  costCp: 7500,  costLabel: '75 GP' },
  { name: 'Heavy Crossbow', damage: '1d10', damageType: 'piercing', properties: ['ammunition (100/400; bolt)', 'heavy', 'loading', 'two-handed'],    mastery: 'Push', weight: 18, costCp: 5000,  costLabel: '50 GP' },
  { name: 'Longbow',        damage: '1d8',  damageType: 'piercing', properties: ['ammunition (150/600; arrow)', 'heavy', 'two-handed'],              mastery: 'Slow', weight: 2,  costCp: 5000,  costLabel: '50 GP' },
  { name: 'Musket',         damage: '1d12', damageType: 'piercing', properties: ['ammunition (40/120; bullet)', 'loading', 'two-handed'],            mastery: 'Slow', weight: 10, costCp: 50000, costLabel: '500 GP' },
  { name: 'Pistol',         damage: '1d10', damageType: 'piercing', properties: ['ammunition (30/90; bullet)', 'loading'],                           mastery: 'Vex',  weight: 3,  costCp: 25000, costLabel: '250 GP' },
]

// ─── Armor (2024 costs) ──────────────────────────────────────────────────────
export const armor: readonly ArmorData[] = [
  // Light Armor — 1 minute to don/doff
  { name: 'Padded Armor',         type: 'light',  baseAC: 11, maxDexBonus: null, stealthDisadvantage: true,  weight: 8,  strengthReq: 0,  costCp: 500,    costLabel: '5 GP' },
  { name: 'Leather Armor',        type: 'light',  baseAC: 11, maxDexBonus: null, stealthDisadvantage: false, weight: 10, strengthReq: 0,  costCp: 1000,   costLabel: '10 GP' },
  { name: 'Studded Leather Armor', type: 'light', baseAC: 12, maxDexBonus: null, stealthDisadvantage: false, weight: 13, strengthReq: 0,  costCp: 4500,   costLabel: '45 GP' },
  // Medium Armor — 5 min to don, 1 min to doff
  { name: 'Hide Armor',           type: 'medium', baseAC: 12, maxDexBonus: 2,    stealthDisadvantage: false, weight: 12, strengthReq: 0,  costCp: 1000,   costLabel: '10 GP' },
  { name: 'Chain Shirt',          type: 'medium', baseAC: 13, maxDexBonus: 2,    stealthDisadvantage: false, weight: 20, strengthReq: 0,  costCp: 5000,   costLabel: '50 GP' },
  { name: 'Scale Mail',           type: 'medium', baseAC: 14, maxDexBonus: 2,    stealthDisadvantage: true,  weight: 45, strengthReq: 0,  costCp: 5000,   costLabel: '50 GP' },
  { name: 'Breastplate',          type: 'medium', baseAC: 14, maxDexBonus: 2,    stealthDisadvantage: false, weight: 20, strengthReq: 0,  costCp: 40000,  costLabel: '400 GP' },
  { name: 'Half Plate Armor',     type: 'medium', baseAC: 15, maxDexBonus: 2,    stealthDisadvantage: true,  weight: 40, strengthReq: 0,  costCp: 75000,  costLabel: '750 GP' },
  // Heavy Armor — 10 min to don, 5 min to doff
  { name: 'Ring Mail',            type: 'heavy',  baseAC: 14, maxDexBonus: 0,    stealthDisadvantage: true,  weight: 40, strengthReq: 0,  costCp: 3000,   costLabel: '30 GP' },
  { name: 'Chain Mail',           type: 'heavy',  baseAC: 16, maxDexBonus: 0,    stealthDisadvantage: true,  weight: 55, strengthReq: 13, costCp: 7500,   costLabel: '75 GP' },
  { name: 'Splint Armor',         type: 'heavy',  baseAC: 17, maxDexBonus: 0,    stealthDisadvantage: true,  weight: 60, strengthReq: 15, costCp: 20000,  costLabel: '200 GP' },
  { name: 'Plate Armor',          type: 'heavy',  baseAC: 18, maxDexBonus: 0,    stealthDisadvantage: true,  weight: 65, strengthReq: 15, costCp: 150000, costLabel: '1,500 GP' },
  // Shield — Utilize action
  { name: 'Shield',               type: 'shield', baseAC: 2,  maxDexBonus: null, stealthDisadvantage: false, weight: 6,  strengthReq: 0,  costCp: 1000,   costLabel: '10 GP' },
]

// ─── Adventuring Gear (PHB 2024) ─────────────────────────────────────────────
// Catálogo de equipo general. Cubre los items más usados en mesa. La lista no
// pretende ser exhaustiva (el PHB tiene varias decenas más con precios
// curiosos); incluye lo que un PJ típico maneja, agrupado por categoría.

export const adventuringGear: readonly GearItem[] = [
  // ─── Containers ─────────────────────────────────────────────────────────
  { id: 'backpack', name: 'Backpack',          category: 'container',  weight: 5,   costCp: 200,   costLabel: '2 GP',  description: 'Holds 1 cubic foot or 30 pounds.' },
  { id: 'entertainers-pack', name: "Entertainer's Pack", category: 'container',  weight: 58.5,costCp: 4000,  costLabel: '40 GP', description: 'Backpack, bedroll, bell, bullseye lantern, costumes, mirror, oil, rations, tinderbox, and waterskin.' },
  { id: 'pouch', name: 'Pouch',             category: 'container',  weight: 1,   costCp: 50,    costLabel: '5 SP',  description: 'Holds 1/5 cubic foot or 6 pounds.' },
  { id: 'sack', name: 'Sack',              category: 'container',  weight: 0.5, costCp: 1,     costLabel: '1 CP',  description: 'Holds 1 cubic foot or 30 pounds.' },
  { id: 'chest', name: 'Chest',             category: 'container',  weight: 25,  costCp: 500,   costLabel: '5 GP',  description: 'Holds 12 cubic feet or 300 pounds.' },
  { id: 'vial', name: 'Vial',              category: 'container',  weight: 0,   costCp: 100,   costLabel: '1 GP',  description: 'Holds 4 ounces of liquid.' },
  { id: 'flask', name: 'Flask',             category: 'container',  weight: 1,   costCp: 2,     costLabel: '2 CP',  description: 'Holds 1 pint of liquid.' },
  { id: 'waterskin', name: 'Waterskin',         category: 'container',  weight: 5,   costCp: 20,    costLabel: '2 SP',  description: 'Holds 4 pints of liquid (full).' },

  // ─── Light sources ──────────────────────────────────────────────────────
  { id: 'torch', name: 'Torch',             category: 'light',      weight: 1,   costCp: 1,     costLabel: '1 CP',  description: 'Burns 1 hour. Bright light 20 ft, dim 20 more.' },
  { id: 'candle', name: 'Candle',            category: 'light',      weight: 0,   costCp: 1,     costLabel: '1 CP',  description: 'Burns 1 hour. Bright light 5 ft, dim 5 more.' },
  { id: 'lantern-hooded', name: 'Lantern, Hooded',   category: 'light',      weight: 2,   costCp: 500,   costLabel: '5 GP',  description: 'Burns 1 hour on 1 flask of oil. Bright 30 ft, dim 30 more. Can be hooded to dim 5 ft.' },
  { id: 'lantern-bullseye', name: 'Lantern, Bullseye', category: 'light',      weight: 2,   costCp: 1000,  costLabel: '10 GP', description: 'Burns 1 hour on 1 flask of oil. Bright 60-ft cone, dim 60 more.' },
  { id: 'oil-flask', name: 'Oil, Flask',        category: 'light',      weight: 1,   costCp: 10,    costLabel: '1 SP',  description: 'Fuels a lantern for 6 hours. Splash for fire damage when ignited.' },
  { id: 'tinderbox', name: 'Tinderbox',         category: 'light',      weight: 1,   costCp: 50,    costLabel: '5 SP',  description: 'Lights a torch in 1 action, or starts a fire in 1 minute.' },

  // ─── Tools (non-tool-proficiency items) ─────────────────────────────────
  { id: 'viol', name: 'Viol',              category: 'tool',       weight: 1,   costCp: 3000,  costLabel: '30 GP' },
  { id: 'thieves-tools', name: "Thieves' Tools",    category: 'tool',       weight: 1,   costCp: 2500,  costLabel: '25 GP' },
  { id: 'gaming-set', name: 'Gaming Set',        category: 'tool',       weight: 0,   costCp: 100,   costLabel: '1 GP' },
  { id: 'crowbar', name: 'Crowbar',           category: 'tool',       weight: 5,   costCp: 200,   costLabel: '2 GP',  description: 'Advantage on STR checks where leverage helps.' },
  { id: 'hammer', name: 'Hammer',            category: 'tool',       weight: 3,   costCp: 100,   costLabel: '1 GP' },
  { id: 'hammer-sledge', name: 'Hammer, Sledge',    category: 'tool',       weight: 10,  costCp: 200,   costLabel: '2 GP' },
  { id: 'piton', name: 'Piton',             category: 'tool',       weight: 0.25,costCp: 5,     costLabel: '5 CP' },
  { id: 'shovel', name: 'Shovel',            category: 'tool',       weight: 5,   costCp: 200,   costLabel: '2 GP' },
  { id: 'manacles', name: 'Manacles',          category: 'tool',       weight: 6,   costCp: 200,   costLabel: '2 GP',  description: 'DC 20 STR check to break; DC 20 Sleight of Hand check to pick.' },
  { id: 'spyglass', name: 'Spyglass',          category: 'tool',       weight: 1,   costCp: 100000,costLabel: '1,000 GP', description: 'Objects viewed appear twice as large.' },
  { id: 'magnifying-glass', name: 'Magnifying Glass',  category: 'tool',       weight: 0,   costCp: 10000, costLabel: '100 GP', description: 'Can substitute for flint and steel to start fires.' },
  { id: 'hourglass', name: 'Hourglass',         category: 'tool',       weight: 1,   costCp: 2500,  costLabel: '25 GP' },

  // ─── Consumables / supplies ─────────────────────────────────────────────
  { id: 'rations', name: 'Rations (1 day)',   category: 'consumable', weight: 2,   costCp: 50,    costLabel: '5 SP',  description: 'Travel-ready food.' },
  { id: 'potion-of-healing', name: 'Potion of Healing', category: 'consumable', weight: 0.5, costCp: 5000,  costLabel: '50 GP', description: 'Drink (Bonus Action): regain 2d4 + 2 HP.' },
  { id: 'acid-vial', name: 'Acid (Vial)',       category: 'consumable', weight: 1,   costCp: 2500,  costLabel: '25 GP', description: 'Action: throw at one creature, ranged attack, hit = 2d6 acid damage.' },
  { id: 'alchemists-fire', name: 'Alchemist’s Fire',  category: 'consumable', weight: 1,   costCp: 5000,  costLabel: '50 GP', description: 'Action: thrown improvised weapon, hit ignites target for 1d4 fire damage each turn.' },
  { id: 'antitoxin', name: 'Antitoxin',         category: 'consumable', weight: 0,   costCp: 5000,  costLabel: '50 GP', description: 'Drink: advantage on saves vs Poison for 1 hour.' },
  { id: 'holy-water', name: 'Holy Water (Flask)',category: 'consumable', weight: 1,   costCp: 2500,  costLabel: '25 GP', description: 'Improvised weapon vs Fiends/Undead, 2d6 radiant damage.' },
  { id: 'caltrops', name: 'Caltrops, Bag of 20',category: 'consumable',weight: 2,   costCp: 100,   costLabel: '1 GP',  description: 'Cover 5-ft square. Creatures save or take 1 piercing and Speed halved.' },
  { id: 'ball-bearings', name: 'Ball Bearings, Bag of 1,000', category: 'consumable', weight: 2, costCp: 100, costLabel: '1 GP', description: 'Cover 10-ft square. Creatures save or fall Prone.' },

  // ─── Utility / general ──────────────────────────────────────────────────
  { id: 'rope', name: 'Rope, Hempen (50 ft)',  category: 'utility', weight: 10, costCp: 100,  costLabel: '1 GP',   description: 'AC 11, 5 HP, can be burst with DC 17 STR check.' },
  // #156 — Variante a media longitud, útil cuando el PJ va encumbered o no
  // necesita los 50 ft completos. Mitad de peso (5 lb) y mitad de coste (5 SP).
  { id: 'rope-25', name: 'Rope, Hempen (25 ft)',  category: 'utility', weight: 5,  costCp: 50,   costLabel: '5 SP',   description: 'Half-length variant. AC 11, 3 HP.' },
  { id: 'rope-silk', name: 'Rope, Silk (50 ft)',    category: 'utility', weight: 5,  costCp: 1000, costLabel: '10 GP',  description: 'AC 11, 5 HP, can be burst with DC 17 STR check.' },
  { id: 'chain', name: 'Chain (10 ft)',         category: 'utility', weight: 10, costCp: 500,  costLabel: '5 GP',   description: 'AC 19, 10 HP. DC 20 STR check to break.' },
  { id: 'grappling-hook', name: 'Grappling Hook',        category: 'utility', weight: 4,  costCp: 200,  costLabel: '2 GP' },
  { id: 'ladder', name: 'Ladder (10-foot)',      category: 'utility', weight: 25, costCp: 10,   costLabel: '1 SP' },
  { id: 'bell', name: 'Bell',                  category: 'utility', weight: 0,  costCp: 100,  costLabel: '1 GP' },
  { id: 'whistle-signal', name: 'Whistle, Signal',       category: 'utility', weight: 0,  costCp: 5,    costLabel: '5 CP' },
  { id: 'mirror-steel', name: 'Mirror, Steel',         category: 'utility', weight: 0.5,costCp: 500,  costLabel: '5 GP' },
  { id: 'lock', name: 'Lock',                  category: 'utility', weight: 1,  costCp: 1000, costLabel: '10 GP',  description: 'DC 15 Sleight of Hand check to pick.' },
  { id: 'ink', name: 'Ink (1-oz bottle)',     category: 'utility', weight: 0,  costCp: 1000, costLabel: '10 GP' },
  { id: 'ink-pen', name: 'Ink Pen',               category: 'utility', weight: 0,  costCp: 2,    costLabel: '2 CP' },
  { id: 'parchment', name: 'Parchment (1 sheet)',   category: 'utility', weight: 0,  costCp: 10,   costLabel: '1 SP' },
  { id: 'paper', name: 'Paper (1 sheet)',       category: 'utility', weight: 0,  costCp: 20,   costLabel: '2 SP' },
  { id: 'sealing-wax', name: 'Sealing Wax',           category: 'utility', weight: 0,  costCp: 50,   costLabel: '5 SP' },
  { id: 'soap', name: 'Soap',                  category: 'utility', weight: 0,  costCp: 2,    costLabel: '2 CP' },
  { id: 'perfume', name: 'Perfume (Vial)',        category: 'utility', weight: 0,  costCp: 500,  costLabel: '5 GP' },
  { id: 'signet-ring', name: 'Signet Ring',           category: 'utility', weight: 0,  costCp: 500,  costLabel: '5 GP' },
  { id: 'component-pouch', name: 'Component Pouch',       category: 'utility', weight: 2,  costCp: 2500, costLabel: '25 GP',  description: 'Holds material spell components without specified cost.' },

  // ─── Survival / outdoor ─────────────────────────────────────────────────
  { id: 'bedroll', name: 'Bedroll',               category: 'survival', weight: 7, costCp: 100,  costLabel: '1 GP' },
  { id: 'blanket', name: 'Blanket',               category: 'survival', weight: 3, costCp: 50,   costLabel: '5 SP' },
  { id: 'mess-kit', name: 'Mess Kit',              category: 'survival', weight: 1, costCp: 20,   costLabel: '2 SP' },
  { id: 'tent', name: 'Tent, 2-person',        category: 'survival', weight: 20,costCp: 200,  costLabel: '2 GP' },
  { id: 'climbers-kit', name: 'Climber’s Kit',         category: 'survival', weight: 12,costCp: 2500, costLabel: '25 GP',  description: 'Pitons, boots, gloves, harness. Anchored, max 25 ft fall.' },
  { id: 'healers-kit', name: 'Healer’s Kit',          category: 'survival', weight: 3, costCp: 500,  costLabel: '5 GP',   description: '10 uses. Action: stabilize a creature at 0 HP without a Medicine check.' },
  { id: 'hunting-trap', name: 'Hunting Trap',          category: 'survival', weight: 25,costCp: 500,  costLabel: '5 GP',   description: 'When stepped on: DC 13 DEX save or take 1d4 piercing and Speed 0 until freed.' },
  { id: 'fishing-tackle', name: 'Fishing Tackle',        category: 'survival', weight: 4, costCp: 100,  costLabel: '1 GP' },
  { id: 'hunting-bow-string', name: 'Hunting Bow String',    category: 'survival', weight: 0, costCp: 50,   costLabel: '5 SP' },

  // ─── Clothing ───────────────────────────────────────────────────────────
  { id: 'clothes-common', name: 'Clothes, Common',       category: 'clothing', weight: 3, costCp: 50,   costLabel: '5 SP' },
  { id: 'clothes-fine', name: 'Clothes, Fine',         category: 'clothing', weight: 6, costCp: 1500, costLabel: '15 GP' },
  { id: 'travelers-clothes', name: 'Clothes, Traveler’s',   category: 'clothing', weight: 4, costCp: 200,  costLabel: '2 GP' },
  { id: 'clothes-costume', name: 'Clothes, Costume',      category: 'clothing', weight: 4, costCp: 500,  costLabel: '5 GP' },
  { id: 'robes', name: 'Robes',                 category: 'clothing', weight: 4, costCp: 100,  costLabel: '1 GP' },
] as const

// ─── Equipment Packs (2024) ──────────────────────────────────────────────────
export const equipmentData: EquipmentSet = {
  simpleWeapons: [...simpleWeapons],
  martialWeapons: [...martialWeapons],
  armor: [...armor],
  packs: [
    {
      name: "Burglar's Pack",
      items: ['Backpack', 'Bag of 1,000 ball bearings', '10 feet of string', 'Bell', '5 candles', 'Crowbar', 'Hammer', '10 pitons', 'Hooded lantern', '2 flasks of oil', '5 days rations', 'Tinderbox', 'Waterskin', '50 feet of hempen rope'],
    },
    {
      name: "Diplomat's Pack",
      items: ['Chest', '2 cases for maps and scrolls', 'Fine clothes', 'Bottle of ink', 'Ink pen', 'Lamp', '2 flasks of oil', '5 sheets of paper', 'Vial of perfume', 'Sealing wax', 'Soap'],
    },
    {
      name: "Dungeoneer's Pack",
      items: ['Backpack', 'Crowbar', 'Hammer', '10 pitons', '10 torches', 'Tinderbox', '10 days of rations', 'Waterskin', '50 feet of hempen rope'],
    },
    {
      name: "Entertainer's Pack",
      items: ['Backpack', 'Bedroll', '2 costumes', '5 candles', '5 days of rations', 'Waterskin', 'Disguise kit'],
    },
    {
      name: "Explorer's Pack",
      items: ['Backpack', 'Bedroll', 'Mess kit', 'Tinderbox', '10 torches', '10 days of rations', 'Waterskin', '50 feet of hempen rope'],
    },
    {
      name: "Priest's Pack",
      items: ['Backpack', 'Blanket', '10 candles', 'Tinderbox', 'Alms box', '2 blocks of incense', 'Censer', 'Vestments', '2 days of rations', 'Waterskin'],
    },
    {
      name: "Scholar's Pack",
      items: ['Backpack', 'Book of lore', 'Bottle of ink', 'Ink pen', '10 sheets of parchment', 'Little bag of sand', 'Small knife'],
    },
  ],
}

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export function getWeaponByName(name: string): WeaponData | undefined {
  return [...simpleWeapons, ...martialWeapons].find(w => w.name.toLowerCase() === name.toLowerCase())
}

export function getArmorByName(name: string): ArmorData | undefined {
  return armor.find(a => a.name.toLowerCase() === name.toLowerCase())
}

export function getWeaponsByMastery(mastery: MasteryProperty): WeaponData[] {
  return [...simpleWeapons, ...martialWeapons].filter(w => w.mastery === mastery)
}

export function getGearByName(name: string): GearItem | undefined {
  return adventuringGear.find(g => g.name.toLowerCase() === name.toLowerCase())
}

export function getGearById(id: string): GearItem | undefined {
  return adventuringGear.find(g => g.id === id)
}
