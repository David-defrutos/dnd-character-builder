import { useI18n } from 'vue-i18n'
import { translateGameTerm } from '@/i18n/gameTerms'
import type { GameTermCategory } from '@/i18n/gameTerms'
import { getRaceById } from '@/data/dnd5e/races'

/**
 * Composable that provides translation functions for game terms
 * (weapons, armor, spells, classes, races, etc.) based on current locale.
 */
export function useGameTerms() {
  const { locale } = useI18n()

  function translate(name: string, category: GameTermCategory, variant?: string): string {
    return translateGameTerm(name, locale.value, category, variant)
  }

  function weapon(name: string): string {
    return translate(name, 'weapon')
  }

  function armorName(name: string): string {
    return translate(name, 'armor')
  }

  function spell(name: string): string {
    return translate(name, 'spell')
  }

  function school(name: string): string {
    return translate(name, 'school')
  }

  function damageType(name: string): string {
    return translate(name, 'damageType')
  }

  function pack(name: string): string {
    return translate(name, 'pack')
  }

  function background(name: string): string {
    return translate(name, 'background')
  }

  /**
   * Translate a class name. Accepts both English names ("Barbarian") and class
   * IDs ("barbarian"). The `variant` parameter is kept for API compatibility
   * with legacy call-sites and is currently unused.
   * @param name - English class name or class ID
   * @param variant - Reserved for future variant-specific overrides
   */
  function className(name: string, variant?: string): string {
    return translate(name, 'class', variant)
  }

  /**
   * Translate a race name.
   * @param name - English race name (e.g., "Dwarf", "Gifted")
   */
  function raceName(name: string): string {
    return translate(name, 'race')
  }

  /**
   * Translate a subrace name.
   * @param name - English subrace name (e.g., "Hill Dwarf", "Child of the Old World")
   */
  function subraceName(name: string): string {
    return translate(name, 'subrace')
  }

  /**
   * Translate a skill name.
   * @param name - English skill name (e.g., "Acrobatics", "Stealth")
   */
  function skill(name: string): string {
    return translate(name, 'skill')
  }

  /**
   * Translate an armor/weapon proficiency label.
   * @param name - English proficiency label (e.g., "light", "martial", "shields")
   */
  function proficiency(name: string): string {
    return translate(name, 'proficiency')
  }

  /**
   * Translate a class feature name.
   * @param name - English feature name (e.g., "Rage", "Sneak Attack")
   */
  function feature(name: string): string {
    return translate(name, 'feature')
  }

  /**
   * Translate a racial trait string.
   * Accepts kebab-case IDs or full sentences as defined in race data.
   * @param name - Trait string exactly as defined in race data
   */
  function trait(name: string): string {
    return translate(name, 'trait')
  }

  /**
   * Translate a language name.
   * @param name - English language name (e.g., "Common", "Elvish")
   */
  function language(name: string): string {
    return translate(name, 'language')
  }

  /**
   * Translate a subclass name.
   * @param name - Subclass ID (e.g., "berserker", "school-of-evocation")
   */
  function subclassName(name: string): string {
    return translate(name, 'subclass')
  }

  /**
   * Translate an equipment item name.
   * @param name - Equipment item string (e.g., "Longsword", "Explorer's Pack")
   */
  function equipment(name: string): string {
    return translate(name, 'equipment')
  }

  /**
   * #100 — Helper unificado para mostrar la especie del personaje en cualquier
   * lista o ficha: si tiene subespecie/linaje, devuelve solo la subespecie
   * (e.g. "Forest Gnome", "Drow"); si no, devuelve solo el nombre de la
   * especie (e.g. "Gnome", "Human"). Resuelve los IDs contra el catálogo y
   * aplica i18n. Si la especie no está en el catálogo, fallback al raceId
   * en bruto para no romper personajes con datos huérfanos.
   */
  function speciesDisplay(raceId: string, subraceId?: string): string {
    if (!raceId) return ''
    const race = getRaceById(raceId)
    if (!race) return raceId
    if (subraceId) {
      const sub = race.subraces?.find(s => s.id === subraceId)
      if (sub) return subraceName(sub.name)
    }
    return raceName(race.name)
  }

  return { weapon, armorName, spell, school, damageType, pack, background, className, raceName, subraceName, skill, proficiency, feature, trait, language, subclassName, equipment, speciesDisplay }
}
