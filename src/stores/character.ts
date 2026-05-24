import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameVariant } from './app'
import { modifier, proficiencyBonus, hpPerLevel, computeArmorClass } from '@/utils/calculations'
import { recomputeMaxHp } from '@/utils/recomputeHp'
import { recomputeSpeciesGrants } from '@/utils/speciesSpells'
import { commitLevelSnapshot } from '@/utils/levelHistory'
import { computeAcBreakdown } from '@/utils/armorClassBreakdown'
import { getMaxLevel, getClasses, getEquipment } from '@/data'
import { getMagicItemById } from '@/data/dnd5e/magic-items'
import { migrateCharacterToClassEntries } from '@/utils/classEntries'
import { migrateInventoryPlusItems } from '@/utils/migrateInventoryPlusItems'
import { multiclassPrereqsSatisfied } from '@/utils/multiclassPrereqs'
import { getMulticlassProfs } from '@/data/dnd5e/multiclassProfs'

export interface AbilityScores {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export interface Weapon {
  name: string
  attackBonus: number
  damage: string
}

/** Una entrada del multiclass o la única entrada para un PJ monoclase.
 *
 *  #139 (Fase 1, refactor multiclass): se amplía con todos los campos
 *  específicos por clase del modelo nuevo. Los campos antiguos
 *  (classId/subclass/level/hitDie) siguen existiendo y son obligatorios;
 *  los nuevos son opcionales para mantener compatibilidad hacia atrás con
 *  los PJs guardados antes del refactor. La migración (loadCharacter /
 *  importJson) los rellena leyendo los campos planos de CharacterData.
 */
export interface ClassEntry {
  classId: string
  subclass: string
  level: number
  hitDie: number

  // ── Campos del modelo nuevo (#139, Fase 1) ──
  // Todos opcionales: los PJs migrados los obtienen al cargar; los nuevos
  // los rellena addMulticlass / selectClass. La lectura agregada se hace
  // vía los helpers de classEntries.ts (getCharCantrips, etc.).

  /** ASIs cogidos en ESTA clase (no en el PJ global). En el modelo viejo
   *  todos los ASIs vivían en char.asiChoices; el nuevo los reparte. */
  asiChoices?: ASIChoice[]

  /** Spellcasting ability de ESTA clase (wis para Cleric, int para Wizard,
   *  cha para Sorcerer/Bard/Warlock/Paladin). Permite calcular DC/Attack
   *  por clase en multiclass-caster. */
  spellcastingAbility?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

  /** Cantrips conocidos de ESTA clase. Distintos casters pueden conocer
   *  cantrips distintos; antes vivían todos en char.cantrips. */
  cantrips?: string[]

  /** Hechizos preparados/conocidos de ESTA clase. */
  spellsKnown?: string[]

  /** Magic Initiate cogido vía ASI feat en ESTA clase (no el origin feat,
   *  que sigue siendo único en char.magicInitiateChoices). */
  magicInitiateChoices?: Array<{
    source: string
    spellList: 'cleric' | 'druid' | 'wizard'
    cantrips: string[]
    levelOneSpell: string
  }>

  /** Fighting Style elegido si la clase lo otorga (Fighter, Paladin, Ranger). */
  fightingStyle?: string

  /** Expertise picks si la clase los otorga (Rogue, Bard). */
  expertiseChoices?: string[]

