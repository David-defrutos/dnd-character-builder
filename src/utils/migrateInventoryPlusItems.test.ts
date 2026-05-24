// #150 — Tests para la migración silenciosa de weapon/armor +N.

import { describe, it, expect } from 'vitest'
import type { CharacterData, InventoryItem } from '@/stores/character'
import { migrateInventoryPlusItems } from './migrateInventoryPlusItems'

function makeChar(inventory: InventoryItem[]): CharacterData {
  return { inventory } as unknown as CharacterData
}

function mkItem(partial: Partial<InventoryItem>): InventoryItem {
  return {
    slotId: partial.slotId ?? crypto.randomUUID(),
    kind: partial.kind ?? 'magic',
    itemId: partial.itemId ?? '',
    name: partial.name ?? '',
    qty: partial.qty ?? 1,
    ...partial,
  }
}

describe('#150 — migrateInventoryPlusItems', () => {
  it('Hand Crossbow +1: kind=magic → kind=weapon + magicItemId', () => {
    const char = makeChar([
      mkItem({ kind: 'magic', itemId: 'hand-crossbow-plus1', name: 'Hand Crossbow +1' }),
    ])
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(1)
    expect(char.inventory[0].kind).toBe('weapon')
    expect(char.inventory[0].itemId).toBe('Hand Crossbow')
    expect(char.inventory[0].magicItemId).toBe('hand-crossbow-plus1')
    expect(char.inventory[0].name).toBe('Hand Crossbow +1')  // name no cambia
  })

  it('Plate Armor +2: kind=magic → kind=armor + magicItemId', () => {
    const char = makeChar([
      mkItem({ kind: 'magic', itemId: 'plate-armor-plus2', name: 'Plate Armor +2' }),
    ])
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(1)
    expect(char.inventory[0].kind).toBe('armor')
    expect(char.inventory[0].itemId).toBe('Plate Armor')
    expect(char.inventory[0].magicItemId).toBe('plate-armor-plus2')
  })

  it('Shield +1: kind=magic → kind=armor (shield se trata como armor) + magicItemId', () => {
    const char = makeChar([
      mkItem({ kind: 'magic', itemId: 'shield-plus1', name: 'Shield +1' }),
    ])
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(1)
    expect(char.inventory[0].kind).toBe('armor')
    expect(char.inventory[0].itemId).toBe('Shield')
    expect(char.inventory[0].magicItemId).toBe('shield-plus1')
  })

  it('Magic item puro (Cloak of Protection): no se migra', () => {
    const char = makeChar([
      mkItem({ kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak of Protection' }),
    ])
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(0)
    expect(char.inventory[0].kind).toBe('magic')
    expect(char.inventory[0].magicItemId).toBeUndefined()
  })

  it('Weapon ya migrada (kind=weapon con magicItemId): no se toca', () => {
    const char = makeChar([
      mkItem({ kind: 'weapon', itemId: 'Hand Crossbow', name: 'Hand Crossbow +1', magicItemId: 'hand-crossbow-plus1' }),
    ])
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(0)
    expect(char.inventory[0].kind).toBe('weapon')
    expect(char.inventory[0].magicItemId).toBe('hand-crossbow-plus1')
  })

  it('Weapon normal (no mágica): no se toca', () => {
    const char = makeChar([
      mkItem({ kind: 'weapon', itemId: 'Rapier', name: 'Rapier' }),
    ])
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(0)
    expect(char.inventory[0].kind).toBe('weapon')
  })

  it('Inventory vacío: no-op', () => {
    const char = makeChar([])
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(0)
  })

  it('Char sin inventory: no-op (defensive)', () => {
    const char = {} as unknown as CharacterData
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(0)
  })

  it('Mezcla: solo migra las viejas weapon/armor +N', () => {
    const char = makeChar([
      mkItem({ kind: 'weapon', itemId: 'Rapier', name: 'Rapier' }),
      mkItem({ kind: 'magic', itemId: 'hand-crossbow-plus1', name: 'Hand Crossbow +1' }),
      mkItem({ kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak of Protection' }),
      mkItem({ kind: 'magic', itemId: 'studded-leather-armor-plus3', name: 'Studded Leather Armor +3' }),
    ])
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(2)
    expect(char.inventory[0].kind).toBe('weapon')  // Rapier
    expect(char.inventory[1].kind).toBe('weapon')  // Hand Crossbow +1
    expect(char.inventory[1].magicItemId).toBe('hand-crossbow-plus1')
    expect(char.inventory[2].kind).toBe('magic')   // Cloak sigue magic
    expect(char.inventory[3].kind).toBe('armor')   // Studded +3
    expect(char.inventory[3].magicItemId).toBe('studded-leather-armor-plus3')
  })

  it('IDs raros con kebab (war-pick-plus1, half-plate-armor-plus2)', () => {
    const char = makeChar([
      mkItem({ kind: 'magic', itemId: 'war-pick-plus1', name: 'War Pick +1' }),
      mkItem({ kind: 'magic', itemId: 'half-plate-armor-plus2', name: 'Half Plate Armor +2' }),
    ])
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(2)
    expect(char.inventory[0].kind).toBe('weapon')
    expect(char.inventory[0].itemId).toBe('War Pick')
    expect(char.inventory[1].kind).toBe('armor')
    expect(char.inventory[1].itemId).toBe('Half Plate Armor')
  })

  it('Sufijo -plus inválido (-plus4, -plus10) o no es plus item: no migra', () => {
    const char = makeChar([
      mkItem({ kind: 'magic', itemId: 'something-plus4', name: 'Something +4' }),
      mkItem({ kind: 'magic', itemId: 'wand-of-magic-missiles', name: 'Wand of MM' }),
    ])
    const n = migrateInventoryPlusItems(char)
    expect(n).toBe(0)
  })
})
