# Funcionalidades futuras — Pospuestas, decididas no hacer y aparcadas

> Documento vivo. Recoge features y mejoras que se han ido posponiendo a lo
> largo de las sesiones, distinguiendo entre **pospuestas** (se harán cuando
> haya rato o demanda real), **decididas NO HACER** (con justificación) y
> **aparcadas** (fuera del alcance acordado).
>
> Sirve para que ninguna idea se pierda en el changelog ni se vuelva a
> debatir desde cero.

## 1. Pospuestas — Se harán cuando haya prioridad o demanda

### F1 — Picker de skill / instrumento musical en multiclass (D3)

**Origen**: cierre del refactor multiclass Fase 6 (#145).
**Decisión**: pospuesto, no urgente.

La tabla `MULTICLASS_PROFS` en `src/data/dnd5e/multiclassProfs.ts` declara
`skillFromList` para Rogue, Ranger y Bard, y `musicalInstrumentChoice` para
Bard. Al hacer `addMulticlass` la app aplica las proficiencies de armadura y
armas pero no abre picker para las choices.

**Lo que falta**:
- Selector inline tras `addMulticlass` cuando `profs.skillFromList > 0` o
  `profs.musicalInstrumentChoice === true`.
- Bard secundaria → 1 skill de la lista del Bard + 1 instrumento.
- Ranger secundaria → 1 skill de la lista del Ranger.
- Rogue secundaria → 1 skill de la lista del Rogue.

**Coste**: ½ sesión, ~5-10 tests nuevos.

---

### F2 — Mystic Arcanum (Warlock)

**Origen**: auditoría 2026-05-24, punto 7.
**Decisión**: pospuesto, sin urgencia.

Feature de Warlock que otorga 1 hechizo de nivel 6/7/8/9 (uno cada vez)
lanzable 1/día sin gastar pact slot a niveles Warlock 11/13/15/17. No está
modelado en la app.

**Lo que falta**:
- Campo nuevo en `classes[i]` (solo para Warlock): `mysticArcana[]`.
- UI en Step7 o sección propia: selector de hechizos de nivel 6-9 limitado
  por nivel del Warlock.
- Gating en `pendingLevelDecisions`: si Warlock 11+ y no hay arcanum
  elegido para ese tramo, bloquear.
- PDF anexo: sección "Mystic Arcanum" en hoja 3.

**Coste**: 1 sesión.

**Cuándo merece la pena**: solo si juegas Warlock en mesa.

---

### F3 — Invocations dependientes de nivel Warlock en multiclass

**Origen**: auditoría 2026-05-24, punto 7.
**Decisión**: verificación pendiente, posible bug.

Las Eldritch Invocations tienen prerequisitos de nivel de WARLOCK (no nivel
total). En un Warlock 3 / Fighter 5 (total 8), las invocations que requieran
Warlock 5+ NO deberían estar disponibles, aunque char.level=8.

**Lo que hay que verificar**:
- Si la UI de invocations usa `getClassEntry(char, 'warlock').level` o
  `char.level` total. Si usa el total → bug.

**Coste**: ½ sesión para auditar + posible fix.

---

### F4 — Equipo del background al inventario (H3)

**Origen**: auditoría 2026-05-21, punto H3.
**Decisión del usuario**: NO es prioritario. Le da igual el inventario inicial.

El background da una opción A/B de equipo + 50 GP. La app no aplica nada de
esto al `char.inventory[]`.

**Coste**: ~½ sesión + datos por background.

**Cuándo merece la pena**: si en algún momento el inventario inicial empieza
a importar (p.ej. exportación a partida real).

---

### F7 — Normalizar tamaños de fuente en el PDF base (a mano con Acrobat)

**Origen**: usuario reportó 2026-05-25 que en la sección "Cantrips & Prepared
Spells" del PDF, algunos campos se ven con letra grande (Range "30 feet",
"Self", Notes "10 minutes", "1 minute") y otros con letra normal o
microscópica.

**Estado**: pospuesto. Decisión del usuario: tocar el PDF base, no el código.

