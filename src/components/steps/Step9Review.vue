<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCharacterStore } from '@/stores/character'
import { formatModifier, spellSaveDC, spellAttackBonus, feetToMeters } from '@/utils/calculations'
import { usePdfExport } from '@/composables/usePdfExport'
import { copyShareUrl } from '@/utils/shareCharacter'
import { SKILLS } from '@/data/dnd5e/skills'
import { getSpells, getClasses, getBackgrounds, getMaxLevel, getSpellsKnownCount, getMaxSpellLevel } from '@/data'
import { useGameTerms } from '@/composables/useGameTerms'
import EquipmentManager from '@/components/shared/EquipmentManager.vue'
import AsiSelector from '@/components/shared/AsiSelector.vue'
import WeaponMasteryPicker from '@/components/shared/WeaponMasteryPicker.vue'
import FightingStylePicker from '@/components/shared/FightingStylePicker.vue'
import ExpertisePicker from '@/components/shared/ExpertisePicker.vue'
import SpellRow from '@/components/shared/SpellRow.vue'
import LevelHistoryPanel from '@/components/shared/LevelHistoryPanel.vue'
import { feats } from '@/data/dnd5e/feats'
import { pendingLevelDecisions } from '@/utils/levelUpGating'
import { buildExportFilename } from '@/utils/exportFilename'
import { computeCurrentLoad } from '@/utils/carryingLoad'
import {
  describeAsiFeatChoice, describeOriginFeatChoice, describeFightingStyle,
} from '@/utils/featChoiceDescription'

const { t } = useI18n()
const characterStore = useCharacterStore()
const { exportPdf, exporting } = usePdfExport()
const gt = useGameTerms()

const char = computed(() => characterStore.character)
const mods = computed(() => characterStore.abilityModifiers)
const prof = computed(() => characterStore.profBonus)
const currentLoad = computed(() => computeCurrentLoad(char.value))
const isEncumbered = computed(() => currentLoad.value.status !== 'Unencumbered')

const saveMessage = ref<{ type: 'success' | 'info'; text: string } | null>(null)

const savingThrows = computed(() => {
  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
  return abilities.map(a => ({
    ability: a,
    value: mods.value[a] + (char.value.savingThrowProficiencies.includes(a) ? prof.value : 0),
    proficient: char.value.savingThrowProficiencies.includes(a),
  }))
})

const skills = computed(() => {
  return SKILLS.map(skill => {
    const abilityMod = mods.value[skill.ability as keyof typeof mods.value]
    const proficient = char.value.skillProficiencies.includes(skill.id)
    const expert = char.value.skillExpertise.includes(skill.id)
    let bonus = abilityMod
    if (proficient) bonus += prof.value
    if (expert) bonus += prof.value
    return { ...skill, bonus, proficient, expert }
  })
})

const spellDC = computed(() => {
  if (!char.value.spellcastingAbility) return 0
  const abilityMod = mods.value[char.value.spellcastingAbility as keyof typeof mods.value]
  return spellSaveDC(prof.value, abilityMod)
})

const spellAtk = computed(() => {
  if (!char.value.spellcastingAbility) return 0
  const abilityMod = mods.value[char.value.spellcastingAbility as keyof typeof mods.value]
  return spellAttackBonus(prof.value, abilityMod)
})

const allSpells = computed(() => getSpells(char.value.variant))

function spellName(id: string): string {
  const spell = allSpells.value.find(s => s.id === id)
  return spell ? gt.spell(spell.name) : id
}

const variantClasses = computed(() => getClasses(char.value.variant))
const variantBackgrounds = computed(() => getBackgrounds(char.value.variant))
const className = computed(() => {
  const cls = variantClasses.value.find(c => c.id === char.value.className)
  return gt.className(cls?.name ?? char.value.className, char.value.variant)
})
const subclassName = computed(() => {
  if (!char.value.subclass) return ''
  const cls = variantClasses.value.find(c => c.id === char.value.className)
  return cls?.subclasses.find(s => s.id === char.value.subclass)?.name ?? char.value.subclass
})

// Selector de subclase — visible cuando nivel ≥ subclassLevel.
// Antes solo se mostraba si NO había subclase; eso impedía cambiarla
// una vez escogida (bug #70). Ahora se muestra siempre que esté desbloqueada,
// resaltando la actual y permitiendo seleccionar otra.
const currentClassObj = computed(() =>
  variantClasses.value.find(c => c.id === char.value.className) ?? null
)
const subclassUnlockedReview = computed(() =>
  !!currentClassObj.value && char.value.level >= (currentClassObj.value.subclassLevel ?? 3)
)
const showSubclassSelectorReview = computed(() =>
  subclassUnlockedReview.value && !!currentClassObj.value?.subclasses?.length
)
const subclassMissingReview = computed(() =>
  subclassUnlockedReview.value && !!currentClassObj.value?.subclasses?.length && !char.value.subclass
)

