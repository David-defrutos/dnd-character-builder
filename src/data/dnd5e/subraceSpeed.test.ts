// Tests para H2 (auditoría externa): subrace.speed debe override race.speed.
// Caso paradigmático: Wood Elf 35 ft sobre Elf base 30 ft.

import { describe, it, expect, beforeAll } from 'vitest'
import { getRaces, preloadVariantData } from '@/data'

describe('H2 — Subrace speed override', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })

  it('Elf base speed = 30', () => {
    const races = getRaces('dnd5e')
    const elf = races.find(r => r.id === 'elf')
    expect(elf?.speed).toBe(30)
  })

  it('Wood Elf subrace tiene speed = 35', () => {
    const races = getRaces('dnd5e')
    const elf = races.find(r => r.id === 'elf')
    const wood = elf?.subraces.find(s => s.id === 'wood-elf')
    expect(wood?.speed).toBe(35)
  })

  it('High Elf y Drow heredan speed = 30 (no override)', () => {
    const races = getRaces('dnd5e')
    const elf = races.find(r => r.id === 'elf')
    const high = elf?.subraces.find(s => s.id === 'high-elf')
    const drow = elf?.subraces.find(s => s.id === 'drow')
    expect(high?.speed).toBeUndefined()
    expect(drow?.speed).toBeUndefined()
  })

  it('La lógica de selectSubrace aplica sub.speed ?? race.speed', () => {
    // Patrón usado en Step2Race.vue.
    const races = getRaces('dnd5e')
    const elf = races.find(r => r.id === 'elf')!
    const wood = elf.subraces.find(s => s.id === 'wood-elf')!
    const high = elf.subraces.find(s => s.id === 'high-elf')!

    const speedWood = wood.speed ?? elf.speed
    const speedHigh = high.speed ?? elf.speed
    expect(speedWood).toBe(35)
    expect(speedHigh).toBe(30)
  })
})
