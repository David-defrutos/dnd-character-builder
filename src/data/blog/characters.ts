// Documento generado el 2026-05-19 — Sprint G: limpieza variantes italianas
// Solo contiene personajes D&D 5e (variantes Brancalonia/Apocalisse eliminadas).

import type { GameVariant } from '@/stores/app'
import type { CharacterData } from '@/stores/character'

// ─── Blog Character Interface ────────────────────────────────────────────────

export interface BlogCharacter {
  /** URL-safe slug in classe-razza-nome format */
  slug: string
  variant: GameVariant
  characterData: CharacterData
  tags: string[]
}

// ─── D&D 5e Character Imports ────────────────────────────────────────────────

import { elaraNightwhisper } from './dnd5e/elara-nightwhisper'
import { grokkIronfang } from './dnd5e/grokk-ironfang'
import { lyraSilvertongue } from './dnd5e/lyra-silvertongue'
import { thordinStoneheart } from './dnd5e/thordin-stoneheart'
import { rowanAshwood } from './dnd5e/rowan-ashwood'
import { beraBattlehammer } from './dnd5e/bera-battlehammer'
import { kaelWindwalker } from './dnd5e/kael-windwalker'
import { varekBrightscale } from './dnd5e/varek-brightscale'
import { pipShadowfoot } from './dnd5e/pip-shadowfoot'
import { zaraHellfire } from './dnd5e/zara-hellfire'
import { vexNightpact } from './dnd5e/vex-nightpact'
import { aldricSpellweaver } from './dnd5e/aldric-spellweaver'
import { fizzleGearspark } from './dnd5e/fizzle-gearspark'
import { bramThickfoot } from './dnd5e/bram-thickfoot'
import { thistleMossheart } from './dnd5e/thistle-mossheart'
import { araelDawnwhisper } from './dnd5e/arael-dawnwhisper'
import { nyxShadowcloak } from './dnd5e/nyx-shadowcloak'
import { serRolandTheBold } from './dnd5e/ser-roland-the-bold'
import { cassaraStarbloom } from './dnd5e/cassara-starbloom'
import { morthosGrimsoul } from './dnd5e/morthos-grimsoul'
import { fernWildbloom } from './dnd5e/fern-wildbloom'
import { skarFlamerage } from './dnd5e/skar-flamerage'
import { marcoFortunato } from './dnd5e/marco-fortunato'

// ─── Blog character registry ─────────────────────────────────────────────────

export const blogCharacters: BlogCharacter[] = [
  { slug: 'ranger-elf-elara-nightwhisper',       variant: 'dnd5e', characterData: elaraNightwhisper,   tags: ['ranger', 'elf', 'dnd5e'] },
  { slug: 'barbarian-orc-grokk-ironfang',         variant: 'dnd5e', characterData: grokkIronfang,       tags: ['barbarian', 'orc', 'dnd5e'] },
  { slug: 'bard-human-lyra-silvertongue',          variant: 'dnd5e', characterData: lyraSilvertongue,    tags: ['bard', 'human', 'dnd5e'] },
  { slug: 'fighter-dwarf-thordin-stoneheart',      variant: 'dnd5e', characterData: thordinStoneheart,   tags: ['fighter', 'dwarf', 'dnd5e'] },
  { slug: 'druid-human-rowan-ashwood',             variant: 'dnd5e', characterData: rowanAshwood,        tags: ['druid', 'human', 'dnd5e'] },
  { slug: 'barbarian-dwarf-bera-battlehammer',     variant: 'dnd5e', characterData: beraBattlehammer,    tags: ['barbarian', 'dwarf', 'dnd5e'] },
  { slug: 'monk-human-kael-windwalker',            variant: 'dnd5e', characterData: kaelWindwalker,      tags: ['monk', 'human', 'dnd5e'] },
  { slug: 'sorcerer-dragonborn-varek-brightscale', variant: 'dnd5e', characterData: varekBrightscale,    tags: ['sorcerer', 'dragonborn', 'dnd5e'] },
  { slug: 'rogue-halfling-pip-shadowfoot',         variant: 'dnd5e', characterData: pipShadowfoot,       tags: ['rogue', 'halfling', 'dnd5e'] },
  { slug: 'warlock-tiefling-zara-hellfire',        variant: 'dnd5e', characterData: zaraHellfire,        tags: ['warlock', 'tiefling', 'dnd5e'] },
  { slug: 'warlock-elf-vex-nightpact',             variant: 'dnd5e', characterData: vexNightpact,        tags: ['warlock', 'elf', 'dnd5e'] },
  { slug: 'wizard-human-aldric-spellweaver',       variant: 'dnd5e', characterData: aldricSpellweaver,   tags: ['wizard', 'human', 'dnd5e'] },
  { slug: 'artificer-gnome-fizzle-gearspark',      variant: 'dnd5e', characterData: fizzleGearspark,     tags: ['artificer', 'gnome', 'dnd5e'] },
  { slug: 'paladin-halfling-bram-thickfoot',       variant: 'dnd5e', characterData: bramThickfoot,       tags: ['paladin', 'halfling', 'dnd5e'] },
  { slug: 'ranger-gnome-thistle-mossheart',        variant: 'dnd5e', characterData: thistleMossheart,    tags: ['ranger', 'gnome', 'dnd5e'] },
  { slug: 'cleric-elf-arael-dawnwhisper',          variant: 'dnd5e', characterData: araelDawnwhisper,    tags: ['cleric', 'elf', 'dnd5e'] },
  { slug: 'rogue-tiefling-nyx-shadowcloak',        variant: 'dnd5e', characterData: nyxShadowcloak,      tags: ['rogue', 'tiefling', 'dnd5e'] },
  { slug: 'fighter-human-ser-roland-the-bold',     variant: 'dnd5e', characterData: serRolandTheBold,    tags: ['fighter', 'human', 'dnd5e'] },
  { slug: 'druid-elf-cassara-starbloom',           variant: 'dnd5e', characterData: cassaraStarbloom,    tags: ['druid', 'elf', 'dnd5e'] },
  { slug: 'warlock-tiefling-morthos-grimsoul',     variant: 'dnd5e', characterData: morthosGrimsoul,     tags: ['warlock', 'tiefling', 'dnd5e'] },
  { slug: 'druid-human-fern-wildbloom',            variant: 'dnd5e', characterData: fernWildbloom,       tags: ['druid', 'human', 'dnd5e'] },
  { slug: 'barbarian-orc-skar-flamerage',          variant: 'dnd5e', characterData: skarFlamerage,       tags: ['barbarian', 'orc', 'dnd5e'] },
  { slug: 'fighter-human-marco-fortunato',         variant: 'dnd5e', characterData: marcoFortunato,      tags: ['fighter', 'human', 'dnd5e'] },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getBlogCharacterBySlug(slug: string): BlogCharacter | undefined {
  return blogCharacters.find(c => c.slug === slug)
}

export function getBlogCharactersByVariant(variant: GameVariant): BlogCharacter[] {
  return blogCharacters.filter(c => c.variant === variant)
}