  /** Weapon Masteries dominadas vía esta clase (Fighter, Barbarian, Paladin,
   *  Ranger, Rogue). Antes vivían en char.weaponMasteries. */
  weaponMasteries?: string[]
}

/** Documento generado el 2026-05-19-2200
 *  ASI/Feat choice made by the player at a level-up checkpoint
 *  (2024: levels 4, 8, 12, 16, 19 for all classes; +6/+14 for Fighter; +10 for Rogue).
 */
export interface ASIChoice {
  /** Character level at which this choice applies (4, 6, 8, 10, 12, 14, 16, 19). */
  level: number
  /** Either bump ability scores, or take a feat. */
  type: 'asi' | 'feat'
  /** Only set when type === 'asi'. */
  asiMode?: '2' | '1+1'
  /** Abilities bumped. If asiMode='2' → length 1 (+2 to that ability).
   *  If asiMode='1+1' → length 2 (+1 to each). */
  asiAbilities?: Array<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'>
  /** Only set when type === 'feat'. Refers to feats.ts ids. */
  featId?: string
  /** Only set when type === 'feat' AND the feat grants an ASI bump with multiple options
   *  (e.g. Crusher: "+1 STR or CON"). For single-option feats this is auto-resolved. */
  featAbility?: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
  /** Only set when type === 'feat' AND the feat has `requiresChoices` (e.g. Skilled,
   *  Crafter, Skill Expert). Key = choice id from Feat.requiresChoices, value = array
   *  of selected option ids (skills, tools, instruments, etc.). */
  featChoices?: Record<string, string[]>
}

/**
 * A single item tracked in the character's inventory.
 * Can be a mundane weapon/armor, a magic item (by id from magic-items.ts),
 * or a free-text custom item.
 */
export interface InventoryItem {
  /** Unique slot id for this inventory entry (crypto.randomUUID). */
  slotId: string
  /** Source kind:
   *  - 'weapon' → lookup en simpleWeapons/martialWeapons por itemId=name
   *  - 'armor'  → lookup en armor[] por itemId=name
   *  - 'magic'  → lookup en magicItems por itemId=id
   *  - 'gear'   → lookup en adventuringGear por itemId=id (#127)
   *  - 'custom' → texto libre del usuario, sin lookup */
  kind: 'weapon' | 'armor' | 'magic' | 'gear' | 'custom'
  /** For kind='magic': id from magic-items.ts. For 'weapon'/'armor': weapon/armor name. */
  itemId: string
  /** Display name (copied at add-time so renames don't break history). */
  name: string
  /** For magic items: true if the character has attuned to it. */
  attuned?: boolean
  /** Free-form notes (charges used, condition, etc.). */
  notes?: string
  /** Quantity (default 1). */
  qty: number
  /** Weight in pounds for custom/adventuring-gear items. Catalogue items resolve weight by itemId. */
  weight?: number
  /**
   * #150 — Si esta entrada es un weapon/armor que TAMBIÉN es ítem mágico
   * (p.ej. Hand Crossbow +1, Plate Armor +2), `magicItemId` apunta al ID en
   * `magic-items.ts` para resolver rarity, attunement, bonus y descripción.
   *
   * `kind` se mantiene como 'weapon' o 'armor' (no 'magic') porque
   * conceptualmente sigue siendo el arma o armadura — el badge, el slot y
   * el comportamiento deben ser los del item base. Solo es campo opcional
   * para mantener compat con entradas que no tienen vínculo mágico.
   */
  magicItemId?: string
  /** #118 — Item equipped on the character (worn/wielded right now).
   *  Multiple items can be equipped; uniqueness rules (1 armor, 1 shield,
   *  1 cloak, max 2 rings) are enforced by the equip helper, not the data. */
  equipped?: boolean
  /** #123 — Item stored inside a magical (extradimensional) container, so
   *  its weight does NOT count for encumbrance (Bag of Holding, Handy
   *  Haversack, etc.). Mutually exclusive with `equipped`: a stored item is,
   *  by definition, not being worn or wielded. */
  stored?: boolean
  /** #123 — Slot type for custom items, since they don't have a catalogue
   *  entry to read from. Used to enforce single-slot rules (1 cloak, 1 belt,
   *  max 2 attuned rings, etc.). Magic items resolve their slot from the
   *  catalogue via MagicItem.slot. Weapons/armor resolve via kind. */
  selectedSlot?: SlotType
  /** #123 — For custom items: declare that this item is a magical
   *  (extradimensional) container, so its contents don't count for
   *  encumbrance. Catalogue magic items use MagicItem.isContainer. */
  isMagicalContainer?: boolean
  /** #118 — For homebrew items: AC bonus that this item grants while
   *  equipped (and attuned, if attuned is also required). Canonical items
   *  use a hardcoded lookup in armorClassBreakdown; this field lets users
   *  declare a bonus for items not in the catalogue. */
  customAcBonus?: number
}

/** #123 — Slot types for equipment-uniqueness rules. */
export type SlotType =
  | 'armor' | 'shield' | 'boots' | 'gloves' | 'belt' | 'cloak'
  | 'head' | 'neck' | 'ring' | 'other'

export interface CharacterData {
  id: string
  variant: GameVariant
  name: string
  playerName: string
  race: string
  subrace: string
  className: string
  subclass: string
  level: number
  background: string
  alignment: string
  experiencePoints: number
  abilityScores: AbilityScores
  /** Bonuses de especie/raza (en 2024 siempre 0 — las especies no dan ASI). */
  speciesBonuses: Partial<AbilityScores>
  /** Selecciones extra de la especie (ej: Dragonborn → Draconic Ancestry).
   *  Mapa { choiceId: optionId } definido en Race.choices. */
  speciesChoices?: Record<string, string>
  /** Bonuses del trasfondo (el jugador elige distribución al seleccionar background). */
  backgroundBonuses: Partial<AbilityScores>
  /** Bonuses de subida de nivel (ASI elegidos en checkpoints de nivel). */
  asiBonuses: Partial<AbilityScores>
  skillProficiencies: string[]
  skillExpertise: string[]
  savingThrowProficiencies: string[]
  languages: string[]
  proficienciesOther: string[]
  weapons: Weapon[]
  armor: string
  shield: boolean
  equipment: string[]
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number }
  personalityTraits: string
  ideals: string
  bonds: string
  flaws: string
  featuresTraits: string[]
  backstory: string
  age: string
  height: string
  weight: string
  eyes: string
  hair: string
  skin: string
  allies: string
  treasure: string
  spellcastingClass: string
  spellcastingAbility: string
  cantrips: string[]
  spellsKnown: string[]
  spellsPrepared: string[]
  hitDie: number
  maxHp: number
  currentHp: number
  tempHp: number
  speed: number
  /** Notas de sesión del jugador. */
  sessionNotes: string
  /**
   * #153 — Notes & FAQ del PJ. Texto libre, separado de sessionNotes.
   * Pensado para FAQ del jugador: reglas que se olvidan, recordatorios fijos,
   * combos del PJ que conviene tener a mano. Aparece al final del anexo del
   * PDF "Detailed Reference" para tenerlo a mano en mesa.
   */
  notesAndFaq?: string
  /** Skills otorgadas por el trasfondo — separadas para no borrar las de clase al cambiar. */
  backgroundSkillProficiencies?: string[]
  /** Skills elegidas via la clase — separadas igual que las del background.
   *  Permite detectar colisiones (background+clase ofrecen la misma skill)
   *  y resolverlas sin perder ninguna fuente. #93 */
  classSkillProficiencies?: string[]
  /** Fighting Style feat elegido (id). Aplica a Fighter (lv.1), Paladin (lv.2),
   *  Ranger (lv.2). Reemplazable en cada subida de nivel del Fighter, o al
   *  alcanzar la feature en las otras clases. #94 */
  fightingStyleFeat?: string
  /** Cantrips concedidos por la especie/subraza (Gnomish Lineage Minor Illusion,
   *  Tiefling Thaumaturgy, Aasimar Light, etc.). #105 — NO cuentan contra el
   *  límite de cantrips de clase ni se pueden borrar manualmente; se aplican
   *  al elegir raza/subraza y se reaplican al subir de nivel si tienen
   *  minCharLevel. */
  speciesGrantedCantrips?: string[]
  /** Hechizos concedidos por la especie/subraza, siempre preparados (Forest
   *  Gnome Speak with Animals, Drow Faerie Fire, Tiefling Hellish Rebuke, etc.).
   *  #105 — mismas reglas que speciesGrantedCantrips: protegidos y no cuentan
   *  contra el max de spells preparados de la clase. */
  speciesGrantedSpells?: string[]
  /** Alternativa al Fighting Style feat para Paladin (Blessed Warrior) y
   *  Ranger (Druidic Warrior): cantrips de Cleric/Druid siempre preparados.
   *  EXCLUSIVO con fightingStyleFeat (no se pueden tener ambos). H5 (auditoría). */
  martialCasterAlt?: {
    source: 'paladin-blessed' | 'ranger-druidic'
    cantrips: string[]
  }
  /** Armor proficiencies otorgadas por la clase (Light, Medium, Shields, etc.).
   *  Separadas para poder reemplazarlas al cambiar de clase sin tocar
   *  proficiencies de feats o de origen manual. H4 (auditoría externa). */
  classArmorProficiencies?: string[]
  /** Weapon proficiencies otorgadas por la clase ('simple', 'martial',
   *  'martial-finesse', etc.). H4 */
  classWeaponProficiencies?: string[]
  /** Tool proficiencies otorgadas por la clase. H4 */
  classToolProficiencies?: string[]
  /** Skills elegidas como Expertise por una feature, indexadas por sourceId.
   *  Ejemplos de sourceId: 'bard-lv2', 'bard-lv10', 'rogue-lv1', 'wizard-scholar'.
   *  La unión de todos los arrays se refleja en `skillExpertise` (lista flat
   *  legacy). H5 (auditoría externa). */
  expertiseSources?: Record<string, string[]>
  /** ID del feat de origen del background actual (separado de featuresTraits para
   *  no mezclarlo con tags que puedan venir de otros sitios — #63). */
  originFeatId?: string
  /** Bonus de HP del feat Tough (nivel × 2). Calculado automáticamente por AsiSelector. */
  toughHpBonus?: number
  /** Saving throw proficiencies otorgadas por feats (ej: Resilient). Tracking
   *  para poder quitarlas idempotentemente sin tocar las de la clase. */
  featAddedSavingThrows?: Array<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'>
  /** Bonus de velocidad de feats (ej: Speedy = +10). */
  featSpeedBonus?: number
  /** Si true, añadir PB al Initiative (ej: Alert). */
  featInitiativeProf?: boolean
  /** Si true, +1 AC con cualquier armadura (Defense fighting style). */
  featDefenseACBonus?: boolean
  /** Proficiencies otorgadas por feats (ej: Chef → ["Cook's Utensils"]). Tracking
   *  para poder quitarlas idempotentemente sin tocar las de la clase/raza. */
  featAddedProficiencies?: string[]
  /** Skills otorgadas por feats (Skilled, Crafter, Observant, Keen Mind, Skill Expert).
   *  Tracking idempotente. Solo IDs de skills. */
  featAddedSkillProficiencies?: string[]
  /** Expertises otorgadas por feats (Skill Expert). Tracking idempotente.
   *  Solo IDs de skills. */
  featAddedExpertise?: string[]
  /** Elecciones del feat Magic Initiate (puede aparecer múltiples veces:
   *  como origin feat y/o como ASI feat — es repeatable).
   *  - source: 'origin' (background) o 'asi-<level>' (ASI checkpoint del nivel N).
   *  - spellList: 'cleric' | 'druid' | 'wizard'.
   *  - cantrips: 2 spell IDs de la lista (cantrip level 0).
   *  - levelOneSpell: 1 spell ID de la lista (level 1). */
  magicInitiateChoices?: Array<{
    source: string
    spellList: 'cleric' | 'druid' | 'wizard'
    cantrips: string[]
    levelOneSpell: string
  }>
  // Multiclass (D&D 5e only) — empty array = single class
  classes: ClassEntry[]
  // ASI/Feat choices made at level-up checkpoints (2024 rules). Empty for new characters.
  // Optional for backwards compatibility with characters saved before milestone 10.
  asiChoices?: ASIChoice[]
  // Inventory: normal + magic items tracked on the character sheet.
  // Optional for backwards compatibility.
  inventory?: InventoryItem[]
  /** Weapon names dominated via class Weapon Mastery feature (#89).
   *  Number of slots is class-dependent: see weaponMasteryByLevel in classes.ts.
   *  Fighter at lv.1 has 3 slots; Barbarian/Paladin/Ranger/Rogue start with 2. */
  weaponMasteries?: string[]
  /** #117 — Historial de niveles. Cada entrada es un snapshot completo del
   *  personaje en el momento de ALCANZAR ese nivel. Modo híbrido:
   *  - Consulta: el jugador puede ver cómo era el PJ en cualquier nivel previo.
   *  - Reset: "Restaurar a este nivel" reescribe el PJ activo con el snapshot
   *    y elimina los snapshots posteriores.
   *
   *  Snapshots NO contienen levelHistory dentro de sí (sería recursivo).
   *  Campo OPCIONAL para personajes guardados antes de esta feature; en ellos
   *  empieza vacío y los snapshots se acumulan a partir del próximo level-up. */
  levelHistory?: LevelSnapshot[]
}

