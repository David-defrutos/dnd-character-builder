// #139 Fase 2 — reorderClasses + sincronía classes[0] ↔ campos planos.
//
// La Fase 2 introduce:
//   - characterStore.reorderClasses(fromIdx, toIdx)
//   - Sincronía silenciosa de classes[0] tras selectClass (en Step3Class.vue,
//     no testeable a nivel de unidad sin montar el componente).
//
// Aquí cubrimos lo testeable a nivel store: reorderClasses con sus casos
// borde y el efecto en los campos planos primarios cuando se mueve a/desde
// el slot 0.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { preloadVariantData } from '@/data'

describe('#139 Fase 2 — reorderClasses del store', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function makeMulticlass() {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'fighter'
    char.subclass = 'champion'
    char.hitDie = 10
    char.level = 6
    // Simular un fighter + wizard ya en classes[]:
    char.classes = [
      { classId: 'fighter', subclass: 'champion', level: 6, hitDie: 10 },
      { classId: 'wizard', subclass: '', level: 4, hitDie: 6, spellcastingAbility: 'int' },
    ]
    char.level = 10
    return store
  }

  it('intercambia dos índices válidos', () => {
    const store = makeMulticlass()
    store.reorderClasses(0, 1)
    expect(store.character.classes.map(c => c.classId)).toEqual(['wizard', 'fighter'])
  })

  it('mover wizard a primaria sincroniza campos planos (className, hitDie, spellcasting)', () => {
    const store = makeMulticlass()
    expect(store.character.className).toBe('fighter')
    expect(store.character.spellcastingAbility).toBe('')  // fighter no caster
    store.reorderClasses(1, 0)  // wizard sube a primaria
    expect(store.character.className).toBe('wizard')
    expect(store.character.subclass).toBe('')
    expect(store.character.hitDie).toBe(6)
    expect(store.character.spellcastingAbility).toBe('int')
    expect(store.character.spellcastingClass).toBe('wizard')
  })

  it('mover fighter de primaria a secundaria limpia spellcasting si la nueva primaria no es caster', () => {
    const store = makeMulticlass()
    // Primero subimos wizard a primaria (le da spellcasting):
    store.reorderClasses(1, 0)
    expect(store.character.spellcastingAbility).toBe('int')
    // Ahora volvemos al estado fighter-primary:
    store.reorderClasses(1, 0)
    expect(store.character.className).toBe('fighter')
    expect(store.character.spellcastingAbility).toBe('')
    expect(store.character.spellcastingClass).toBe('')
  })

  it('reordenar índices que NO incluyen el 0 no toca campos planos', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'fighter'
    char.subclass = 'champion'
    char.hitDie = 10
    char.classes = [
      { classId: 'fighter', subclass: 'champion', level: 6, hitDie: 10 },
      { classId: 'wizard', subclass: '', level: 4, hitDie: 6 },
      { classId: 'cleric', subclass: 'life', level: 2, hitDie: 8 },
    ]
    char.level = 12
    // Intercambiar wizard (1) y cleric (2): primaria sigue siendo fighter.
    store.reorderClasses(1, 2)
    expect(store.character.classes.map(c => c.classId)).toEqual(['fighter', 'cleric', 'wizard'])
    expect(store.character.className).toBe('fighter')
    expect(store.character.hitDie).toBe(10)
    expect(store.character.subclass).toBe('champion')
  })

  it('fromIdx === toIdx: no-op', () => {
    const store = makeMulticlass()
    const before = JSON.stringify(store.character.classes)
    store.reorderClasses(0, 0)
    expect(JSON.stringify(store.character.classes)).toBe(before)
  })

  it('índice fuera de rango: no-op', () => {
    const store = makeMulticlass()
    const before = JSON.stringify(store.character.classes)
    store.reorderClasses(0, 5)
    expect(JSON.stringify(store.character.classes)).toBe(before)
    store.reorderClasses(-1, 0)
    expect(JSON.stringify(store.character.classes)).toBe(before)
  })

  it('mover la primaria a posición intermedia en triple multiclass', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'fighter'
    char.hitDie = 10
    char.classes = [
      { classId: 'fighter', subclass: '', level: 5, hitDie: 10 },
      { classId: 'wizard', subclass: '', level: 3, hitDie: 6, spellcastingAbility: 'int' },
      { classId: 'cleric', subclass: '', level: 2, hitDie: 8, spellcastingAbility: 'wis' },
    ]
    // Mover wizard a primaria (idx 1 → 0): fighter cae a idx 1, cleric queda en 2.
    store.reorderClasses(1, 0)
    expect(store.character.classes.map(c => c.classId)).toEqual(['wizard', 'fighter', 'cleric'])
    expect(store.character.className).toBe('wizard')
    expect(store.character.spellcastingAbility).toBe('int')
  })

  it('HP no se recalcula tras reorder (sigue siendo suma)', () => {
    const store = makeMulticlass()
    const hpBefore = store.character.maxHp
    store.reorderClasses(0, 1)
    expect(store.character.maxHp).toBe(hpBefore)
  })

  it('subclase de la nueva primaria se respeta', () => {
    const store = useCharacterStore()
    const char = store.character
    char.variant = 'dnd5e'
    char.className = 'fighter'
    char.subclass = 'champion'
    char.hitDie = 10
    char.classes = [
      { classId: 'fighter', subclass: 'champion', level: 6, hitDie: 10 },
      { classId: 'cleric', subclass: 'life', level: 4, hitDie: 8, spellcastingAbility: 'wis' },
    ]
    store.reorderClasses(1, 0)
    expect(store.character.className).toBe('cleric')
    expect(store.character.subclass).toBe('life')
    expect(store.character.spellcastingAbility).toBe('wis')
  })
})