// ── Selector de hechizos (#41) ────────────────────────────────────────────
// Para preparadores (Clérigo, Druida, Paladín, etc.) muestra selector cuando
// el jugador no ha visitado Step7 y tiene slots disponibles.
const maxSpellsReview = computed(() =>
  getSpellsKnownCount(char.value.className, char.value.level, characterStore.abilityModifiers)
)
const spellSlotsAvailable = computed(() =>
  maxSpellsReview.value > 0 && char.value.spellsKnown.length < maxSpellsReview.value
)
const spellSearchReview = ref('')
const spellLevelFilterReview = ref<number | null>(null)

const availableSpellsReview = computed(() => {
  const cls = char.value.className
  const maxLv = getMaxSpellLevel(cls, char.value.level)
  return allSpells.value.filter(s => s.classes.includes(cls) && s.level > 0 && s.level <= maxLv)
})

const filteredSpellsReview = computed(() => {
  let list = availableSpellsReview.value
  if (spellLevelFilterReview.value !== null)
    list = list.filter(s => s.level === spellLevelFilterReview.value)
  const q = spellSearchReview.value.toLowerCase().trim()
  if (q) list = list.filter(s => s.name.toLowerCase().includes(q))
  return list
})

function toggleSpellReview(spellId: string) {
  const arr = char.value.spellsKnown
  const idx = arr.indexOf(spellId)
  if (idx >= 0) {
    arr.splice(idx, 1)
  } else if (arr.length < maxSpellsReview.value) {
    arr.push(spellId)
  }
}

const spellLevelsReview = computed(() =>
  [...new Set(availableSpellsReview.value.map(s => s.level))].sort((a, b) => a - b)
)
const displayRace = computed(() =>
  // #100: helper unificado — solo subespecie si existe, sino solo el nombre
  // de la especie. Antes se mostraba "Gnome (Forest Gnome)" — redundante.
  gt.speciesDisplay(char.value.race, char.value.subrace),
)
const displayBackground = computed(() => {
  const bg = variantBackgrounds.value.find(b => b.id === char.value.background)
  if (!bg) return char.value.background
  if ((bg as any).nameOriginal) return (bg as any).nameOriginal
  return gt.background(bg.name)
})

// Multiclass display (defensive: classes may be undefined for old saved characters)
const multiclassDisplay = computed(() => {
  const classes = char.value.classes ?? []
  if (classes.length < 2) return ''
  return classes
    .map(c => {
      const cls = variantClasses.value.find(cl => cl.id === c.classId)
      const name = cls ? gt.className(cls.name, char.value.variant) : c.classId
      return `${name} ${c.level}`
    })
    .join(' / ')
})

const hitDiceDisplay = computed(() => {
  const classes = char.value.classes ?? []
  if (classes.length < 2) {
    return `${char.value.level}d${char.value.hitDie}`
  }
  return classes
    .map(c => `${c.level}d${c.hitDie}`)
    .join(' + ')
})

/** #101 + #107 — Features & Traits a mostrar: lo que hay en char.featuresTraits
 *  enriquecido con (a) Fighting Style (que vive en char.fightingStyleFeat) y
 *  (b) la elección hecha en cada feat con choices (Resilient (WIS), Skilled
 *  (Athletics, Stealth, Perception), Fighting Style: Archery — +2 to ranged...).
 *  Sin esto, dos Resilient se mostraban como dos tags idénticos. */
const featureTraitsDisplay = computed<string[]>(() => {
  const out: string[] = []
  const tags = char.value.featuresTraits ?? []

  for (const tag of tags) {
    // ASI Feat: <Name> (lv.N) → enriquecer con la elección del checkpoint N.
    const asi = tag.match(/^ASI Feat:\s*(.+?)\s*\(lv\.(\d+)\)\s*$/i)
    if (asi && asi[1] && asi[2]) {
      const featName = asi[1].trim()
      const lvl = Number(asi[2])
      const f = feats.find(x => x.name === featName)
      const choice = char.value.asiChoices?.find(c => c.level === lvl && c.type === 'feat' && c.featId === f?.id)
      if (f && choice) {
        const chosen = describeAsiFeatChoice(choice, char.value)
        out.push(chosen ? `ASI Feat: ${f.name} (${chosen}, lv.${lvl})` : tag)
        continue
      }
    }

    // Origin Feat: <Name> → enriquecer con la elección del background.
    const orig = tag.match(/^Origin Feat:\s*(.+)$/i)
    if (orig && orig[1]) {
      const featName = orig[1].trim()
      const f = feats.find(x => x.name === featName)
      if (f) {
        const chosen = describeOriginFeatChoice(f.id, char.value)
        out.push(chosen ? `Origin Feat: ${f.name} (${chosen})` : tag)
        continue
      }
    }

    // Cualquier otro tag pasa intacto.
    out.push(tag)
  }

  // Fighting Style (vive en char.fightingStyleFeat, no en featuresTraits).
  const fsId = char.value.fightingStyleFeat
  if (fsId) {
    const f = feats.find(x => x.id === fsId)
    if (f) {
      const desc = describeFightingStyle(fsId)
      out.push(desc ? `Fighting Style: ${f.name} — ${desc}` : `Fighting Style: ${f.name}`)
    }
  }

  return out
})


