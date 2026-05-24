// classEntries.test.ts — #139 Fase 1 (refactor multiclass).
//
// Cubre:
//   - getPrimaryClass / getClassEntries / getTotalLevel / getClassEntry
//   - getCharCantrips / getCharSpellsKnown / getAllAsiChoices (con fallback a
//     los campos planos del modelo viejo)
//   - migrateCharacterToClassEntries (silenciosa, idempotente)
//
// IMPORTANTE: estos tests son sobre los HELPERS, no sobre el comportamiento
// del store ni de la UI. La Fase 1 no toca UI: solo añade la capa de acceso.

import { describe, it, expect } from 'vitest'
import {
  getPrimaryClass,
  getClassEntries,
  getTotalLevel,
  getClassEntry,
  getCharCantrips,
  getCharSpellsKnown,
  getAllAsiChoices,
  getAsiChoicesForClass,
  setAsiChoicesForClass,
  getCasterClasses,
  getSpellsKnownForClass,
  setSpellsKnownForClass,
  getCantripsForClass,
  setCantripsForClass,
  migrateCharacterToClassEntries,
} from '@/utils/classEntries'
import type { CharacterData, ClassEntry, ASIChoice } from '@/stores/character'

/** Helper para construir un PJ minimal para test, modelo VIEJO (sin classes[]). */
function legacyChar(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    id: 'test-id',
    variant: 'dnd5e',
    name: 'Test',
    playerName: '',
    race: 'human',
    subrace: '',
    className: 'wizard',
    subclass: 'evoker',
    level: 5,
    background: 'sage',
    alignment: 'tn',
    experiencePoints: 0,
    abilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    speciesBonuses: {},
    backgroundBonuses: {},
    asiBonuses: {},
    skillProficiencies: [],
    skillExpertise: [],
    savingThrowProficiencies: ['int', 'wis'],
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
    featuresTraits: [],
    backstory: '',
    age: '30',
    height: "5'10\"",
    weight: '150 lbs',
    eyes: 'Brown',
    hair: 'Black',
    skin: 'Fair',
    allies: '',
    treasure: '',
    spellcastingClass: 'wizard',
    spellcastingAbility: 'int',
    cantrips: ['fire-bolt', 'mage-hand'],
    spellsKnown: ['magic-missile', 'shield'],
    spellsPrepared: [],
    hitDie: 6,
    maxHp: 30,
    currentHp: 30,
    tempHp: 0,
    speed: 30,
    sessionNotes: '',
    classes: [],
    ...overrides,
  }
}

