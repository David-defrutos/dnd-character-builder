// Documento generado el 2026-05-20-1900 — milestone 20 (#53 PDF weapon attack)
// Bug: el bonus de ataque no consideraba la ability correcta del arma (siempre STR),
// no extraía el bonus mágico del nombre, y no comprobaba proficiency.
// Caso del bug: Cecino nivel 10, DEX +3, PB +4, Hand Crossbow → debería +7 (no +5);
// Hand Crossbow +1 → +8.

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import {
  computeWeaponAttack,
  extractMagicBonus,
  stripMagicBonus,
  findWeaponData,
  weaponAttackAbility,
  isProficientWithWeapon,
} from '@/utils/weaponCalc'
import { getDnd2024FieldMapping } from '@/utils/pdfFieldMapping'
import type { CharacterData } from '@/stores/character'

function freshChar(): CharacterData {
  setActivePinia(createPinia())
  return useCharacterStore().character
}

describe('Milestone 20 — weapon attack bonus (#53)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe('extractMagicBonus / stripMagicBonus', () => {
    it('detecta +N en el nombre', () => {
      expect(extractMagicBonus('Longsword +1')).toBe(1)
      expect(extractMagicBonus('Hand Crossbow +2')).toBe(2)
      expect(extractMagicBonus('Vorpal Sword +3')).toBe(3)
    })

    it('devuelve 0 si no hay bonus', () => {
      expect(extractMagicBonus('Longsword')).toBe(0)
      expect(extractMagicBonus('Hand Crossbow')).toBe(0)
    })

    it('strip quita el +N final', () => {
      expect(stripMagicBonus('Longsword +1')).toBe('Longsword')
      expect(stripMagicBonus('Hand Crossbow +2')).toBe('Hand Crossbow')
      expect(stripMagicBonus('Longsword')).toBe('Longsword')
    })
  })

  describe('findWeaponData', () => {
    it('encuentra arma por nombre exacto', () => {
      expect(findWeaponData('Longsword')?.damage).toBe('1d8')
      expect(findWeaponData('Hand Crossbow')?.damage).toBe('1d6')
    })

    it('encuentra arma con sufijo mágico', () => {
      expect(findWeaponData('Longsword +1')?.name).toBe('Longsword')
      expect(findWeaponData('Hand Crossbow +2')?.name).toBe('Hand Crossbow')
    })

    it('case-insensitive', () => {
      expect(findWeaponData('LONGSWORD')?.name).toBe('Longsword')
      expect(findWeaponData('hand crossbow')?.name).toBe('Hand Crossbow')
    })

    it('devuelve undefined si no existe', () => {
      expect(findWeaponData('Whatever Sword of Fluff')).toBeUndefined()
    })
  })

  describe('weaponAttackAbility', () => {
    it('Hand Crossbow (ammunition) usa DEX', () => {
      const w = findWeaponData('Hand Crossbow')
      expect(weaponAttackAbility(w, { str: 4, dex: 0 })).toBe('dex')
    })

    it('Longsword (no finesse, no ranged) usa STR', () => {
      const w = findWeaponData('Longsword')
      expect(weaponAttackAbility(w, { str: 0, dex: 5 })).toBe('str')
    })

    it('Rapier (finesse) usa el mayor entre STR y DEX', () => {
      const w = findWeaponData('Rapier')
      expect(weaponAttackAbility(w, { str: 1, dex: 3 })).toBe('dex')
      expect(weaponAttackAbility(w, { str: 4, dex: 2 })).toBe('str')
    })

    it('Dagger (finesse + thrown) usa el mayor', () => {
      const w = findWeaponData('Dagger')
      expect(weaponAttackAbility(w, { str: 0, dex: 3 })).toBe('dex')
    })

    it('arma desconocida → STR', () => {
      expect(weaponAttackAbility(undefined, { str: 0, dex: 5 })).toBe('str')
    })
  })

  describe('isProficientWithWeapon', () => {
    it('Fighter con "Simple weapons" + "Martial weapons" es proficient en todo', () => {
      const char = freshChar()
      char.proficienciesOther = ['Simple weapons', 'Martial weapons']
      expect(isProficientWithWeapon(char, findWeaponData('Longsword'))).toBe(true)
      expect(isProficientWithWeapon(char, findWeaponData('Hand Crossbow'))).toBe(true)
      expect(isProficientWithWeapon(char, findWeaponData('Dagger'))).toBe(true)
    })

    it('Wizard solo con Simple weapons NO es proficient con Longsword (martial)', () => {
      const char = freshChar()
      char.proficienciesOther = ['Simple weapons']
      expect(isProficientWithWeapon(char, findWeaponData('Dagger'))).toBe(true)
      expect(isProficientWithWeapon(char, findWeaponData('Longsword'))).toBe(false)
    })
  })

  describe('computeWeaponAttack — CASO DEL BUG #53', () => {
    it('Hand Crossbow: DEX +3, PB +4 (lv10), proficient → +7', () => {
      const char = freshChar()
      char.level = 10
      char.abilityScores.dex = 16 // +3
      char.proficienciesOther = ['Simple weapons', 'Martial weapons']
      const info = computeWeaponAttack('Hand Crossbow', char)
      expect(info.attackBonus).toBe(7)
      expect(info.ability).toBe('dex')
      expect(info.magicBonus).toBe(0)
    })

    it('Hand Crossbow +1: DEX +3, PB +4, +1 mágico → +8', () => {
      const char = freshChar()
      char.level = 10
      char.abilityScores.dex = 16
      char.proficienciesOther = ['Simple weapons', 'Martial weapons']
      const info = computeWeaponAttack('Hand Crossbow +1', char)
      expect(info.attackBonus).toBe(8)
      expect(info.magicBonus).toBe(1)
    })

    it('Hand Crossbow +2: DEX +3, PB +4, +2 mágico → +9', () => {
      const char = freshChar()
      char.level = 10
      char.abilityScores.dex = 16
      char.proficienciesOther = ['Simple weapons', 'Martial weapons']
      const info = computeWeaponAttack('Hand Crossbow +2', char)
      expect(info.attackBonus).toBe(9)
      expect(info.magicBonus).toBe(2)
    })
  })

  describe('computeWeaponAttack — daño', () => {
    it('Hand Crossbow +1 con DEX +3 → daño "1d6 +4 piercing"', () => {
      const char = freshChar()
      char.level = 10
      char.abilityScores.dex = 16
      char.proficienciesOther = ['Simple weapons', 'Martial weapons']
      const info = computeWeaponAttack('Hand Crossbow +1', char)
      expect(info.damage).toBe('1d6 +4 piercing')
    })

    it('Longsword (STR +4) → daño "1d8 +4 slashing"', () => {
      const char = freshChar()
      char.level = 5
      char.abilityScores.str = 18 // +4
      char.proficienciesOther = ['Martial weapons']
      const info = computeWeaponAttack('Longsword', char)
      expect(info.damage).toBe('1d8 +4 slashing')
    })

    it('arma desconocida → damage vacío', () => {
      const char = freshChar()
      const info = computeWeaponAttack('Wand of Fluff', char)
      expect(info.damage).toBe('')
    })
  })

  describe('computeWeaponAttack — sin proficiency', () => {
    it('Wizard con Longsword (no proficient) NO suma PB', () => {
      const char = freshChar()
      char.level = 10 // PB +4
      char.abilityScores.str = 14 // +2
      char.proficienciesOther = ['Simple weapons'] // sin martial
      const info = computeWeaponAttack('Longsword', char)
      expect(info.proficient).toBe(false)
      expect(info.attackBonus).toBe(2) // solo STR +2, sin PB
    })
  })

  describe('computeWeaponAttack — finesse', () => {
    it('Rapier con DEX > STR usa DEX', () => {
      const char = freshChar()
      char.level = 5 // PB +3
      char.abilityScores.str = 12 // +1
      char.abilityScores.dex = 18 // +4
      char.proficienciesOther = ['Martial weapons']
      const info = computeWeaponAttack('Rapier', char)
      expect(info.ability).toBe('dex')
      expect(info.attackBonus).toBe(7) // DEX +4 + PB +3
    })

    it('Rapier con STR > DEX usa STR', () => {
      const char = freshChar()
      char.level = 5
      char.abilityScores.str = 18
      char.abilityScores.dex = 12
      char.proficienciesOther = ['Martial weapons']
      const info = computeWeaponAttack('Rapier', char)
      expect(info.ability).toBe('str')
      expect(info.attackBonus).toBe(7)
    })
  })

  describe('PDF mapping — campo Weapon{N}_Bonus', () => {
    it('Cecino-like: Hand Crossbow del inventory aparece con bonus correcto', () => {
      const char = freshChar()
      char.level = 10
      char.abilityScores.dex = 16
      char.proficienciesOther = ['Simple weapons', 'Martial weapons']
      char.inventory = [
        { slotId: 'w1', kind: 'weapon', itemId: 'hand-crossbow', name: 'Hand Crossbow', qty: 1 },
        { slotId: 'w2', kind: 'magic', itemId: 'hand-crossbow-1', name: 'Hand Crossbow +1', qty: 1 },
      ]
      const fields = getDnd2024FieldMapping(char)
      expect(fields['Weapon1_Name']).toBe('Hand Crossbow')
      expect(fields['Weapon1_Bonus']).toBe('+7')
      expect(fields['Weapon2_Name']).toBe('Hand Crossbow +1')
      expect(fields['Weapon2_Bonus']).toBe('+8')
    })

    it('damage también se rellena correctamente desde inventory', () => {
      const char = freshChar()
      char.level = 10
      char.abilityScores.dex = 16
      char.proficienciesOther = ['Simple weapons', 'Martial weapons']
      char.inventory = [
        { slotId: 'w1', kind: 'magic', itemId: 'hand-crossbow-1', name: 'Hand Crossbow +1', qty: 1 },
      ]
      const fields = getDnd2024FieldMapping(char)
      expect(fields['Weapon1_Damage']).toBe('1d6 +4 piercing')
    })
  })

  // ─── #53 caso real: Cecino sin proficienciesOther pobladas ────────────────
  // Reproducción del PDF Cecino-sheet-13.pdf: Fighter lv10 con DEX 17 (+3),
  // sin proficienciesOther pobladas. El bug: isProficientWithWeapon devolvía
  // false y faltaba el PB en el ataque. Fix: leer también class.weaponProficiencies.
  describe('#53 — Cecino fighter lv10 sin proficienciesOther', () => {
    function cecino(): CharacterData {
      const char = freshChar()
      char.variant = 'dnd5e'
      char.className = 'fighter'
      char.level = 10
      // DEX 15 base + 2 ASI = 17, mod +3
      char.abilityScores = { str: 12, dex: 15, con: 14, int: 10, wis: 13, cha: 8 }
      char.asiBonuses = { dex: 2, wis: 1 }
      char.proficienciesOther = [] // ← el bug original: estaba vacío
      return char
    }

    it('Rapier (martial finesse) → DEX+3 + PB+4 = +7', () => {
      const info = computeWeaponAttack('Rapier', cecino())
      expect(info.proficient).toBe(true)
      expect(info.pbBonus).toBe(4)
      expect(info.abilityMod).toBe(3)
      expect(info.attackBonus).toBe(7)
      expect(info.damage).toBe('1d8 +3 piercing')
    })

    it('Dagger (simple finesse) → DEX+3 + PB+4 = +7', () => {
      const info = computeWeaponAttack('Dagger', cecino())
      expect(info.proficient).toBe(true)
      expect(info.attackBonus).toBe(7)
    })

    it('Hand Crossbow +1 (martial ranged) → DEX+3 + PB+4 + magic+1 = +8', () => {
      const info = computeWeaponAttack('Hand Crossbow +1', cecino())
      expect(info.proficient).toBe(true)
      expect(info.pbBonus).toBe(4)
      expect(info.magicBonus).toBe(1)
      expect(info.attackBonus).toBe(8)
      expect(info.damage).toBe('1d6 +4 piercing')
    })
  })

  // ─── #53 — proficiencias por código de clase (cobertura) ──────────────────
  describe('#53 — códigos de proficiencia por clase', () => {
    it('Wizard (only simple) NO es proficient con Rapier (martial)', () => {
      const char = freshChar()
      char.className = 'wizard'
      char.level = 5
      char.proficienciesOther = []
      const info = computeWeaponAttack('Rapier', char)
      expect(info.proficient).toBe(false)
      expect(info.pbBonus).toBe(0)
    })

    it('Wizard SÍ es proficient con Dagger (simple)', () => {
      const char = freshChar()
      char.className = 'wizard'
      char.level = 5
      char.proficienciesOther = []
      const info = computeWeaponAttack('Dagger', char)
      expect(info.proficient).toBe(true)
    })

    it('Rogue (martial-finesse) ES proficient con Rapier (finesse)', () => {
      const char = freshChar()
      char.className = 'rogue'
      char.level = 5
      char.proficienciesOther = []
      const info = computeWeaponAttack('Rapier', char)
      expect(info.proficient).toBe(true)
    })

    it('Rogue (martial-finesse) NO es proficient con Greatsword (no finesse)', () => {
      const char = freshChar()
      char.className = 'rogue'
      char.level = 5
      char.proficienciesOther = []
      const info = computeWeaponAttack('Greatsword', char)
      expect(info.proficient).toBe(false)
    })
  })

  // ─── #76 — desglose explícito en WeaponAttackInfo ─────────────────────────
  describe('#76 — desglose de la fórmula', () => {
    it('expone abilityMod, pbBonus, magicBonus, damageDie, damageType, damageMod', () => {
      const char = freshChar()
      char.className = 'fighter'
      char.level = 10
      char.abilityScores.dex = 17
      const info = computeWeaponAttack('Hand Crossbow +1', char)
      expect(info.abilityMod).toBe(3)
      expect(info.pbBonus).toBe(4)
      expect(info.magicBonus).toBe(1)
      expect(info.damageDie).toBe('1d6')
      expect(info.damageType).toBe('piercing')
      expect(info.damageMod).toBe(4) // 3 + 1
      expect(info.attackBonus).toBe(8) // 3 + 4 + 1
    })

    it('cuando no es proficient, pbBonus es 0 (no se incluye en attackBonus)', () => {
      const char = freshChar()
      char.className = 'wizard'
      char.level = 5
      char.abilityScores.str = 10
      const info = computeWeaponAttack('Greatsword', char)
      expect(info.proficient).toBe(false)
      expect(info.pbBonus).toBe(0)
      expect(info.attackBonus).toBe(0) // STR mod 0 + 0 PB
    })
  })
})
