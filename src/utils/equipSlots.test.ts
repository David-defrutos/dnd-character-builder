// #123 — Tests de equipSlots: resolveSlot, equipItem (con auto-desplazamiento),
// attuneItem (con cascada de reglas anillo + total), helpers de diagnóstico.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { preloadVariantData } from '@/data'
import { useCharacterStore } from '@/stores/character'
import type { CharacterData, InventoryItem } from '@/stores/character'
import {
  resolveSlot, isMagicalContainer, isRing,
  equipItem, attuneItem,
  getEquippedConflicts, getAttunementSummary,
} from './equipSlots'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

function makeItem(partial: Partial<InventoryItem> & Pick<InventoryItem, 'slotId' | 'kind' | 'name'>): InventoryItem {
  return {
    itemId: '',
    qty: 1,
    ...partial,
  }
}

beforeAll(async () => { await preloadVariantData('dnd5e') })

describe('#123 — resolveSlot', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('armor item kind → armor slot', () => {
    const i = makeItem({ slotId: 'a', kind: 'armor', itemId: 'Studded Leather Armor', name: 'Studded' })
    expect(resolveSlot(i)).toBe('armor')
  })

  it('weapon item → undefined (sin slot único)', () => {
    const i = makeItem({ slotId: 'a', kind: 'weapon', itemId: 'Dagger', name: 'Dagger' })
    expect(resolveSlot(i)).toBeUndefined()
  })

  it('magic item conocido (Cloak of Protection) → cloak', () => {
    const i = makeItem({ slotId: 'a', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak of Protection' })
    expect(resolveSlot(i)).toBe('cloak')
  })

  it('magic item conocido (Ring of Protection) → ring', () => {
    const i = makeItem({ slotId: 'a', kind: 'magic', itemId: 'ring-of-protection', name: 'Ring of Protection' })
    expect(resolveSlot(i)).toBe('ring')
  })

  it('magic item conocido (Bag of Holding) → sin slot, pero isContainer true', () => {
    // El catálogo no necesita marcar slot en containers (no hay regla PHB
    // de "1 container equipped a la vez"); basta con isContainer para
    // excluir su contenido del peso.
    const i = makeItem({ slotId: 'a', kind: 'magic', itemId: 'bag-of-holding', name: 'Bag of Holding' })
    expect(resolveSlot(i)).toBeUndefined()
    expect(isMagicalContainer(i)).toBe(true)
  })

  it('magic item sin slot declarado → undefined', () => {
    const i = makeItem({ slotId: 'a', kind: 'magic', itemId: 'wand-of-magic-missiles', name: 'Wand of MM' })
    expect(resolveSlot(i)).toBeUndefined()
  })

  it('custom item con selectedSlot → ese slot', () => {
    const i = makeItem({ slotId: 'a', kind: 'custom', name: 'Homebrew Ring', selectedSlot: 'ring' })
    expect(resolveSlot(i)).toBe('ring')
  })

  it('custom item sin selectedSlot → undefined', () => {
    const i = makeItem({ slotId: 'a', kind: 'custom', name: 'Curio' })
    expect(resolveSlot(i)).toBeUndefined()
  })
})

describe('#123 — isMagicalContainer', () => {
  it('Bag of Holding → true', () => {
    const i = makeItem({ slotId: 'a', kind: 'magic', itemId: 'bag-of-holding', name: 'Bag of Holding' })
    expect(isMagicalContainer(i)).toBe(true)
  })
  it('Handy Haversack → true', () => {
    const i = makeItem({ slotId: 'a', kind: 'magic', itemId: 'handy-haversack', name: 'Handy Haversack' })
    expect(isMagicalContainer(i)).toBe(true)
  })
  it('Cloak of Protection → false', () => {
    const i = makeItem({ slotId: 'a', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak' })
    expect(isMagicalContainer(i)).toBe(false)
  })
  it('Custom marcado como container → true', () => {
    const i = makeItem({ slotId: 'a', kind: 'custom', name: 'Homebrew Bag', isMagicalContainer: true })
    expect(isMagicalContainer(i)).toBe(true)
  })
})

describe('#123 — isRing', () => {
  it('Ring of Protection → true', () => {
    const i = makeItem({ slotId: 'a', kind: 'magic', itemId: 'ring-of-protection', name: 'Ring' })
    expect(isRing(i)).toBe(true)
  })
  it('Custom con selectedSlot=ring → true', () => {
    const i = makeItem({ slotId: 'a', kind: 'custom', name: 'Homebrew Ring', selectedSlot: 'ring' })
    expect(isRing(i)).toBe(true)
  })
  it('Cloak → false', () => {
    const i = makeItem({ slotId: 'a', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak' })
    expect(isRing(i)).toBe(false)
  })
})

describe('#123 — equipItem', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('equipar item en slot vacío: solo marca equipped=true', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak' }),
    ]
    const r = equipItem(inv, 'a')
    expect(r.updates).toEqual([{ slotId: 'a', equipped: true }])
    expect(r.notice).toBeUndefined()
  })

  it('equipar item en slot ocupado: auto-desequipa el anterior', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak of Protection', equipped: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'cloak-of-displacement', name: 'Cloak of Displacement' }),
    ]
    const r = equipItem(inv, 'b')
    expect(r.updates).toContainEqual({ slotId: 'a', equipped: false })
    expect(r.updates).toContainEqual({ slotId: 'b', equipped: true })
    expect(r.notice).toContain('Cloak of Protection unequipped')
    expect(r.notice).toContain('cloak')
  })

  it('equipar anillo: no desplaza otros anillos equipados', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'ring-of-protection', name: 'Ring 1', equipped: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'ring-of-swimming', name: 'Ring 2', equipped: true }),
      makeItem({ slotId: 'c', kind: 'magic', itemId: 'ring-of-warmth', name: 'Ring 3' }),
    ]
    const r = equipItem(inv, 'c')
    expect(r.updates).toEqual([{ slotId: 'c', equipped: true }])
    expect(r.notice).toBeUndefined()
  })

  it('equipar item que estaba stored: lo saca del container y lo equipa', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak', stored: true }),
    ]
    const r = equipItem(inv, 'a')
    expect(r.updates).toContainEqual({ slotId: 'a', equipped: true, stored: false })
  })

  it('equipar custom con selectedSlot=boots: desplaza unas botas equipadas', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'boots-of-elvenkind', name: 'Boots of Elvenkind', equipped: true }),
      makeItem({ slotId: 'b', kind: 'custom', name: 'Homebrew Boots', selectedSlot: 'boots' }),
    ]
    const r = equipItem(inv, 'b')
    expect(r.updates).toContainEqual({ slotId: 'a', equipped: false })
    expect(r.updates).toContainEqual({ slotId: 'b', equipped: true })
  })

  it('equipar item sin slot detectable: no desplaza nada', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak', equipped: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'wand-of-magic-missiles', name: 'Wand' }),
    ]
    const r = equipItem(inv, 'b')
    expect(r.updates).toEqual([{ slotId: 'b', equipped: true }])
  })

  // #130 — magic items sin slot declarado (wands, scrolls, instrumentos
  // sin uniqueness en catálogo) se pueden equipar varios a la vez sin
  // desplazarse entre sí. Items que SÍ tienen slot (head, neck...)
  // mantienen sus reglas de unicidad.
  it('#130 — varios magic items sin slot coexisten equipados sin conflicto', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'wand-of-magic-missiles', name: 'Wand 1', equipped: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'wand-of-fireballs', name: 'Wand 2' }),
    ]
    const r = equipItem(inv, 'b')
    expect(r.updates).toEqual([{ slotId: 'b', equipped: true }])
    // Crítico: el primer wand NO se desequipa (ninguno tiene slot único).
    expect(r.updates.find(u => u.slotId === 'a')).toBeUndefined()
  })
})

