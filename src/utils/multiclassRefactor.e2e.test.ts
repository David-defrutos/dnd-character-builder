// #139 Fase 6 (E2E) — Test del refactor multiclass de cabo a rabo.
//
// Simula el flujo de creación de un PJ multiclass Fighter 4 / Wizard 3 y
// verifica que TODAS las piezas del refactor (Fases 1-5) cooperan:
//   - Fase 1: helpers + migración
//   - Fase 2: reorderClasses + sincronía classes[0] ↔ planos
//   - Fase 3: ASIs por clase
//   - Fase 4: hechizos por clase, DC/Attack por caster
//   - Fase 5: levelUp(classId), PDF spellcasting por clase
//   - Fase 6: prereqs y proficiencies de multiclass
//
// No monta Vue. Trabaja directamente con el store y helpers puros.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { preloadVariantData } from '@/data'
import {
  getClassEntries,
  getTotalLevel,
  getPrimaryClass,
  getCasterClasses,
  getAsiChoicesForClass,
  setAsiChoicesForClass,
  getAllAsiChoices,
} from '@/utils/classEntries'
import { computeSpellcastingCalculationsByClass } from '@/utils/detailedReferenceCalc'
import { pendingLevelDecisions } from '@/utils/levelUpGating'
import { getClasses } from '@/data'