// Apocalisse display helpers

/**
 * Given a featuresTraits string like "ASI Feat: Resilient (WIS, lv.6)" or
 * "Origin Feat: Magic Initiate (Cleric: Guidance Resistance Bless)" or
 * "Fighting Style: Archery — +2 to ranged weapon attack rolls",
 * returns the feat description if found, or null.
 *
 * #107 — Los tags ahora pueden incluir la elección entre paréntesis o tras
 * un guión largo. Los regex toleran ambos formatos.
 */
function featDescriptionFromTag(tag: string): string | null {
  // 0. Fighting Style: <Name>[ — <effect>]
  //    Reconoce tanto el viejo formato ("Fighting Style: Archery") como el
  //    enriquecido ("Fighting Style: Archery — +2 to ...").
  const fsMatch = tag.match(/^Fighting Style:\s*([^—(]+?)(?:\s*—.*|\s*\(.*\))?\s*$/)
  if (fsMatch) {
    const name = (fsMatch[1] ?? '').trim()
    const feat = feats.find(f => f.name === name)
    if (feat?.description) return feat.description
  }

  // 1. ASI Feat / Origin Feat / Feat: <Name>[ (...)]
  //    El paréntesis ahora puede contener (a) lv.N, (b) la elección + lv.N,
  //    o (c) solo la elección. Cogemos el nombre antes del primer paréntesis.
  const match = tag.match(/^(?:ASI |Origin )?Feat:\s*([^(]+?)(?:\s*\(.*\))?\s*$/)
  if (match) {
    const name = (match[1] ?? '').trim()
    const feat = feats.find(f => f.name === name)
    if (feat?.description) return feat.description
  }

  // 2. Buscar en class features del personaje (nombre exacto)
  const cls = variantClasses.value.find(c => c.id === char.value.className)
  if (cls) {
    const cf = cls.features.find(f => f.name === tag)
    if (cf?.description) return cf.description

    // 3. Buscar en subclass features
    const sub = cls.subclasses.find(s => s.id === char.value.subclass)
    if (sub) {
      const sf = sub.features.find(f => f.name === tag)
      if (sf?.description) return sf.description
    }
  }

  return null
}

function saveChar() {
  characterStore.saveCharacter()
  saveMessage.value = { type: 'success', text: t('review.saveSuccess') }
  setTimeout(() => { saveMessage.value = null }, 3000)
}

async function downloadJson() {
  const json = characterStore.exportJson()
  const suggestedName = buildExportFilename(char.value)

  // Navegadores Chromium modernos: showSaveFilePicker permite al usuario editar
  // el nombre antes de guardar. Si no está disponible (Firefox, Safari, etc.),
  // caemos al patrón clásico de <a download>, que en la mayoría de navegadores
  // abre el "Save As" donde también se puede editar el nombre.
  const w = window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName: string
      types: Array<{ description: string; accept: Record<string, string[]> }>
    }) => Promise<{ createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }> }>
  }
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName,
        types: [{
          description: 'D&D character JSON',
          accept: { 'application/json': ['.json'] },
        }],
      })
      const writable = await handle.createWritable()
      await writable.write(json)
      await writable.close()
      return
    } catch (e: unknown) {
      // El usuario canceló o el navegador no soporta — caer al fallback.
      const err = e as { name?: string }
      if (err.name === 'AbortError') return
      // cualquier otro error → fallback
    }
  }

  // Fallback: <a download>
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  a.click()
  URL.revokeObjectURL(url)
}

function printSheet() {
  window.print()
}

const shareMessage = ref<{ type: 'success' | 'error'; text: string; url?: string } | null>(null)

async function shareCharacter() {
  try {
    const result = await copyShareUrl(char.value)
    if (result.copied) {
      shareMessage.value = { type: 'success', text: t('review.shareCopied') }
      setTimeout(() => { shareMessage.value = null }, 5000)
    } else {
      // Clipboard failed — show the URL so user can copy manually
      shareMessage.value = { type: 'success', text: t('review.shareManual'), url: result.url }
    }
  } catch {
    shareMessage.value = { type: 'error', text: t('review.shareFailed') }
    setTimeout(() => { shareMessage.value = null }, 5000)
  }
}

const pendingDecisions = computed(() => pendingLevelDecisions(char.value))
const isMaxLevel = computed(() => char.value.level >= getMaxLevel(char.value.variant))

// ─── Bug B: Picker inline para cantrips/spells pendientes en Review ──────
// Cuando un PJ caster llega a Step 9 con cantrips o spells incompletos (por
// import de JSON antiguo, o por subida de nivel que sumó cantrips/spells y
// el wizard ya no se muestra por #116), aquí hay un selector para resolverlo.
// La lista se filtra al spell-list de la clase y al nivel máximo de slot.

