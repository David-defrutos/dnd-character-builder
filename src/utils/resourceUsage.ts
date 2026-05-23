/**
 * Limited-use resources tracker (bug #78).
 *
 * Devuelve la lista de recursos con usos limitados que el personaje tiene
 * disponibles según su clase, nivel, raza y feats. La tabla en el PDF anexo
 * (hoja final) tiene una columna con el nombre, otra con el número máximo
 * de usos y una columna en blanco para apuntar a mano los gastados.
 *
 * Diseño:
 *   - Catálogo declarativo: cada entrada describe cómo calcular los usos
 *     para un recurso concreto (Action Surge, Channel Divinity, Second Wind,
 *     Breath Weapon, Unleash Incarnation, etc.).
 *   - La derivación es defensiva: si una clase no tiene la columna esperada
 *     en `progression`, simplemente no añadimos esa fila.
 *   - No intenta parsear el texto libre de las descripciones — solo lee
 *     campos estructurados (class.progression, class.features[].level,
 *     race.id, asiChoices[].featId).
 *
 * Entradas posibles para "usos":
 *   - Número entero: "3"
 *   - Texto: "PB" (Proficiency Bonus), "CON+ (min 1)" (modificador, con suelo)
 *     cuando se quiere mostrar la fórmula en vez del valor calculado.
 *   Aquí preferimos siempre el número final calculado (más útil en la mesa).
 */

import type { CharacterData } from '@/stores/character'
import { getClassById } from '@/data/dnd5e/classes'
import { getFeatById } from '@/data/dnd5e/feats'
import { proficiencyBonus, modifier } from './calculations'

export interface ResourceUsage {
  /** Display name (e.g. "Action Surge", "Channel Divinity"). */
  name: string
  /** Maximum number of uses available at the character's current level. */
  uses: number
  /** Recharge interval (e.g. "long rest", "short or long rest"). */
  recharge: string
  /** Optional source tag for context ("Fighter lv.2", "Dragonborn", ...). */
  source?: string
  /** Optional unit for the Max column. Empty for plain counters; "HP" for
   *  pool resources like Paladin Lay on Hands (Max = "50 HP"). Used by the
   *  PDF appendix renderer to format the Max cell. */
  unit?: string
}

/** Total ability score (base + species + background + ASI bonuses). */
function totalAbility(char: CharacterData, key: keyof CharacterData['abilityScores']): number {
  const base = char.abilityScores[key] ?? 10
  const species = char.speciesBonuses?.[key] ?? 0
  const bg = char.backgroundBonuses?.[key] ?? 0
  const asi = char.asiBonuses?.[key] ?? 0
  return base + species + bg + asi
}

function abilityMod(char: CharacterData, key: keyof CharacterData['abilityScores']): number {
  return modifier(totalAbility(char, key))
}

/** Look up a progression column value for the character's level. */
function progressionAt(char: CharacterData, columnKey: string): number | undefined {
  const cls = getClassById(char.className)
  if (!cls?.progression) return undefined
  const arr = cls.progression[columnKey]
  if (!arr) return undefined
  const idx = Math.max(0, Math.min(char.level - 1, arr.length - 1))
  const v = arr[idx]
  return typeof v === 'number' ? v : undefined
}

/** Has the character unlocked a feature (by id) at their current level? */
function hasFeature(char: CharacterData, featureId: string): boolean {
  const cls = getClassById(char.className)
  if (!cls) return false
  // class features
  if (cls.features.some(f => f.id === featureId && f.level <= char.level)) return true
  // subclass features
  if (char.subclass) {
    const sub = cls.subclasses.find(s => s.id === char.subclass)
    if (sub?.features.some(f => f.id === featureId && f.level <= char.level)) return true
  }
  return false
}