describe('#139 Fase 6 — E2E refactor multiclass', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Fighter 4 / Wizard 3: flujo completo de creación + integración entre fases', () => {
    const store = useCharacterStore()
    const char = store.character

    // ── PHASE: Step1/2 — setup básico (race, background, abilities) ──
    char.variant = 'dnd5e'
    char.name = 'Eldrin'
    char.race = 'human'
    char.background = 'sage'
    char.abilityScores = { str: 14, dex: 13, con: 14, int: 14, wis: 10, cha: 8 }

    // ── PHASE: Step3 — Fighter como primaria, luego añadir Wizard ──
    char.className = 'fighter'
    char.subclass = 'champion'
    char.hitDie = 10
    char.level = 4
    // Sincroniza classes[0]
    char.classes = [
      { classId: 'fighter', subclass: 'champion', level: 4, hitDie: 10 },
    ]

    // Añadir Wizard como secundaria (Fase 6 M7: prereqs aplicados)
    const result = store.addMulticlass('wizard')
    expect(result.ok).toBe(true)
    expect(char.classes).toHaveLength(2)
    expect(char.classes[0]!.classId).toBe('fighter')
    expect(char.classes[1]!.classId).toBe('wizard')

    // Fase 6 M8: proficiencies del Wizard multiclass son vacías → no añade nada
    // (Wizard no aporta proficiencies como multiclass).
    // Fase 1 + 2: classes[0] sincronizado.
    expect(getPrimaryClass(char)!.classId).toBe('fighter')

    // ── PHASE: Subir Wizard de 1 a 3 (dos veces) usando levelUp(classId) ──
    // (Fase 5 M5: levelUp acepta classId)
    store.levelUp('wizard')  // Wizard 1 → 2
    store.levelUp('wizard')  // Wizard 2 → 3

    expect(getClassEntries(char).find(e => e.classId === 'wizard')!.level).toBe(3)
    expect(getTotalLevel(char)).toBe(7)  // 4 + 3
    expect(char.level).toBe(7)

    // ── PHASE: Fase 3 — ASIs por clase ──
    // Fighter lv.4 tiene checkpoint ASI. Wizard lv.3 no (su primer ASI es lv.4).
    setAsiChoicesForClass(char, 'fighter', [
      { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] },
    ])

    // Verificación: el ASI de Fighter está donde toca, y como Fighter es la
    // primaria, también está espejado en char.asiChoices plano (compat).
    const fighterAsis = getAsiChoicesForClass(char, 'fighter')
    expect(fighterAsis).toHaveLength(1)
    expect(fighterAsis[0]!.asiAbilities).toEqual(['str'])
    expect(char.asiChoices).toEqual(fighterAsis)  // sincronía

    // Wizard no tiene ASIs todavía (su checkpoint lv.4 aún no llegó).
    expect(getAsiChoicesForClass(char, 'wizard')).toEqual([])

    // getAllAsiChoices junta los de TODAS las clases (es la fuente para
    // recomputeBonuses y applyFeatEffects).
    expect(getAllAsiChoices(char)).toHaveLength(1)

    // ── PHASE: Fase 4 — Spellcasting por clase ──
    char.spellcastingAbility = 'int'
    char.classes[1]!.spellcastingAbility = 'int'

    const casters = getCasterClasses(char, getClasses('dnd5e'))
    expect(casters).toHaveLength(1)  // solo Wizard es caster
    expect(casters[0]!.entry.classId).toBe('wizard')
    expect(casters[0]!.ability).toBe('int')

    // ── PHASE: Fase 5 — Spellcasting calculations por clase ──
    const spellcasting = computeSpellcastingCalculationsByClass(char)
    expect(spellcasting).toHaveLength(1)
    expect(spellcasting[0]!.classId).toBe('wizard')
    expect(spellcasting[0]!.classLevel).toBe(3)
    // PB del PJ a nivel 7 = 3. INT 14 → mod +2. DC = 8 + 3 + 2 = 13.
    expect(spellcasting[0]!.saveDc).toBe(13)
    expect(spellcasting[0]!.attackBonus).toBe(5)  // 3 + 2

    // ── PHASE: pending gating (Fase 3+4 lo iteran por clase) ──
    const decisions = pendingLevelDecisions(char)
    // Esperado: al menos Fighter lv.4 ASI ya resuelto. Pueden quedar pendientes
    // de subclase wizard si lv.3+ pero la elegimos vacía a propósito. Confirmamos
    // que NO hay decisiones "asi-fighter-4-*" (ya hecha), pero SÍ puede haber
    // "asi-wizard-X" si tocara o spellcasting de wizard (queremos verlos).
    const keys = decisions.map(d => d.key)
    expect(keys.some(k => k.startsWith('asi-fighter-4-'))).toBe(false)  // ya resuelta
  })

  it('reorderClasses cambia la primaria y la sincronía se mantiene', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'fighter'
    char.subclass = 'champion'
    char.hitDie = 10
    char.abilityScores = { str: 14, dex: 13, con: 14, int: 14, wis: 10, cha: 8 }
    char.classes = [
      { classId: 'fighter', subclass: 'champion', level: 4, hitDie: 10 },
      { classId: 'wizard', subclass: '', level: 3, hitDie: 6, spellcastingAbility: 'int' },
    ]
    char.level = 7

    // Mover wizard a primaria
    store.reorderClasses(1, 0)

    // Sincronía: campos planos reflejan al wizard.
    expect(char.className).toBe('wizard')
    expect(char.hitDie).toBe(6)
    expect(char.spellcastingAbility).toBe('int')

    // getPrimaryClass devuelve el wizard.
    expect(getPrimaryClass(char)!.classId).toBe('wizard')

    // Total level no cambia (suma).
    expect(getTotalLevel(char)).toBe(7)
  })

  it('Fase 6 M7: prereqs bloquean clase impossible y la UI debería verlo', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'wizard'
    char.subclass = ''
    char.hitDie = 6
    // INT 16 (wizard OK), pero STR 8, DEX 10 → Fighter no es viable.
    char.abilityScores = { str: 8, dex: 10, con: 14, int: 16, wis: 12, cha: 10 }
    char.classes = [{ classId: 'wizard', subclass: '', level: 5, hitDie: 6 }]

    const r = store.addMulticlass('fighter')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      // El mensaje menciona Fighter STR 13.
      expect(r.failures.join(' ')).toMatch(/Fighter.*STR 13/i)
    }
    // classes[] sigue igual.
    expect(char.classes).toHaveLength(1)
  })

  it('Fase 6 M8: las proficiencies de multiclass se acumulan correctamente', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'wizard'
    char.subclass = ''
    char.hitDie = 6
    char.abilityScores = { str: 13, dex: 14, con: 14, int: 16, wis: 13, cha: 10 }
    char.classArmorProficiencies = []
    char.classWeaponProficiencies = []
    char.classToolProficiencies = []
    char.classes = [{ classId: 'wizard', subclass: '', level: 5, hitDie: 6 }]

    // Wizard primario añade Fighter (Light/Medium/Shields + Martial weapons)
    store.addMulticlass('fighter')
    expect(char.classArmorProficiencies).toContain('Light armor')
    expect(char.classArmorProficiencies).toContain('Medium armor')
    expect(char.classArmorProficiencies).toContain('Shields')
    expect(char.classWeaponProficiencies).toContain('Martial weapons')

    // Ahora añadir Cleric (Light/Medium/Shields). Sin duplicar.
    char.abilityScores.wis = 13
    store.addMulticlass('cleric')
    const lightCount = char.classArmorProficiencies.filter(p => p === 'Light armor').length
    expect(lightCount).toBe(1)
  })
})
