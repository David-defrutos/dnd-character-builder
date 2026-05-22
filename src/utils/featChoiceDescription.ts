// #107 — Describe la ELECCIÓN concreta que el jugador hizo al tomar un feat,
// para mostrarla junto al nombre del feat en la ficha y en el PDF anexo.
//
// Ejemplos:
//   - Resilient (lv.6, WIS=15)         → "WIS"
//   - Crossbow Expert (lv.4, +1 DEX)   → "+1 DEX"
//   - Skilled (lv.4, Acrobatics, ...)  → "Acrobatics, Stealth, Perception"
//   - Fighting Style: Archery          → "Archery — +2 to ranged weapon attacks"
//   - Magic Initiate: Cleric           → "Cleric: Guidance, Resistance, Bless"
//
// La descripción devuelta NUNCA incluye el nombre del feat (eso ya lo pone
// quien llama). Devuelve "" si el feat no tiene elección no trivial.

import type { CharacterData, ASIChoice } from '@/stores/character'
import { getFeatById } from '@/data/dnd5e/feats'
import type { Feat } from '@/data/dnd5e/feats'

/** Mayúsculas para abilities ('wis' → 'WIS'). */
function up(ab: string): string {
  return ab.toUpperCase()
}

/** Capitaliza primera letra ('stealth' → 'Stealth', 'sleight-of-hand' → 'Sleight Of Hand'). */
function cap(s: string): string {
  return s.split(/[-\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Descripción de la elección hecha en un ASIChoice tipo 'feat'.
 * Devuelve "" si el feat no requiere elección o si la elección no se hizo.
 */
export function describeAsiFeatChoice(choice: ASIChoice, char: CharacterData): string {
  if (choice.type !== 'feat' || !choice.featId) return ''
  const feat = getFeatById(choice.featId)
  if (!feat) return ''

  const parts: string[] = []

  // 1. featAbility: aplica a Resilient (saving throw) y a feats con asiBonus
  //    multi-opción (ej. Crusher: STR/CON, Resilient: cualquier ability).
  if (choice.featAbility) {
    if (feat.grantsSavingThrowProficiency) {
      // Resilient: la ability ELEGIDA es para qué ST se gana.
      parts.push(up(choice.featAbility))
    } else if (feat.asiBonus && feat.asiBonus.abilities.length > 1) {
      // Crusher, Piercer, Slasher, Tavern Brawler, Telekinetic, etc.
      // Solo se muestra si había más de una opción para elegir.
      parts.push(`+${feat.asiBonus.amount} ${up(choice.featAbility)}`)
    }
  }

  // 2. requiresChoices: Skilled, Skill Expert, Crafter, Musician, Observant,
  //    Keen Mind. Listamos las opciones elegidas por cada grupo.
  if (feat.requiresChoices && choice.featChoices) {
    for (const group of feat.requiresChoices) {
      const picked = choice.featChoices[group.id]
      if (!picked || !picked.length) continue
      const formatted = picked.map(cap).join(', ')
      // Skill Expert tiene 2 grupos (proficiency + expertise). Etiquetamos:
      if (feat.requiresChoices.length > 1) {
        parts.push(`${group.id}: ${formatted}`)
      } else {
        parts.push(formatted)
      }
    }
  }

  // 3. Magic Initiate: las elecciones viven en char.magicInitiateChoices,
  //    NO en choice.featChoices. Buscamos la que corresponde a este feat.
  if (feat.grantsMagicInitiate) {
    // Para ASI feats, la entrada de magicInitiateChoices tiene source = 'asi-N'
    const asiSrc = `asi-${choice.level}`
    const mi = char.magicInitiateChoices?.find(m => m.source === asiSrc)
    if (mi) {
      const items: string[] = []
      if (mi.spellList) items.push(cap(mi.spellList) + ':')
      if (mi.cantrips?.length) items.push(...mi.cantrips.map(c => cap(c)))
      if (mi.levelOneSpell) items.push(cap(mi.levelOneSpell.replace(/^\d+-/, '')))
      if (items.length) parts.push(items.join(' '))
    }
  }

  return parts.join(' — ')
}

/**
 * Descripción de la elección hecha en un origin feat (background).
 * El origin feat se guarda en char.originFeatId y SUS elecciones viven en:
 *   - char.magicInitiateChoices con source='origin' (si el feat es Magic Initiate)
 *   - char.featChoicesOrigin (si el feat tiene requiresChoices — Skilled,
 *     Crafter, Musician, etc.). Si ese campo no existe en el store, no hay
 *     elecciones registradas y devolvemos "".
 */
export function describeOriginFeatChoice(featId: string, char: CharacterData): string {
  const feat = getFeatById(featId)
  if (!feat) return ''
  const parts: string[] = []

  // Magic Initiate como origin
  if (feat.grantsMagicInitiate) {
    const mi = char.magicInitiateChoices?.find(m => m.source === 'origin')
    if (mi) {
      const items: string[] = []
      if (mi.spellList) items.push(cap(mi.spellList) + ':')
      if (mi.cantrips?.length) items.push(...mi.cantrips.map(c => cap(c)))
      if (mi.levelOneSpell) items.push(cap(mi.levelOneSpell.replace(/^\d+-/, '')))
      if (items.length) parts.push(items.join(' '))
    }
  }

  // featChoicesOrigin: si en el futuro el store lo expone, lo recogemos aquí.
  // Por ahora, los origin feats con requiresChoices (raros) no exponen las
  // elecciones por separado. No falla; simplemente no se muestran.
  const originChoices = (char as unknown as { featChoicesOrigin?: Record<string, string[]> })
    .featChoicesOrigin
  if (feat.requiresChoices && originChoices) {
    for (const group of feat.requiresChoices) {
      const picked = originChoices[group.id]
      if (!picked || !picked.length) continue
      const formatted = picked.map(cap).join(', ')
      if (feat.requiresChoices.length > 1) {
        parts.push(`${group.id}: ${formatted}`)
      } else {
        parts.push(formatted)
      }
    }
  }

  return parts.join(' — ')
}

/**
 * Descripción del Fighting Style elegido. Incluye el efecto mecánico, ya que
 * es la información útil para tener en la ficha (no solo el nombre).
 */
export function describeFightingStyle(featId: string): string {
  const f = getFeatById(featId)
  if (!f) return ''
  // El nombre del feat ya es algo como "Archery", "Defense", "Dueling"...
  // El campo description del feat ya contiene la descripción completa pero
  // larga; devolvemos un resumen corto si el feat tiene un asiBonus implícito
  // codificado, o el primer trozo de su description si no.
  if (f.rangedAttackBonus) return `+${f.rangedAttackBonus} to ranged weapon attack rolls`
  if (f.duelingDamageBonus) return `+${f.duelingDamageBonus} damage with a one-handed melee weapon (no other weapons)`
  if (f.defenseACBonus) return '+1 AC while wearing armor'
  // Si no encaja en ningún caso conocido, devolvemos un resumen genérico.
  return shortDescription(f)
}

/**
 * Devuelve la descripción del feat ABREVIADA a una sola línea, cortando en
 * el primer punto si excede 120 caracteres. Útil para tablas.
 */
function shortDescription(f: Feat): string {
  const d = f.description.replace(/\s+/g, ' ').trim()
  if (d.length <= 120) return d
  const cut = d.indexOf('. ')
  if (cut > 0 && cut < 200) return d.slice(0, cut + 1)
  return d.slice(0, 118) + '…'
}

/**
 * Helper de alto nivel: dado un feat y su contexto (origen + char),
 * compone el nombre completo "Resilient (WIS)" o "Skilled (Athletics, …)".
 * Si el feat no tiene elección, devuelve solo el nombre del feat.
 */
export function feateDisplayName(
  featId: string,
  source: 'asi' | 'origin' | 'fighting-style',
  char: CharacterData,
  choice?: ASIChoice,
): string {
  const f = getFeatById(featId)
  if (!f) return featId

  let chosen = ''
  if (source === 'asi' && choice) {
    chosen = describeAsiFeatChoice(choice, char)
  } else if (source === 'origin') {
    chosen = describeOriginFeatChoice(featId, char)
  } else if (source === 'fighting-style') {
    chosen = describeFightingStyle(featId)
  }

  return chosen ? `${f.name} (${chosen})` : f.name
}