/** Build the per-character list of limited-use resources. */
export function getLimitedResources(char: CharacterData): ResourceUsage[] {
  const out: ResourceUsage[] = []
  const cls = getClassById(char.className)
  const pb = proficiencyBonus(char.level)

  // ─── Class-based resources ──────────────────────────────────────────────
  if (cls) {
    // Barbarian — Rages (per long rest, table)
    const rages = progressionAt(char, 'rages')
    if (rages !== undefined && hasFeature(char, 'rage')) {
      out.push({ name: 'Rage', uses: rages, recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Bard — Bardic Inspiration (#119)
    // Uses = max(1, CHA mod) per PHB 2024. Recharge: long rest, short or long from lv.5
    // (Font of Inspiration). Die size escala con bardicDie pero la columna del PDF es
    // un contador de USOS, no de tamaño de dado. El tamaño del dado va a la descripción.
    if (hasFeature(char, 'bardic-inspiration')) {
      const chaMod = abilityMod(char, 'cha')
      const uses = Math.max(1, chaMod)
      const recharge = char.level >= 5 ? 'short or long rest' : 'long rest'
      out.push({ name: 'Bardic Inspiration', uses, recharge, source: `${cls.name} lv.${char.level}` })
    }

    // Fighter — Second Wind (per long rest, table; one back per short rest)
    const sw = progressionAt(char, 'secondWind')
    if (sw !== undefined && hasFeature(char, 'second-wind')) {
      out.push({ name: 'Second Wind', uses: sw, recharge: 'long rest (1 back per short rest)', source: `${cls.name} lv.${char.level}` })
    }

    // Fighter — Action Surge (1 use/short rest from lv2; 2 from lv17)
    if (hasFeature(char, 'action-surge')) {
      out.push({ name: 'Action Surge', uses: char.level >= 17 ? 2 : 1, recharge: 'short or long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Fighter — Indomitable (1 use/long rest from lv9; 2 from lv13; 3 from lv17)
    if (hasFeature(char, 'indomitable')) {
      const n = char.level >= 17 ? 3 : char.level >= 13 ? 2 : 1
      out.push({ name: 'Indomitable', uses: n, recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Cleric / Paladin — Channel Divinity (table per short or long rest)
    // Nota: Cleric usa feature id 'channel-divinity', Paladin 'channel-divinity-paladin'.
    // Ambos comparten la columna `channelDivinity` en su progression.
    const cd = progressionAt(char, 'channelDivinity')
    const hasChannelDivinity = hasFeature(char, 'channel-divinity') || hasFeature(char, 'channel-divinity-paladin')
    if (cd !== undefined && cd > 0 && hasChannelDivinity) {
      out.push({ name: 'Channel Divinity', uses: cd, recharge: 'short or long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Cleric — Divine Intervention (1/long rest from lv.10) (#119)
    if (hasFeature(char, 'divine-intervention')) {
      out.push({ name: 'Divine Intervention', uses: 1, recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Druid — Wild Shape (#119: FIX leer columna wildShape; lv.20 unlimited)
    if (hasFeature(char, 'wild-shape')) {
      const wsCol = progressionAt(char, 'wildShape')
      const uses = char.level >= 20 ? 999 : (wsCol !== undefined && wsCol > 0 ? wsCol : 2)
      out.push({ name: 'Wild Shape', uses, recharge: 'short or long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Monk — Focus Points (column focusPoints, short or long rest) (#119)
    if (hasFeature(char, 'monks-focus')) {
      const fp = progressionAt(char, 'focusPoints')
      if (fp !== undefined && fp > 0) {
        out.push({ name: 'Focus Points', uses: fp, recharge: 'short or long rest', source: `${cls.name} lv.${char.level}` })
      }
    }

    // Monk — Uncanny Metabolism (1/long rest, lv.2) (#119)
    if (hasFeature(char, 'uncanny-metabolism')) {
      out.push({ name: 'Uncanny Metabolism', uses: 1, recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Paladin — Lay on Hands (HP pool = 5 × level, long rest) (#119)
    if (hasFeature(char, 'lay-on-hands')) {
      out.push({ name: 'Lay on Hands (HP Pool)', uses: 5 * char.level, unit: 'HP', recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Paladin — Paladin's Smite (1 free Divine Smite cast/long rest, lv.2) (#119)
    if (hasFeature(char, 'paladin-smite')) {
      out.push({ name: "Paladin's Smite", uses: 1, recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Paladin — Faithful Steed (1 free Find Steed cast/long rest, lv.5) (#119)
    if (hasFeature(char, 'faithful-steed')) {
      out.push({ name: 'Faithful Steed', uses: 1, recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Ranger — Favored Enemy (#119)
    // Free Hunter's Mark casts without a slot. Cantidad en columna favoredEnemy.
    if (hasFeature(char, 'favored-enemy')) {
      const fe = progressionAt(char, 'favoredEnemy')
      if (fe !== undefined && fe > 0) {
        out.push({ name: 'Favored Enemy (free Hunter\u2019s Mark)', uses: fe, recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
      }
    }

    // Sorcerer — Sorcery Points (column sorceryPoints, long rest) (#119)
    if (hasFeature(char, 'font-of-magic')) {
      const sp = progressionAt(char, 'sorceryPoints')
      if (sp !== undefined && sp > 0) {
        out.push({ name: 'Sorcery Points', uses: sp, recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
      }
    }

    // Sorcerer — Innate Sorcery (2/long rest, lv.1) (#119)
    if (hasFeature(char, 'innate-sorcery')) {
      out.push({ name: 'Innate Sorcery', uses: 2, recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Warlock — Magical Cunning (1/short rest, lv.2) (#119)
    // Nota: regenera Pact Magic slots. NO duplicamos los slots como recurso (decisión del usuario).
    if (hasFeature(char, 'magical-cunning')) {
      out.push({ name: 'Magical Cunning', uses: 1, recharge: 'short rest', source: `${cls.name} lv.${char.level}` })
    }

    // Wizard — Arcane Recovery (1/long rest, lv.1) (#119)
    if (hasFeature(char, 'arcane-recovery')) {
      out.push({ name: 'Arcane Recovery', uses: 1, recharge: 'long rest', source: `${cls.name} lv.${char.level}` })
    }
  }

  // ─── Subclass-based resources ───────────────────────────────────────────
  // Echo Knight — Unleash Incarnation (CON mod uses, min 1, per long rest)
  if (hasFeature(char, 'unleash-incarnation') || char.subclass === 'echo-knight') {
    if (char.subclass === 'echo-knight' && char.level >= 3) {
      const conMod = abilityMod(char, 'con')
      out.push({ name: 'Unleash Incarnation', uses: Math.max(1, conMod), recharge: 'long rest', source: 'Echo Knight lv.3' })
    }
  }

  // Echo Knight — Shadow Martyr (1 use per short or long rest, lv.10)
  if (char.subclass === 'echo-knight' && char.level >= 10) {
    out.push({ name: 'Shadow Martyr', uses: 1, recharge: 'short or long rest', source: 'Echo Knight lv.10' })
  }

  // Glamour Bard — Mantle of Majesty (1/long rest, lv.6) (#119)
  if (char.subclass === 'glamour' && char.className === 'bard' && char.level >= 6) {
    out.push({ name: 'Mantle of Majesty', uses: 1, recharge: 'long rest', source: 'College of Glamour lv.6' })
  }

  // Glamour Bard — Unbreakable Majesty (1/short or long rest, lv.14) (#119)
  if (char.subclass === 'glamour' && char.className === 'bard' && char.level >= 14) {
    out.push({ name: 'Unbreakable Majesty', uses: 1, recharge: 'short or long rest', source: 'College of Glamour lv.14' })
  }

  // ─── Race-based resources ───────────────────────────────────────────────
  // Dragonborn — Breath Weapon (PB uses per long rest)
  if (char.race === 'dragonborn') {
    out.push({ name: 'Breath Weapon', uses: pb, recharge: 'long rest', source: 'Dragonborn' })
    out.push({ name: 'Draconic Flight', uses: 1, recharge: 'long rest', source: 'Dragonborn lv.5+' })
  }

  // Tiefling — Hellish Resistance (passive, no usage; skip)
  // ... (otros patterns añadibles aquí en el futuro)

  // ─── Feat-based resources (#119) ────────────────────────────────────────
  // Recorre originFeatId + asiChoices[].featId. Solo los feats con usos
  // limitados aparecen aquí; Inspiring Leader, Tough, Resilient, etc. no
  // tienen contador y se omiten deliberadamente.
  const featIds: Array<{ id: string; source: string }> = []
  if (char.originFeatId) {
    featIds.push({ id: char.originFeatId, source: 'Origin Feat' })
  }
  if (char.asiChoices && char.asiChoices.length > 0) {
    for (const choice of char.asiChoices) {
      if (choice.type === 'feat' && choice.featId) {
        featIds.push({ id: choice.featId, source: `ASI Feat lv.${choice.level}` })
      }
    }
  }
  for (const { id, source } of featIds) {
    const feat = getFeatById(id)
    if (!feat) continue
    switch (id) {
      case 'lucky':
        // Luck Points = PB, recharge long rest.
        out.push({ name: 'Luck Points', uses: pb, recharge: 'long rest', source: `${source}: Lucky` })
        break
      case 'magic-initiate':
        // 1 free cast del lv.1 spell por long rest.
        out.push({ name: 'Magic Initiate (free lv.1 cast)', uses: 1, recharge: 'long rest', source: `${source}: ${feat.name}` })
        break
      case 'fey-touched':
        // 2 filas: Misty Step + lv.1 spell elegido. 1 free cast cada uno por long rest.
        out.push({ name: 'Fey-Touched: Misty Step', uses: 1, recharge: 'long rest', source: `${source}: ${feat.name}` })
        out.push({ name: 'Fey-Touched: lv.1 spell', uses: 1, recharge: 'long rest', source: `${source}: ${feat.name}` })
        break
      case 'shadow-touched':
        // 2 filas: Invisibility + lv.1 spell elegido. 1 free cast cada uno por long rest.
        out.push({ name: 'Shadow-Touched: Invisibility', uses: 1, recharge: 'long rest', source: `${source}: ${feat.name}` })
        out.push({ name: 'Shadow-Touched: lv.1 spell', uses: 1, recharge: 'long rest', source: `${source}: ${feat.name}` })
        break
      case 'ritual-caster':
        // Quick Ritual: 1 free ritual cast (sin slot) por long rest.
        out.push({ name: 'Quick Ritual', uses: 1, recharge: 'long rest', source: `${source}: ${feat.name}` })
        break
      case 'telepathic':
        // Detect Thoughts: 1 free cast por long rest.
        out.push({ name: 'Telepathic: Detect Thoughts', uses: 1, recharge: 'long rest', source: `${source}: ${feat.name}` })
        break
      case 'mage-slayer':
        // Guarded Mind: 1 reroll INT/WIS/CHA save fallado por short or long rest.
        out.push({ name: 'Guarded Mind', uses: 1, recharge: 'short or long rest', source: `${source}: ${feat.name}` })
        break
      default:
        // Otros feats sin contador (Inspiring Leader, Tough, Resilient, etc.): skip.
        break
    }
  }

  // #87: ordenar alfabéticamente por nombre. Antes el orden era el de
  // aparición en el código (Barbarian → Fighter → Cleric → ... → Race),
  // lo que dejaba "Second Wind" antes de "Action Surge" para un Fighter.
  out.sort((a, b) => a.name.localeCompare(b.name))

  return out
}