/** #117 — Snapshot de un personaje en un momento concreto.
 *  El campo `snapshot` es una copia COMPLETA de CharacterData salvo por
 *  `levelHistory` (que se omite para no anidar historial). */
export interface LevelSnapshot {
  /** Nivel al que se llegó (1, 2, 3, ...). */
  level: number
  /** Timestamp ISO del momento en que se creó el snapshot. */
  snapshotAt: string
  /** Copia del personaje completo en ese momento, sin levelHistory. */
  snapshot: Omit<CharacterData, 'levelHistory'>
}

function createEmptyCharacter(): CharacterData {
  return {
    id: crypto.randomUUID(),
    variant: 'dnd5e',
    name: '',
    playerName: '',
    race: '',
    subrace: '',
    className: '',
    subclass: '',
    level: 1,
    background: '',
    alignment: '',
    experiencePoints: 0,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    speciesBonuses: {},
    speciesChoices: {},
    backgroundBonuses: {},
    asiBonuses: {},
    skillProficiencies: [],
    skillExpertise: [],
    savingThrowProficiencies: [],
    languages: [],
    proficienciesOther: [],
    weapons: [],
    armor: '',
    shield: false,
    equipment: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    personalityTraits: '',
    ideals: '',
    bonds: '',
    flaws: '',
    featuresTraits: [],
    backstory: '',
    age: '',
    height: '',
    weight: '',
    eyes: '',
    hair: '',
    skin: '',
    allies: '',
    treasure: '',
    spellcastingClass: '',
    spellcastingAbility: '',
    cantrips: [],
    spellsKnown: [],
    spellsPrepared: [],
    hitDie: 8,
    maxHp: 0,
    currentHp: 0,
    tempHp: 0,
    speed: 30,
    sessionNotes: '',
    notesAndFaq: '',
    classes: [],
    asiChoices: [],
  }
}

