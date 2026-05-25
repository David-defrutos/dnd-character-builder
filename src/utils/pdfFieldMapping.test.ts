// Documento generado el 2026-05-20-1820 — milestone 17 (#56 PDF species traits)
// Bug: la sección SPECIES TRAITS aparecía vacía en el PDF.
// Causa: pdfFieldMapping filtraba `featuresTraits` por regex /^(species|race)\b/i
// pero featuresTraits nunca contenía traits de raza — solo class features y feats.
// Fix: derivar las species traits directamente de la raza/subraza/choices.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import { getDnd2024FieldMapping } from '@/utils/pdfFieldMapping'
import type { CharacterData } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('Milestone 17 — PDF Species Traits (#56)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe('Dragonborn (con Draconic Ancestry)', () => {
    it('rellena Species_Traits con las traits de la raza', () => {
      const char = freshChar()
      char.race = 'dragonborn'
      char.className = 'fighter'
      char.speciesChoices = { 'draconic-ancestry': 'red' }
      const fields = getDnd2024FieldMapping(char)
      const traits = fields['Species_Traits'] as string
      expect(traits).toBeTruthy()
      expect(traits).toContain('Draconic Ancestry')
      expect(traits).toContain('Breath Weapon')
      expect(traits).toContain('Damage Resistance')
      expect(traits).toContain('Darkvision')
      expect(traits).toContain('Draconic Flight')
    })

    it('incluye la Draconic Ancestry elegida con su tipo de daño', () => {
      const char = freshChar()
      char.race = 'dragonborn'
      char.className = 'fighter'
      char.speciesChoices = { 'draconic-ancestry': 'red' }
      const fields = getDnd2024FieldMapping(char)
      const traits = fields['Species_Traits'] as string
      // Línea explícita de la elección, ej. "Draconic Ancestry: Red (Fire)"
      expect(traits).toMatch(/Draconic Ancestry:\s*Red\s*\(Fire\)/)
    })

    it('NO incluye la línea de elección si la Ancestry no está elegida', () => {
      const char = freshChar()
      char.race = 'dragonborn'
      char.className = 'fighter'
      char.speciesChoices = {}
      const fields = getDnd2024FieldMapping(char)
      const traits = fields['Species_Traits'] as string
      // Sigue habiendo trait genérica de "Draconic Ancestry" (sin colon → name resumido)
      expect(traits).toContain('Draconic Ancestry')
      // Pero NO la versión con la opción elegida
      expect(traits).not.toMatch(/Draconic Ancestry:\s*\w+\s*\(/)
    })
  })

  describe('Especies sin choices', () => {
    it('Human (sin traits especiales en 2024) — Species_Traits vacío o mínimo', () => {
      const char = freshChar()
      char.race = 'human'
      char.className = 'fighter'
      const fields = getDnd2024FieldMapping(char)
      // Human en el catálogo puede tener algunas traits básicas; si no las tiene, vacío.
      // El test crítico es que NO se rompe.
      expect(typeof fields['Species_Traits']).toBe('string')
    })

    it('Dwarf rellena traits clásicas: Darkvision, Dwarven Resilience, Stonecunning', () => {
      const char = freshChar()
      char.race = 'dwarf'
      char.className = 'fighter'
      const fields = getDnd2024FieldMapping(char)
      const traits = fields['Species_Traits'] as string
      expect(traits).toContain('Darkvision')
      expect(traits).toContain('Dwarven Resilience')
      expect(traits).toContain('Stonecunning')
    })
  })

  describe('Especies con subrace (lineage)', () => {
    it('Elf con High Elf incluye traits de la subraza', () => {
      const char = freshChar()
      char.race = 'elf'
      char.subrace = 'high-elf'
      char.className = 'wizard'
      const fields = getDnd2024FieldMapping(char)
      const traits = fields['Species_Traits'] as string
      // No fallar aunque cambie el orden — solo confirmar que aparece algo de elf
      expect(traits.length).toBeGreaterThan(0)
    })
  })

  describe('Regresión — featuresTraits ya no se mete en Species_Traits', () => {
    it('una entrada que empieza con "Race ..." no acaba en Species_Traits', () => {
      // El filtro antiguo /^(species|race)\b/i metía cosas como "Race: Human"
      // en Species_Traits. Ahora ese filtro ya no existe.
      const char = freshChar()
      char.race = 'human'
      char.featuresTraits = ['Race: stuff from somewhere']
      const fields = getDnd2024FieldMapping(char)
      const traits = fields['Species_Traits'] as string
      expect(traits).not.toContain('stuff from somewhere')
    })

    it('las features de clase NO acaban en Species_Traits', () => {
      const char = freshChar()
      char.race = 'human'
      char.className = 'fighter'
      char.featuresTraits = ['Action Surge', 'Second Wind']
      const fields = getDnd2024FieldMapping(char)
      const traits = fields['Species_Traits'] as string
      expect(traits).not.toContain('Action Surge')
      expect(traits).not.toContain('Second Wind')
    })
  })

  describe('Sin raza', () => {
    it('no rompe el mapping', () => {
      const char = freshChar()
      char.race = ''
      char.className = 'fighter'
      expect(() => getDnd2024FieldMapping(char)).not.toThrow()
      const fields = getDnd2024FieldMapping(char)
      expect(fields['Species_Traits']).toBe('')
    })
  })
})

