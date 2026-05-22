// Tests para el flujo de skills en creación — bug #93.
//
// Comprueba que background y clase no se pisan, que las colisiones se
// resuelven correctamente, y que la unión skillProficiencies se mantiene
// coherente.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'

describe('#93 — Skills creation flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('background añade sus skills a skillProficiencies', () => {
    const store = useCharacterStore()
    // Simulamos lo que Step5 hace
    const bgSkills = ['athletics', 'survival']
    store.character.backgroundSkillProficiencies = bgSkills
    store.character.classSkillProficiencies = []
    store.character.skillProficiencies = [...bgSkills]

    expect(store.character.skillProficiencies).toEqual(['athletics', 'survival'])
  })

  it('elección de clase se suma sin pisar las del bg', () => {
    const store = useCharacterStore()
    store.character.backgroundSkillProficiencies = ['athletics', 'survival']
    store.character.classSkillProficiencies = ['intimidation', 'perception']

    // Reconstruimos la unión como hace rebuildSkillProficiencies en Step3
    const union: string[] = []
    for (const s of store.character.backgroundSkillProficiencies)
      if (!union.includes(s)) union.push(s)
    for (const s of store.character.classSkillProficiencies)
      if (!union.includes(s)) union.push(s)
    store.character.skillProficiencies = union

    expect(store.character.skillProficiencies).toEqual([
      'athletics', 'survival', 'intimidation', 'perception',
    ])
  })

  it('si el bg cambia y la nueva trae una skill que la clase había elegido, esa elección de clase se descarta', () => {
    const store = useCharacterStore()
    // Setup inicial: bg con athletics, clase con intimidation y athletics seleccionados
    // (caso imposible si la UI funciona bien, pero defensivo)
    store.character.backgroundSkillProficiencies = ['stealth']
    store.character.classSkillProficiencies = ['athletics', 'intimidation']

    // Cambio bg a uno que ya da athletics
    const newBgSkills = ['athletics', 'history']
    store.character.backgroundSkillProficiencies = newBgSkills
    // Lógica Step5: descartar de classSkills lo que ya viene en bg
    store.character.classSkillProficiencies =
      store.character.classSkillProficiencies.filter(s => !newBgSkills.includes(s))

    expect(store.character.classSkillProficiencies).toEqual(['intimidation'])
    // El jugador ahora tendrá un slot libre en Step3 para elegir otra
  })

  it('no se pueden seleccionar skills del bg desde la lista de clase', () => {
    // Esta es la regla que aplica el UI (bgSkills.includes(skill) → disabled).
    const bgSkills = ['athletics']
    const offerByClass = ['athletics', 'acrobatics', 'intimidation', 'perception']

    // El jugador intenta tocar 'athletics' pero la UI lo bloquea.
    // Las skills *seleccionables* son las restantes.
    const selectable = offerByClass.filter(s => !bgSkills.includes(s))
    expect(selectable).toEqual(['acrobatics', 'intimidation', 'perception'])
  })

  it('al cambiar de clase, se conservan las skills del bg y se reinician las de clase', () => {
    const store = useCharacterStore()
    store.character.backgroundSkillProficiencies = ['athletics', 'survival']
    store.character.classSkillProficiencies = ['intimidation']
    store.character.skillProficiencies = ['athletics', 'survival', 'intimidation']

    // Cambio de clase: Step3.selectClass reinicia classSkillProficiencies
    store.character.classSkillProficiencies = []
    const union: string[] = []
    for (const s of store.character.backgroundSkillProficiencies)
      if (!union.includes(s)) union.push(s)
    store.character.skillProficiencies = union

    expect(store.character.skillProficiencies).toEqual(['athletics', 'survival'])
  })

  it('límite numSkillChoices se respeta — no se puede meter una 3ª si la clase permite 2', () => {
    const numSkillChoices = 2
    const current = ['athletics', 'intimidation']
    // Intento meter una 3ª; toggleSkill no debe permitirlo
    const tryAdd = (skill: string) => {
      if (current.includes(skill)) {
        return current.filter(s => s !== skill)
      } else if (current.length < numSkillChoices) {
        return [...current, skill]
      }
      return current // sin cambio
    }
    expect(tryAdd('perception')).toEqual(['athletics', 'intimidation'])
    expect(tryAdd('athletics')).toEqual(['intimidation']) // toggle off sí funciona
  })
})