describe('#123 — attuneItem', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('atunar primer item: solo marca attuned=true', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak' }),
    ]
    const r = attuneItem(inv, 'a')
    expect(r.updates).toEqual([{ slotId: 'a', attuned: true }])
    expect(r.notice).toBeUndefined()
  })

  it('atunar 4º item: desatúa el más antiguo', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak', attuned: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'boots-of-elvenkind', name: 'Boots', attuned: true }),
      makeItem({ slotId: 'c', kind: 'magic', itemId: 'amulet-of-health', name: 'Amulet', attuned: true }),
      makeItem({ slotId: 'd', kind: 'magic', itemId: 'belt-of-dwarvenkind', name: 'Belt' }),
    ]
    const r = attuneItem(inv, 'd')
    expect(r.updates).toContainEqual({ slotId: 'a', attuned: false })
    expect(r.updates).toContainEqual({ slotId: 'd', attuned: true })
    expect(r.notice).toContain('Cloak unattuned')
    expect(r.notice).toContain('maximum 3 attuned items')
  })

  it('atunar 3er anillo: desatúa el anillo más antiguo (regla de 2 rings)', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'ring-of-protection', name: 'Ring 1', attuned: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'ring-of-swimming', name: 'Ring 2', attuned: true }),
      makeItem({ slotId: 'c', kind: 'magic', itemId: 'ring-of-warmth', name: 'Ring 3' }),
    ]
    const r = attuneItem(inv, 'c')
    expect(r.updates).toContainEqual({ slotId: 'a', attuned: false })
    expect(r.updates).toContainEqual({ slotId: 'c', attuned: true })
    expect(r.notice).toContain('Ring 1 unattuned')
    expect(r.notice).toContain('maximum 2 attuned rings')
  })

  it('cascada: 3er anillo cuando ya hay 2 rings + 1 no-ring atunados (3 total)', () => {
    const inv: InventoryItem[] = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'ring-of-protection', name: 'Ring 1', attuned: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'ring-of-swimming', name: 'Ring 2', attuned: true }),
      makeItem({ slotId: 'c', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak', attuned: true }),
      makeItem({ slotId: 'd', kind: 'magic', itemId: 'ring-of-warmth', name: 'Ring 3' }),
    ]
    const r = attuneItem(inv, 'd')
    // Se desatúa Ring 1 por regla anillos. Tras eso quedan 2 atuneados (Ring 2 + Cloak)
    // más el nuevo Ring 3 = 3, lo cual encaja con el límite total → no más cascada.
    expect(r.updates).toContainEqual({ slotId: 'a', attuned: false })
    expect(r.updates).toContainEqual({ slotId: 'd', attuned: true })
    // Cloak NO debería desatuneatse.
    expect(r.updates.find(u => u.slotId === 'c')).toBeUndefined()
  })
})

