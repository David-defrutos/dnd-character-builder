// #117 — Tests del historial de niveles
import { describe, it, expect, beforeAll } from 'vitest'
import { commitLevelSnapshot, restoreToLevel } from './levelHistory'
import type { CharacterData } from '@/stores/character'
import { preloadVariantData } from '@/data'

beforeAll(async () => {
  // pendingLevelDecisions lee getClasses() (lazy-loaded). Sin esto, devuelve
  // vacío para cualquier PJ y los tests de "no snapshotea con pendientes"
  // dan falso positivo.
  await preloadVariantData('dnd5e')
})

function baseChar(): CharacterData {
  return {
    id: 'test-id',
    variant: 'dnd5e',
    name: 'TestPJ',
    playerName: '',
    race: 'human',
    subrace: '',
    className: 'fighter',
    subclass: '',
    level: 1,
    background: 'soldier',
    alignment: '',
    experiencePoints: 0,
    abilityScores: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
    speciesBonuses: {},
    speciesChoices: {},
    backgroundBonuses: { str: 2, con: 1 },
    asiBonuses: {},
    skillProficiencies: ['athletics'],
    skillExpertise: [],
    savingThrowProficiencies: ['str', 'con'],
    languages: ['Common'],
    proficienciesOther: [],
    weapons: [],
    armor: '',
    shield: false,
    equipment: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    personalityTraits: '',
    ideals: '',
    bonds: '',
    flaws: '',
    featuresTraits: ['Fighting Style', 'Second Wind', 'Weapon Mastery'],
    backstory: '',
    age: '', height: '', weight: '', eyes: '', hair: '', skin: '',
    allies: '', treasure: '',
    spellcastingClass: '',
    spellcastingAbility: '',
    cantrips: [],
    spellsKnown: [],
    spellsPrepared: [],
    hitDie: 10,
    maxHp: 13,
    currentHp: 13,
    tempHp: 0,
    speed: 30,
    sessionNotes: '',
    classes: [],
    asiChoices: [],
    classArmorProficiencies: ['light', 'medium', 'heavy', 'shields'],
    classWeaponProficiencies: ['simple', 'martial'],
    classToolProficiencies: [],
    classSkillProficiencies: ['athletics'],
    backgroundSkillProficiencies: [],
    fightingStyleFeat: 'archery',
    originFeatId: 'lucky',
  } as unknown as CharacterData
}

describe('commitLevelSnapshot', () => {
  it('crea el primer snapshot en lv.1 si no hay historial previo', () => {
    const char = baseChar()
    expect(char.levelHistory).toBeUndefined()
    const ok = commitLevelSnapshot(char)
    expect(ok).toBe(true)
    expect(char.levelHistory).toHaveLength(1)
    expect(char.levelHistory![0]!.level).toBe(1)
    expect(char.levelHistory![0]!.snapshot.name).toBe('TestPJ')
  })

  it('el snapshot NO contiene su propio levelHistory (no recursivo)', () => {
    const char = baseChar()
    commitLevelSnapshot(char)
    // El snapshot.snapshot no debe tener un campo levelHistory
    const snap = char.levelHistory![0]!.snapshot as Record<string, unknown>
    expect(snap.levelHistory).toBeUndefined()
  })

  it('reemplaza el snapshot del mismo nivel si se llama otra vez', () => {
    const char = baseChar()
    commitLevelSnapshot(char)
    // Cambiar algún dato y volver a snapshotear
    char.name = 'TestPJ-renamed'
    const ok = commitLevelSnapshot(char)
    expect(ok).toBe(true)
    expect(char.levelHistory).toHaveLength(1)
    expect(char.levelHistory![0]!.snapshot.name).toBe('TestPJ-renamed')
  })

  it('añade un nuevo snapshot al cambiar de nivel', () => {
    const char = baseChar()
    commitLevelSnapshot(char)
    char.level = 2
    char.maxHp = 22
    commitLevelSnapshot(char)
    expect(char.levelHistory).toHaveLength(2)
    expect(char.levelHistory!.map(s => s.level)).toEqual([1, 2])
    expect(char.levelHistory![1]!.snapshot.maxHp).toBe(22)
  })

  it('NO snapshotea si hay decisiones pendientes (Wizard lv.1 sin cantrips suficientes)', () => {
    const char = baseChar()
    // Convertir el Fighter de prueba en Wizard, que necesita 3 cantrips a lv.1.
    char.className = 'wizard'
    char.hitDie = 6
    char.spellcastingClass = 'wizard'
    char.spellcastingAbility = 'int'
    char.cantrips = []  // 0 cantrips → pendiente "Choose 3 more cantrips"
    char.savingThrowProficiencies = ['int', 'wis']
    char.classArmorProficiencies = []
    char.classWeaponProficiencies = []
    const ok = commitLevelSnapshot(char)
    expect(ok).toBe(false)
    expect(char.levelHistory ?? []).toHaveLength(0)
  })

  it('los snapshots se mantienen ordenados por nivel ASC', () => {
    const char = baseChar()
    char.levelHistory = [
      { level: 3, snapshotAt: '2026-01-01T00:00:00Z', snapshot: { ...baseChar(), level: 3 } as Omit<CharacterData, 'levelHistory'> },
      { level: 1, snapshotAt: '2026-01-01T00:00:00Z', snapshot: { ...baseChar(), level: 1 } as Omit<CharacterData, 'levelHistory'> },
    ]
    char.level = 2
    commitLevelSnapshot(char)
    expect(char.levelHistory.map(s => s.level)).toEqual([1, 2, 3])
  })
})

describe('restoreToLevel', () => {
  it('restaura el PJ al estado del snapshot indicado', () => {
    const char = baseChar()
    commitLevelSnapshot(char)  // snapshot lv.1
    // Subimos a lv.2 cambiando datos
    char.level = 2
    char.maxHp = 22
    char.featuresTraits.push('Action Surge')
    commitLevelSnapshot(char)
    // Restaurar a lv.1
    const restored = restoreToLevel(char, 1)
    expect(restored).not.toBeNull()
    expect(char.level).toBe(1)
    expect(char.maxHp).toBe(13)
    expect(char.featuresTraits).not.toContain('Action Surge')
  })

  it('elimina los snapshots de niveles posteriores al elegido', () => {
    const char = baseChar()
    commitLevelSnapshot(char)
    char.level = 2; commitLevelSnapshot(char)
    char.level = 3; commitLevelSnapshot(char)
    char.level = 4; commitLevelSnapshot(char)
    restoreToLevel(char, 2)
    expect(char.levelHistory).toHaveLength(2)
    expect(char.levelHistory!.map(s => s.level)).toEqual([1, 2])
  })

  it('mantiene el id original al restaurar', () => {
    const char = baseChar()
    const originalId = char.id
    commitLevelSnapshot(char)
    char.level = 2
    commitLevelSnapshot(char)
    restoreToLevel(char, 1)
    expect(char.id).toBe(originalId)
  })

  it('devuelve null si el snapshot solicitado no existe', () => {
    const char = baseChar()
    commitLevelSnapshot(char)
    const r = restoreToLevel(char, 99)
    expect(r).toBeNull()
  })

  it('devuelve null si el personaje no tiene historial', () => {
    const char = baseChar()
    expect(char.levelHistory).toBeUndefined()
    expect(restoreToLevel(char, 1)).toBeNull()
  })
})
