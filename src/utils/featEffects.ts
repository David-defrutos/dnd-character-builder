// Documento generado el 2026-05-20-1730 — efectos mecánicos de feats
// (anteriormente duplicado entre AsiSelector.vue y no aplicado en Step4Abilities.vue).
//
// Esta función se llama tras CUALQUIER cambio en asiChoices del personaje
// para mantener actualizados los campos que dependen de los feats elegidos:
//   - toughHpBonus      ← feat 'tough'  (nivel × 2 HP)
//   - savingThrowProficiencies ← feat 'resilient' (proficiency en featAbility)
//   - featAddedSavingThrows    ← tracking interno para limpieza idempotente
//
// Idempotente: cada llamada recalcula desde cero el estado deseado y elimina
// los efectos de feats previamente añadidos que ya no estén entre los elegidos.

import type { CharacterData, ASIChoice } from '@/stores/character'
import { getFeatById } from '@/data/dnd5e/feats'
import type { FeatAbility } from '@/data/dnd5e/feats'

/**
 * Aplica los efectos mecánicos de los feats elegidos al personaje.
 * Llamar tras cualquier mutación en `char.asiChoices`.
 */
export function applyFeatEffects(char: CharacterData, choices: ASIChoice[]): void {
  const chosen = choices.filter(c => c.type === 'feat' && c.featId)
  const chosenFeatIds = chosen.map(c => c.featId!)

  // ── Tough: +2 HP por nivel del personaje ──────────────────────────────────
  if (chosenFeatIds.includes('tough')) {
    char.toughHpBonus = char.level * 2
  } else {
    char.toughHpBonus = 0
  }

  // ── Resilient et al.: saving throw proficiency en la ability elegida ──────
  const newFeatSaves: FeatAbility[] = []
  for (const c of chosen) {
    const feat = getFeatById(c.featId!)
    if (feat?.grantsSavingThrowProficiency && c.featAbility) {
      if (!newFeatSaves.includes(c.featAbility)) newFeatSaves.push(c.featAbility)
    }
  }

  // Quitar las saving throws añadidas previamente por feats y que ya no estén.
  const previousFeatSaves = (char.featAddedSavingThrows ?? []) as FeatAbility[]
  const toRemove = previousFeatSaves.filter(a => !newFeatSaves.includes(a))
  if (toRemove.length > 0) {
    char.savingThrowProficiencies = char.savingThrowProficiencies.filter(
      a => !toRemove.includes(a as FeatAbility),
    )
  }

  // Añadir las nuevas que aún no estén (no duplicar las de la clase).
  for (const ab of newFeatSaves) {
    if (!char.savingThrowProficiencies.includes(ab)) {
      char.savingThrowProficiencies.push(ab)
    }
  }

  char.featAddedSavingThrows = newFeatSaves

  // ── Speedy & co.: suma de speedBonus ──────────────────────────────────────
  let speedBonus = 0
  let initiativeProf = false
  let defenseAC = false
  const newFeatProfs: string[] = []
  // Recolección de elecciones del usuario en feats con requiresChoices.
  const newFeatSkillProfs: string[] = []
  const newFeatExpertise: string[] = []
  for (const c of chosen) {
    const feat = getFeatById(c.featId!)
    if (!feat) continue
    if (feat.speedBonus) speedBonus += feat.speedBonus
    if (feat.grantsInitiativeProf) initiativeProf = true
    if (feat.defenseACBonus) defenseAC = true
    if (feat.grantsProficiencies) {
      for (const prof of feat.grantsProficiencies) {
        if (!newFeatProfs.includes(prof)) newFeatProfs.push(prof)
      }
    }
    // Procesar elecciones del usuario (requiresChoices) — #52 fase 2.
    if (feat.requiresChoices && c.featChoices) {
      for (const choice of feat.requiresChoices) {
        const picked = c.featChoices[choice.id] ?? []
        for (const optId of picked) {
          switch (choice.kind) {
            case 'skill-proficiency':
              if (!newFeatSkillProfs.includes(optId)) newFeatSkillProfs.push(optId)
              break
            case 'skill-expertise':
              if (!newFeatExpertise.includes(optId)) newFeatExpertise.push(optId)
              break
            case 'artisans-tool':
            case 'musical-instrument':
              if (!newFeatProfs.includes(optId)) newFeatProfs.push(optId)
              break
            case 'skill-or-tool':
              // Skilled: cada opción es 'skill:<id>' o 'tool:<name>'.
              if (optId.startsWith('skill:')) {
                const sk = optId.slice(6)
                if (!newFeatSkillProfs.includes(sk)) newFeatSkillProfs.push(sk)
              } else if (optId.startsWith('tool:')) {
                const tool = optId.slice(5)
                if (!newFeatProfs.includes(tool)) newFeatProfs.push(tool)
              }
              break
          }
        }
      }
    }
  }
  char.featSpeedBonus = speedBonus
  char.featInitiativeProf = initiativeProf
  char.featDefenseACBonus = defenseAC

  // ── Sincronizar proficiencies de feats (idempotente, #52 fase 1) ───────────
  // Quitar las prof añadidas previamente por feats y que ya no estén.
  const prevFeatProfs = char.featAddedProficiencies ?? []
  const profsToRemove = prevFeatProfs.filter(p => !newFeatProfs.includes(p))
  if (profsToRemove.length > 0) {
    char.proficienciesOther = char.proficienciesOther.filter(
      p => !profsToRemove.includes(p),
    )
  }
  // Añadir las nuevas que aún no estén (no duplicar las de la clase/raza).
  for (const prof of newFeatProfs) {
    if (!char.proficienciesOther.includes(prof)) {
      char.proficienciesOther.push(prof)
    }
  }
  char.featAddedProficiencies = newFeatProfs

  // ── Sincronizar skill proficiencies de feats (idempotente, #52 fase 2) ─────
  const prevFeatSkills = char.featAddedSkillProficiencies ?? []
  const skillsToRemove = prevFeatSkills.filter(s => !newFeatSkillProfs.includes(s))
  if (skillsToRemove.length > 0) {
    char.skillProficiencies = char.skillProficiencies.filter(
      s => !skillsToRemove.includes(s),
    )
  }
  for (const sk of newFeatSkillProfs) {
    if (!char.skillProficiencies.includes(sk)) {
      char.skillProficiencies.push(sk)
    }
  }
  char.featAddedSkillProficiencies = newFeatSkillProfs

  // ── Sincronizar skill expertise de feats (idempotente, #52 fase 2) ─────────
  const prevFeatExp = char.featAddedExpertise ?? []
  const expToRemove = prevFeatExp.filter(s => !newFeatExpertise.includes(s))
  if (expToRemove.length > 0) {
    char.skillExpertise = char.skillExpertise.filter(s => !expToRemove.includes(s))
  }
  for (const sk of newFeatExpertise) {
    if (!char.skillExpertise.includes(sk)) {
      char.skillExpertise.push(sk)
    }
  }
  char.featAddedExpertise = newFeatExpertise
}
