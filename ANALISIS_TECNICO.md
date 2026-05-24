# Análisis técnico — Deuda y bugs conocidos

> Documento vivo. Generado tras la auditoría externa del 2026-05-24 sobre el
> refactor multiclass. Lista los problemas técnicos detectados, su estado real
> (no la afirmación del auditor sin filtrar) y una estimación honesta de
> coste/beneficio. La idea es decidir QUÉ se acomete sin morder anzuelo.

## Resumen ejecutivo

Tras el refactor multiclass (#139 fases 1-6, sesión 2026-05-24) y los fixes
posteriores (#146 filtro de hechizos por clase, #147 subclase secundaria), la
app cubre con razonable solvencia:

- Monoclase: fiable.
- Multiclass simple no-caster (Fighter/Rogue, Fighter/Barbarian, etc.): fiable.
- Multiclass simple caster (Cleric/Paladin, Ranger/Rogue): fiable.
- Multiclass caster complejo (Wizard/Sorcerer, Cleric/Druid, doble caster con
  doble spellcasting ability): funciona pero hay deuda técnica concreta.

Lo que queda pendiente es **deuda técnica de fondo** (modelo de hechizos sin
etiqueta de clase, campos planos que coexisten con `classes[]`) y **features
no soportadas** (Mystic Arcanum, invocations escalables por nivel Warlock).
Ninguna bloquea el uso normal.

---

## 1. Auditoría 2026-05-24 — Veredicto por punto

| # | Punto del auditor | Veredicto | Estado tras esta sesión |
|---|---|---|---|
| 1 | Filtro `maxSpellLevelAvailable` mezcla clases | **VÁLIDO, bug real** | **CERRADO** en #146 |
| 2 | Subclase secundaria sin gating | VÁLIDO (M2 reconocido) | **CERRADO** en #147 |
| 3 | `spellsKnown` mezclados sin classId | PARCIALMENTE VÁLIDO | En memoria como pendiente baja |
| 4 | `pendingLevelDecisions` monoclase | EN GRAN PARTE FALSO | Solo subclase era monoclase → cerrado en #147 |
| 5 | `className` y `classes[]` coexisten | VÁLIDO como deuda, exagerado en síntomas | Deuda técnica reconocida |
| 6 | Profs multiclass incompletas (skillFromList) | VÁLIDO (ya reconocido) | En memoria como pendiente baja |
| 7 | Warlock multiclass delicado | VÁLIDO pero fuera de alcance | Pendiente, ver "Future Work" |
| 8 | ASI dependen de `char.level` en algún sitio | **FALSO** | Verificado: todos usan `classLevel` excepto `randomCharacter` (que solo crea monoclase) |

---

## 2. Deuda técnica reconocida

### D1 — `char.spellsKnown[]` sin etiqueta de classId

**Estado**: pendiente baja en memoria.

**Síntoma real**: en multiclass-caster (Cleric/Wizard, Sorcerer/Cleric, etc.),
los hechizos viven en un único array `char.spellsKnown[]` sin saber a qué
clase pertenecen. Cuando Step7 muestra "Spells by class" usa una heurística:
cada hechizo se atribuye a la PRIMERA clase caster del PJ cuya spell list lo
contenga. Bless cogido por un Cleric/Wizard se atribuye al Cleric (primaria).
La heurística es estable pero no estricta: si el jugador quería contarlo como
del Wizard, la app no le deja.

**Cuándo se nota**:
- Solo en multiclass-caster con hechizos compartidos entre listas.
- El panel "Spells by class" es informativo, no bloquea selección.
- DC/Attack ya se muestran por clase (Fase 4).

**Coste de cerrarlo**: **ALTO**. ~2 sesiones largas.
- Cambiar el modelo: `char.spellsKnown: string[]` → mover todo a
  `classes[i].spellsKnown` (ya existe) y eliminar el plano.
- 35 archivos tocan `char.cantrips` o `char.spellsKnown` directamente. Cada
  uno necesita migrar a `getSpellsKnownForClass(char, classId)` o
  `getCharSpellsKnown(char)` agregado.
- Migración de PJs guardados: cada hechizo necesita atribución de clase, que
  solo se puede inferir por heurística (la misma que hoy).
- UI: Step7 necesitaría pestañas/secciones por clase caster para que el
  jugador elija explícitamente "este hechizo es del Wizard".
- Tests: 30-50 nuevos o adaptados.

**Beneficio real**: marginal hoy. La heurística "primera caster con el hechizo"
funciona bien en práctica. El daño concreto es teórico, no observado.

**Recomendación**: **NO HACER** hasta que algún caso real demuestre el daño
en una partida.

---

### D2 — Campos planos coexisten con `classes[]`

**Estado**: deuda técnica documentada, no bloqueante.

**Síntoma**: `char.className`, `char.subclass`, `char.cantrips`,
`char.spellsKnown`, `char.spellcastingAbility`, `char.asiChoices`, `char.hitDie`
siguen existiendo en el modelo y los lee mucho código. El refactor multiclass
mantuvo sincronía espejo `classes[0] ↔ campos planos` para no romper nada.

35 archivos leen `char.className` directamente.

**Por qué el auditor exagera el riesgo**:
- HP usa `recomputeMaxHp(char)` que itera `char.classes[]` (no mira
  `className`).
- DC/Attack usa `casterInfo` que itera `classes`.
- Gating ASI itera `classes`. Gating subclase desde #147 también.
- La sincronía se mantiene en `selectClass`, `selectSubclass`,
  `reorderClasses`, `addMulticlass`, `removeMulticlass`. Solo falla si alguien
  edita el JSON directamente.

**Coste de cerrarlo**: **ALTO**. ~2-3 sesiones.
- Sustituir `char.className` → `getPrimaryClass(char).classId` en 35 archivos.
- Idem para `char.subclass`, `char.cantrips`, `char.spellsKnown`,
  `char.spellcastingAbility`, `char.asiChoices`, `char.hitDie`.
- `char.level` se queda (es la suma de niveles, no de una clase).
- Quitar la sincronía espejo del store: ya no necesaria.
- Migración silenciosa Fase 1 vuelca el plano a `classes[0]` y luego los
  campos planos pueden borrarse.
- Tests: muchas adaptaciones.

**Beneficio real**: solo limpieza, ningún bug concreto se arregla.

**Recomendación**: **NO HACER** hasta refactor mayor o hasta que aparezca un
bug real causado por desincronía.

---

### D3 — Skill / Musical Instrument choice en M8

**Estado**: pendiente baja en memoria.

**Síntoma**: la tabla `MULTICLASS_PROFS` (en `src/data/dnd5e/multiclassProfs.ts`)
declara `skillFromList` y `musicalInstrumentChoice` para Rogue, Ranger y Bard,
pero al hacer `addMulticlass` no se abre ningún picker. El jugador no gana la
skill / instrumento que RAW le tocaría.

**Clases afectadas**:
- Bard como secundaria: 1 skill de la lista + 1 instrumento musical.
- Ranger como secundaria: 1 skill de la lista.
- Rogue como secundaria: 1 skill de la lista.

**Coste de cerrarlo**: **BAJO-MEDIO**. ~½ sesión.
- Detectar en `addMulticlass` si `profs.skillFromList > 0` o
  `profs.musicalInstrumentChoice`.
- Mostrar selector modal/inline con lista de skills de la clase o de
  instrumentos del PHB.
- Aplicar a `char.skillProficiencies` o `char.proficienciesOther`.
- Tests: 5-10 nuevos.

**Beneficio real**: completitud RAW. Si juegas Bard/Ranger/Rogue multiclass
en mesa, falta una skill o instrumento.

**Recomendación**: **HACER** cuando haya rato libre. Coste real bajo.

---

## 3. Otros bugs/limitaciones identificados (no de la auditoría)

### B1 — `pendingLevelDecisions` no detecta cambios en ASI bonuses para revalidar feat prereqs

**Estado**: bug latente, no observado en uso real.

**Síntoma teórico**: si un PJ tiene un feat War Caster cogido a lv.4 (que
requiere Spellcasting), y luego el jugador cambia un ASI/feat anterior que le
daba spellcasting (vía Magic Initiate, por ej.), War Caster queda huérfano.
`pendingLevelDecisions` no detecta esto retroactivamente.

**Coste**: MEDIO. Implementar revalidación cascada de feat prereqs.

**Beneficio**: pequeño. El botón "Desbloquear edición" (#138) ya avisa de
este riesgo al usuario.

**Recomendación**: **NO HACER** hasta que se reporte un caso real (decisión
ya tomada en #138, se mantiene).

---

### B2 — Hechizos al elegir secundaria caster no se atribuyen automáticamente

**Estado**: consecuencia de D1.

**Síntoma**: si añades Wizard como secundaria a un Cleric, el cupo total
(`maxSpellsKnown`) crece y puedes elegir nuevos hechizos. Pero no hay forma
de marcar "este hechizo que elijo ahora es del Wizard". Si Bless ya estaba
en la lista cogido como Cleric, sigue contando como Cleric en el breakdown.

**Coste**: incluido en D1 (es la misma deuda).

**Recomendación**: ver D1.

---

### B3 — `randomCharacter` no genera multiclass

**Estado**: comportamiento intencional, no bug.

**Síntoma**: el botón "PJ aleatorio" siempre crea monoclase. No prueba el
camino multiclass.

**Recomendación**: no hacer. Multiclass random sería difícil de generar
respetando prereqs y heurística, y los tests E2E ya cubren multiclass
manualmente.

---

## 4. Resumen de prioridades

| Item | Coste | Beneficio | Acción |
|---|---|---|---|
| D3 Skill/Instrument picker multiclass | Bajo-Medio | Medio | **Cuando haya rato** |
| D1 classId por hechizo | Alto | Bajo | **No hacer hasta dolor real** |
| D2 Eliminar campos planos | Alto | Solo limpieza | **No hacer hasta refactor mayor** |
| B1 Revalidación cascada feats | Medio | Bajo | **No hacer** |
| B2 Auto-atribución hechizos secundaria | Alto (= D1) | Bajo | **No hacer** |
| B3 Random multiclass | Alto | Bajo | **No hacer** |

---

## 5. Lo que SÍ se hizo en la sesión 2026-05-24

Como referencia rápida para no preguntárselo otra vez:

- Refactor multiclass completo (#139 fases 1-6).
- #146 — Filtro de hechizos por clase con max-level POR clase. Ranger 4 /
  Wizard 5 ya no muestra hechizos Ranger nivel 2-3.
- #147 — M2 cerrado. Subclase secundaria con UI y gating propio.

**Pendientes en memoria al cierre de esta sesión**: solo H3 (background no
aplica equipo A/B ni 50 GP) en prioridad baja.
