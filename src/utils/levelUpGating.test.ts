// Documento generado el 2026-05-20-1235 — milestone 14 (gating del level-up, #50)
// Bloquear la subida de nivel hasta que el usuario haya resuelto todas las
// decisiones pendientes del nivel actual (subclase, ASI/feat, hechizos).

import { describe, it, expect, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { pendingLevelDecisions, canLevelUp } from '@/utils/levelUpGating'
import { preloadVariantData } from '@/data'
import type { CharacterData } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('Milestone 14 — gating del level-up (#50)', () => {
  beforeAll(async () => {
    await preloadVariantData('dnd5e')
  })
  describe('subclass gating', () => {
    it('no bloquea si nivel < subclassLevel', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 2
      char.subclass = ''
      expect(pendingLevelDecisions(char).map(d => d.key)).not.toContain('subclass')
      expect(canLevelUp(char)).toBe(true)
    })

    it('bloquea si nivel ≥ subclassLevel y subclass está vacío', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 3
      char.subclass = ''
      // (no ASI yet at lv 3, no spellcaster) — only blocker should be subclass
      const decisions = pendingLevelDecisions(char)
      expect(decisions.map(d => d.key)).toContain('subclass')
      expect(canLevelUp(char)).toBe(false)
    })

    it('no bloquea si subclass está rellena', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 3
      char.subclass = 'champion'
      expect(pendingLevelDecisions(char).map(d => d.key)).not.toContain('subclass')
    })

    it('no bloquea para clases sin subclases (caso teórico)', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 10
      char.subclass = 'champion'
      const decisions = pendingLevelDecisions(char)
      expect(decisions.map(d => d.key)).not.toContain('subclass')
    })
  })

  describe('ASI/feat gating', () => {
    it('bloquea si no hay choice para un nivel ≤ actual con ASI checkpoint', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      char.asiChoices = [] // missing the lv 4 choice
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key.startsWith('asi-4-'))).toBe(true)
    })

    it('bloquea si type=feat pero featId está vacío', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      char.asiChoices = [{ level: 4, type: 'feat', featId: '' }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'feat-4-missing')).toBe(true)
    })

    it('bloquea si el feat tiene asiBonus multi-opción y featAbility está sin elegir', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      // Crusher: +1 STR or CON — multi-opción
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'crusher' }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'feat-4-ability')).toBe(true)
    })

    it('no bloquea si el feat tiene asiBonus de una sola opción (auto-resuelto)', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      // Crossbow Expert: +1 DEX fijo — no necesita selector
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'crossbow-expert' }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key.startsWith('feat-4'))).toBe(false)
    })

    it('no bloquea si el feat multi-opción tiene featAbility elegido', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      char.asiChoices = [{ level: 4, type: 'feat', featId: 'crusher', featAbility: 'str' }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key.startsWith('feat-4'))).toBe(false)
    })

    it('bloquea si type=asi modo +1+1 con los dos atributos iguales', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      char.asiChoices = [{ level: 4, type: 'asi', asiMode: '1+1', asiAbilities: ['str', 'str'] }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'asi-4-dup')).toBe(true)
    })

    it('REGRESIÓN #50 reabierto — slot ASI recién creado con array vacío bloquea', () => {
      // Este es el caso del bug: AsiSelector crea slots con asiAbilities: []
      // (en lugar del antiguo default ['str']) y el gating debe detectarlo.
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      char.asiChoices = [{ level: 4, type: 'asi', asiMode: '2', asiAbilities: [] }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'asi-4-empty')).toBe(true)
    })

    it('REGRESIÓN #50 — slot ASI modo +1+1 con array vacío bloquea', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      char.asiChoices = [{ level: 4, type: 'asi', asiMode: '1+1', asiAbilities: [] }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'asi-4-two')).toBe(true)
    })

    it('REGRESIÓN #50 — slot ASI modo +1+1 con solo el primero relleno bloquea', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      char.asiChoices = [{ level: 4, type: 'asi', asiMode: '1+1', asiAbilities: ['str'] }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'asi-4-two')).toBe(true)
    })

    it('no bloquea si type=asi modo +2 está bien relleno', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      char.asiChoices = [{ level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] }]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key.startsWith('asi-4'))).toBe(false)
    })

    it('Fighter en nivel 6 (ASI extra) bloquea si falta el slot de nivel 6', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 6
      char.subclass = 'champion'
      char.asiChoices = [
        { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] },
        // nivel 6 vacío
      ]
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'asi-6-missing')).toBe(true)
    })

    it('escenario completo Fighter 4 → 5 con todo resuelto deja canLevelUp=true', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 4
      char.subclass = 'champion'
      char.asiChoices = [
        { level: 4, type: 'feat', featId: 'crossbow-expert', featAbility: 'dex' },
      ]
      expect(canLevelUp(char)).toBe(true)
    })
  })

  describe('spell gating', () => {
    it('Wizard nivel 1 con 0 cantrips bloquea', () => {
      const char = freshChar()
      char.className = 'wizard'
      char.level = 1
      char.cantrips = []
      char.spellsPrepared = []
      char.spellsKnown = []
      // Wizard tiene cantrips conocidos > 0 a nivel 1
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'cantrips')).toBe(true)
    })

    it('Wizard con cantrips y spells preparados completos no bloquea', () => {
      const char = freshChar()
      char.className = 'wizard'
      char.level = 1
      char.abilityScores.int = 16 // mod +3, prepared = max(1, mod + level) = 4
      char.cantrips = ['fire-bolt', 'mage-hand', 'ray-of-frost']
      // Bug #79: la UI escribe los hechizos en spellsKnown (incluso para
      // preparedCaster); spellsPrepared es legacy y casi no se usa. El gating
      // ahora lee de spellsKnown.
      char.spellsPrepared = []
      char.spellsKnown = ['magic-missile', 'mage-armor', 'shield', 'detect-magic']
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'cantrips' || d.key === 'spells')).toBe(false)
    })

    it('clases no caster nunca bloquean por hechizos', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 1
      char.cantrips = []
      char.spellsPrepared = []
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'cantrips' || d.key === 'spells')).toBe(false)
    })
  })

  describe('combinaciones', () => {
    it('Echo Knight (Fighter subclase) nivel 10 sin subclase ni ASIs es múltiplemente bloqueado', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 10
      char.subclass = ''
      char.asiChoices = []
      const decisions = pendingLevelDecisions(char)
      const keys = decisions.map(d => d.key)
      expect(keys).toContain('subclass')
      // Fighter tiene ASIs en 4, 6, 8
      expect(keys.some(k => k.startsWith('asi-4'))).toBe(true)
      expect(keys.some(k => k.startsWith('asi-6'))).toBe(true)
      expect(keys.some(k => k.startsWith('asi-8'))).toBe(true)
      expect(canLevelUp(char)).toBe(false)
    })

    it('vacío si no hay clase elegida (los pasos anteriores ya gating eso)', () => {
      const char = freshChar()
      char.className = ''
      char.level = 1
      expect(pendingLevelDecisions(char)).toEqual([])
      expect(canLevelUp(char)).toBe(true)
    })
  })

  // ─── #79 — Clérigo lv1→2 no debe quedar atrapado ──────────────────────────
  describe('#79 — preparedCaster spells leen de spellsKnown', () => {
    it('Cleric lv1 con WIS 16 (mod +3) → max = 1+3 = 4; spellsKnown completo no bloquea', () => {
      const char = freshChar()
      char.className = 'cleric'
      char.level = 1
      char.abilityScores.wis = 16
      char.cantrips = ['guidance', 'sacred-flame', 'spare-the-dying']
      char.spellsPrepared = []  // vacío (legacy)
      char.spellsKnown = ['1-bless', '1-cure-wounds', '1-guiding-bolt', '1-healing-word']
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'spells')).toBe(false)
    })

    it('Cleric lv1 con WIS 16 y spellsKnown vacío bloquea con cuenta correcta', () => {
      const char = freshChar()
      char.className = 'cleric'
      char.level = 1
      char.abilityScores.wis = 16
      char.cantrips = ['guidance', 'sacred-flame', 'spare-the-dying']
      char.spellsPrepared = []
      char.spellsKnown = []
      const decisions = pendingLevelDecisions(char)
      const spellsDecision = decisions.find(d => d.key === 'spells')
      expect(spellsDecision).toBeDefined()
      expect(spellsDecision!.message).toContain('4')
      expect(spellsDecision!.message).toContain('prepared')
    })

    it('Cleric lv2 con WIS 16 (max = 5) parcialmente cubierto bloquea con la diferencia', () => {
      const char = freshChar()
      char.className = 'cleric'
      char.level = 2
      char.abilityScores.wis = 16
      char.cantrips = ['guidance', 'sacred-flame', 'spare-the-dying']
      char.spellsPrepared = []
      char.spellsKnown = ['1-bless', '1-cure-wounds', '1-guiding-bolt', '1-healing-word']
      // max 2+3 = 5, tiene 4, falta 1
      const decisions = pendingLevelDecisions(char)
      const spellsDecision = decisions.find(d => d.key === 'spells')
      expect(spellsDecision).toBeDefined()
      expect(spellsDecision!.message).toMatch(/Choose 1 more/)
    })

    it('Cleric lv1 con WIS 16 y spellsPrepared con datos NO debe bloquear si spellsKnown tiene los hechizos', () => {
      // Comprueba que ya no se mira spellsPrepared. El usuario solo ha usado
      // la UI (que escribe en spellsKnown).
      const char = freshChar()
      char.className = 'cleric'
      char.level = 1
      char.abilityScores.wis = 16
      char.cantrips = ['guidance', 'sacred-flame', 'spare-the-dying']
      char.spellsPrepared = ['1-foo', '1-bar', '1-baz', '1-qux']  // basura legacy
      char.spellsKnown = ['1-bless', '1-cure-wounds', '1-guiding-bolt', '1-healing-word']
      const decisions = pendingLevelDecisions(char)
      expect(decisions.some(d => d.key === 'spells')).toBe(false)
    })
  })
})
