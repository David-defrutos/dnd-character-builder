// #152 — Tests para buildWeaponMasteryRows del anexo PDF.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import type { CharacterData } from '@/stores/character'
import { preloadVariantData } from '@/data'
import { buildWeaponMasteryRows } from './pdfAppendix'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  const c = useCharacterStore().character
  c.variant = 'dnd5e'
  return c
}

describe('#152 — buildWeaponMasteryRows: filas por mastery única', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('PJ sin masteries y sin Fighter 9+: devuelve []', () => {
    const char = freshChar()
    char.className = 'wizard'
    char.level = 5
    char.weaponMasteries = []
    char.classes = [{ classId: 'wizard', subclass: '', level: 5, hitDie: 6 }]
    expect(buildWeaponMasteryRows(char)).toEqual([])
  })

  it('una arma con Vex: 1 fila Vex', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'champion'
    char.level = 4
    char.weaponMasteries = ['Rapier']
    char.classes = [{ classId: 'fighter', subclass: 'champion', level: 4, hitDie: 10 }]
    const rows = buildWeaponMasteryRows(char)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.mastery).toBe('Vex')
    expect(rows[0]!.weapons).toBe('Rapier')
    expect(rows[0]!.description).toContain('Advantage on your next attack')
  })

  it('dos armas con la misma mastery: una sola fila con ambas armas', () => {
    // Rapier y Hand Crossbow comparten Vex.
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'champion'
    char.level = 4
    char.weaponMasteries = ['Rapier', 'Hand Crossbow']
    char.classes = [{ classId: 'fighter', subclass: 'champion', level: 4, hitDie: 10 }]
    const rows = buildWeaponMasteryRows(char)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.mastery).toBe('Vex')
    expect(rows[0]!.weapons).toContain('Rapier')
    expect(rows[0]!.weapons).toContain('Hand Crossbow')
  })

  it('Cecino (Fighter 10 Echo Knight con 5 armas): masteries únicas + Push/Sap/Slow por Tactical Master', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'echo-knight'
    char.level = 10
    char.weaponMasteries = ['Dagger', 'Hand Crossbow', 'Rapier', 'Heavy Crossbow', 'Scimitar']
    char.classes = [{ classId: 'fighter', subclass: 'echo-knight', level: 10, hitDie: 10 }]
    const rows = buildWeaponMasteryRows(char)
    const masteries = rows.map(r => r.mastery)

    // De las 5 armas: Dagger=Nick, Hand Crossbow=Vex, Rapier=Vex, Heavy Crossbow=Push, Scimitar=Nick
    // → Nick, Vex, Push (3 únicas)
    // + Tactical Master añade Push (ya hay), Sap, Slow
    // → total: Nick, Push, Sap, Slow, Vex (5 únicas)
    expect(masteries).toContain('Nick')
    expect(masteries).toContain('Push')
    expect(masteries).toContain('Sap')
    expect(masteries).toContain('Slow')
    expect(masteries).toContain('Vex')

    // Sap y Slow vienen solo de Tactical Master → columna Weapons marcada.
    const sap = rows.find(r => r.mastery === 'Sap')!
    expect(sap.weapons).toBe('(Tactical Master)')
    const slow = rows.find(r => r.mastery === 'Slow')!
    expect(slow.weapons).toBe('(Tactical Master)')

    // Push viene de Heavy Crossbow (no marca Tactical Master en weapons).
    const push = rows.find(r => r.mastery === 'Push')!
    expect(push.weapons).toBe('Heavy Crossbow')
  })

  it('Fighter 8 (sin Tactical Master aún): solo masteries del arma, sin Push/Sap/Slow extra', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'champion'
    char.level = 8
    char.weaponMasteries = ['Rapier']  // solo Vex
    char.classes = [{ classId: 'fighter', subclass: 'champion', level: 8, hitDie: 10 }]
    const rows = buildWeaponMasteryRows(char)
    const masteries = rows.map(r => r.mastery)
    expect(masteries).toEqual(['Vex'])
  })

  it('Fighter 9 sin masteries elegidas (caso raro): tabla solo con Push/Sap/Slow por Tactical Master', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'champion'
    char.level = 9
    char.weaponMasteries = []
    char.classes = [{ classId: 'fighter', subclass: 'champion', level: 9, hitDie: 10 }]
    const rows = buildWeaponMasteryRows(char)
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.mastery)).toEqual(['Push', 'Sap', 'Slow'])
    expect(rows.every(r => r.weapons === '(Tactical Master)')).toBe(true)
  })

  it('Tactical Master en Fighter MULTICLASS (Wizard 5 / Fighter 9): activa Push/Sap/Slow', () => {
    // NOTA: con Wizard como primaria, sanitizeMasteries() actualmente solo
    // mira la clase primaria para los slots/elegibles, así que las masteries
    // del Fighter secundario no se rellenan automáticamente. Esto es deuda
    // técnica (otro día), pero Tactical Master sí lo detectamos vía classes[],
    // así que Push/Sap/Slow SÍ aparecen.
    const char = freshChar()
    char.className = 'wizard'
    char.subclass = ''
    char.level = 14
    char.weaponMasteries = []
    char.classes = [
      { classId: 'wizard', subclass: '', level: 5, hitDie: 6 },
      { classId: 'fighter', subclass: 'champion', level: 9, hitDie: 10 },
    ]
    const rows = buildWeaponMasteryRows(char)
    const masteries = rows.map(r => r.mastery)
    expect(masteries).toContain('Push')
    expect(masteries).toContain('Sap')
    expect(masteries).toContain('Slow')
  })

  it('Fighter 8 / Wizard 1: NO activa Tactical Master (Fighter aún en 8)', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'champion'
    char.level = 9
    char.weaponMasteries = ['Rapier']
    char.classes = [
      { classId: 'fighter', subclass: 'champion', level: 8, hitDie: 10 },
      { classId: 'wizard', subclass: '', level: 1, hitDie: 6 },
    ]
    const rows = buildWeaponMasteryRows(char)
    const masteries = rows.map(r => r.mastery)
    expect(masteries).toEqual(['Vex'])  // solo Rapier
  })

  it('orden de filas: alfabético (orden de masteryDescriptions)', () => {
    // Rapier=Vex, Heavy Crossbow=Push, Dagger=Nick. Esperamos Nick < Push < Vex.
    const char = freshChar()
    char.className = 'fighter'
    char.subclass = 'champion'
    char.level = 4
    char.weaponMasteries = ['Rapier', 'Heavy Crossbow', 'Dagger']
    char.classes = [{ classId: 'fighter', subclass: 'champion', level: 4, hitDie: 10 }]
    const rows = buildWeaponMasteryRows(char)
    expect(rows.map(r => r.mastery)).toEqual(['Nick', 'Push', 'Vex'])
  })
})