**MITIGACIÓN PARCIAL YA APLICADA (#159)**: para el caso concreto de
castingTime ("Action or Ritual" ilegible), se aplica `shortCastingTime()`
en `pdfFieldMapping.ts` que envía "Action" en lugar de "Action or Ritual"
al PDF (la R va en el checkbox aparte). Cubre el caso peor pero no resuelve
la incoherencia general entre filas.

**Diagnóstico residual**:
- Cada campo del AcroForm en `public/dnd5e/<plantilla>.pdf` tiene su propia
  configuración de fuente y `MaxLen` heredada del PDF original de WotC.
- Algunos campos tienen tamaño FIJO (12pt aprox.) — texto se ve grande
  aunque sea corto, pero se SALE si es largo.
- Otros campos tienen autosize-to-fit — texto encoge si no cabe.
- La incoherencia entre filas viene del PDF base, no del código.

**Lo que hay que hacer** (en el PDF base, con Acrobat Pro o similar):
- Abrir `public/dnd5e/<plantilla>.pdf`.
- Para los campos de las filas de spells (SName_N, STime_N, SRange_N,
  SNotes_N): unificar configuración de fuente.
  - Recomendación: autosize-to-fit en TODOS, tamaño máximo 10-11pt y
    mínimo ~7pt para que campos cortos no salgan gigantes y largos no
    salgan microscópicos.
- Guardar y reemplazar el archivo en `public/dnd5e/`.

**Coste**: 30-45 min con Acrobat Pro. Sin código, sin tests.

**Alternativa via código** (descartada): un script con pdf-lib y
`field.setFontSize()`. Coste estimado 1-1.5 sesiones por el ciclo de
calibración + variabilidad entre visores. Se prefiere la solución manual.

**Cuándo merece la pena**: cuando tengas acceso a Acrobat Pro.

---

## 2. Decididas NO HACER (con justificación)

### NH1 — Limpiar nomenclatura `spellsKnown` vs `spellsPrepared` (H11)

**Origen**: auditoría 2026-05-21.
**Decisión**: no tocar.

`spellsPrepared` queda declarado en el modelo pero nunca se usa. Step7 lo
ignora y usa `spellsKnown` para todos los casters (incluidos preparadores
como Cleric y Druid). Funciona; solo confunde al leer el código.

**Por qué no se hace**: el coste de migrar es mayor que la confusión que
genera. Cualquier "limpieza" arrastraría 35+ archivos.

---

### NH2 — Weapon Mastery en hoja 1 del PDF (H12)

**Origen**: auditoría 2026-05-21.
**Decisión**: no hacer.

La implementación actual (#89) muestra masteries en el anexo del PDF (hoja
3) y respeta slots por clase. Integrar más profundo (mastery property en la
lista de ataques de hoja 1, conexión con inventario) no se acomete.

**Por qué no se hace**: la hoja 1 del PDF tiene campos fijos del formulario
oficial. Encajar mastery property ahí requiere o sobrescribir campos
existentes o renderizar overlay manual. Coste alto para mejora cosmética.

---

### NH3 — Etiqueta `classId` por hechizo en el modelo (D1)

**Origen**: auditoría 2026-05-24, punto 3 (parcialmente válido).
**Decisión**: no hacer hasta que duela.

`char.spellsKnown[]` guarda IDs sin atribución de clase. La heurística
"primera caster del PJ con el hechizo en su lista" funciona estable. El
daño real es teórico.

**Coste**: ALTO (~2 sesiones largas, 35 archivos, 30-50 tests).
**Beneficio actual**: marginal.

**Cuándo reabrir**: si aparece un caso real en mesa donde la atribución
heurística cause un cómputo erróneo y reportable.

---

### NH4 — Eliminar campos planos (`char.className`, `char.subclass`, etc.) (D2)

**Origen**: auditoría 2026-05-24, punto 5.
**Decisión**: no hacer hasta refactor mayor.

Los campos planos coexisten con `classes[]` mediante sincronía espejo. 35
archivos los leen. El refactor multiclass mantuvo esto a propósito para no
romper nada.

**Coste**: ALTO (~2-3 sesiones).
**Beneficio**: solo limpieza, ningún bug concreto se arregla.

**Cuándo reabrir**: si algún bug demuestra desincronía. Hoy todos los
cálculos críticos (HP, DC/Attack, gating) ya leen de `classes[]`.

---

### NH5 — Revalidación cascada de feat prereqs (B1)

**Origen**: identificado tras #138 (botón Desbloquear edición).
**Decisión**: no hacer hasta caso real.

Si un PJ tiene War Caster a lv.4 (requiere Spellcasting) y luego cambia un
ASI anterior que le daba spellcasting, War Caster queda huérfano sin que
la app avise.

**Por qué no se hace**: el botón "Desbloquear edición" ya avisa al usuario
del riesgo. El caso es muy específico.

---

### NH6 — Random character genera multiclass (B3)

**Decisión**: no hacer.

El generador aleatorio crea siempre monoclase. Multiclass random sería
difícil de generar respetando prereqs y heurística, y los tests E2E ya
cubren multiclass manualmente.

---

### NH7 — Auditor de coherencia automático

**Origen**: sesión anterior.
**Decisión**: descartado.

Un sistema que escaneara el PJ tras cada cambio buscando inconsistencias
(skills duplicadas, feats prerequisitos rotos, etc.) y mostrara avisos.

**Por qué no se hace**: complejo de implementar bien, ruidoso si se hace
mal, y los avisos puntuales que ya hay (#137 feat duplicado, #138 unlock
edit, multiclass prereqs M7) cubren los casos más frecuentes.

---

## 3. Aparcadas — Fuera del alcance del refactor multiclass

### A1 — UI explícita para "este hechizo es del Wizard" en multiclass-caster

**Origen**: consecuencia de NH3.

Si NH3 cambia (se decide etiquetar hechizos con classId), entonces Step7
necesitaría pestañas o selector "Add as Wizard / Add as Cleric" en cada
hechizo compartido entre listas.

**Estado**: aparcado mientras NH3 esté vigente.

---

### A2 — "Qué slot consume cada hechizo cada vez" en Warlock multiclass

**Origen**: auditoría 2026-05-24, punto 7.

RAW: un Warlock/Wizard puede lanzar Magic Missile (wizard) usando un Pact
Slot. La app no modela "rastreo de slots gastados" — solo muestra cupos
disponibles, sin gastar.

**Estado**: aparcado. La app no es un combat tracker, es un creador de
PJs. Esto sería trabajo de una herramienta de mesa, no de creación.

---

## 4. Referencia rápida de archivos clave

Para localizar dónde tocar si se reactiva alguna de estas tareas:

- **Modelo PJ**: `src/stores/character.ts` (ClassEntry, CharacterData)
- **Helpers multiclass**: `src/utils/classEntries.ts`
- **Prereqs habilidad**: `src/utils/multiclassPrereqs.ts`
- **Tabla profs multiclass**: `src/data/dnd5e/multiclassProfs.ts`
- **Gating**: `src/utils/levelUpGating.ts`
- **Steps de la UI**: `src/components/steps/Step3Class.vue` (clase/subclase),
  `Step7Spells.vue` (hechizos), `Step9Review.vue` (resumen + level up)
- **Componentes compartidos**: `src/components/shared/AsiSelector.vue`,
  `FeatPicker.vue`, `SpellRow.vue`
- **PDF**: `src/utils/pdfFieldMapping.ts`, `src/utils/pdfAppendix.ts`,
  `src/utils/detailedReferenceCalc.ts`
- **Random**: `src/utils/randomCharacter.ts`
- **i18n**: `src/i18n/locales/en.json`

---

## 5. Cómo usar este documento

- **Antes de empezar una sesión nueva**: revisar las secciones 1 y 2 para
  no proponer algo ya descartado.
- **Tras decidir hacer una de las pospuestas**: moverla a `changelog.txt`
  como PENDIENTE con número, y borrarla de este documento.
- **Tras decidir cambiar un NO HACER**: actualizar la justificación con la
  nueva información y moverla a pospuestas.
- **Tras cerrar una pospuesta**: borrarla aquí y registrar en changelog.
