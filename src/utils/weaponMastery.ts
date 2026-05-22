/**
 * Weapon Mastery selection helpers (bug #89).
 *
 * D&D 2024 introduce la feature "Weapon Mastery" (Fighter, Barbarian, Paladin,
 * Ranger, Rogue). El personaje "domina" un número de armas determinado por su
 * nivel (y por la tabla weaponMasteryByLevel de su clase). Cada arma dominada
 * permite usar la propiedad de maestría asociada (Vex, Topple, Sap, etc.).
 *
 * Reglas:
 *   - Las armas elegibles son las que coinciden con la proficiencia del PJ.
 *   - Fighter / Barbarian / Paladin / Ranger: Simple + Martial.
 *   - Rogue: Simple + Martial con propiedad Finesse o Light (codificado en
 *     'martial-finesse' en classes.ts).
 *   - Monk: tiene Mastery solo via Weapon Master feat, no via clase, así que
 *     este módulo no la cubre por defecto.
 *   - Cada Long Rest se puede cambiar una elección (no simulado: el builder
 *     no gestiona descansos, solo guarda la lista actual).
 *
 * Slot count: leído de class.weaponMasteryByLevel[char.level - 1].
 */

import type { CharacterData } from '@/stores/character'
import { getClassById } from '@/data/dnd5e/classes'
import { simpleWeapons, martialWeapons, type WeaponData } from '@/data/dnd5e/equipment'

/** Total slots de Weapon Mastery según clase y nivel actual del PJ. */
export function getWeaponMasterySlots(char: CharacterData): number {
  const cls = getClassById(char.className)
  if (!cls?.weaponMasteryByLevel) return 0
  const idx = Math.max(0, Math.min(char.level - 1, cls.weaponMasteryByLevel.length - 1))
  return cls.weaponMasteryByLevel[idx] ?? 0
}

/**
 * Lista de armas elegibles para Weapon Mastery según las weaponProficiencies
 * de la clase. Si la clase no tiene weaponMasteryByLevel, devuelve [].
 */
export function getEligibleMasteryWeapons(char: CharacterData): readonly WeaponData[] {
  const cls = getClassById(char.className)
  if (!cls?.weaponMasteryByLevel) return []

  const profs = cls.weaponProficiencies
  const out: WeaponData[] = []

  if (profs.includes('simple')) {
    out.push(...simpleWeapons)
  }
  if (profs.includes('martial')) {
    out.push(...martialWeapons)
  } else if (profs.includes('martial-finesse')) {
    // Rogue: solo martial con Finesse o Light
    out.push(...martialWeapons.filter(w =>
      w.properties.includes('finesse') || w.properties.includes('light')
    ))
  } else if (profs.includes('martial-light')) {
    // Monk: aunque no tiene Mastery por clase, dejamos la rama por simetría.
    out.push(...martialWeapons.filter(w => w.properties.includes('light')))
  }

  return out
}

/**
 * Filtra y normaliza la lista de armas dominadas del PJ:
 *  - quita duplicados
 *  - quita armas no elegibles
 *  - trunca a getWeaponMasterySlots(char) (si tiene más, sobran)
 */
export function sanitizeMasteries(char: CharacterData): string[] {
  const slots = getWeaponMasterySlots(char)
  if (slots <= 0) return []
  const eligible = new Set(getEligibleMasteryWeapons(char).map(w => w.name))
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of char.weaponMasteries ?? []) {
    if (!eligible.has(name) || seen.has(name)) continue
    out.push(name)
    seen.add(name)
    if (out.length >= slots) break
  }
  return out
}

/** Mastery property de un arma por nombre, o undefined si no es arma conocida. */
export function getMasteryFor(weaponName: string): string | undefined {
  const all = [...simpleWeapons, ...martialWeapons]
  return all.find(w => w.name.toLowerCase() === weaponName.toLowerCase())?.mastery
}