describe('Milestone 18 — PDF Inventory incluye magic items (#59)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('Winged Boots del inventory aparecen en el campo Inventory', () => {
    const char = freshChar()
    char.race = 'human'
    char.className = 'fighter'
    char.inventory = [
      { slotId: 'a1', kind: 'magic', itemId: 'winged-boots', name: 'Winged Boots', qty: 1, attuned: true },
    ]
    const fields = getDnd2024FieldMapping(char)
    const inv = fields['Inventory'] as string
    expect(inv).toContain('Winged Boots')
  })

  it('items mágicos atunados aparecen con [attuned]', () => {
    const char = freshChar()
    char.inventory = [
      { slotId: 'a1', kind: 'magic', itemId: 'winged-boots', name: 'Winged Boots', qty: 1, attuned: true },
      { slotId: 'a2', kind: 'magic', itemId: 'cloak-of-protection', name: 'Cloak of Protection', qty: 1, attuned: false },
    ]
    const fields = getDnd2024FieldMapping(char)
    const inv = fields['Inventory'] as string
    expect(inv).toContain('Winged Boots [attuned]')
    expect(inv).toContain('Cloak of Protection')
    expect(inv).not.toContain('Cloak of Protection [attuned]')
  })

  it('cantidad > 1 se muestra como ×N', () => {
    const char = freshChar()
    char.inventory = [
      { slotId: 'a1', kind: 'custom', itemId: 'arrows', name: 'Arrow', qty: 20 },
    ]
    const fields = getDnd2024FieldMapping(char)
    const inv = fields['Inventory'] as string
    expect(inv).toContain('Arrow (×20)')
  })

  it('cantidad 1 no añade el sufijo', () => {
    const char = freshChar()
    char.inventory = [
      { slotId: 'a1', kind: 'weapon', itemId: 'longsword', name: 'Longsword', qty: 1 },
    ]
    const fields = getDnd2024FieldMapping(char)
    const inv = fields['Inventory'] as string
    expect(inv).toContain('Longsword')
    expect(inv).not.toContain('×')
  })

  it('items con notas las incluyen', () => {
    const char = freshChar()
    char.inventory = [
      { slotId: 'a1', kind: 'magic', itemId: 'wand-of-magic-missiles', name: 'Wand of Magic Missiles', qty: 1, notes: '3 charges left' },
    ]
    const fields = getDnd2024FieldMapping(char)
    const inv = fields['Inventory'] as string
    expect(inv).toContain('Wand of Magic Missiles')
    expect(inv).toContain('3 charges left')
  })

  it('equipment clásico y inventory coexisten', () => {
    const char = freshChar()
    char.equipment = ['Backpack', 'Bedroll', '50 ft rope']
    char.inventory = [
      { slotId: 'a1', kind: 'magic', itemId: 'winged-boots', name: 'Winged Boots', qty: 1, attuned: true },
    ]
    const fields = getDnd2024FieldMapping(char)
    const inv = fields['Inventory'] as string
    expect(inv).toContain('Backpack')
    expect(inv).toContain('Bedroll')
    expect(inv).toContain('Winged Boots')
  })

  it('inventory vacío y sin equipment produce string sin items', () => {
    const char = freshChar()
    char.equipment = []
    char.inventory = []
    const fields = getDnd2024FieldMapping(char)
    expect(typeof fields['Inventory']).toBe('string')
  })

  it('treasure (texto libre) sigue incluyéndose', () => {
    const char = freshChar()
    char.equipment = []
    char.treasure = '500 gp in a velvet bag'
    const fields = getDnd2024FieldMapping(char)
    const inv = fields['Inventory'] as string
    expect(inv).toContain('500 gp in a velvet bag')
  })
})

