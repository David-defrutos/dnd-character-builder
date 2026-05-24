// Documento generado el 2026-05-23 — #137 (warning de feat duplicado).
//
// El FeatPicker, dado un Set de IDs de feats no-repetibles ya cogidos en
// otros checkpoints, marca esos feats con un aviso visible en la lista y
// en el bloque del feat seleccionado. NO bloquea la selección: el usuario
// decide si lo cambia o lo deja.
//
// Aquí se testea la LÓGICA de detección de duplicados (qué feats deben
// estar en el Set), no el render Vue. La lógica vive en AsiSelector.vue
// pero su corazón es: "recorre asiChoices, filtra el slot actual, ignora
// repeatables, devuelve el resto". La reproducimos aquí con la misma
// función pura.

import { describe, it, expect, beforeAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { preloadVariantData } from '@/data'
import { getFeatById } from '@/data/dnd5e/feats'
import type { ASIChoice } from '@/stores/character'

/** Misma lógica que AsiSelector.duplicateFeatIdsFor — replicada aquí para test puro. */
function duplicateFeatIdsFor(asiChoices: ASIChoice[], idx: number): Set<string> {
  const out = new Set<string>()
  asiChoices.forEach((slot, i) => {
    if (i === idx) return
    if (slot.type !== 'feat' || !slot.featId) return
    const feat = getFeatById(slot.featId)
    if (!feat || feat.repeatable) return
    out.add(slot.featId)
  })
  return out
}

describe('#137 — Detección de feats duplicados en checkpoints', () => {
  beforeAll(async () => {
    setActivePinia(createPinia())
    await preloadVariantData('dnd5e')
  })

  it('un único slot con un feat no marca duplicados', () => {
    const choices: ASIChoice[] = [
      { level: 4, type: 'feat', featId: 'war-caster' },
    ]
    expect(duplicateFeatIdsFor(choices, 0).size).toBe(0)
  })

  it('dos slots con el mismo feat no-repetible (war-caster) se detectan mutuamente', () => {
    const choices: ASIChoice[] = [
      { level: 4, type: 'feat', featId: 'war-caster' },
      { level: 8, type: 'feat', featId: 'war-caster' },
    ]
    // Para el slot 1 (lv.4), el duplicado es el del slot 2 (lv.8)
    expect(duplicateFeatIdsFor(choices, 0).has('war-caster')).toBe(true)
    // Y viceversa
    expect(duplicateFeatIdsFor(choices, 1).has('war-caster')).toBe(true)
  })

  it('Magic Initiate (repetible) cogido dos veces NO marca duplicado', () => {
    const choices: ASIChoice[] = [
      { level: 4, type: 'feat', featId: 'magic-initiate' },
      { level: 8, type: 'feat', featId: 'magic-initiate' },
    ]
    expect(duplicateFeatIdsFor(choices, 0).size).toBe(0)
    expect(duplicateFeatIdsFor(choices, 1).size).toBe(0)
  })

  it('Skilled (repetible) cogido dos veces NO marca duplicado', () => {
    const choices: ASIChoice[] = [
      { level: 4, type: 'feat', featId: 'skilled' },
      { level: 8, type: 'feat', featId: 'skilled' },
    ]
    expect(duplicateFeatIdsFor(choices, 0).size).toBe(0)
  })

  it('Ability Score Improvement (repetible) cogido dos veces NO marca duplicado', () => {
    const choices: ASIChoice[] = [
      { level: 4, type: 'feat', featId: 'ability-score-improvement' },
      { level: 8, type: 'feat', featId: 'ability-score-improvement' },
    ]
    expect(duplicateFeatIdsFor(choices, 0).size).toBe(0)
  })

  it('Elemental Adept (repetible) cogido dos veces NO marca duplicado', () => {
    const choices: ASIChoice[] = [
      { level: 4, type: 'feat', featId: 'elemental-adept' },
      { level: 8, type: 'feat', featId: 'elemental-adept' },
    ]
    expect(duplicateFeatIdsFor(choices, 0).size).toBe(0)
  })

  it('Resilient (NO repetible según catálogo) cogido dos veces SÍ marca duplicado', () => {
    // El catálogo no marca Resilient como repeatable, así que el aviso aparece
    // aunque mecánicamente el feat se pueda coger con habilidad distinta. El
    // warning está justamente para que el usuario decida si lo deja.
    const choices: ASIChoice[] = [
      { level: 4, type: 'feat', featId: 'resilient', featAbility: 'con' },
      { level: 8, type: 'feat', featId: 'resilient', featAbility: 'dex' },
    ]
    expect(duplicateFeatIdsFor(choices, 0).has('resilient')).toBe(true)
    expect(duplicateFeatIdsFor(choices, 1).has('resilient')).toBe(true)
  })

  it('slots ASI (no feat) ven los feats no-repetibles de otros slots', () => {
    // Justificación: si el usuario cambia un ASI a feat, debe ver el warning
    // si elige un feat ya cogido en otra parte. Por eso duplicateFeatIdsFor
    // no depende del tipo del slot consultado: siempre devuelve los feats
    // no-repetibles cogidos en OTROS slots.
    const choices: ASIChoice[] = [
      { level: 4, type: 'asi', asiMode: '2', asiAbilities: ['str'] },
      { level: 8, type: 'feat', featId: 'war-caster' },
    ]
    // Slot 0 (ASI) ve war-caster del slot 1 como duplicado potencial.
    expect(duplicateFeatIdsFor(choices, 0).has('war-caster')).toBe(true)
    // Slot 1 (war-caster) no ve nada (el otro slot es ASI).
    expect(duplicateFeatIdsFor(choices, 1).size).toBe(0)
  })

  it('slots feat con featId vacío no añaden nada al set, pero ven feats de otros', () => {
    const choices: ASIChoice[] = [
      { level: 4, type: 'feat', featId: '' },
      { level: 8, type: 'feat', featId: 'war-caster' },
    ]
    // Slot 0 (vacío) ve war-caster del slot 1 como duplicado potencial.
    expect(duplicateFeatIdsFor(choices, 0).has('war-caster')).toBe(true)
    // Slot 1 ve el slot 0 vacío → 0 duplicados.
    expect(duplicateFeatIdsFor(choices, 1).size).toBe(0)
  })

  it('combinación realista: 4 slots con 2 duplicados se detectan correctamente', () => {
    const choices: ASIChoice[] = [
      { level: 4, type: 'feat', featId: 'war-caster' },         // dup con lv.12
      { level: 6, type: 'feat', featId: 'magic-initiate' },     // repetible
      { level: 8, type: 'feat', featId: 'resilient', featAbility: 'con' },
      { level: 12, type: 'feat', featId: 'war-caster' },        // dup con lv.4
    ]
    // Slot lv.4: ve war-caster (en lv.12) y resilient (en lv.8) como
    // duplicados potenciales si se moviera ahí. Magic Initiate es repetible.
    const dups0 = duplicateFeatIdsFor(choices, 0)
    expect(dups0.has('war-caster')).toBe(true)
    expect(dups0.has('resilient')).toBe(true)
    expect(dups0.has('magic-initiate')).toBe(false)
    expect(dups0.size).toBe(2)

    // Slot lv.6 (magic-initiate): ve war-caster y resilient como duplicados
    // potenciales en los otros slots no-repetibles.
    const dups1 = duplicateFeatIdsFor(choices, 1)
    expect(dups1.has('war-caster')).toBe(true)
    expect(dups1.has('resilient')).toBe(true)
    expect(dups1.size).toBe(2)

    // Slot lv.8 (resilient): ve war-caster (dos veces) como duplicado.
    const dups2 = duplicateFeatIdsFor(choices, 2)
    expect(dups2.has('war-caster')).toBe(true)
    expect(dups2.has('resilient')).toBe(false)
    expect(dups2.size).toBe(1)

    // Slot lv.12 (war-caster): ve war-caster (en lv.4) y resilient (en lv.8).
    const dups3 = duplicateFeatIdsFor(choices, 3)
    expect(dups3.has('war-caster')).toBe(true)
    expect(dups3.has('resilient')).toBe(true)
    expect(dups3.size).toBe(2)
  })
})