describe('#139 Fase 1 — classEntries helpers', () => {
  describe('getPrimaryClass', () => {
    it('PJ viejo (classes vacío): sintetiza desde className', () => {
      const char = legacyChar()
      const prim = getPrimaryClass(char)
      expect(prim).not.toBeNull()
      expect(prim?.classId).toBe('wizard')
      expect(prim?.subclass).toBe('evoker')
      expect(prim?.level).toBe(5)
    })

    it('PJ nuevo (classes[0] poblado): devuelve la entrada', () => {
      const char = legacyChar({
        className: '',  // simulamos modelo nuevo: className puede quedar vacío
        classes: [{ classId: 'fighter', subclass: 'champion', level: 6, hitDie: 10 }],
      })
      const prim = getPrimaryClass(char)
      expect(prim?.classId).toBe('fighter')
      expect(prim?.level).toBe(6)
    })

    it('PJ sin clase elegida: devuelve null', () => {
      const char = legacyChar({ className: '', classes: [] })
      expect(getPrimaryClass(char)).toBeNull()
    })

    it('multiclass: la primaria es classes[0]', () => {
      const char = legacyChar({
        classes: [
          { classId: 'fighter', subclass: 'champion', level: 6, hitDie: 10 },
          { classId: 'wizard', subclass: '', level: 4, hitDie: 6 },
        ],
      })
      expect(getPrimaryClass(char)?.classId).toBe('fighter')
    })
  })

  describe('getClassEntries', () => {
    it('PJ viejo: devuelve array de 1 entrada sintética', () => {
      const entries = getClassEntries(legacyChar())
      expect(entries).toHaveLength(1)
      expect(entries[0]?.classId).toBe('wizard')
    })

    it('multiclass: devuelve todas las entradas en orden', () => {
      const char = legacyChar({
        classes: [
          { classId: 'fighter', subclass: '', level: 6, hitDie: 10 },
          { classId: 'wizard', subclass: '', level: 4, hitDie: 6 },
          { classId: 'cleric', subclass: '', level: 2, hitDie: 8 },
        ],
      })
      const entries = getClassEntries(char)
      expect(entries.map(e => e.classId)).toEqual(['fighter', 'wizard', 'cleric'])
    })

    it('PJ sin clase: devuelve array vacío', () => {
      const char = legacyChar({ className: '', classes: [] })
      expect(getClassEntries(char)).toEqual([])
    })
  })

  describe('getTotalLevel', () => {
    it('PJ viejo: devuelve char.level', () => {
      expect(getTotalLevel(legacyChar())).toBe(5)
    })

    it('multiclass: suma de levels de todas las entradas', () => {
      const char = legacyChar({
        classes: [
          { classId: 'fighter', subclass: '', level: 6, hitDie: 10 },
          { classId: 'wizard', subclass: '', level: 4, hitDie: 6 },
        ],
      })
      expect(getTotalLevel(char)).toBe(10)
    })

    it('triple multiclass: suma correcta', () => {
      const char = legacyChar({
        classes: [
          { classId: 'fighter', subclass: '', level: 6, hitDie: 10 },
          { classId: 'wizard', subclass: '', level: 4, hitDie: 6 },
          { classId: 'cleric', subclass: '', level: 2, hitDie: 8 },
        ],
      })
      expect(getTotalLevel(char)).toBe(12)
    })
  })

  describe('getClassEntry', () => {
    it('busca por id en multiclass', () => {
      const char = legacyChar({
        classes: [
          { classId: 'fighter', subclass: '', level: 6, hitDie: 10 },
          { classId: 'wizard', subclass: '', level: 4, hitDie: 6 },
        ],
      })
      expect(getClassEntry(char, 'wizard')?.level).toBe(4)
      expect(getClassEntry(char, 'fighter')?.level).toBe(6)
      expect(getClassEntry(char, 'cleric')).toBeUndefined()
    })
  })

  describe('getCharCantrips — fallback al modelo viejo', () => {
    it('PJ viejo (classes[].cantrips undefined): cae a char.cantrips', () => {
      const char = legacyChar({
        cantrips: ['fire-bolt', 'mage-hand'],
      })
      expect(getCharCantrips(char)).toEqual(['fire-bolt', 'mage-hand'])
    })

    it('PJ nuevo (classes[].cantrips definido): unión por clase', () => {
      const char = legacyChar({
        cantrips: ['legacy-should-be-ignored'],
        classes: [
          { classId: 'cleric', subclass: '', level: 3, hitDie: 8, cantrips: ['sacred-flame', 'light'] },
          { classId: 'wizard', subclass: '', level: 3, hitDie: 6, cantrips: ['fire-bolt', 'mage-hand'] },
        ],
      })
      expect(getCharCantrips(char).sort()).toEqual(['fire-bolt', 'light', 'mage-hand', 'sacred-flame'])
    })

    it('cantrips duplicados entre clases se deduplican', () => {
      const char = legacyChar({
        classes: [
          { classId: 'cleric', subclass: '', level: 3, hitDie: 8, cantrips: ['guidance', 'light'] },
          { classId: 'druid', subclass: '', level: 3, hitDie: 8, cantrips: ['guidance', 'thorn-whip'] },
        ],
      })
      const result = getCharCantrips(char)
      expect(result.filter(c => c === 'guidance')).toHaveLength(1)
      expect(result.sort()).toEqual(['guidance', 'light', 'thorn-whip'])
    })

    it('una clase tiene cantrips definido y otra no: solo cuenta las definidas', () => {
      const char = legacyChar({
        cantrips: ['old-fallback'],
        classes: [
          { classId: 'cleric', subclass: '', level: 3, hitDie: 8, cantrips: ['sacred-flame'] },
          { classId: 'fighter', subclass: '', level: 3, hitDie: 10 },  // sin cantrips
        ],
      })
      // Cualquier entrada con cantrips definido activa el modo "nuevo".
      // La fighter sin cantrips contribuye con 0; no se cae al fallback plano.
      expect(getCharCantrips(char)).toEqual(['sacred-flame'])
    })
  })

  describe('getCharSpellsKnown — fallback al modelo viejo', () => {
    it('PJ viejo: cae a char.spellsKnown', () => {
      const char = legacyChar({ spellsKnown: ['magic-missile', 'shield'] })
      expect(getCharSpellsKnown(char)).toEqual(['magic-missile', 'shield'])
    })

    it('PJ nuevo: unión por clase con deduplicación', () => {
      const char = legacyChar({
        classes: [
          { classId: 'cleric', subclass: '', level: 5, hitDie: 8, spellsKnown: ['bless', 'cure-wounds'] },
          { classId: 'wizard', subclass: '', level: 5, hitDie: 6, spellsKnown: ['magic-missile', 'shield', 'bless'] },
        ],
      })
      const result = getCharSpellsKnown(char)
      expect(result.filter(s => s === 'bless')).toHaveLength(1)
      expect(result.sort()).toEqual(['bless', 'cure-wounds', 'magic-missile', 'shield'])
    })
  })

  describe('getAllAsiChoices — fallback al modelo viejo', () => {
    it('PJ viejo: cae a char.asiChoices', () => {
      const oldAsi: ASIChoice[] = [
        { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['int'] },
      ]
      const char = legacyChar({ asiChoices: oldAsi })
      expect(getAllAsiChoices(char)).toEqual(oldAsi)
    })

    it('PJ nuevo: concatena los asiChoices de todas las entradas', () => {
      const char = legacyChar({
        asiChoices: [],  // vacío en el plano; debe ignorarse al haber por clase
        classes: [
          {
            classId: 'fighter', subclass: '', level: 8, hitDie: 10,
            asiChoices: [
              { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] },
              { level: 6, type: 'feat', featId: 'great-weapon-master' },
              { level: 8, type: 'asi', asiMode: '1+1', asiAbilities: ['con', 'str'] },
            ],
          },
          {
            classId: 'wizard', subclass: '', level: 4, hitDie: 6,
            asiChoices: [
              { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['int'] },
            ],
          },
        ],
      })
      const all = getAllAsiChoices(char)
      expect(all).toHaveLength(4)
      // Importante: hay DOS slots con level=4, uno de Fighter y otro de Wizard.
      // Hasta Fase 3 el llamador no diferencia; aquí solo verificamos el conteo.
      expect(all.filter(a => a.level === 4)).toHaveLength(2)
    })
  })

  describe('getAsiChoicesForClass / setAsiChoicesForClass — #139 Fase 3a', () => {
    it('getAsiChoicesForClass devuelve el array de la entrada si está definido', () => {
      const asis: ASIChoice[] = [
        { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] },
      ]
      const char = legacyChar({
        classes: [
          { classId: 'fighter', subclass: '', level: 6, hitDie: 10, asiChoices: asis },
        ],
      })
      // Importados arriba junto al resto de helpers.
      expect(getAsiChoicesForClass(char, 'fighter')).toEqual(asis)
    })

    it('getAsiChoicesForClass cae a char.asiChoices plano si la entrada no lo tiene y es la primaria', () => {
      const flatAsis: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'alert' },
      ]
      const char = legacyChar({
        className: 'wizard',
        asiChoices: flatAsis,
        classes: [
          { classId: 'wizard', subclass: '', level: 5, hitDie: 6 },  // sin asiChoices
        ],
      })
      expect(getAsiChoicesForClass(char, 'wizard')).toEqual(flatAsis)
    })

    it('getAsiChoicesForClass devuelve [] si la clase no existe en classes[]', () => {
      const char = legacyChar({
        classes: [{ classId: 'fighter', subclass: '', level: 6, hitDie: 10 }],
      })
      expect(getAsiChoicesForClass(char, 'wizard')).toEqual([])
    })

    it('setAsiChoicesForClass escribe en la entrada de la clase', () => {
      const char = legacyChar({
        classes: [
          { classId: 'fighter', subclass: '', level: 6, hitDie: 10 },
          { classId: 'wizard', subclass: '', level: 4, hitDie: 6 },
        ],
      })
      const newAsis: ASIChoice[] = [
        { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['int'] },
      ]
      setAsiChoicesForClass(char, 'wizard', newAsis)
      expect(char.classes[1]!.asiChoices).toEqual(newAsis)
      // Wizard NO es primaria → char.asiChoices plano NO debe cambiar.
      // (En el legacyChar de test asiChoices no está inicializado, queda undefined.)
      expect(char.asiChoices).toBeUndefined()
    })

    it('setAsiChoicesForClass espeja en char.asiChoices plano si es la primaria', () => {
      const char = legacyChar({
        className: 'fighter',
        classes: [
          { classId: 'fighter', subclass: '', level: 6, hitDie: 10 },
          { classId: 'wizard', subclass: '', level: 4, hitDie: 6 },
        ],
      })
      const newAsis: ASIChoice[] = [
        { level: 4, type: 'feat', featId: 'war-caster' },
      ]
      setAsiChoicesForClass(char, 'fighter', newAsis)
      expect(char.classes[0]!.asiChoices).toEqual(newAsis)
      // Fighter SÍ es primaria → char.asiChoices plano se sincroniza.
      expect(char.asiChoices).toEqual(newAsis)
    })

    it('setAsiChoicesForClass con classId desconocido es no-op (no crash)', () => {
      const char = legacyChar({
        classes: [{ classId: 'fighter', subclass: '', level: 6, hitDie: 10 }],
      })
      setAsiChoicesForClass(char, 'monk', [
        { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['dex'] },
      ])
      expect(char.classes).toHaveLength(1)
      expect(char.classes[0]!.classId).toBe('fighter')
    })

    it('setAsiChoicesForClass clona el array (no comparte referencia)', () => {
      const char = legacyChar({
        classes: [{ classId: 'fighter', subclass: '', level: 6, hitDie: 10 }],
      })
      const asis: ASIChoice[] = [
        { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] },
      ]
      setAsiChoicesForClass(char, 'fighter', asis)
      // Mutar el original no debe afectar al char.
      asis.push({ level: 8, type: 'feat', featId: 'tough' })
      expect(char.classes[0]!.asiChoices).toHaveLength(1)
    })
  })

  describe('Helpers spellcasting multiclass — #139 Fase 4a', () => {
    // Catálogo mock: solo necesitamos id y spellcasting.ability.
    const mockCatalog = [
      { id: 'fighter', spellcasting: null },
      { id: 'wizard', spellcasting: { ability: 'int' } },
      { id: 'cleric', spellcasting: { ability: 'wis' } },
      { id: 'sorcerer', spellcasting: { ability: 'cha' } },
      { id: 'barbarian', spellcasting: null },
    ]

    it('getCasterClasses filtra las clases sin spellcasting', () => {
      const char = legacyChar({
        classes: [
          { classId: 'fighter', subclass: '', level: 5, hitDie: 10 },
          { classId: 'wizard', subclass: '', level: 3, hitDie: 6 },
          { classId: 'barbarian', subclass: '', level: 2, hitDie: 12 },
        ],
      })
      const casters = getCasterClasses(char, mockCatalog)
      expect(casters).toHaveLength(1)
      expect(casters[0]!.entry.classId).toBe('wizard')
      expect(casters[0]!.ability).toBe('int')
    })

    it('getCasterClasses devuelve dos casters con distinta ability', () => {
      const char = legacyChar({
        classes: [
          { classId: 'cleric', subclass: '', level: 5, hitDie: 8 },
          { classId: 'wizard', subclass: '', level: 3, hitDie: 6 },
        ],
      })
      const casters = getCasterClasses(char, mockCatalog)
      expect(casters.map(c => c.ability)).toEqual(['wis', 'int'])
    })

    it('getCasterClasses prefiere ability de la entrada sobre la del catálogo', () => {
      const char = legacyChar({
        classes: [
          { classId: 'cleric', subclass: '', level: 5, hitDie: 8, spellcastingAbility: 'wis' },
        ],
      })
      const casters = getCasterClasses(char, mockCatalog)
      expect(casters[0]!.ability).toBe('wis')
    })

    it('getCasterClasses con PJ sin classes[] (modelo viejo) usa primaria sintética', () => {
      const char = legacyChar({
        className: 'wizard',
        level: 5,
        hitDie: 6,
        classes: [],  // modelo viejo
      })
      const casters = getCasterClasses(char, mockCatalog)
      expect(casters).toHaveLength(1)
      expect(casters[0]!.entry.classId).toBe('wizard')
    })

    it('getSpellsKnownForClass lee de la entrada si está definido', () => {
      const char = legacyChar({
        classes: [
          { classId: 'wizard', subclass: '', level: 5, hitDie: 6, spellsKnown: ['fireball', 'shield'] },
        ],
      })
      expect(getSpellsKnownForClass(char, 'wizard')).toEqual(['fireball', 'shield'])
    })

    it('getSpellsKnownForClass cae al plano si es primaria y la entrada no lo tiene', () => {
      const char = legacyChar({
        className: 'wizard',
        spellsKnown: ['magic-missile', 'detect-magic'],
        classes: [
          { classId: 'wizard', subclass: '', level: 5, hitDie: 6 },  // sin spellsKnown
        ],
      })
      expect(getSpellsKnownForClass(char, 'wizard')).toEqual(['magic-missile', 'detect-magic'])
    })

    it('getSpellsKnownForClass devuelve [] para clase secundaria sin definir', () => {
      const char = legacyChar({
        className: 'wizard',
        spellsKnown: ['magic-missile'],
        classes: [
          { classId: 'wizard', subclass: '', level: 5, hitDie: 6 },
          { classId: 'cleric', subclass: '', level: 3, hitDie: 8 },  // sin spellsKnown
        ],
      })
      // Cleric no es primaria → no podemos atribuirle hechizos del plano.
      expect(getSpellsKnownForClass(char, 'cleric')).toEqual([])
    })

    it('setSpellsKnownForClass escribe en la entrada y sincroniza plano si primaria', () => {
      const char = legacyChar({
        className: 'wizard',
        classes: [
          { classId: 'wizard', subclass: '', level: 5, hitDie: 6 },
          { classId: 'cleric', subclass: '', level: 3, hitDie: 8 },
        ],
      })
      setSpellsKnownForClass(char, 'wizard', ['fireball', 'shield'])
      expect(char.classes[0]!.spellsKnown).toEqual(['fireball', 'shield'])
      // Wizard es primaria → plano espejado.
      expect(char.spellsKnown).toEqual(['fireball', 'shield'])
    })

    it('setSpellsKnownForClass en clase secundaria NO toca el plano', () => {
      const char = legacyChar({
        className: 'wizard',
        spellsKnown: ['magic-missile'],
        classes: [
          { classId: 'wizard', subclass: '', level: 5, hitDie: 6 },
          { classId: 'cleric', subclass: '', level: 3, hitDie: 8 },
        ],
      })
      setSpellsKnownForClass(char, 'cleric', ['bless', 'cure-wounds'])
      expect(char.classes[1]!.spellsKnown).toEqual(['bless', 'cure-wounds'])
      // Plano sigue con los del wizard.
      expect(char.spellsKnown).toEqual(['magic-missile'])
    })

    it('setSpellsKnownForClass clona el array', () => {
      const char = legacyChar({
        classes: [{ classId: 'wizard', subclass: '', level: 5, hitDie: 6 }],
      })
      const spells = ['fireball']
      setSpellsKnownForClass(char, 'wizard', spells)
      spells.push('shield')
      expect(char.classes[0]!.spellsKnown).toHaveLength(1)
    })

    it('getCantripsForClass / setCantripsForClass siguen misma semántica que spellsKnown', () => {
      const char = legacyChar({
        className: 'wizard',
        cantrips: ['fire-bolt'],
        classes: [
          { classId: 'wizard', subclass: '', level: 5, hitDie: 6 },
          { classId: 'cleric', subclass: '', level: 3, hitDie: 8 },
        ],
      })
      // Lectura primaria con fallback al plano.
      expect(getCantripsForClass(char, 'wizard')).toEqual(['fire-bolt'])
      // Lectura secundaria sin definir.
      expect(getCantripsForClass(char, 'cleric')).toEqual([])
      // Escritura primaria espeja plano.
      setCantripsForClass(char, 'wizard', ['fire-bolt', 'mage-hand'])
      expect(char.cantrips).toEqual(['fire-bolt', 'mage-hand'])
      // Escritura secundaria NO toca el plano.
      setCantripsForClass(char, 'cleric', ['guidance', 'sacred-flame'])
      expect(char.classes[1]!.cantrips).toEqual(['guidance', 'sacred-flame'])
      expect(char.cantrips).toEqual(['fire-bolt', 'mage-hand'])  // sin cambios
    })

    it('classId desconocido en setSpellsKnownForClass es no-op', () => {
      const char = legacyChar({
        classes: [{ classId: 'wizard', subclass: '', level: 5, hitDie: 6 }],
      })
      setSpellsKnownForClass(char, 'rogue', ['silvery-barbs'])
      expect(char.classes).toHaveLength(1)
      expect(char.classes[0]!.spellsKnown).toBeUndefined()
    })
  })

  describe('migrateCharacterToClassEntries', () => {
    it('PJ viejo monoclase: rellena classes[0] con campos planos', () => {
      const char = legacyChar({
        className: 'cleric',
        subclass: 'life',
        level: 7,
        hitDie: 8,
        cantrips: ['sacred-flame', 'guidance'],
        spellsKnown: ['bless', 'cure-wounds'],
        spellcastingAbility: 'wis',
        asiChoices: [
          { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['wis'] },
        ],
        classes: [],
      })
      const migrated = migrateCharacterToClassEntries(char)
      expect(migrated).toBe(true)
      expect(char.classes).toHaveLength(1)
      const entry = char.classes[0]!
      expect(entry.classId).toBe('cleric')
      expect(entry.subclass).toBe('life')
      expect(entry.level).toBe(7)
      expect(entry.hitDie).toBe(8)
      expect(entry.cantrips).toEqual(['sacred-flame', 'guidance'])
      expect(entry.spellsKnown).toEqual(['bless', 'cure-wounds'])
      expect(entry.spellcastingAbility).toBe('wis')
      expect(entry.asiChoices).toEqual([
        { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['wis'] },
      ])
    })

    it('PJ ya migrado (classes[] no vacío): no toca nada — idempotente', () => {
      const entry: ClassEntry = {
        classId: 'wizard', subclass: 'evoker', level: 5, hitDie: 6,
        cantrips: ['fire-bolt'], spellsKnown: ['magic-missile'],
      }
      const char = legacyChar({
        classes: [{ ...entry }],
      })
      const migrated = migrateCharacterToClassEntries(char)
      expect(migrated).toBe(false)
      expect(char.classes).toHaveLength(1)
      expect(char.classes[0]!.cantrips).toEqual(['fire-bolt'])  // sin cambios
    })

    it('PJ sin clase elegida (className vacío): no migra — devuelve false', () => {
      const char = legacyChar({ className: '', classes: [] })
      expect(migrateCharacterToClassEntries(char)).toBe(false)
      expect(char.classes).toEqual([])
    })

    it('PJ con weaponMasteries planas: se vuelcan a la entrada', () => {
      const char = legacyChar({
        className: 'fighter', subclass: 'champion', level: 5, hitDie: 10,
        weaponMasteries: ['Longsword', 'Greatsword'],
        classes: [],
      })
      migrateCharacterToClassEntries(char)
      expect(char.classes[0]!.weaponMasteries).toEqual(['Longsword', 'Greatsword'])
    })

    it('campos planos sin definir: la entrada usa defaults razonables', () => {
      const char = legacyChar({
        className: 'barbarian',
        subclass: '',  // sin elegir aún
        level: 1,
        hitDie: 12,
        asiChoices: undefined,
        cantrips: undefined,
        spellsKnown: undefined,
        classes: [],
      })
      migrateCharacterToClassEntries(char)
      const entry = char.classes[0]!
      expect(entry.classId).toBe('barbarian')
      expect(entry.subclass).toBe('')
      expect(entry.level).toBe(1)
      expect(entry.hitDie).toBe(12)
      expect(entry.asiChoices).toBeUndefined()
      expect(entry.cantrips).toBeUndefined()
    })

    it('migración aplicada dos veces seguidas no duplica datos', () => {
      const char = legacyChar({
        className: 'rogue', subclass: 'thief', level: 4, hitDie: 8,
        cantrips: [], classes: [],
      })
      migrateCharacterToClassEntries(char)
      const firstSnapshot = JSON.stringify(char.classes)
      migrateCharacterToClassEntries(char)
      const secondSnapshot = JSON.stringify(char.classes)
      expect(secondSnapshot).toBe(firstSnapshot)
      expect(char.classes).toHaveLength(1)
    })
  })
})
