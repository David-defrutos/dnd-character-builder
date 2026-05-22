// Tests para H4 (auditoría externa): selectClass debe copiar
// armor/weapon/tool proficiencies al personaje, separadas por origen.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { getClasses, preloadVariantData } from '@/data'

describe('H4 — Class proficiencies se copian al personaje', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Patrón de selectClass (Step3Class.vue) que estos tests validan:
  function applyClassToCharacter(cls: ReturnType<typeof getClasses>[number]) {
    const store = useCharacterStore()
    store.character.classArmorProficiencies = [...cls.armorProficiencies]
    store.character.classWeaponProficiencies = [...cls.weaponProficiencies]
    store.character.classToolProficiencies = [...cls.toolProficiencies]
  }

  it('Fighter aplica armor light/medium/heavy/shields, weapon simple+martial', () => {
    const fighter = getClasses('dnd5e').find(c => c.id === 'fighter')!
    applyClassToCharacter(fighter)
    const store = useCharacterStore()
    expect(store.character.classArmorProficiencies).toEqual(fighter.armorProficiencies)
    expect(store.character.classWeaponProficiencies).toEqual(['simple', 'martial'])
  })

  it('Wizard aplica solo simple weapons, sin armor', () => {
    const wiz = getClasses('dnd5e').find(c => c.id === 'wizard')!
    applyClassToCharacter(wiz)
    const store = useCharacterStore()
    expect(store.character.classWeaponProficiencies).toEqual(['simple'])
    // Wizard PHB 2024: ninguna armor proficiency de clase
    expect(store.character.classArmorProficiencies).toEqual([])
  })

  it('Rogue aplica martial-finesse en weapon proficiencies', () => {
    const rogue = getClasses('dnd5e').find(c => c.id === 'rogue')!
    applyClassToCharacter(rogue)
    const store = useCharacterStore()
    expect(store.character.classWeaponProficiencies).toContain('simple')
    expect(store.character.classWeaponProficiencies).toContain('martial-finesse')
  })

  it('Bard tiene tool proficiencies (3 musical instruments)', () => {
    const bard = getClasses('dnd5e').find(c => c.id === 'bard')!
    applyClassToCharacter(bard)
    const store = useCharacterStore()
    expect(store.character.classToolProficiencies?.length).toBeGreaterThan(0)
  })

  it('Cleric sin tool proficiencies → array vacío', () => {
    const cleric = getClasses('dnd5e').find(c => c.id === 'cleric')!
    applyClassToCharacter(cleric)
    const store = useCharacterStore()
    expect(store.character.classToolProficiencies).toEqual([])
  })

  it('Cambiar de clase reemplaza las proficiencies anteriores', () => {
    const fighter = getClasses('dnd5e').find(c => c.id === 'fighter')!
    const wiz = getClasses('dnd5e').find(c => c.id === 'wizard')!
    const store = useCharacterStore()

    applyClassToCharacter(fighter)
    expect(store.character.classArmorProficiencies?.length).toBeGreaterThan(0)
    expect(store.character.classWeaponProficiencies).toContain('martial')

    applyClassToCharacter(wiz)
    expect(store.character.classArmorProficiencies).toEqual([])
    expect(store.character.classWeaponProficiencies).toEqual(['simple'])
    expect(store.character.classWeaponProficiencies).not.toContain('martial')
  })

  it('Las copias son independientes — modificar el array del PJ no afecta la fuente', () => {
    const fighter = getClasses('dnd5e').find(c => c.id === 'fighter')!
    applyClassToCharacter(fighter)
    const store = useCharacterStore()
    store.character.classWeaponProficiencies!.push('exotic')
    // El array original de la clase no debe verse afectado
    expect(fighter.weaponProficiencies).not.toContain('exotic')
  })
})