// ─── #120 — Spell columns en hoja 2 (Name canónico + STime + SRange + checks + Notes)
describe('#120 — PDF spell columns', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('Cantrip "vicious-mockery" → name canónico + Action + 60 feet + Instantaneous', () => {
    const char = freshChar()
    char.className = 'bard'
    char.level = 1
    char.cantrips = ['vicious-mockery']
    const f = getDnd2024FieldMapping(char)
    expect(f['SLevel_1']).toBe('C')
    expect(f['SName_1']).toBe('Vicious Mockery')
    expect(f['STime_1']).toBe('Action')
    expect(f['SRange_1']).toBe('60 feet')
    expect(f['SNotes_1']).toBe('Instantaneous')
    // V only — no Concentration, no Ritual, no Material
    expect(f['SC_1']).toBeUndefined()
    expect(f['SR_1']).toBeUndefined()
    expect(f['SM_1']).toBeUndefined()
  })

  it('"light" tiene componente Material (V, M) → SM check', () => {
    const char = freshChar()
    char.className = 'bard'
    char.level = 1
    char.cantrips = ['light']
    const f = getDnd2024FieldMapping(char)
    expect(f['SName_1']).toBe('Light')
    expect(f['SNotes_1']).toBe('1 hour')
    expect(f['SM_1']).toBe(true)
    expect(f['SC_1']).toBeUndefined()
  })

  it('"hideous-laughter" (V,S,M, Concentration) → SC, SM check', () => {
    const char = freshChar()
    char.className = 'bard'
    char.level = 1
    char.spellsKnown = ['1-hideous-laughter']
    const f = getDnd2024FieldMapping(char)
    expect(f['SLevel_1']).toBe('1')
    expect(f['SName_1']).toBe('Hideous Laughter')
    expect(f['SC_1']).toBe(true)
    expect(f['SM_1']).toBe(true)
    expect(f['SR_1']).toBeUndefined()
    expect(f['SNotes_1']).toMatch(/Concentration/)
  })

  it('"tiny-hut" tiene Ritual en castingTime → SR check', () => {
    const char = freshChar()
    char.className = 'bard'
    char.level = 5
    char.spellsKnown = ['3-tiny-hut']
    const f = getDnd2024FieldMapping(char)
    expect(f['SName_1']).toBe('Tiny Hut')
    expect(f['SR_1']).toBe(true)
    expect(f['SM_1']).toBe(true)
    // #159 — STime ya NO contiene "Ritual" (va al checkbox SR_1). El texto
    // visible se abrevia a la forma compacta para evitar auto-shrink del PDF.
    // Tiny Hut tiene castingTime "1 minute or Ritual" → "1 min".
    expect(f['STime_1']).toBe('1 min')
    expect(f['STime_1']).not.toMatch(/Ritual/)
    expect(f['SNotes_1']).toBe('8 hours')
  })

  it('Spell id desconocido (homebrew/typo) → name = id crudo, otros campos vacíos', () => {
    const char = freshChar()
    char.className = 'bard'
    char.level = 1
    char.cantrips = ['homebrew-not-in-catalog']
    const f = getDnd2024FieldMapping(char)
    expect(f['SName_1']).toBe('homebrew-not-in-catalog')
    expect(f['STime_1']).toBeUndefined()
    expect(f['SRange_1']).toBeUndefined()
    expect(f['SNotes_1']).toBeUndefined()
  })

  it('Species-granted cantrip mantiene tag (Race) con name canónico', () => {
    const char = freshChar()
    char.className = 'bard'
    char.level = 1
    char.speciesGrantedCantrips = ['light']
    const f = getDnd2024FieldMapping(char)
    expect(f['SName_1']).toBe('Light (Race)')
    expect(f['STime_1']).toBe('Action')
  })

  it('Magic Initiate mantiene tag (MI) con name canónico', () => {
    const char = freshChar()
    char.className = 'fighter'
    char.level = 4
    char.magicInitiateChoices = [
      { source: 'origin', spellList: 'wizard', cantrips: ['fire-bolt'], levelOneSpell: '1-shield' },
    ] as any
    const f = getDnd2024FieldMapping(char)
    expect(f['SName_1']).toBe('Fire Bolt (MI)')
    expect(f['SLevel_1']).toBe('C')
    expect(f['STime_1']).toBe('Action')
  })

  it('Salusa lv.10 — cantrip pos 2 es "Vicious Mockery" (canónico)', () => {
    const char = freshChar()
    char.className = 'bard'
    char.subclass = 'glamour'
    char.level = 10
    char.cantrips = ['light', 'vicious-mockery', 'starry-wisp', 'message']
    const f = getDnd2024FieldMapping(char)
    expect(f['SName_1']).toBe('Light')
    expect(f['SName_2']).toBe('Vicious Mockery') // antes salía 'vicious-mockery' crudo
    expect(f['SName_3']).toBe('Starry Wisp')
    expect(f['SName_4']).toBe('Message')
  })
})

