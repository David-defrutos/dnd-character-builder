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

    // Cleric — Channel Divinity (table per short or long rest)
    const cd = progressionAt(char, 'channelDivinity')
    if (cd !== undefined && cd > 0 && hasFeature(char, 'channel-divinity')) {
      out.push({ name: 'Channel Divinity', uses: cd, recharge: 'short or long rest', source: `${cls.name} lv.${char.level}` })
    }

    // Druid — Wild Shape (2/short or long rest; lv.20 unlimited)
    if (hasFeature(char, 'wild-shape')) {
      out.push({ name: 'Wild Shape', uses: char.level >= 20 ? 999 : 2, recharge: 'short or long rest', source: `${cls.name} lv.${char.level}` })
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

  // ─── Race-based resources ───────────────────────────────────────────────
  // Dragonborn — Breath Weapon (PB uses per long rest)
  if (char.race === 'dragonborn') {
    out.push({ name: 'Breath Weapon', uses: pb, recharge: 'long rest', source: 'Dragonborn' })
    out.push({ name: 'Draconic Flight', uses: 1, recharge: 'long rest', source: 'Dragonborn lv.5+' })
  }

  // Tiefling — Hellish Resistance (passive, no usage; skip)
  // ... (otros patterns añadibles aquí en el futuro)

  // #87: ordenar alfabéticamente por nombre. Antes el orden era el de
  // aparición en el código (Barbarian → Fighter → Cleric → ... → Race),
  // lo que dejaba "Second Wind" antes de "Action Surge" para un Fighter.
  out.sort((a, b) => a.name.localeCompare(b.name))

  return out
}