const hasPendingCantrips = computed(() =>
  pendingDecisions.value.some(p => p.key === 'cantrips')
)
const hasPendingSpells = computed(() =>
  pendingDecisions.value.some(p => p.key === 'spells-known' || p.key === 'spells-prepared')
)

const allSpellsForCharacter = computed(() => {
  // Lista plana de spells del catálogo activo, filtrada por las clases caster
  // que tiene el PJ y por el nivel máximo de slot disponible.
  const variant = char.value.variant
  const spells = getSpells(variant)
  const classIds: string[] = char.value.classes?.length
    ? char.value.classes.map(c => c.classId)
    : [char.value.className]
  const maxLv = char.value.classes?.length
    ? Math.max(0, ...char.value.classes.map(e => getMaxSpellLevel(e.classId, e.level)))
    : getMaxSpellLevel(char.value.className, char.value.level)
  return spells.filter(s => {
    if (!classIds.some(cls => s.classes.includes(cls))) return false
    if (s.level > 0 && s.level > maxLv) return false
    return true
  })
})

const pickerCantripsAvailable = computed(() =>
  allSpellsForCharacter.value
    .filter(s => s.level === 0 && !(char.value.cantrips ?? []).includes(s.id))
    .sort((a, b) => a.name.localeCompare(b.name))
)
const pickerSpellsAvailable = computed(() =>
  allSpellsForCharacter.value
    .filter(s => s.level > 0 && !(char.value.spellsKnown ?? []).includes(s.id))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
)

function addCantripFromPicker(spellId: string): void {
  if (!char.value.cantrips) char.value.cantrips = []
  if (!char.value.cantrips.includes(spellId)) {
    char.value.cantrips.push(spellId)
  }
}
function addSpellFromPicker(spellId: string): void {
  if (!char.value.spellsKnown) char.value.spellsKnown = []
  if (!char.value.spellsKnown.includes(spellId)) {
    char.value.spellsKnown.push(spellId)
  }
}

const canLevelUp = computed(() => !isMaxLevel.value && pendingDecisions.value.length === 0)
const levelUpBlockedReason = computed(() => {
  if (isMaxLevel.value) return t('characters.maxLevel')
  if (pendingDecisions.value.length > 0) {
    return t('characters.levelUpBlocked', { count: pendingDecisions.value.length })
  }
  return ''
})
const levelUpMessage = ref<string | null>(null)

function doLevelUp() {
  // Defensive: guard against keyboard-driven or stale-state clicks.
  if (!canLevelUp.value) return
  const result = characterStore.levelUp()
  if (!result) {
    levelUpMessage.value = t('characters.maxLevel')
  } else {
    const parts = [`+${result.hpGained} HP`]
    if (result.newFeatures.length > 0) {
      parts.push(result.newFeatures.join(', '))
    }
    levelUpMessage.value = t('characters.levelUpSuccess', { details: parts.join(' | ') })
  }
  setTimeout(() => { levelUpMessage.value = null }, 5000)
}

const fileInput = ref<HTMLInputElement | null>(null)

function triggerImport() {
  fileInput.value?.click()
}

