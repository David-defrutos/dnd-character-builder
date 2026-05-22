// Documento generado el 2026-05-19-1941
// Smoke test for the official 2024 PDF mapping.
// Runs through vitest because the mapping module uses '@/' path aliases.
//
// Run with:  npx vitest run scripts/smoke-test-pdf-mapping.test.ts

import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { getDnd2024FieldMapping } from '@/utils/pdfFieldMapping'
import type { CharacterData } from '@/stores/character'

const sampleEchoKnight: CharacterData = {
  id: 'test-1',
  variant: 'dnd5e',
  name: 'Kalia Vex',
  playerName: 'Test',
  race: 'human',
  subrace: '',
  className: 'fighter',
  subclass: 'Echo Knight',
  level: 10,
  background: 'soldier',
  alignment: 'Neutral Good',
  experiencePoints: 64000,
  abilityScores: { str: 18, dex: 14, con: 16, int: 10, wis: 13, cha: 8 },
  skillProficiencies: ['athletics', 'intimidation', 'perception', 'survival'],
  skillExpertise: [],
  savingThrowProficiencies: ['str', 'con'],
  languages: ['Common', 'Elvish'],
  proficienciesOther: [
    'Light armor', 'Medium armor', 'Heavy armor', 'Shields',
    'Simple weapons', 'Martial weapons',
    'Gaming set: dice', 'Vehicles (Land)',
  ],
  weapons: [
    { name: 'Longsword +1', attackBonus: 0, damage: '1d8+5 slashing' },
    { name: 'Light Crossbow', attackBonus: 0, damage: '1d8+2 piercing' },
  ],
  armor: 'Chain Mail',
  shield: true,
  equipment: [
    'Chain Mail', 'Shield', 'Longsword +1',
    'Light Crossbow (20 bolts)', "Explorer's Pack", 'Cloak of Elvenkind',
  ],
  coins: { cp: 0, sp: 0, ep: 0, gp: 320, pp: 0 },
  personalityTraits: 'I face problems head-on.',
  ideals: 'Responsibility.',
  bonds: "I'd lay down my life for the people I served with.",
  flaws: "I'd rather eat my armor than admit when I'm wrong.",
  featuresTraits: [
    'Second Wind (4 uses/long rest)',
    'Action Surge (1 use/short rest)',
    'Manifest Echo',
    'Unleash Incarnation (4 uses/long rest)',
    'Echo Avatar',
    'Shadow Martyr',
    'Species: Human - Versatile, Skillful, Resourceful',
    'Feat: Savage Attacker',
    'Feat: Polearm Master',
  ],
  backstory: 'A veteran of the Cobalt Soul wars.',
  age: '32', height: "5'10\"", weight: '160 lb',
  eyes: 'Grey', hair: 'Black, short', skin: 'Olive',
  allies: 'The Cobalt Soul order',
  treasure: '',
  spellcastingClass: '', spellcastingAbility: '',
  cantrips: [], spellsKnown: [], spellsPrepared: [],
  hitDie: 10, maxHp: 94, currentHp: 94, tempHp: 0, speed: 30,
  brawlingMoves: [], misdeeds: '',
  size: 'Medium', whacksLevel: 0,
  mark: '', markSpirit: '', virtue: '', sin: '', humanity: 0,
  sessionNotes: '',
  classes: [],
}

describe('2024 PDF field mapping — smoke test', () => {
  it('computes the right values for an Echo Knight nv.10', () => {
    const f = getDnd2024FieldMapping(sampleEchoKnight)
    expect(f['Name']).toBe('Kalia Vex')
    expect(f['Level']).toBe('10')
    expect(f['Class']).toBe('Fighter')
    expect(f['Subclass']).toBe('Echo Knight')
    expect(f['Proficiency_Bonus']).toBe('+4')
    expect(f['STR_Score']).toBe('18')
    expect(f['STR_Mod']).toBe('+4')
    expect(f['STR_ST_Bonus']).toBe('+8')
    expect(f['STR_ST_Prof']).toBe(true)
    expect(f['CON_ST_Bonus']).toBe('+7')
    expect(f['DEX_ST_Bonus']).toBe('+2')
    expect(f['Athletics_Bonus']).toBe('+8')
    expect(f['Athletics_Prof']).toBe(true)
    expect(f['Perception_Bonus']).toBe('+5')
    expect(f['Passive_Perception']).toBe('15')
    // Chain Mail (heavy, baseAC 16) + Shield (+2) = 18. DEX irrelevant for heavy.
    expect(f['AC']).toBe('18')
    expect(f['HP_Max']).toBe('94')
    expect(f['Hit_Dice_Max']).toBe('10d10')
    expect(f['Weapon1_Name']).toBe('Longsword +1')
    // Longsword (Martial Melee, no finesse) → STR. STR 18 → +4, PB +4 (lv10), magic +1 → +9.
    expect(f['Weapon1_Bonus']).toBe('+9')
    expect(f['Armor_Heavy_Prof']).toBe(true)
    expect(f['Shield_Prof']).toBe(true)
    expect(f['Coin_GP']).toBe('320')
    expect(String(f['Species_Traits'])).toContain('Versatile')
    expect(String(f['Feats'])).toContain('Savage Attacker')
    expect(String(f['Feats'])).toContain('Polearm Master')
    expect(String(f['ClassFeatures_L']) + String(f['ClassFeatures_R']))
      .not.toContain('Polearm Master')
  })

  it('fills the official 2024 PDF AcroForm without any missing field', async () => {
    const f = getDnd2024FieldMapping(sampleEchoKnight)
    const pdfBytes = await fs.readFile('public/pdf/dnd-2024-sheet.pdf')
    const pdfDoc = await PDFDocument.load(new Uint8Array(pdfBytes))
    const form = pdfDoc.getForm()

    let filled = 0
    const missing: string[] = []
    for (const [name, value] of Object.entries(f)) {
      try {
        if (typeof value === 'boolean') {
          if (value) form.getCheckBox(name).check()
          filled++
        } else if (value) {
          form.getTextField(name).setText(String(value).slice(0, 1000))
          filled++
        }
      } catch {
        missing.push(name)
      }
    }

    const out = await pdfDoc.save()
    await fs.writeFile('/tmp/test-out-2024.pdf', out)

    console.log(`Smoke test: ${filled} fields filled, ${missing.length} missing`)
    if (missing.length) console.log('  Missing fields:', missing.join(', '))

    expect(filled).toBeGreaterThanOrEqual(60)
    expect(missing).toEqual([])
  })
})
