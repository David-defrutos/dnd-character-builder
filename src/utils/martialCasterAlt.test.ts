// Tests para H5 (Paladin Blessed Warrior / Ranger Druidic Warrior) — auditoría externa.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import {
  MARTIAL_CASTER_ALT_OPTIONS,
  getApplicableAltOption,
  setMartialCasterAlt,
  hasMartialCasterAlt,
} from './martialCasterAlt'

describe('H5 — Martial Caster Alt (Blessed/Druidic Warrior)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('catálogo MARTIAL_CASTER_ALT_OPTIONS', () => {
    it('incluye Blessed Warrior (Paladin lv.2, cleric cantrips, count=2)', () => {
      const o = MARTIAL_CASTER_ALT_OPTIONS.find(x => x.source === 'paladin-blessed')
      expect(o).toBeDefined()
      expect(o?.className).toBe('paladin')
      expect(o?.level).toBe(2)
      expect(o?.cantripList).toBe('cleric')
      expect(o?.count).toBe(2)
    })

    it('incluye Druidic Warrior (Ranger lv.2, druid cantrips, count=2)', () => {
      const o = MARTIAL_CASTER_ALT_OPTIONS.find(x => x.source === 'ranger-druidic')
      expect(o).toBeDefined()
      expect(o?.className).toBe('ranger')
      expect(o?.level).toBe(2)
      expect(o?.cantripList).toBe('druid')
      expect(o?.count).toBe(2)
    })
  })

  describe('getApplicableAltOption', () => {
    it('Paladin lv.2+ → Blessed Warrior', () => {
      const store = useCharacterStore()
      store.character.className = 'paladin'
      store.character.level = 2
      const opt = getApplicableAltOption(store.character)
      expect(opt?.source).toBe('paladin-blessed')
    })

    it('Paladin lv.1 → null (Fighting Style aún no disponible)', () => {
      const store = useCharacterStore()
      store.character.className = 'paladin'
      store.character.level = 1
      expect(getApplicableAltOption(store.character)).toBeNull()
    })

    it('Ranger lv.5 → Druidic Warrior', () => {
      const store = useCharacterStore()
      store.character.className = 'ranger'
      store.character.level = 5
      const opt = getApplicableAltOption(store.character)
      expect(opt?.source).toBe('ranger-druidic')
    })

    it('Fighter (cualquier nivel) → null (Fighter no tiene Alt)', () => {
      const store = useCharacterStore()
      store.character.className = 'fighter'
      store.character.level = 10
      expect(getApplicableAltOption(store.character)).toBeNull()
    })
  })

  describe('setMartialCasterAlt', () => {
    it('Activar Blessed Warrior con 2 cantrips', () => {
      const store = useCharacterStore()
      store.character.className = 'paladin'
      store.character.level = 2
      setMartialCasterAlt(store.character, 'paladin-blessed', ['guidance', 'sacred-flame'])
      expect(store.character.martialCasterAlt).toEqual({
        source: 'paladin-blessed',
        cantrips: ['guidance', 'sacred-flame'],
      })
    })

    it('Desactivar limpia el campo', () => {
      const store = useCharacterStore()
      setMartialCasterAlt(store.character, 'paladin-blessed', ['guidance'])
      expect(store.character.martialCasterAlt).toBeDefined()
      setMartialCasterAlt(store.character, null)
      expect(store.character.martialCasterAlt).toBeUndefined()
    })

    it('Activar Alt borra el fightingStyleFeat (exclusión mutua)', () => {
      const store = useCharacterStore()
      store.character.fightingStyleFeat = 'defense'
      setMartialCasterAlt(store.character, 'paladin-blessed', ['guidance'])
      expect(store.character.fightingStyleFeat).toBeUndefined()
      expect(store.character.martialCasterAlt?.source).toBe('paladin-blessed')
    })
  })

  describe('hasMartialCasterAlt', () => {
    it('false por defecto', () => {
      const store = useCharacterStore()
      expect(hasMartialCasterAlt(store.character)).toBe(false)
    })

    it('true tras activar', () => {
      const store = useCharacterStore()
      setMartialCasterAlt(store.character, 'paladin-blessed', [])
      expect(hasMartialCasterAlt(store.character)).toBe(true)
    })

    it('false tras desactivar', () => {
      const store = useCharacterStore()
      setMartialCasterAlt(store.character, 'paladin-blessed', ['guidance'])
      setMartialCasterAlt(store.character, null)
      expect(hasMartialCasterAlt(store.character)).toBe(false)
    })
  })
})