function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      characterStore.importJson(e.target?.result as string)
    } catch (err) {
      const msg = (err as Error).message
      if (msg.startsWith('VALIDATION:')) {
        const codes = msg.replace('VALIDATION:', '').split(',')
        alert(codes.map(c => t(`import.${c}`)).join('\n'))
      } else {
        alert(t(`import.${msg}`, t('import.unknownError')))
      }
    }
  }
  reader.readAsText(file)
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <section aria-labelledby="review-heading">
    <h2 id="review-heading" class="text-2xl font-bold text-amber-500 mb-6">{{ t('review.title') }}</h2>

    <!-- Header -->
    <div class="bg-stone-800 border border-stone-700 rounded-lg p-6 mb-4">
      <div class="flex flex-wrap gap-6">
        <div>
          <p class="text-xs text-stone-500 uppercase">{{ t('review.charName') }}</p>
          <p class="text-xl font-bold text-amber-400">{{ char.name || '--' }}</p>
        </div>
        <div>
          <p class="text-xs text-stone-500 uppercase">{{ t('review.classLevel') }}</p>
          <p class="text-stone-200">{{ multiclassDisplay || `${className} ${char.level}` }}</p>
          <p v-if="!multiclassDisplay && subclassName" class="text-xs text-stone-500">{{ subclassName }}</p>
          <!-- Selector de subclase — aparece cuando nivel ≥ subclassLevel.
               Permite cambiar la subclase incluso si ya hay una elegida (bug #70). -->
          <div v-if="showSubclassSelectorReview" class="mt-2">
            <p class="text-xs mb-1" :class="subclassMissingReview ? 'text-amber-500' : 'text-stone-500'">
              <template v-if="subclassMissingReview">⚠ Elige tu {{ currentClassObj!.subclassName }}:</template>
              <template v-else>{{ currentClassObj!.subclassName }}:</template>
            </p>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="sub in currentClassObj!.subclasses"
                :key="sub.id"
                @click="characterStore.character.subclass = sub.id"
                class="px-2 py-0.5 rounded text-xs cursor-pointer transition-colors"
                :class="characterStore.character.subclass === sub.id
                  ? 'bg-amber-600 text-stone-900 font-medium'
                  : 'bg-stone-700 text-stone-300 hover:bg-amber-600 hover:text-stone-900'"
              >{{ sub.name }}</button>
            </div>
          </div>
        </div>
        <div>
          <p class="text-xs text-stone-500 uppercase">{{ t('review.charRace') }}</p>
          <p class="text-stone-200">{{ displayRace }}</p>
        </div>
        <div>
          <p class="text-xs text-stone-500 uppercase">{{ t('review.charBackground') }}</p>
          <p class="text-stone-200">{{ displayBackground }}</p>
        </div>
        <div>
          <p class="text-xs text-stone-500 uppercase">{{ t('details.alignment') }}</p>
          <p class="text-stone-200">{{ char.alignment ? t(`alignments.${char.alignment}`) : '--' }}</p>
        </div>
      </div>
    </div>

    <!-- Combat Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-4">
      <div class="bg-stone-800 border border-amber-700/30 rounded-lg p-3 text-center">
        <p class="text-xs text-stone-500">{{ t('review.ac') }}</p>
        <p class="text-2xl font-bold text-amber-400">{{ characterStore.armorClass }}</p>
      </div>
      <div class="bg-stone-800 border border-stone-700 rounded-lg p-3 text-center">
        <p class="text-xs text-stone-500">{{ t('review.initiative') }}</p>
        <p class="text-2xl font-bold text-stone-200">{{ formatModifier(characterStore.initiative) }}</p>
      </div>
      <div class="bg-stone-800 border border-stone-700 rounded-lg p-3 text-center">
        <p class="text-xs text-stone-500">{{ t('review.speed') }}</p>
        <p class="text-2xl font-bold text-stone-200">{{ feetToMeters(char.speed) }}m</p>
      </div>
      <div class="bg-stone-800 border border-red-700/30 rounded-lg p-3 text-center">
        <p class="text-xs text-stone-500">{{ t('review.hp') }}</p>
        <p class="text-2xl font-bold text-red-400">{{ char.maxHp }}</p>
      </div>
      <div class="bg-stone-800 border border-stone-700 rounded-lg p-3 text-center">
        <p class="text-xs text-stone-500">{{ t('review.hitDie') }}</p>
        <p class="text-lg font-bold text-stone-200">{{ hitDiceDisplay }}</p>
      </div>
      <div class="bg-stone-800 border border-stone-700 rounded-lg p-3 text-center">
        <p class="text-xs text-stone-500">{{ t('review.proficiencyBonus') }}</p>
        <p class="text-2xl font-bold text-stone-200">{{ formatModifier(prof) }}</p>
      </div>
    </div>

    <!-- Ability Scores -->
    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
      <div v-for="a in (['str','dex','con','int','wis','cha'] as const)" :key="a"
        class="bg-stone-800 border border-stone-700 rounded-lg p-3 text-center">
        <p class="text-xs text-stone-500 uppercase">{{ t(`abilities.${a}`) }}</p>
        <p class="text-xl font-bold text-stone-200">{{ characterStore.totalAbilityScore(a) }}</p>
        <p class="text-sm text-amber-400">{{ formatModifier(mods[a]) }}</p>
      </div>
    </div>

    <!-- Saving Throws & Skills -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div class="bg-stone-800 border border-stone-700 rounded-lg p-4">
        <h3 class="font-semibold text-stone-300 mb-2">{{ t('review.savingThrows') }}</h3>
        <!-- UX: una sola columna; las 6 saving throws caben perfectamente. -->
        <div class="flex flex-col gap-y-1 text-sm">
          <div v-for="st in savingThrows" :key="st.ability" class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full" :class="st.proficient ? 'bg-amber-500' : 'bg-stone-600'" :aria-label="st.proficient ? 'Proficient' : 'Not proficient'" role="img"></span>
            <span class="text-stone-400 uppercase w-8">{{ st.ability }}</span>
            <span class="text-stone-200 font-medium">{{ formatModifier(st.value) }}</span>
          </div>
        </div>
      </div>

      <div class="bg-stone-800 border border-stone-700 rounded-lg p-4">
        <h3 class="font-semibold text-stone-300 mb-2">{{ t('review.skills') }}</h3>
        <!-- UX: CSS multi-column rellena por columna (Acrobatics, Animal Handling,
             Arcana... bajan por la primera columna y luego saltan a la segunda).
             break-inside-avoid evita que un item se parta entre columnas. -->
        <div class="columns-2 gap-x-4 text-xs">
          <div v-for="skill in skills" :key="skill.id" class="flex items-center gap-2 break-inside-avoid mb-1">
            <span class="w-2.5 h-2.5 rounded-full" :class="skill.proficient ? 'bg-amber-500' : 'bg-stone-600'" :aria-label="skill.proficient ? 'Proficient' : 'Not proficient'" role="img"></span>
            <span class="text-stone-400 flex-1">{{ gt.skill(skill.name) }}</span>
            <span class="text-stone-200 font-medium">{{ formatModifier(skill.bonus) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Spells -->
    <div
      v-if="char.spellcastingAbility || (char.speciesGrantedCantrips?.length ?? 0) > 0 || (char.speciesGrantedSpells?.length ?? 0) > 0"
      class="bg-stone-800 border border-stone-700 rounded-lg p-4 mb-4"
    >
      <h3 class="font-semibold text-stone-300 mb-2">{{ t('spells.title') }}</h3>
      <div v-if="char.spellcastingAbility" class="flex gap-4 text-sm mb-3">
        <span class="text-stone-400">{{ t('spells.spellSaveDC') }}: <strong class="text-amber-400">{{ spellDC }}</strong></span>
        <span class="text-stone-400">{{ t('spells.spellAttackBonus') }}: <strong class="text-amber-400">{{ formatModifier(spellAtk) }}</strong></span>
      </div>
      <div v-if="char.cantrips.length || (char.speciesGrantedCantrips?.length ?? 0) > 0" class="mb-2">
        <span class="text-xs text-stone-500">{{ t('spells.cantrips') }}:</span>
        <span class="text-stone-300 text-sm ml-1">{{ char.cantrips.map(spellName).join(', ') }}</span>
        <span v-if="(char.speciesGrantedCantrips?.length ?? 0) > 0" class="text-stone-300 text-sm">
          <span v-if="char.cantrips.length">, </span>
          <span v-for="(id, i) in (char.speciesGrantedCantrips ?? [])" :key="id">
            <span v-if="i > 0">, </span>{{ spellName(id) }}
            <span class="text-xs text-amber-500">(Race)</span>
          </span>
        </span>
      </div>
      <div v-if="char.spellsKnown.length || (char.speciesGrantedSpells?.length ?? 0) > 0">
        <span class="text-xs text-stone-500">{{ t('spells.knownSpells') }}:</span>
        <span class="text-stone-300 text-sm ml-1">{{ char.spellsKnown.map(spellName).join(', ') }}</span>
        <span v-if="(char.speciesGrantedSpells?.length ?? 0) > 0" class="text-stone-300 text-sm">
          <span v-if="char.spellsKnown.length">, </span>
          <span v-for="(id, i) in (char.speciesGrantedSpells ?? [])" :key="id">
            <span v-if="i > 0">, </span>{{ spellName(id) }}
            <span class="text-xs text-amber-500">(Race)</span>
          </span>
        </span>
      </div>
    </div>

    <!-- Weapons & Armor -->
    <div v-if="char.weapons.length || char.armor || char.equipment.length" class="bg-stone-800 border border-stone-700 rounded-lg p-4 mb-4">
      <div v-if="char.armor || char.shield" class="mb-3">
        <h4 class="font-semibold text-stone-300 mb-1">{{ t('review.armorLabel') }}</h4>
        <div class="flex gap-3 text-sm">
          <span v-if="char.armor" class="text-stone-300">{{ gt.armorName(char.armor) }}</span>
          <span v-if="char.shield" class="text-amber-400">{{ t('review.shieldBonus') }}</span>
          <span v-if="!char.armor && !char.shield" class="text-stone-500">{{ t('review.noArmor') }}</span>
        </div>
      </div>

      <div v-if="char.weapons.length" class="mb-3">
        <h4 class="font-semibold text-stone-300 mb-1">{{ t('review.attacks') }}</h4>
        <div class="space-y-1">
          <div v-for="(wpn, i) in char.weapons" :key="i" class="flex gap-4 text-sm">
            <span class="text-amber-400 font-medium w-36">{{ gt.weapon(wpn.name) }}</span>
            <span class="text-stone-400 w-12">{{ formatModifier(wpn.attackBonus) }}</span>
            <span class="text-stone-300">{{ wpn.damage }}</span>
          </div>
        </div>
      </div>

      <div v-if="char.equipment.length">
        <h4 class="font-semibold text-stone-300 mb-1">{{ t('equipment.title') }}</h4>
        <p class="text-stone-400 text-sm">{{ char.equipment.join(', ') }}</p>
      </div>
    </div>

    <!-- Current Load warning (#weight) -->
    <div
      v-if="isEncumbered"
      class="bg-amber-950/50 border border-amber-700 rounded-lg p-3 mb-4 text-amber-200"
      role="alert"
    >
      <p class="font-semibold">Encumbrance warning: {{ currentLoad.status }}</p>
      <p class="text-sm text-amber-100/80">
        Current Load: {{ currentLoad.total }} lbs ({{ currentLoad.totalKg }} kg),
        {{ currentLoad.capacityUsedPct }}% of {{ currentLoad.capacity }} lbs capacity.
      </p>
    </div>

    <!-- Equipment Manager — full inventory with magic items, filters, attunement -->
    <div class="mb-4">
      <EquipmentManager />
    </div>

    <!-- ASI / Feat Checkpoints -->
    <AsiSelector class="mb-4" />

    <!-- #89: Weapon Mastery -->
    <WeaponMasteryPicker class="mb-4" />

    <!-- #94: Fighting Style -->
    <FightingStylePicker class="mb-4" />

    <!-- H5: Expertise (Bard lv.2, lv.10) -->
    <ExpertisePicker class="mb-4" />

    <!-- Selector de hechizos (#41) — visible cuando hay slots sin usar -->
    <div v-if="spellSlotsAvailable" class="bg-stone-800/50 border border-blue-700/30 rounded-lg p-4 mb-4">
      <h3 class="text-lg font-bold text-blue-400 mb-1">
        Spells
        <span class="text-stone-500 text-xs font-normal ml-2">
          ({{ char.spellsKnown.length }}/{{ maxSpellsReview }} prepared)
        </span>
      </h3>
      <p class="text-xs text-stone-500 mb-3">
        Choose your prepared spells. As a prepared caster you can swap them on a Long Rest.
      </p>

      <!-- Hechizos ya preparados -->
      <div v-if="char.spellsKnown.length" class="flex flex-wrap gap-1 mb-3">
        <span v-for="id in char.spellsKnown" :key="id"
          class="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-900/40 border border-blue-700/40 text-xs text-blue-300">
          {{ spellName(id) }}
          <button @click="toggleSpellReview(id)" class="text-blue-500 hover:text-red-400 cursor-pointer ml-1">✕</button>
        </span>
      </div>

      <!-- Filtros -->
      <div class="flex gap-2 mb-2">
        <input v-model="spellSearchReview" type="text" placeholder="Search spells…"
          class="flex-1 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 placeholder-stone-500 focus:border-blue-500 focus:outline-none" />
        <select v-model="spellLevelFilterReview"
          class="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-stone-200 cursor-pointer">
          <option :value="null">All levels</option>
          <option v-for="lv in spellLevelsReview" :key="lv" :value="lv">Level {{ lv }}</option>
        </select>
      </div>

      <!-- Lista de hechizos -->
      <div class="max-h-72 overflow-y-auto border border-stone-700 rounded bg-stone-900/60 p-1 space-y-1">
        <SpellRow
          v-for="spell in filteredSpellsReview"
          :key="spell.id"
          :spell="spell"
          :selected="char.spellsKnown.includes(spell.id)"
          :disabled="char.spellsKnown.length >= maxSpellsReview"
          @toggle="toggleSpellReview(spell.id)"
        />
      </div>
    </div>

    <!-- Features & Traits -->
    <div v-if="featureTraitsDisplay.length" class="bg-stone-800 border border-stone-700 rounded-lg p-4 mb-4">
      <h3 class="font-semibold text-stone-300 mb-2">{{ t('class.features') }}</h3>
      <div class="space-y-2">
        <div v-for="(tag, i) in featureTraitsDisplay" :key="i" class="text-sm">
          <span class="text-stone-400">{{ gt.feature(tag) }}</span>
          <p v-if="featDescriptionFromTag(tag)" class="text-xs text-stone-500 italic mt-0.5 ml-2">
            {{ featDescriptionFromTag(tag) }}
          </p>
        </div>
      </div>
    </div>



    <!-- Session Notes -->
    <div v-if="char.sessionNotes" class="bg-stone-800 border border-stone-700 rounded-lg p-4 mb-4">
      <h3 class="font-semibold text-stone-300 mb-2">{{ t('details.sessionNotes') }}</h3>
      <p class="text-stone-400 text-sm whitespace-pre-wrap">{{ char.sessionNotes }}</p>
    </div>

    <!-- Save/Share confirmation banner -->
    <Transition name="fade">
      <div
        v-if="saveMessage"
        class="mt-4 p-3 rounded-lg border flex items-center gap-3 bg-green-900/30 border-green-700 text-green-300"
        role="status"
        aria-live="polite"
      >
        <span class="text-xl" aria-hidden="true">✅</span>
        <p class="flex-1 text-sm">{{ saveMessage.text }}</p>
      </div>
    </Transition>
    <Transition name="fade">
      <div
        v-if="shareMessage"
        :class="[
          'mt-4 p-3 rounded-lg border flex items-center gap-3',
          shareMessage.type === 'success' ? 'bg-blue-900/30 border-blue-700 text-blue-300' : 'bg-red-900/30 border-red-700 text-red-300'
        ]"
        role="status"
        aria-live="polite"
      >
        <span class="text-xl" aria-hidden="true">{{ shareMessage.type === 'success' ? '🔗' : '❌' }}</span>
        <div class="flex-1">
          <p class="text-sm">{{ shareMessage.text }}</p>
          <input v-if="shareMessage.url" type="text" :value="shareMessage.url" readonly
            class="mt-2 w-full text-xs bg-stone-900/50 border border-stone-600 rounded px-2 py-1 text-stone-300 select-all"
            @click="($event.target as HTMLInputElement).select()"
            :aria-label="t('review.shareUrl')"
          />
        </div>
      </div>
    </Transition>

    <!-- #117: Historial de niveles -->
    <LevelHistoryPanel />

    <!-- Export Buttons -->
    <div class="flex flex-wrap gap-3 mt-6 no-print" role="group" :aria-label="t('review.export')">
      <button @click="exportPdf" :disabled="exporting"
        class="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
        {{ exporting ? t('common.loading') : t('review.exportPdf') }}
      </button>
      <button @click="downloadJson"
        class="px-6 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg transition-colors cursor-pointer">
        {{ t('review.exportJson') }}
      </button>
      <button @click="saveChar"
        class="px-6 py-2 bg-green-700 hover:bg-green-600 text-stone-200 rounded-lg transition-colors cursor-pointer">
        {{ t('review.save') }}
      </button>
      <button @click="printSheet"
        class="px-6 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg transition-colors cursor-pointer">
        {{ t('review.print') }}
      </button>
      <button @click="shareCharacter"
        class="px-6 py-2 bg-blue-700 hover:bg-blue-600 text-stone-200 rounded-lg transition-colors cursor-pointer">
        <span aria-hidden="true">🔗</span> {{ t('review.shareUrl') }}
      </button>
      <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImport" aria-hidden="true" tabindex="-1" />
      <button @click="triggerImport"
        class="px-6 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg transition-colors cursor-pointer">
        {{ t('review.importJson') }}
      </button>
      <button
        v-if="!isMaxLevel"
        @click="doLevelUp"
        :disabled="!canLevelUp"
        :aria-disabled="!canLevelUp"
        :title="levelUpBlockedReason"
        :aria-describedby="!canLevelUp ? 'level-up-pending-list' : undefined"
        class="px-6 py-2 rounded-lg font-semibold transition-colors"
        :class="canLevelUp
          ? 'bg-purple-700 hover:bg-purple-600 text-purple-100 cursor-pointer'
          : 'bg-stone-700/60 text-stone-500 cursor-not-allowed'"
      >
        <span aria-hidden="true">⬆</span> {{ t('review.levelUp') }}
      </button>
    </div>

    <!-- Pending decisions blocking level-up -->
    <div
      v-if="!isMaxLevel && pendingDecisions.length > 0"
      id="level-up-pending-list"
      class="mt-3 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg text-amber-200 text-sm"
      role="status"
      aria-live="polite"
    >
      <p class="font-medium mb-1">
        <span aria-hidden="true">⚠</span> {{ t('review.levelUpBlockedTitle') }}
      </p>
      <ul class="list-disc list-inside space-y-0.5 text-xs">
        <li v-for="d in pendingDecisions" :key="d.key">{{ d.message }}</li>
      </ul>

      <!-- Bug B: picker inline para resolver cantrips faltantes -->
      <div v-if="hasPendingCantrips" class="mt-3 pt-3 border-t border-amber-700/40">
        <p class="text-xs text-amber-300 mb-2 font-medium">{{ t('spells.cantrips') }}:</p>
        <div class="flex flex-wrap gap-1.5" role="group" :aria-label="t('spells.cantrips')">
          <button
            v-for="s in pickerCantripsAvailable"
            :key="s.id"
            @click="addCantripFromPicker(s.id)"
            class="px-2.5 py-1 text-xs bg-stone-700 hover:bg-amber-700 text-stone-200 hover:text-amber-100 rounded transition-colors cursor-pointer"
          >
            {{ gt.spell(s.name) }}
          </button>
        </div>
      </div>

      <!-- Bug B: picker inline para resolver spells faltantes -->
      <div v-if="hasPendingSpells" class="mt-3 pt-3 border-t border-amber-700/40">
        <p class="text-xs text-amber-300 mb-2 font-medium">{{ t('spells.knownSpells') }}:</p>
        <div class="flex flex-wrap gap-1.5" role="group" :aria-label="t('spells.knownSpells')">
          <button
            v-for="s in pickerSpellsAvailable"
            :key="s.id"
            @click="addSpellFromPicker(s.id)"
            class="px-2.5 py-1 text-xs bg-stone-700 hover:bg-amber-700 text-stone-200 hover:text-amber-100 rounded transition-colors cursor-pointer"
          >
            <span class="text-stone-400">{{ s.level }}</span> {{ gt.spell(s.name) }}
          </button>
        </div>
      </div>
    </div>

    <!-- Level Up feedback -->
    <Transition name="fade">
      <div
        v-if="levelUpMessage"
        class="mt-4 p-3 bg-purple-900/30 border border-purple-700 text-purple-300 rounded-lg flex items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <span class="text-xl" aria-hidden="true">✨</span>
        <p class="flex-1 text-sm">{{ levelUpMessage }}</p>
      </div>
    </Transition>

  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