describe('#123 — getEquippedConflicts', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('detecta 2 cloaks equipados', () => {
    const char = freshChar()
    char.inventory = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak 1', equipped: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'cloak-of-displacement', name: 'Cloak 2', equipped: true }),
    ]
    const conflicts = getEquippedConflicts(char)
    expect(conflicts.length).toBe(1)
    expect(conflicts[0]!.slot).toBe('cloak')
    expect(conflicts[0]!.items.length).toBe(2)
  })

  it('rings no se consideran conflicto (sin límite físico)', () => {
    const char = freshChar()
    char.inventory = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'ring-of-protection', name: 'R1', equipped: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'ring-of-swimming', name: 'R2', equipped: true }),
      makeItem({ slotId: 'c', kind: 'magic', itemId: 'ring-of-warmth', name: 'R3', equipped: true }),
    ]
    expect(getEquippedConflicts(char)).toEqual([])
  })
})

describe('#123 — getAttunementSummary', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('cuenta atuneamientos totales y de anillos', () => {
    const char = freshChar()
    char.inventory = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'ring-of-protection', name: 'R1', attuned: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'ring-of-swimming', name: 'R2', attuned: true }),
      makeItem({ slotId: 'c', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak', attuned: true }),
    ]
    const s = getAttunementSummary(char)
    expect(s.attunedCount).toBe(3)
    expect(s.attunedRingCount).toBe(2)
    expect(s.exceedsTotal).toBe(false)
    expect(s.exceedsRings).toBe(false)
  })

  it('detecta exceso (PJ importado con 4 atuneados)', () => {
    const char = freshChar()
    char.inventory = [
      makeItem({ slotId: 'a', kind: 'magic', itemId: 'ring-of-protection', name: 'R1', attuned: true }),
      makeItem({ slotId: 'b', kind: 'magic', itemId: 'ring-of-swimming', name: 'R2', attuned: true }),
      makeItem({ slotId: 'c', kind: 'magic', itemId: 'ring-of-warmth', name: 'R3', attuned: true }),
      makeItem({ slotId: 'd', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak', attuned: true }),
    ]
    const s = getAttunementSummary(char)
    expect(s.attunedCount).toBe(4)
    expect(s.attunedRingCount).toBe(3)
    expect(s.exceedsTotal).toBe(true)
    expect(s.exceedsRings).toBe(true)
  })
})
