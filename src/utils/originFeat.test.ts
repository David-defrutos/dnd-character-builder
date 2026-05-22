// Documento generado el 2026-05-20-2145 — milestone 23 (#63 origin feat)
//
// Tests del helper setOriginFeat que reemplaza la lógica defectuosa que
// usaba startsWith('Feat: ') en Step5Background.vue.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { setOriginFeat } from '@/utils/originFeat'
import { preloadVariantData } from '@/data'
import type { CharacterData } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('Milestone 23 — Origin feat tracking (#63)', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  beforeEach(() => setActivePinia(createPinia()))

  it('asigna un feat: añade tag y guarda originFeatId', () => {
    const char = freshChar()
    setOriginFeat(char, 'alert')
    expect(char.originFeatId).toBe('alert')
    expect(char.featuresTraits).toContain('Origin Feat: Alert')
  })

  it('reemplazar el feat: quita el tag anterior y pone el nuevo', () => {
    const char = freshChar()
    setOriginFeat(char, 'alert')
    setOriginFeat(char, 'lucky')
    expect(char.originFeatId).toBe('lucky')
    expect(char.featuresTraits).toContain('Origin Feat: Lucky')
    expect(char.featuresTraits).not.toContain('Origin Feat: Alert')
  })

  it('limpiar el feat (undefined): quita el tag y deja originFeatId vacío', () => {
    const char = freshChar()
    setOriginFeat(char, 'alert')
    setOriginFeat(char, undefined)
    expect(char.originFeatId).toBeUndefined()
    expect(char.featuresTraits.some(f => f.startsWith('Origin Feat:'))).toBe(false)
  })

  it('CASO DEL BUG: NO borra otros tags que no sean del origin feat', () => {
    const char = freshChar()
    // Simulación de tags futuros añadidos por otras features
    char.featuresTraits = [
      'Versatile: Skilled humans gain one extra skill...',
      'ASI Feat: Tough (lv.4)',
      'Wild Talent: psychic resonance',
    ]
    setOriginFeat(char, 'alert')
    // El feat de origen se añadió
    expect(char.featuresTraits).toContain('Origin Feat: Alert')
    // Los tags previos siguen ahí
    expect(char.featuresTraits).toContain('Versatile: Skilled humans gain one extra skill...')
    expect(char.featuresTraits).toContain('ASI Feat: Tough (lv.4)')
    expect(char.featuresTraits).toContain('Wild Talent: psychic resonance')
  })

  it('CASO DEL BUG: limpiar el origin feat NO toca otros tags', () => {
    const char = freshChar()
    setOriginFeat(char, 'alert')
    // Añadimos un tag "inocente" después
    char.featuresTraits.push('ASI Feat: Tough (lv.4)')
    char.featuresTraits.push('Some other note')
    setOriginFeat(char, undefined)
    expect(char.featuresTraits).not.toContain('Origin Feat: Alert')
    // Otros tags siguen intactos
    expect(char.featuresTraits).toContain('ASI Feat: Tough (lv.4)')
    expect(char.featuresTraits).toContain('Some other note')
  })

  it('llamadas idempotentes: aplicar el mismo feat dos veces no duplica', () => {
    const char = freshChar()
    setOriginFeat(char, 'alert')
    setOriginFeat(char, 'alert')
    const alertTags = char.featuresTraits.filter(f => f === 'Origin Feat: Alert')
    expect(alertTags.length).toBe(1)
  })

  it('id desconocido: no añade tag, limpia originFeatId', () => {
    const char = freshChar()
    setOriginFeat(char, 'imaginary-feat-id')
    expect(char.originFeatId).toBeUndefined()
    expect(char.featuresTraits.some(f => f.startsWith('Origin Feat:'))).toBe(false)
  })

  it('flujo: criminal (alert) -> sage (magic-initiate) -> sin feat', () => {
    const char = freshChar()
    // Criminal → Alert
    setOriginFeat(char, 'alert')
    expect(char.featuresTraits.filter(f => f.startsWith('Origin Feat:'))).toEqual([
      'Origin Feat: Alert',
    ])
    // Sage → Magic Initiate
    setOriginFeat(char, 'magic-initiate')
    expect(char.featuresTraits.filter(f => f.startsWith('Origin Feat:'))).toEqual([
      'Origin Feat: Magic Initiate',
    ])
    // Background sin feat
    setOriginFeat(char, undefined)
    expect(char.featuresTraits.filter(f => f.startsWith('Origin Feat:'))).toEqual([])
    expect(char.originFeatId).toBeUndefined()
  })
})
