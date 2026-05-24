// #146 — Filtro de hechizos multiclass por max-level POR CLASE.
//
// Documenta y verifica la regla: un hechizo es elegible si existe alguna
// clase caster del PJ que (a) lo tenga en su lista y (b) tenga max-level
// ≥ spell.level.
//
// El bug que cierra: filtrar Ranger 4 / Wizard 5 con maxLv=max(1, 3)=3
// dejaba pasar Aid (Ranger lv.2) que NO debería poder aprenderse via
// Ranger 4 (que solo llega a lv.1).
//
// La lógica vive en los componentes Step7Spells y Step9Review. Aquí se
// testea la regla aislada (función pura) que ambos comparten en espíritu.

import { describe, it, expect, beforeAll } from 'vitest'
import { preloadVariantData, getSpells, getMaxSpellLevel } from '@/data'

/**
 * Implementación de referencia (espejo de la lógica de Step7/Step9 reescrita
 * en #146). La testeamos aquí porque montar el componente entero solo para
 * probar el filtro sería costoso. Si esta lógica diverge del componente,
 * el bug volverá: mantenlas alineadas.
 */
function isSpellEligibleByClass(
  spell: { level: number; classes: readonly string[] },
  casterClasses: ReadonlyArray<{ classId: string; level: number }>,
): boolean {
  for (const c of casterClasses) {
    if (!spell.classes.includes(c.classId)) continue
    if (spell.level === 0) return true  // cantrip
    if (spell.level <= getMaxSpellLevel(c.classId, c.level)) return true
  }
  return false
}

describe('#146 — filtro de hechizos por clase y max-level', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  it('Ranger 4 / Wizard 5: NO debe permitir Aid si solo está en lista Ranger', () => {
    // Aid en PHB 2024 está en Bard/Cleric/Paladin/Ranger pero NO en Wizard.
    // Lo simulamos buscándolo en el catálogo.
    const spells = getSpells('dnd5e')
    const aid = spells.find(s => s.id === '2-aid')
    expect(aid).toBeDefined()
    expect(aid!.level).toBe(2)
    expect(aid!.classes).toContain('ranger')
    expect(aid!.classes.includes('wizard')).toBe(false)

    const casters = [
      { classId: 'ranger', level: 4 },
      { classId: 'wizard', level: 5 },
    ]
    // Ranger 4 → max nivel 1. Wizard 5 → max nivel 3, pero wizard no tiene Aid.
    // Por tanto Aid NO es elegible.
    expect(isSpellEligibleByClass(aid!, casters)).toBe(false)
  })

  it('Ranger 4 / Wizard 5: SÍ permite Fireball (Wizard lv.3 ≤ max Wizard 3)', () => {
    const spells = getSpells('dnd5e')
    const fireball = spells.find(s => s.id === '3-fireball')
    expect(fireball).toBeDefined()
    expect(fireball!.level).toBe(3)
    expect(fireball!.classes).toContain('wizard')

    const casters = [
      { classId: 'ranger', level: 4 },
      { classId: 'wizard', level: 5 },
    ]
    expect(isSpellEligibleByClass(fireball!, casters)).toBe(true)
  })

  it('Ranger 4 / Wizard 5: NO permite hechizo Wizard lv.4 (max wizard = 3)', () => {
    const spells = getSpells('dnd5e')
    const lv4Wizard = spells.find(s => s.level === 4 && s.classes.includes('wizard'))
    expect(lv4Wizard).toBeDefined()

    const casters = [
      { classId: 'ranger', level: 4 },
      { classId: 'wizard', level: 5 },
    ]
    expect(isSpellEligibleByClass(lv4Wizard!, casters)).toBe(false)
  })

  it('Cleric 3 / Wizard 5: Cure Wounds (en ambas listas) elegible vía Cleric (max 2 ≥ 1)', () => {
    const spells = getSpells('dnd5e')
    const cureWounds = spells.find(s => s.id === '1-cure-wounds')
    expect(cureWounds).toBeDefined()
    expect(cureWounds!.level).toBe(1)
    expect(cureWounds!.classes).toContain('cleric')

    const casters = [
      { classId: 'cleric', level: 3 },
      { classId: 'wizard', level: 5 },
    ]
    expect(isSpellEligibleByClass(cureWounds!, casters)).toBe(true)
  })

  it('Cantrip: elegible si alguna clase del PJ lo tiene en su lista', () => {
    const spells = getSpells('dnd5e')
    const fireBolt = spells.find(s => s.id === 'fire-bolt')
    expect(fireBolt).toBeDefined()
    expect(fireBolt!.level).toBe(0)
    expect(fireBolt!.classes).toContain('wizard')

    const casters = [
      { classId: 'ranger', level: 1 },  // ranger lv.1: no tiene spell slots todavía
      { classId: 'wizard', level: 1 },
    ]
    expect(isSpellEligibleByClass(fireBolt!, casters)).toBe(true)
  })

  it('Monoclase Wizard 5: Fireball lv.3 elegible, hechizo lv.4 no', () => {
    const spells = getSpells('dnd5e')
    const fireball = spells.find(s => s.id === '3-fireball')!
    const lv4 = spells.find(s => s.level === 4 && s.classes.includes('wizard'))!

    const casters = [{ classId: 'wizard', level: 5 }]
    expect(isSpellEligibleByClass(fireball, casters)).toBe(true)
    expect(isSpellEligibleByClass(lv4, casters)).toBe(false)
  })

  it('PJ sin caster: ningún hechizo elegible', () => {
    const spells = getSpells('dnd5e')
    const fireball = spells.find(s => s.id === '3-fireball')!
    const casters: Array<{ classId: string; level: number }> = []
    expect(isSpellEligibleByClass(fireball, casters)).toBe(false)
  })

  it('Hechizo de clase que el PJ no tiene: no elegible aunque su nivel sea bajo', () => {
    const spells = getSpells('dnd5e')
    // Bardic Inspiration no es hechizo; busco uno de bard que no esté en wizard.
    const bardOnly = spells.find(s =>
      s.level === 1 &&
      s.classes.includes('bard') &&
      !s.classes.includes('wizard') &&
      !s.classes.includes('cleric') &&
      !s.classes.includes('ranger'),
    )
    if (!bardOnly) return  // si el catálogo no tiene uno, este test no aplica

    const casters = [
      { classId: 'wizard', level: 5 },
      { classId: 'cleric', level: 3 },
    ]
    expect(isSpellEligibleByClass(bardOnly, casters)).toBe(false)
  })
})