export const useCharacterStore = defineStore('character', () => {
  const character = ref<CharacterData>(createEmptyCharacter())
  const savedCharacters = ref<CharacterData[]>([])

  // Computed derived stats
  const abilityModifiers = computed(() => ({
    str: modifier(totalAbilityScore('str')),
    dex: modifier(totalAbilityScore('dex')),
    con: modifier(totalAbilityScore('con')),
    int: modifier(totalAbilityScore('int')),
    wis: modifier(totalAbilityScore('wis')),
    cha: modifier(totalAbilityScore('cha')),
  }))

  const profBonus = computed(() => proficiencyBonus(character.value.level))

  const armorClass = computed(() => {
    // #118: si hay items equipped en inventory, usar armorClassBreakdown
    // (sistema nuevo, sources + total). Si no, fallback al sistema legacy
    // (char.armor string + primer armor del inventory).
    const char = character.value
    const equip = getEquipment(char.variant)

    const breakdown = computeAcBreakdown(char, abilityModifiers.value.dex, equip.armor)
    if (breakdown) return breakdown.total

    // Legacy path: AC considera la armadura equipada (string) y el escudo.
    // char.armor = nombre de la armadura (texto); char.shield = booleano.
    // Si char.armor está vacío, intentamos detectar la primera armadura del
    // inventory[] estructurado (kind='armor'). Si no hay nada, unarmored.
    let armorName = char.armor || ''
    let hasShield = !!char.shield

    if (!armorName && Array.isArray(char.inventory)) {
      const armorItem = char.inventory.find(i => i.kind === 'armor')
      if (armorItem) armorName = armorItem.name
      const shieldItem = char.inventory.find(
        i => i.kind === 'armor' && /shield/i.test(i.name),
      )
      if (shieldItem && !hasShield) hasShield = true
    }

    let ac = computeArmorClass(
      abilityModifiers.value.dex,
      armorName,
      hasShield,
      equip.armor,
    )
    // Defense fighting style: +1 AC mientras lleves armadura.
    if (char.featDefenseACBonus && armorName) ac += 1
    return ac
  })

  const initiative = computed(() => {
    // Alert: PB añadido al Initiative.
    return abilityModifiers.value.dex
      + (character.value.featInitiativeProf ? profBonus.value : 0)
  })

  const passivePerception = computed(() => {
    const base = 10 + abilityModifiers.value.wis
    const proficient = character.value.skillProficiencies.includes('perception')
    return base + (proficient ? profBonus.value : 0)
  })

  /** Suma total de bonuses de un atributo (especie + trasfondo + ASI). */
  function totalBonus(ability: keyof AbilityScores): number {
    const char = character.value
    return (char.speciesBonuses?.[ability] ?? 0)
      + (char.backgroundBonuses?.[ability] ?? 0)
      + (char.asiBonuses?.[ability] ?? 0)
  }

  function totalAbilityScore(ability: keyof AbilityScores): number {
    return (character.value.abilityScores?.[ability] ?? 10) + totalBonus(ability)
  }

  function resetCharacter() {
    character.value = createEmptyCharacter()
  }

  /** Maximum localStorage budget for saved characters (5 MB) */
  const MAX_STORAGE_BYTES = 5 * 1024 * 1024

  function saveCharacter() {
    // #117: registrar snapshot del nivel actual si el PJ está limpio.
    // No-op si quedan decisiones pendientes; se snapshoteará al volver a
    // guardar tras resolverlas.
    commitLevelSnapshot(character.value)

    const idx = savedCharacters.value.findIndex(c => c.id === character.value.id)
    const copy = JSON.parse(JSON.stringify(character.value))

    // Estimate storage size before saving
    const tentative = idx >= 0
      ? [...savedCharacters.value.slice(0, idx), copy, ...savedCharacters.value.slice(idx + 1)]
      : [...savedCharacters.value, copy]
    const estimatedSize = new Blob([JSON.stringify(tentative)]).size
    if (estimatedSize > MAX_STORAGE_BYTES) {
      throw new Error('STORAGE_LIMIT_EXCEEDED')
    }

    if (idx >= 0) {
      savedCharacters.value[idx] = copy
    } else {
      savedCharacters.value.push(copy)
    }
  }

  function loadCharacter(id: string) {
    const found = savedCharacters.value.find(c => c.id === id)
    if (found) {
      character.value = JSON.parse(JSON.stringify(found))
      // #139 Fase 1: si el PJ guardado es de antes del refactor multiclass,
      // poblamos classes[0] con los campos planos. Silencioso e idempotente.
      migrateCharacterToClassEntries(character.value)
      // #150: weapon/armor +N que se guardaron con kind='magic' pasan a
      // su kind real con magicItemId. Silencioso e idempotente.
      migrateInventoryPlusItems(character.value)
    }
  }

  function deleteCharacter(id: string) {
    savedCharacters.value = savedCharacters.value.filter(c => c.id !== id)
  }

  /** Whether current character is multiclass */
  const isMulticlass = computed(() => (character.value.classes ?? []).length >= 2)

  /**
   * Add a second (or third, etc.) class to the current D&D 5e character.
   * Only works for dnd5e variant.
   */
  /**
   * Add a second (or third, etc.) class to the current D&D 5e character.
   * Only works for dnd5e variant.
   *
   * #139 Fase 6 (M7): valida prereqs de habilidad del PHB 2024 (primary ability
   * ≥ 13 en TODAS las clases existentes Y en la nueva). Si fallan, no añade
   * y devuelve la lista de violaciones. La UI muestra el mensaje al jugador.
   */
  function addMulticlass(classId: string): { ok: true } | { ok: false; failures: string[] } {
    const char = character.value
    if (char.variant !== 'dnd5e') return { ok: false, failures: ['Multiclass only available for D&D 5e'] }

    const allClasses = getClasses(char.variant)
    const newCls = allClasses.find(c => c.id === classId)
    if (!newCls) return { ok: false, failures: [`Unknown class: ${classId}`] }

    // Don't add the same class twice
    if (char.classes.some(c => c.classId === classId)) return { ok: false, failures: [`${newCls.name} is already in this character.`] }
    // Caso PJ aún sin classes[]: si la clase nueva coincide con la primaria
    // del modelo plano, también es duplicado.
    if (char.classes.length === 0 && char.className === classId) {
      return { ok: false, failures: [`${newCls.name} is already in this character.`] }
    }

    // #139 Fase 6 (M7) — prereqs de habilidad.
    const prereqs = multiclassPrereqsSatisfied(char, newCls, allClasses)
    if (!prereqs.satisfied) {
      return { ok: false, failures: prereqs.failures }
    }

    // If classes array is empty, populate with current primary class first
    if (char.classes.length === 0) {
      char.classes.push({
        classId: char.className,
        subclass: char.subclass,
        level: char.level,
        hitDie: char.hitDie,
      })
    }

    // Add the new class at level 1
    char.classes.push({
      classId,
      subclass: '',
      level: 1,
      hitDie: newCls.hitDie,
    })

    // Recalculate total level
    char.level = char.classes.reduce((sum, c) => sum + c.level, 0)

    // #139 Fase 6 (M8) — Aplicar proficiencies parciales del PHB 2024.
    // Se añaden a classArmorProficiencies / classWeaponProficiencies /
    // classToolProficiencies (sin duplicar). No tocamos las skills sin
    // selección del jugador (skillFromList queda pendiente de UI; cuando
    // exista, se aplicará via característica skillProficiencies del PJ).
    const profs = getMulticlassProfs(classId)
    if (profs) {
      const mergeUnique = (target: string[], extras: readonly string[]): string[] => {
        const set = new Set(target)
        for (const x of extras) set.add(x)
        return Array.from(set)
      }
      char.classArmorProficiencies = mergeUnique(char.classArmorProficiencies ?? [], profs.armor)
      char.classWeaponProficiencies = mergeUnique(char.classWeaponProficiencies ?? [], profs.weapons)
      char.classToolProficiencies = mergeUnique(char.classToolProficiencies ?? [], profs.tools)
    }

    // H8: recalcular maxHp desde cero (en lugar de sumar el hp del nuevo nivel)
    recomputeMaxHp(char)
    char.currentHp = char.maxHp

    return { ok: true }
  }

  /**
   * Remove a secondary class from multiclass.
   * Cannot remove the primary class.
   */
  function removeMulticlass(classId: string) {
    const char = character.value
    if (char.classes.length < 2) return
    // Don't remove primary class
    if (char.classes[0]?.classId === classId) return

    char.classes = char.classes.filter(c => c.classId !== classId)

    // If only one class remains, keep classes populated (it's still valid)
    // Recalculate total level
    char.level = char.classes.reduce((sum, c) => sum + c.level, 0)

    // H8: recalcular HP desde cero (centralizado en recomputeMaxHp).
    recomputeMaxHp(char)
    char.currentHp = char.maxHp
  }

  /**
   * #139 Fase 2 (M9): reordena classes[] intercambiando dos índices.
   * Si el cambio afecta a classes[0] (la primaria), sincroniza también los
   * campos planos primarios (className, subclass, hitDie, spellcastingAbility)
   * para que el resto de la app, que todavía los lee, vea la nueva primaria.
   *
   * Sin efecto si los índices están fuera de rango o son el mismo.
   */
  function reorderClasses(fromIdx: number, toIdx: number) {
    const char = character.value
    const n = char.classes.length
    if (fromIdx === toIdx) return
    if (fromIdx < 0 || fromIdx >= n) return
    if (toIdx < 0 || toIdx >= n) return

    const arr = char.classes
    const moved = arr.splice(fromIdx, 1)[0]
    if (!moved) return
    arr.splice(toIdx, 0, moved)

    // Si el orden de la primaria cambió, refrescar los campos planos.
    const newPrimary = arr[0]
    if (newPrimary && (fromIdx === 0 || toIdx === 0)) {
      const allClasses = getClasses(char.variant)
      const newPrimaryCls = allClasses.find(c => c.id === newPrimary.classId)
      char.className = newPrimary.classId
      char.subclass = newPrimary.subclass
      char.hitDie = newPrimary.hitDie
      // Spellcasting ability del nuevo primario, si lo tiene definido en la
      // entrada o resolvible desde el catálogo de clases.
      if (newPrimary.spellcastingAbility) {
        char.spellcastingAbility = newPrimary.spellcastingAbility
        char.spellcastingClass = newPrimary.classId
      } else if (newPrimaryCls?.spellcasting) {
        char.spellcastingAbility = newPrimaryCls.spellcasting.ability
        char.spellcastingClass = newPrimary.classId
      } else {
        // Nueva primaria no caster: limpiamos.
        char.spellcastingAbility = ''
        char.spellcastingClass = ''
      }
    }
    // HP no cambia (es la suma de todas las clases, sin orden). Tampoco
    // los ASIs ni cantrips: solo el orden y los campos primarios planos.
  }

  /**
   * Level up the current character.
   * For multiclass characters, pass the classId to level up in.
   * Returns { hpGained, newFeatures } or null if at max level.
   */
  function levelUp(classId?: string): { hpGained: number; newFeatures: string[] } | null {
    const char = character.value
    const maxLv = getMaxLevel(char.variant)
    if (char.level >= maxLv) return null

    const conMod = modifier(
      char.abilityScores.con + totalBonus('con'),
    )
    const allClasses = getClasses(char.variant)
    let hitDieForLevel: number
    let targetClassId: string
    let targetSubclass: string

    if (char.classes.length >= 2 && classId) {
      // Multiclass: level up specific class
      const entry = char.classes.find(c => c.classId === classId)
      if (!entry) return null
      entry.level += 1
      char.level = char.classes.reduce((sum, c) => sum + c.level, 0)
      hitDieForLevel = entry.hitDie
      targetClassId = entry.classId
      targetSubclass = entry.subclass
    } else {
      // Single class or multiclass without specific target
      char.level += 1
      hitDieForLevel = char.hitDie
      targetClassId = char.className
      targetSubclass = char.subclass

      // Also update classes array entry if populated
      if (char.classes.length >= 1) {
        const entry = char.classes.find(c => c.classId === char.className)
        if (entry) entry.level += 1
      }
    }

    // HP gain: hitDie/2 + 1 + CON modifier
    const hpGained = hpPerLevel(hitDieForLevel, conMod)
    // H8: recalcular maxHp desde cero (canónico) en lugar de sumar
    // incrementalmente. Esto mantiene maxHp consistente si después se
    // cambia CON, ASI o feat Tough.
    recomputeMaxHp(char)
    char.currentHp = char.maxHp

    // Gather new features from the class/subclass leveled up
    const newFeatures: string[] = []
    const cls = allClasses.find(c => c.id === targetClassId)
    if (cls) {
      // Use the class-specific level for features
      const classLevel = char.classes.length >= 2
        ? (char.classes.find(c => c.classId === targetClassId)?.level ?? char.level)
        : char.level
      const classFeats = cls.features.filter(f => f.level === classLevel)
      for (const feat of classFeats) {
        if (!char.featuresTraits.includes(feat.name)) {
          char.featuresTraits.push(feat.name)
          newFeatures.push(feat.name)
        }
      }
      // Subclass features
      if (targetSubclass) {
        const sub = cls.subclasses.find(s => s.id === targetSubclass)
        if (sub) {
          const subFeats = sub.features.filter(f => f.level === classLevel)
          for (const feat of subFeats) {
            if (!char.featuresTraits.includes(feat.name)) {
              char.featuresTraits.push(feat.name)
              newFeatures.push(feat.name)
            }
          }
        }
      }
    }

    // #105: algunos grants raciales se activan al alcanzar lv.3 o lv.5
    // (Drow Faerie Fire, High Elf Detect Magic, Tiefling Hellish Rebuke, etc.).
    // Recalcular para que aparezcan en speciesGrantedCantrips/Spells.
    recomputeSpeciesGrants(char)

    // Auto-save if the character exists in saved list
    const idx = savedCharacters.value.findIndex(c => c.id === char.id)
    if (idx >= 0) {
      // #117: intentar commit antes de copiar. Si quedan pendientes, no-op.
      commitLevelSnapshot(char)
      savedCharacters.value[idx] = JSON.parse(JSON.stringify(char))
    }

    return { hpGained, newFeatures }
  }

  function exportJson(): string {
    return JSON.stringify(character.value, null, 2)
  }

  /**
   * Validates and imports a JSON character.
   * Returns { data, warnings } on success, throws with user-friendly messages on failure.
   */
  function importJson(json: string): { data: CharacterData; warnings: string[] } {
    let raw: Record<string, unknown>
    try {
      raw = JSON.parse(json)
    } catch {
      throw new Error('JSON_PARSE_ERROR')
    }

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error('JSON_NOT_OBJECT')
    }

    const warnings: string[] = []
    const errors: string[] = []

    // Validate variant
    const validVariants = ['dnd5e']
    if (!raw.variant || !validVariants.includes(raw.variant as string)) {
      errors.push('MISSING_VARIANT')
    }

    // Validate required string fields
    const requiredStrings: (keyof CharacterData)[] = ['race', 'className']
    for (const field of requiredStrings) {
      if (!raw[field] || typeof raw[field] !== 'string' || (raw[field] as string).trim() === '') {
        errors.push(`MISSING_${field.toUpperCase()}`)
      }
    }

    // Validate level
    if (raw.level === undefined || typeof raw.level !== 'number' || raw.level < 1 || raw.level > 20) {
      errors.push('INVALID_LEVEL')
    }

    // Validate ability scores
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
    if (!raw.abilityScores || typeof raw.abilityScores !== 'object') {
      errors.push('MISSING_ABILITY_SCORES')
    } else {
      const scores = raw.abilityScores as Record<string, unknown>
      for (const ab of abilities) {
        if (typeof scores[ab] !== 'number' || (scores[ab] as number) < 1 || (scores[ab] as number) > 30) {
          errors.push('INVALID_ABILITY_SCORES')
          break
        }
      }
    }

    // Validate arrays that should be arrays
    const arrayFields: (keyof CharacterData)[] = [
      'skillProficiencies', 'languages', 'equipment', 'featuresTraits',
      'cantrips', 'spellsKnown', 'spellsPrepared', 'weapons', 'classes',
      'inventory',
    ]
    for (const field of arrayFields) {
      if (raw[field] !== undefined && !Array.isArray(raw[field])) {
        errors.push(`INVALID_${field.toUpperCase()}`)
      }
    }

    if (errors.length > 0) {
      throw new Error('VALIDATION:' + errors.join(','))
    }

    // Build a valid character, filling in defaults for missing optional fields.
    // Whitelist explícito de claves permitidas (#82).
    //
    // Antes usábamos Object.keys(createEmptyCharacter()) como allowlist, pero
    // ese objeto sólo contiene los campos REQUERIDOS — los opcionales como
    // inventory, originFeatId, featAddedSavingThrows, magicInitiateChoices
    // etc. no aparecían y se descartaban en silencio al importar. Resultado:
    // un JSON exportado con inventario y feats acumulados perdía esa data al
    // re-importarlo.
    //
    // Esta lista debe mantenerse sincronizada con la interface CharacterData.
    const empty = createEmptyCharacter()
    const allowedKeys = new Set<string>([
      ...Object.keys(empty),
      // ─── Opcionales que se perdían (#82) ───
      'backgroundSkillProficiencies',
      'classSkillProficiencies',
      'classArmorProficiencies',
      'classWeaponProficiencies',
      'classToolProficiencies',
      'expertiseSources',
      'fightingStyleFeat',
      'martialCasterAlt',
      'originFeatId',
      'toughHpBonus',
      'featAddedSavingThrows',
      'featSpeedBonus',
      'featInitiativeProf',
      'featDefenseACBonus',
      'featAddedProficiencies',
      'featAddedSkillProficiencies',
      'featAddedExpertise',
      'magicInitiateChoices',
      'inventory',
      'weaponMasteries',
      'speciesGrantedCantrips',
      'speciesGrantedSpells',
      'levelHistory',
    ])
    const safeRaw: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (allowedKeys.has(key)) safeRaw[key] = value
    }

    // Deep-validate array contents: string arrays should contain only strings
    const stringArrayFields = [
      'skillProficiencies', 'skillExpertise', 'savingThrowProficiencies',
      'languages', 'proficienciesOther', 'equipment', 'featuresTraits',
      'cantrips', 'spellsKnown', 'spellsPrepared', 'weaponMasteries',
      'backgroundSkillProficiencies', 'classSkillProficiencies',
      'classArmorProficiencies', 'classWeaponProficiencies', 'classToolProficiencies',
      'speciesGrantedCantrips', 'speciesGrantedSpells',
    ] as const
    for (const field of stringArrayFields) {
      if (Array.isArray(safeRaw[field])) {
        safeRaw[field] = (safeRaw[field] as unknown[]).filter(
          (item): item is string => typeof item === 'string' && item.length < 500
        )
      }
    }

    // Validate weapons array contents
    if (Array.isArray(safeRaw.weapons)) {
      safeRaw.weapons = (safeRaw.weapons as unknown[]).filter((w): w is Weapon =>
        typeof w === 'object' && w !== null &&
        typeof (w as Record<string, unknown>).name === 'string' &&
        typeof (w as Record<string, unknown>).damage === 'string'
      )
    }

    // #117: validar levelHistory. Cada entrada debe ser { level, snapshotAt, snapshot }
    // con types correctos. snapshot es un objeto cualquiera (lo confiamos como
    // CharacterData; si está corrupto, el render lo mostrará vacío pero no
    // rompe la app). Entradas inválidas se descartan silenciosamente.
    if (Array.isArray(safeRaw.levelHistory)) {
      safeRaw.levelHistory = (safeRaw.levelHistory as unknown[]).filter(
        (s): s is LevelSnapshot =>
          typeof s === 'object' && s !== null &&
          typeof (s as Record<string, unknown>).level === 'number' &&
          typeof (s as Record<string, unknown>).snapshotAt === 'string' &&
          typeof (s as Record<string, unknown>).snapshot === 'object' &&
          (s as Record<string, unknown>).snapshot !== null
      )
    }

    // Validate classes array contents
    if (Array.isArray(safeRaw.classes)) {
      safeRaw.classes = (safeRaw.classes as unknown[]).filter((c): c is ClassEntry =>
        typeof c === 'object' && c !== null &&
        typeof (c as Record<string, unknown>).classId === 'string' &&
        typeof (c as Record<string, unknown>).level === 'number'
      )
    }

    // Validate inventory contents (#82). Item shape: { slotId, kind, itemId, name, qty }.
    // Si falta slotId (export antiguo) lo regeneramos para no perder el item.
    // #127: añadido 'gear' como kind reconocido (items oficiales del catálogo
    // adventuringGear; resolución por itemId=id en el catálogo).
    const validKinds = new Set(['weapon', 'armor', 'magic', 'gear', 'custom'])
    if (Array.isArray(safeRaw.inventory)) {
      safeRaw.inventory = (safeRaw.inventory as unknown[])
        .filter((i): i is Record<string, unknown> =>
          typeof i === 'object' && i !== null &&
          typeof (i as Record<string, unknown>).name === 'string' &&
          typeof (i as Record<string, unknown>).kind === 'string' &&
          validKinds.has((i as Record<string, unknown>).kind as string)
        )
        .map(i => ({
          slotId: typeof i.slotId === 'string' && i.slotId.length > 0 ? i.slotId : crypto.randomUUID(),
          kind: i.kind as 'weapon' | 'armor' | 'magic' | 'gear' | 'custom',
          itemId: typeof i.itemId === 'string' ? i.itemId : '',
          name: (i.name as string).slice(0, 200),
          qty: typeof i.qty === 'number' && i.qty > 0 ? Math.min(i.qty, 999) : 1,
          attuned: typeof i.attuned === 'boolean' ? i.attuned : undefined,
          notes: typeof i.notes === 'string' ? (i.notes as string).slice(0, 500) : undefined,
          weight: typeof i.weight === 'number' && Number.isFinite(i.weight) && i.weight >= 0 && i.weight <= 100000
            ? i.weight
            : undefined,
          // #118: campos nuevos. Boolean strict para evitar truthy raros.
          equipped: typeof i.equipped === 'boolean' ? i.equipped : undefined,
          // #123: stored y selectedSlot y isMagicalContainer.
          stored: typeof i.stored === 'boolean' ? i.stored : undefined,
          selectedSlot: typeof i.selectedSlot === 'string'
            && ['armor', 'shield', 'boots', 'gloves', 'belt', 'cloak', 'head', 'neck', 'ring', 'other'].includes(i.selectedSlot as string)
            ? (i.selectedSlot as SlotType)
            : undefined,
          isMagicalContainer: typeof i.isMagicalContainer === 'boolean' ? i.isMagicalContainer : undefined,
          customAcBonus: typeof i.customAcBonus === 'number' && i.customAcBonus >= -10 && i.customAcBonus <= 10
            ? i.customAcBonus
            : undefined,
        }))
      // #126 — Defensa: un container mágico nunca puede estar "stored"
      // (no se mete a sí mismo). Si llega así en el JSON importado, lo
      // limpiamos silenciosamente. Detectamos por catálogo (kind='magic'
      // con MagicItem.isContainer) o por flag custom (isMagicalContainer).
      const inventoryItems = safeRaw.inventory as Array<Record<string, unknown>>
      for (const item of inventoryItems) {
        let isContainer = false
        if (item.kind === 'magic' && typeof item.itemId === 'string') {
          const mi = getMagicItemById(item.itemId)
          isContainer = !!mi?.isContainer
        } else if (item.kind === 'custom') {
          isContainer = item.isMagicalContainer === true
        }
        if (isContainer && item.stored === true) {
          item.stored = false
        }
      }
    }

    // Truncate long strings to prevent abuse
    for (const [key, value] of Object.entries(safeRaw)) {
      if (typeof value === 'string' && value.length > 5000) {
        safeRaw[key] = (value as string).slice(0, 5000)
      }
    }

    const data: CharacterData = {
      ...empty,
      ...(safeRaw as Partial<CharacterData>),
      id: (typeof raw.id === 'string' && raw.id.length < 100) ? raw.id : crypto.randomUUID(),
      variant: raw.variant as GameVariant,
    }

    // Add warnings for optional missing fields
    if (!data.name) warnings.push('WARN_NO_NAME')
    if (!data.background) warnings.push('WARN_NO_BACKGROUND')
    if (data.maxHp <= 0) warnings.push('WARN_NO_HP')

    // #139 Fase 1: si el JSON importado es del modelo viejo, migrar.
    // Silencioso e idempotente.
    migrateCharacterToClassEntries(data)
    // #150: weapon/armor +N que se guardaron con kind='magic' pasan a su
    // kind real con magicItemId. Silencioso e idempotente.
    migrateInventoryPlusItems(data)

    character.value = data
    return { data, warnings }
  }

  return {
    character,
    savedCharacters,
    abilityModifiers,
    profBonus,
    armorClass,
    initiative,
    passivePerception,
    totalBonus,
    totalAbilityScore,
    resetCharacter,
    saveCharacter,
    loadCharacter,
    deleteCharacter,
    isMulticlass,
    addMulticlass,
    removeMulticlass,
    reorderClasses,
    levelUp,
    exportJson,
    importJson,
  }
}, {
  persist: {
    pick: ['character', 'savedCharacters'],
    // #139 Fase 1: tras rehidratar desde localStorage, migrar el PJ activo y
    // todos los guardados al modelo nuevo. Silencioso e idempotente.
    afterHydrate(ctx) {
      const store = ctx.store as unknown as {
        character: CharacterData
        savedCharacters: CharacterData[]
      }
      if (store.character) {
        migrateCharacterToClassEntries(store.character)
        migrateInventoryPlusItems(store.character)
      }
      if (Array.isArray(store.savedCharacters)) {
        for (const c of store.savedCharacters) {
          migrateCharacterToClassEntries(c)
          migrateInventoryPlusItems(c)
        }
      }
    },
  },
})
