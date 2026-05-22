import type { CharacterData, AbilityScores } from '@/stores/character'
import { modifier, proficiencyBonus, formatModifier, spellSaveDC, spellAttackBonus, feetToMeters, computeArmorClass } from './calculations'
import { getClassById } from '@/data/dnd5e/classes'
import { getRaceById } from '@/data/dnd5e/races'
import { getFeatById } from '@/data/dnd5e/feats'
import { armor as dnd5eArmorCatalogue } from '@/data/dnd5e/equipment'
import { computeWeaponAttack } from './weaponCalc'

/** Capitalize a class ID for English display (e.g., "barbarian" → "Barbarian") */
function capitalizeId(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/**
 * Compute the character's AC for the PDF mapping. Mirrors the store logic:
 * uses char.armor or the first armor in char.inventory[]; respects char.shield.
 */
function pdfArmorClass(char: CharacterData): number {
  const dexMod = modifier((char.abilityScores?.dex ?? 10) + (char.speciesBonuses?.dex ?? 0) + (char.backgroundBonuses?.dex ?? 0) + (char.asiBonuses?.dex ?? 0))
  let armorName = char.armor || ''
  let hasShield = !!char.shield
  if (!armorName && Array.isArray(char.inventory)) {
    const armorItem = char.inventory.find(i => i.kind === 'armor' && !/shield/i.test(i.name))
    if (armorItem) armorName = armorItem.name
    const shieldItem = char.inventory.find(
      i => i.kind === 'armor' && /shield/i.test(i.name),
    )
    if (shieldItem && !hasShield) hasShield = true
  }
  let ac = computeArmorClass(dexMod, armorName, hasShield, dnd5eArmorCatalogue)
  // Defense fighting style: +1 AC mientras lleves armadura.
  if (char.featDefenseACBonus && armorName) ac += 1
  return ac
}

/** Get display class name for PDF */
function pdfClassName(classId: string): string {
  return capitalizeId(classId)
}

/** Get display race name for PDF.
 *  #100: si hay subespecie/linaje, devolver SOLO el nombre de la subespecie
 *  (e.g. "Forest Gnome", "Drow"). Si no, devolver el nombre de la especie
 *  (e.g. "Gnome", "Human"). Antes se mostraba "Gnome (Dnd5e)" o
 *  "Gnome (Forest Gnome)", lo cual era ruidoso y confuso. */
function pdfRaceName(raceId: string, subraceId: string): string {
  if (subraceId) return capitalizeId(subraceId).replace(/-/g, ' ')
  return capitalizeId(raceId)
}

/** Get display background name for PDF */
function pdfBackgroundName(bgId: string): string {
  return bgId.split(/[-\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
function totalBonus(char: CharacterData, ability: keyof AbilityScores): number {
  return (char.speciesBonuses?.[ability] ?? 0)
    + (char.backgroundBonuses?.[ability] ?? 0)
    + (char.asiBonuses?.[ability] ?? 0)
}

function totalAbility(char: CharacterData, ability: keyof AbilityScores): number {
  return char.abilityScores[ability] + totalBonus(char, ability)
}

function abilityMod(char: CharacterData, ability: keyof AbilityScores): number {
  return modifier(totalAbility(char, ability))
}

function skillBonus(char: CharacterData, skillId: string, ability: keyof AbilityScores): number {
  const mod = abilityMod(char, ability)
  const prof = char.skillProficiencies.includes(skillId) ? proficiencyBonus(char.level) : 0
  const expert = char.skillExpertise.includes(skillId) ? proficiencyBonus(char.level) : 0
  return mod + prof + expert
}

function savingThrow(char: CharacterData, ability: keyof AbilityScores): number {
  const mod = abilityMod(char, ability)
  const prof = char.savingThrowProficiencies.includes(ability) ? proficiencyBonus(char.level) : 0
  return mod + prof
}

export function getDnd5eFieldMapping(char: CharacterData): Record<string, string | boolean> {
  const prof = proficiencyBonus(char.level)
  const fields: Record<string, string | boolean> = {}

  // Basic Info
  fields['CharacterName'] = char.name
  const classes = char.classes ?? []
  if (classes.length >= 2) {
    fields['ClassLevel'] = classes
      .map(c => `${pdfClassName(c.classId)} ${c.level}`)
      .join(' / ')
  } else {
    fields['ClassLevel'] = `${pdfClassName(char.className)} ${char.level}`
  }
  fields['Background'] = pdfBackgroundName(char.background)
  fields['PlayerName'] = char.playerName
  // #100: pdfRaceName ahora devuelve solo la subespecie si existe, o solo
  // la especie. Evita el "Gnome (Dnd5e)" del bug y el "Gnome (Forest Gnome)"
  // redundante anterior.
  fields['Race '] = pdfRaceName(char.race, char.subrace)
  fields['Alignment'] = char.alignment
  fields['XP'] = String(char.experiencePoints)

  // Ability Scores
  const abilities: (keyof AbilityScores)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  const abilityFieldMap: Record<string, string> = {
    str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
  }
  const modFieldMap: Record<string, string> = {
    str: 'STRmod', dex: 'DEXmod', con: 'CONmod', int: 'INTmod', wis: 'WISmod', cha: 'CHAmod',
  }
  const profFieldMap: Record<string, string> = {
    str: 'STRprof', dex: 'DEXprof', con: 'CONprof', int: 'INTprof', wis: 'WISprof', cha: 'CHAprof',
  }
  const stFieldMap: Record<string, string> = {
    str: 'ST Strength', dex: 'ST Dexterity', con: 'ST Constitution',
    int: 'ST Intelligence', wis: 'ST Wisdom', cha: 'ST Charisma',
  }

  for (const a of abilities) {
    const abilityField = abilityFieldMap[a]!
    const modField = modFieldMap[a]!
    const stField = stFieldMap[a]!
    const profField = profFieldMap[a]!
    fields[abilityField] = String(totalAbility(char, a))
    fields[modField] = String(abilityMod(char, a))
    fields[stField] = String(savingThrow(char, a))
    if (char.savingThrowProficiencies.includes(a)) {
      fields[profField] = true
    }
  }

  // Combat Stats
  fields['AC'] = String(pdfArmorClass(char))
  fields['Initiative'] = String(abilityMod(char, 'dex'))
  fields['Speed'] = `${feetToMeters(char.speed)}m`
  fields['HPMax'] = String(char.maxHp)
  fields['HPCurrent'] = String(char.currentHp || char.maxHp)
  fields['HPTemp'] = String(char.tempHp || '')
  const hdClasses = char.classes ?? []
  if (hdClasses.length >= 2) {
    fields['HDTotal'] = hdClasses.map(c => `${c.level}d${c.hitDie}`).join(' + ')
  } else {
    fields['HDTotal'] = `${char.level}d${char.hitDie}`
  }
  fields['HD'] = `${char.level}d${char.hitDie}`
  fields['ProfBonus'] = String(prof)
  fields['Passive'] = String(10 + skillBonus(char, 'perception', 'wis'))

  // Skills
  const skillFieldMap: Record<string, { field: string; profField: string; ability: keyof AbilityScores }> = {
    acrobatics: { field: 'ACRO', profField: 'ACROP', ability: 'dex' },
    'animal-handling': { field: 'ANIM', profField: 'ANIMP', ability: 'wis' },
    arcana: { field: 'ARC', profField: 'ARCP', ability: 'int' },
    athletics: { field: 'ATH', profField: 'ATHP', ability: 'str' },
    deception: { field: 'DEC', profField: 'DECP', ability: 'cha' },
    history: { field: 'HIST', profField: 'HISTP', ability: 'int' },
    insight: { field: 'INS', profField: 'INSP', ability: 'wis' },
    intimidation: { field: 'INTI', profField: 'INTIP', ability: 'cha' },
    investigation: { field: 'INV', profField: 'INVP', ability: 'int' },
    medicine: { field: 'MED', profField: 'MEDP', ability: 'wis' },
    nature: { field: 'NAT', profField: 'NATP', ability: 'int' },
    perception: { field: 'PERC', profField: 'PERCP', ability: 'wis' },
    performance: { field: 'PERF', profField: 'PERFP', ability: 'cha' },
    persuasion: { field: 'PERS', profField: 'PERSP', ability: 'cha' },
    religion: { field: 'REL', profField: 'RELP', ability: 'int' },
    'sleight-of-hand': { field: 'SLE', profField: 'SLEP', ability: 'dex' },
    stealth: { field: 'STLTH', profField: 'STLTHP', ability: 'dex' },
    survival: { field: 'SURV', profField: 'SURVP', ability: 'wis' },
  }

  for (const [skillId, mapping] of Object.entries(skillFieldMap)) {
    fields[mapping.field] = String(skillBonus(char, skillId, mapping.ability))
    if (char.skillProficiencies.includes(skillId)) {
      fields[mapping.profField] = true
    }
  }

  // Weapons (up to 5)
  for (let i = 0; i < Math.min(char.weapons.length, 5); i++) {
    const wpn = char.weapons[i]!
    const suffix = i === 0 ? '' : ` ${i + 1}`
    const atkSuffix = i === 0 ? '' : i === 1 ? ' ' : '  '
    const dmgSuffix = i <= 1 ? (i === 1 ? ' ' : '') : ''
    fields[`Wpn Name${suffix}`] = wpn.name
    fields[`Wpn${i + 1} AtkBonus${atkSuffix}`] = formatModifier(wpn.attackBonus + prof + abilityMod(char, 'str'))
    fields[`Wpn${i + 1} Damage${dmgSuffix}`] = wpn.damage
  }

  // Equipment & Other
  fields['Equipment'] = char.equipment.join(', ')
  fields['ProficienciesLang'] = [...char.proficienciesOther, ...char.languages.map(l => `Language: ${l}`)].join('\n')
  // Features and Traits
  const featureLines = [...char.featuresTraits]
  fields['Features and Traits'] = featureLines.join('\n')
  fields['PersonalityTraits '] = char.personalityTraits
  fields['Ideals'] = char.ideals
  fields['Bonds'] = char.bonds
  fields['Flaws'] = char.flaws

  // Coins
  fields['CP'] = String(char.coins.cp || '')
  fields['SP'] = String(char.coins.sp || '')
  fields['EP'] = String(char.coins.ep || '')
  fields['GP'] = String(char.coins.gp || '')
  fields['PP'] = String(char.coins.pp || '')

  // Page 2
  fields['Age'] = char.age
  fields['Height'] = char.height
  fields['Weight'] = char.weight
  fields['Eyes'] = char.eyes
  fields['Hair'] = char.hair
  fields['Skin'] = char.skin
  fields['Backstory'] = char.backstory
  // Character Appearance: compose a physical description from detail fields
  const appearanceParts = [
    char.age ? `Age: ${char.age}` : '',
    char.height ? `Height: ${char.height}` : '',
    char.weight ? `Weight: ${char.weight}` : '',
    char.eyes ? `Eyes: ${char.eyes}` : '',
    char.hair ? `Hair: ${char.hair}` : '',
    char.skin ? `Skin: ${char.skin}` : '',
  ].filter(Boolean)
  fields['Feats+Traits'] = appearanceParts.join('\n')
  const alliesContent = [char.allies, char.sessionNotes].filter(Boolean).join('\n\n')
  fields['Allies'] = alliesContent
  fields['Treasure'] = char.treasure

  // Page 3 - Spellcasting
  if (char.spellcastingAbility) {
    fields['Spellcasting Class 2'] = pdfClassName(char.spellcastingClass)
    fields['SpellcastingAbility 2'] = char.spellcastingAbility.toUpperCase()
    const sMod = abilityMod(char, char.spellcastingAbility as keyof AbilityScores)
    fields['SpellSaveDC  2'] = String(spellSaveDC(prof, sMod))
    fields['SpellAtkBonus 2'] = formatModifier(spellAttackBonus(prof, sMod))
  }

  return fields
}

export function getBrancaloniaFieldMapping(char: CharacterData): Record<string, string | boolean> {
  const prof = proficiencyBonus(char.level)
  const fields: Record<string, string | boolean> = {}

  // Basic Info
  fields['Nome'] = char.name
  fields['Classe'] = pdfClassName(char.className)
  fields['Liv'] = String(char.level)
  fields['Background'] = pdfBackgroundName(char.background)
  fields['Nome Giocatore'] = char.playerName
  fields['Allineamento'] = char.alignment
  fields['Bonus Competenza'] = String(prof)
  fields['Ispirazione'] = ''

  // Ability Scores
  fields['Forza'] = String(totalAbility(char, 'str'))
  fields['Mod For'] = String(abilityMod(char, 'str'))
  fields['Des'] = String(totalAbility(char, 'dex'))
  fields['Mod Des'] = String(abilityMod(char, 'dex'))
  fields['Cos'] = String(totalAbility(char, 'con'))
  fields['MOD Cos'] = String(abilityMod(char, 'con'))
  fields['Int'] = String(totalAbility(char, 'int'))
  fields['Mod Int'] = String(abilityMod(char, 'int'))
  fields['Sag'] = String(totalAbility(char, 'wis'))
  fields['Mod Sag'] = String(abilityMod(char, 'wis'))
  fields['Car'] = String(totalAbility(char, 'cha'))
  fields['Mod Car'] = String(abilityMod(char, 'cha'))

  // Saving Throws
  fields['TSforza'] = String(savingThrow(char, 'str'))
  fields['TSdestreza'] = String(savingThrow(char, 'dex'))
  fields['TScostituzione'] = String(savingThrow(char, 'con'))
  fields['TSinteligenza'] = String(savingThrow(char, 'int'))
  fields['TSsaggezza'] = String(savingThrow(char, 'wis'))
  fields['TScarisma'] = String(savingThrow(char, 'cha'))

  // Combat
  fields['CA '] = String(pdfArmorClass(char))
  fields['Iniziativa'] = String(abilityMod(char, 'dex'))
  fields['Max PF'] = String(char.maxHp)
  fields['PF attuali '] = String(char.currentHp || char.maxHp)
  fields['PF Temporanei '] = String(char.tempHp || '')
  fields['Dadi Vita'] = `${char.level}d${char.hitDie}`
  fields['Percezione Passiva'] = String(10 + skillBonus(char, 'perception', 'wis'))

  // Skills
  const brancSkillMap: Record<string, { field: string; ability: keyof AbilityScores }> = {
    acrobatics: { field: 'Acrobazia', ability: 'dex' },
    'animal-handling': { field: 'Addestrare Animali', ability: 'wis' },
    arcana: { field: 'Arcano', ability: 'int' },
    athletics: { field: 'Atletica', ability: 'str' },
    stealth: { field: 'Furtività', ability: 'dex' },
    investigation: { field: 'Indagare', ability: 'int' },
    deception: { field: 'Inganno', ability: 'cha' },
    intimidation: { field: 'Intimidire', ability: 'cha' },
    performance: { field: 'Intrattenere', ability: 'cha' },
    insight: { field: 'Intuizione', ability: 'wis' },
    medicine: { field: 'Medicina', ability: 'wis' },
    nature: { field: 'Natura', ability: 'int' },
    perception: { field: 'Percezione', ability: 'wis' },
    persuasion: { field: 'Persuasione', ability: 'cha' },
    'sleight-of-hand': { field: 'Rapidità di Mano', ability: 'dex' },
    religion: { field: 'Religione', ability: 'int' },
    survival: { field: 'Sopravvivenza', ability: 'wis' },
    history: { field: 'Storia', ability: 'int' },
  }

  for (const [skillId, mapping] of Object.entries(brancSkillMap)) {
    fields[mapping.field] = String(skillBonus(char, skillId, mapping.ability))
  }

  // Weapons (up to 3)
  for (let i = 0; i < Math.min(char.weapons.length, 3); i++) {
    const wpn = char.weapons[i]!
    fields[`Arma ${i + 1}`] = wpn.name
    fields[`Bonus ${i + 1}`] = formatModifier(wpn.attackBonus + prof + abilityMod(char, 'str'))
    fields[`Danno ${i + 1}`] = wpn.damage
  }

  // Equipment
  fields['Equipaggiamento'] = char.equipment.join(', ')
  fields['Tratti Caratteriali'] = char.personalityTraits
  fields['Ideali'] = char.ideals
  fields['Legami'] = char.bonds
  fields['Difetti'] = char.flaws
  fields['Privilegi'] = char.featuresTraits.join('\n')
  fields['Alleati'] = char.allies
  const noteContent = [char.backstory, char.sessionNotes].filter(Boolean).join('\n\n')
  fields['Note'] = noteContent

  // Coins (silver standard)
  fields['MR'] = String(char.coins.cp || '')
  fields['MF '] = String(char.coins.sp || '')
  fields['MA'] = String(char.coins.ep || '')
  fields['MO'] = String(char.coins.gp || '')

  // Spellcasting
  if (char.spellcastingAbility) {
    fields['Classe Incantatore '] = pdfClassName(char.spellcastingClass)
    fields['Caratteristica da incantatore'] = char.spellcastingAbility.toUpperCase()
    const sMod = abilityMod(char, char.spellcastingAbility as keyof AbilityScores)
    fields['CD TS incantesimi'] = String(spellSaveDC(prof, sMod))
    fields['Bonus al copire incanteismi'] = formatModifier(spellAttackBonus(prof, sMod))
    fields['Trucchetti'] = char.cantrips.join(', ')
    fields['Incantesimi livello 1 '] = char.spellsKnown.filter(s => s.startsWith('1-')).join(', ')
    fields['Incantesimi livello 2'] = char.spellsKnown.filter(s => s.startsWith('2-')).join(', ')
    fields['Incantesimi livello 3'] = char.spellsKnown.filter(s => s.startsWith('3-')).join(', ')
  }

  // Brawling

  return fields
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mapping for the official 2024 (D&D 5.5) form-fillable character sheet.
//  Source PDF: DD_2024_Character_Sheet__FormFillable.pdf (411 AcroForm fields).
//  Document generated el 2026-05-19-1941
// ─────────────────────────────────────────────────────────────────────────────

export function getDnd2024FieldMapping(char: CharacterData): Record<string, string | boolean> {
  const prof = proficiencyBonus(char.level)
  const fields: Record<string, string | boolean> = {}

  // ── Identity ─────────────────────────────────────────────────────────────
  fields['Name'] = char.name
  fields['Background'] = pdfBackgroundName(char.background)
  // #100: pdfRaceName ahora devuelve solo la subespecie si existe, o solo
  // la especie.
  fields['Species'] = pdfRaceName(char.race, char.subrace)
  const classes = char.classes ?? []
  if (classes.length >= 2) {
    fields['Class'] = classes
      .map(c => `${pdfClassName(c.classId)} ${c.level}`)
      .join(' / ')
  } else {
    fields['Class'] = pdfClassName(char.className)
  }
  fields['Subclass'] = char.subclass ?? ''
  fields['Level'] = String(char.level)
  fields['XP'] = String(char.experiencePoints || '')
  fields['Alignment'] = char.alignment

  // ── Core combat ──────────────────────────────────────────────────────────
  fields['AC'] = String(pdfArmorClass(char))
  // Initiative = DEX_mod + (PB si feat Alert)
  const initiativeBonus = abilityMod(char, 'dex') + (char.featInitiativeProf ? prof : 0)
  fields['Initiative'] = formatModifier(initiativeBonus)
  // Speed: base + bonus de feats (Speedy = +10)
  const totalSpeed = (char.speed ?? 30) + (char.featSpeedBonus ?? 0)
  fields['Speed'] = `${totalSpeed} ft`
  fields['Passive_Perception'] = String(10 + skillBonus(char, 'perception', 'wis'))
  fields['Proficiency_Bonus'] = formatModifier(prof)

  // ── Hit points & hit dice ────────────────────────────────────────────────
  fields['HP_Current'] = String(char.currentHp || char.maxHp)
  fields['HP_Max'] = String(char.maxHp)
  fields['HP_Temp'] = String(char.tempHp || '')
  fields['Hit_Dice_Spent'] = '0'
  if (classes.length >= 2) {
    fields['Hit_Dice_Max'] = classes.map(c => `${c.level}d${c.hitDie}`).join(' + ')
  } else {
    fields['Hit_Dice_Max'] = `${char.level}d${char.hitDie}`
  }

  // ── Ability scores, modifiers, saves ─────────────────────────────────────
  const abilities: (keyof AbilityScores)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  // The 2024 sheet uses upper-case ability prefixes for the field names
  const abilityFieldPrefix: Record<keyof AbilityScores, string> = {
    str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
  }
  for (const a of abilities) {
    const p = abilityFieldPrefix[a]
    fields[`${p}_Score`] = String(totalAbility(char, a))
    fields[`${p}_Mod`] = formatModifier(abilityMod(char, a))
    fields[`${p}_ST_Bonus`] = formatModifier(savingThrow(char, a))
    if (char.savingThrowProficiencies.includes(a)) {
      // Note: the PDF has a typo for Charisma -> 'CHAT_ST_Prof' (sic, kept as-is)
      const stField = a === 'cha' ? 'CHAT_ST_Prof' : `${p}_ST_Prof`
      fields[stField] = true
    }
  }

  // ── Skills ───────────────────────────────────────────────────────────────
  // PDF field naming is CamelCase per skill (e.g. AnimalHandling_Bonus,
  // SleightOfHand_Prof). Map our internal kebab-case ids to the PDF names.
  type SkillMap = { name: string; ability: keyof AbilityScores }
  const skill2024: Record<string, SkillMap> = {
    'acrobatics':        { name: 'Acrobatics',        ability: 'dex' },
    'animal-handling':   { name: 'AnimalHandling',    ability: 'wis' },
    'arcana':            { name: 'Arcana',            ability: 'int' },
    'athletics':         { name: 'Athletics',         ability: 'str' },
    'deception':         { name: 'Deception',         ability: 'cha' },
    'history':           { name: 'History',           ability: 'int' },
    'insight':           { name: 'Insight',           ability: 'wis' },
    'intimidation':      { name: 'Intimidation',      ability: 'cha' },
    'investigation':     { name: 'Investigation',     ability: 'int' },
    'medicine':          { name: 'Medicine',          ability: 'wis' },
    'nature':            { name: 'Nature',            ability: 'int' },
    'perception':        { name: 'Perception',        ability: 'wis' },
    'performance':       { name: 'Performance',       ability: 'cha' },
    'persuasion':        { name: 'Persuasion',        ability: 'cha' },
    'religion':          { name: 'Religion',          ability: 'int' },
    'sleight-of-hand':   { name: 'SleightOfHand',     ability: 'dex' },
    'stealth':           { name: 'Stealth',           ability: 'dex' },
    'survival':          { name: 'Survival',          ability: 'wis' },
  }
  for (const [skillId, m] of Object.entries(skill2024)) {
    fields[`${m.name}_Bonus`] = formatModifier(skillBonus(char, skillId, m.ability))
    if (char.skillProficiencies.includes(skillId)) {
      fields[`${m.name}_Prof`] = true
    }
  }

  // ── Equipment training & proficiencies (#37) ─────────────────────────────
  // Combinar: proficienciesOther del store + proficiencias de la clase
  const otherProfs = char.proficienciesOther ?? []
  const cls = getClassById(char.className)

  // H4: leer proficiencies desde el store (classArmorProficiencies, etc.) con
  // fallback a la clase directa por si el personaje aún no las tiene copiadas
  // (e.g. importado de una versión vieja). El store es la fuente preferida
  // porque permite añadir/quitar proficiencies via feats sin tocar la clase.
  const armorFromChar = char.classArmorProficiencies ?? cls?.armorProficiencies ?? []
  const weaponFromChar = char.classWeaponProficiencies ?? cls?.weaponProficiencies ?? []
  const toolFromChar = char.classToolProficiencies ?? cls?.toolProficiencies ?? []

  // Armor checkboxes — desde clase y proficienciesOther
  const armorSources = [
    ...armorFromChar,
    ...otherProfs,
  ].join(' | ').toLowerCase()
  if (armorSources.includes('light'))   fields['Armor_Light_Prof'] = true
  if (armorSources.includes('medium'))  fields['Armor_Med_Prof']   = true
  if (armorSources.includes('heavy'))   fields['Armor_Heavy_Prof'] = true
  if (armorSources.includes('shield'))  fields['Shield_Prof']      = true

  // Weapon proficiencies — desde clase + store
  const wpnFromClass = weaponFromChar
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
  const wpnFromStore = otherProfs
    .filter(p => /weapon|sword|axe|bow|crossbow|hammer|mace|flail|spear|club|dart|dagger/i.test(p))
  fields['Weapon_Prof'] = [...new Set([...wpnFromClass, ...wpnFromStore])].join(', ')

  // Tool proficiencies — desde clase + background + store
  const toolFromClass = toolFromChar
  const toolFromStore = otherProfs
    .filter(p => /tool|kit|supplies|instrument|game|vehicle/i.test(p))
  fields['Tool_Prof'] = [...new Set([...toolFromClass, ...toolFromStore])].join(', ')

  // ── Weapons (up to 6) — desde inventory (#37, #53) ───────────────────────
  // Prioritizar ítems de inventario con kind=weapon/magic sobre el array legacy weapons[]
  // El cálculo del attack bonus usa la ability correcta (DEX para ranged, STR/DEX
  // para finesse, STR para melee normal), PB si proficient, y bonus mágico
  // detectado del nombre (ej: "Hand Crossbow +1" → +1).
  const inventoryWeapons = (char.inventory ?? [])
    .filter(i => i.kind === 'weapon' || (i.kind === 'magic' && /sword|axe|bow|dagger|spear|mace|hammer|rapier|quarterstaff|scimitar|maul|lance|whip|halberd|glaive|crossbow|club|sickle|sling|trident|dart|blowgun|pistol|musket|warhammer|war pick|morningstar|battleaxe|greataxe|greatsword|greatclub|handaxe|javelin|light hammer|longbow|shortbow|shortsword|longsword|flail|pike|hand axe/i.test(i.name)))
  const legacyWeapons = char.weapons ?? []

  const namesToProcess: string[] = inventoryWeapons.length > 0
    ? inventoryWeapons.map(i => i.name)
    : legacyWeapons.map(w => w.name)
  const inventoryNotesByName: Record<string, string> = {}
  for (const i of inventoryWeapons) inventoryNotesByName[i.name] = i.notes ?? ''

  for (let i = 0; i < Math.min(namesToProcess.length, 6); i++) {
    const name = namesToProcess[i]!
    const info = computeWeaponAttack(name, char)
    const n = i + 1
    fields[`Weapon${n}_Name`]   = name
    fields[`Weapon${n}_Bonus`]  = formatModifier(info.attackBonus)
    fields[`Weapon${n}_Damage`] = info.damage
    fields[`Weapon${n}_Notes`]  = inventoryNotesByName[name] ?? ''
  }

  // ── Features / Traits / Feats (#36 — texto compacto para caber en el PDF) ─
  // Solo nombres cortos — las descripciones completas no caben en los campos PDF.
  // Class features + feats vienen de `char.featuresTraits`.
  // Species traits se derivan de la raza/subraza/choices (no van en featuresTraits).
  const allFeatLines = char.featuresTraits ?? []
  const featLines: string[] = []
  const classLines: string[] = []
  for (const line of allFeatLines) {
    const trimmed = line.trim()
    const shortName = trimmed.length > 60 ? trimmed.slice(0, 57) + '…' : trimmed
    if (/^(ASI |Origin )?feat\b/i.test(trimmed)) featLines.push(shortName)
    else                                          classLines.push(shortName)
  }
  // #101: Fighting Style feat (Fighter lv.1, Paladin lv.2, Ranger lv.2). NO está
  // en featuresTraits; vive en char.fightingStyleFeat. Lo añadimos al campo
  // "Feats" del PDF hoja 1 con el prefijo "Fighting Style:" para identificarlo.
  if (char.fightingStyleFeat) {
    const fsFeat = getFeatById(char.fightingStyleFeat)
    if (fsFeat) {
      const line = `Fighting Style: ${fsFeat.name}`
      featLines.push(line.length > 60 ? line.slice(0, 57) + '…' : line)
    }
  }
  // Partir en dos columnas
  const halfway = Math.ceil(classLines.length / 2)
  fields['ClassFeatures_L'] = classLines.slice(0, halfway).join('\n')
  fields['ClassFeatures_R'] = classLines.slice(halfway).join('\n')

  // ── Species Traits (#56 — derivado de la raza, no de featuresTraits) ──────
  // Para cada trait de la raza guardamos solo el nombre corto (antes de ":")
  // — las descripciones largas no caben en el campo del PDF.
  const speciesLines: string[] = []
  const race = char.race ? getRaceById(char.race) : undefined
  if (race) {
    for (const trait of race.traits ?? []) {
      // "Darkvision 60 ft." → "Darkvision 60 ft."
      // "Breath Weapon: when you..." → "Breath Weapon"
      const colonIdx = trait.indexOf(':')
      const short = colonIdx > 0 ? trait.slice(0, colonIdx).trim() : trait.trim()
      speciesLines.push(short.length > 60 ? short.slice(0, 57) + '…' : short)
    }
    // Subrace traits (Elven Lineage, Gnomish Lineage, Tiefling Legacy).
    if (char.subrace) {
      const sub = race.subraces?.find(s => s.id === char.subrace)
      if (sub) {
        for (const trait of sub.traits ?? []) {
          const colonIdx = trait.indexOf(':')
          const short = colonIdx > 0 ? trait.slice(0, colonIdx).trim() : trait.trim()
          speciesLines.push(short.length > 60 ? short.slice(0, 57) + '…' : short)
        }
      }
    }
    // Species choices (e.g. Dragonborn — Draconic Ancestry: Red (Fire)).
    if (race.choices?.length && char.speciesChoices) {
      for (const choice of race.choices) {
        const optId = char.speciesChoices[choice.id]
        if (!optId) continue
        const opt = choice.options.find(o => o.id === optId)
        if (!opt) continue
        const detail = opt.details ? ` (${opt.details})` : ''
        speciesLines.push(`${choice.label}: ${opt.name}${detail}`)
      }
    }
  }
  fields['Species_Traits']  = speciesLines.join('\n')
  fields['Feats']           = featLines.join('\n')

  // Languages — campo separado en el PDF 2024 (#36 — formato compacto)
  fields['Languages'] = (char.languages ?? []).join(', ')

  // ── Spellcasting (page 2) ────────────────────────────────────────────────
  if (char.spellcastingAbility) {
    const sMod = abilityMod(char, char.spellcastingAbility as keyof AbilityScores)
    fields['Spellcasting_Ability'] = char.spellcastingAbility.toUpperCase()
    fields['Spellcasting_AM']      = formatModifier(sMod)
    fields['Spellcasting_DC']      = String(spellSaveDC(prof, sMod))
    fields['Spell_Attack_Mod']     = formatModifier(spellAttackBonus(prof, sMod))
  }

  // Spell slot totals (L1..L9) — not stored on CharacterData; left blank for
  // now. The caster will see the slot icons preserved in the PDF and can
  // tick them manually, until we wire computeSpellSlots() into this mapping.

  // Cantrips + Prepared spells listed in the spell table (up to 30 rows).
  const allSpellEntries: { level: number; name: string }[] = []
  for (const c of char.cantrips ?? []) allSpellEntries.push({ level: 0, name: c })
  for (const s of char.spellsKnown ?? []) {
    const m = /^(\d+)-(.*)$/.exec(s)
    if (m) allSpellEntries.push({ level: parseInt(m[1]!, 10), name: m[2]! })
    else   allSpellEntries.push({ level: 1, name: s })
  }
  // #105: Species grants (Forest Gnome Minor Illusion, Drow Faerie Fire, etc.).
  // Etiquetados (Race) para distinguirlos de los hechizos elegidos de clase.
  for (const cId of char.speciesGrantedCantrips ?? []) {
    if (cId) allSpellEntries.push({ level: 0, name: `${cId} (Race)` })
  }
  for (const sId of char.speciesGrantedSpells ?? []) {
    const m = /^(\d+)-(.*)$/.exec(sId)
    if (m) allSpellEntries.push({ level: parseInt(m[1]!, 10), name: `${m[2]!} (Race)` })
    else   allSpellEntries.push({ level: 1, name: `${sId} (Race)` })
  }
  // Magic Initiate (#74): 2 cantrips + 1 level-1 spell per instance.
  // Tagged so the player can tell them apart from class spells on the sheet.
  for (const mi of char.magicInitiateChoices ?? []) {
    for (const cId of mi.cantrips) {
      if (cId) allSpellEntries.push({ level: 0, name: `${cId} (MI)` })
    }
    if (mi.levelOneSpell) {
      const m = /^(\d+)-(.*)$/.exec(mi.levelOneSpell)
      const nm = m ? m[2]! : mi.levelOneSpell
      allSpellEntries.push({ level: 1, name: `${nm} (MI)` })
    }
  }
  // H5: Blessed Warrior / Druidic Warrior — cantrips alternativos al Fighting Style.
  // Etiquetados para distinguirlos de los cantrips de clase.
  if (char.martialCasterAlt) {
    const tag = char.martialCasterAlt.source === 'paladin-blessed' ? 'BW' : 'DW'
    for (const cId of char.martialCasterAlt.cantrips) {
      if (cId) allSpellEntries.push({ level: 0, name: `${cId} (${tag})` })
    }
  }
  for (let i = 0; i < Math.min(allSpellEntries.length, 30); i++) {
    const e = allSpellEntries[i]!
    const n = i + 1
    fields[`SLevel_${n}`] = e.level === 0 ? 'C' : String(e.level)
    fields[`SName_${n}`]  = e.name
  }

  // ── Story / Description boxes (page 2) ───────────────────────────────────
  const historyParts = [
    char.personalityTraits ? `Personality: ${char.personalityTraits}` : '',
    char.ideals  ? `Ideals: ${char.ideals}`   : '',
    char.bonds   ? `Bonds: ${char.bonds}`     : '',
    char.flaws   ? `Flaws: ${char.flaws}`     : '',
    char.backstory ? `\n${char.backstory}`    : '',
  ].filter(Boolean)
  fields['History_Personality'] = historyParts.join('\n')

  // ── Inventory (#59 — incluir char.inventory[]) ───────────────────────────
  // char.equipment es el listado clásico (texto libre); char.inventory es
  // donde están los magic items con kind, qty, attuned. Antes solo se metía
  // char.equipment, así que los magic items (ej: Winged Boots) no aparecían.
  const inventoryLines: string[] = []
  // Items mundanos del array clásico, si los hay.
  const equipmentText = char.equipment.join(', ')
  if (equipmentText) inventoryLines.push(equipmentText)
  // Items del inventory[] estructurado (armas, armadura, magic, custom).
  for (const item of char.inventory ?? []) {
    let line = item.name
    if (item.qty > 1) line = `${item.name} (×${item.qty})`
    if (item.kind === 'magic' && item.attuned) line += ' [attuned]'
    if (item.notes) line += ` — ${item.notes}`
    inventoryLines.push(line)
  }
  if (char.treasure) inventoryLines.push(`\nTreasure: ${char.treasure}`)
  fields['Inventory'] = inventoryLines.join('\n')

  fields['Languages'] = (char.languages ?? []).join(', ')

  const appearanceParts = [
    char.age    ? `Age: ${char.age}`       : '',
    char.height ? `Height: ${char.height}` : '',
    char.weight ? `Weight: ${char.weight}` : '',
    char.eyes   ? `Eyes: ${char.eyes}`     : '',
    char.hair   ? `Hair: ${char.hair}`     : '',
    char.skin   ? `Skin: ${char.skin}`     : '',
  ].filter(Boolean)
  fields['Appearance'] = appearanceParts.join('\n')

  // ── Coins ────────────────────────────────────────────────────────────────
  fields['Coin_CP'] = String(char.coins.cp || '')
  fields['Coin_SP'] = String(char.coins.sp || '')
  fields['Coin_EP'] = String(char.coins.ep || '')
  fields['Coin_GP'] = String(char.coins.gp || '')
  fields['Coin_PP'] = String(char.coins.pp || '')

  return fields
}

/** Alias público con nombre más corto (#101). Equivalente al mapping del PDF
 *  2024 (que es el oficial del proyecto). Existe para que la lógica de
 *  Fighting Style sea testeable sin acoplarse al nombre interno. */
export function buildPdfFields(char: CharacterData): Record<string, string | boolean> {
  return getDnd2024FieldMapping(char)
}
