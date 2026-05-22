# generador-dungeon — D&D 2024 Character Builder

*Read this in [English](#english) below.*

---

## Castellano

Generador de personajes para Dungeons & Dragons 2024 (Player's Handbook 5.5).
Funciona enteramente en el navegador, sin servidor, sin cuenta y sin
seguimiento. Pensado para uso local entre amigos.

Este proyecto es un fork de [fullo/dnd-character-builder](https://github.com/fullo/dnd-character-builder),
reescrito desde el SRD 5.1 (2014) al reglamento 2024 y la hoja oficial
rellenable de D&D 5.5.


### Cómo arrancarlo

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173/dnd-character-builder/` en el navegador.

Si trabajas con Node portable (sin instalación global), el lanzador
`lanzar-dnd.bat` que viene en el ZIP hace todo el proceso desde la carpeta
descomprimida.


### Cómo se usa el wizard

La creación de un personaje pasa por nueve pasos. Puedes ir hacia atrás y
hacia adelante; los datos quedan guardados en el navegador (localStorage)
en cuanto los introduces.

**Paso 1 — Variant.** Elige el reglamento. Por defecto está el de D&D 2024.

**Paso 2 — Especie.** Once especies del PHB 2024 (Dragonborn, Dwarf, Elf,
Gnome, Goliath, Halfling, Human, Orc, Tiefling, Aasimar y subrazas). Las
especies dan rasgos, velocidad, tamaño y darkvision; en 2024 ya no
otorgan aumentos de característica ni idiomas. Algunas exigen elecciones
adicionales (Draconic Ancestry de Dragonborn, subrazas de Elf, etc.).

**Paso 3 — Clase.** Las doce clases del PHB 2024 con sus tablas de
progresión nivel 1–20 y la subclase correspondiente. Aquí se eligen las
skills de proficiencia de la clase y, si aplica, el Fighting Style
(Fighter lv.1, Paladin lv.2, Ranger lv.2). Paladin y Ranger pueden
sustituir el feat por Blessed Warrior o Druidic Warrior (cantrips
alternativos).

**Paso 4 — Características.** Tres métodos disponibles: standard array,
point buy y 4d6 drop lowest. En los niveles con ASI (4/8/12/16/19) el
jugador elige entre +2 a una característica, +1 a dos, o un feat. El cap
de 20 se respeta automáticamente (Epic Boons llegan a 30).

**Paso 5 — Trasfondo.** Dieciséis backgrounds del PHB 2024, cada uno con
sus aumentos de característica (repartibles 2+1 o 1+1+1), Origin Feat,
skills y herramientas. En este paso también se eligen los dos idiomas
adicionales (todo personaje conoce Common por defecto).

**Paso 6 — Equipo.** Lista de armas y armaduras del PHB 2024 con la
propiedad Weapon Mastery asignada. Selección de mastery según el número
de slots de la clase.

**Paso 7 — Hechizos.** Selectores de cantrips y hechizos preparados según
la tabla de la clase (no la fórmula 2014). Cada hechizo se despliega con
escuela, casting time, alcance, componentes y descripción. Magic Initiate
añade dos cantrips y un hechizo de nivel 1.

**Paso 8 — Detalles.** Nombre, alineamiento, edad, altura, peso,
personalidad, ideales, vínculos y defectos, historia.

**Paso 9 — Revisión.** Ficha completa con todos los cálculos derivados
(HP, AC, save DC, attack bonuses). Aquí también están los selectores que
dependen del estado final del personaje: ASI/feat, Weapon Mastery,
Fighting Style/Blessed Warrior/Druidic Warrior, Expertise (Bard lv.2 y
lv.10, Rogue lv.1 y lv.6, Wizard Scholar). Desde aquí se exporta el PDF
oficial y se descarga el JSON.


### Importar y exportar personajes

- **JSON.** Botón en el paso 9. El archivo lleva todos los datos del
  personaje y se puede volver a importar más adelante. Validado al cargar:
  los campos malformados se ignoran sin romper el resto.
- **PDF oficial.** Rellena la hoja 2024 (411 campos AcroForm) con un
  anexo extra de tres páginas para datos que no caben en la ficha base
  (rasgos de especie, feats, item magico, ataques con desglose, recursos
  con casillas de uso).


### Generador aleatorio

Botón en la pantalla inicial. Crea un personaje válido en un solo clic
con especie, clase, característica, background y skills aleatorios.
Útil para NPCs o para arrancar rápido y luego ajustar.


### Privacidad

Cero recopilación de datos. Todo corre en tu navegador. Sin cookies, sin
analítica, sin cuentas. Los personajes se guardan solo en el localStorage
de tu navegador. Si limpias el navegador, exporta antes el JSON.


### Para desarrolladores

```bash
npm run dev       # Servidor de desarrollo
npm run build     # Build de producción (sale en docs/)
npm test          # Vitest una vez
npm run test:watch
```

**Stack:** Vue 3 (Composition API + TypeScript), Vite, Pinia, TailwindCSS
v4, pdf-lib para AcroForm, Vitest.

**Organización del código:**

```
src/
  components/
    layout/      Cabecera, navegación entre pasos
    steps/       Step1Variant a Step9Review
    shared/      Pickers reutilizables (Expertise, FightingStyle, etc.)
  composables/   usePdfExport, useGameTerms
  data/dnd5e/    Clases, especies, hechizos, equipo, trasfondos, idiomas
  stores/        character.ts (datos del personaje), app.ts (settings)
  utils/         Cálculos, PDF mapping, generador aleatorio, helpers de features
public/pdf/
  dnd-2024-sheet.pdf   Hoja oficial 2024
scripts/
  smoke-test-pdf-mapping.test.ts   Test end-to-end del PDF
```

El registro de cambios está en `changelog.txt` (raíz). Cada fix lleva una
entrada con causa, fix y archivos tocados.


### Licencia

MIT — ver [LICENSE](LICENSE). Contenido D&D del SRD 5.1 bajo la Open
Gaming License; las reglas 2024 se han portado desde el PHB 5.5 para uso
local.


### Créditos

Basado en [fullo/dnd-character-builder](https://github.com/fullo/dnd-character-builder)
(Vue 3 + TypeScript + Vite, exportación PDF AcroForm, wizard de 9 pasos,
import/export JSON, PWA offline). Migración 2024 hecha sobre ese
scaffolding.


---

## English

Character builder for Dungeons & Dragons 2024 (Player's Handbook 5.5).
Runs entirely in the browser — no server, no account, no tracking.
Intended for local use among friends.

This project is a fork of [fullo/dnd-character-builder](https://github.com/fullo/dnd-character-builder),
rewritten from the SRD 5.1 (2014) to the 2024 ruleset and the official
form-fillable D&D 5.5 sheet.


### Getting started

Requirements: Node.js 20 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:5173/dnd-character-builder/` in your browser.

If you work with portable Node (no global install), the `lanzar-dnd.bat`
launcher bundled in the ZIP handles the whole process from the unzipped
folder.


### Using the wizard

Character creation runs through nine steps. You can navigate forwards
and backwards; data is saved to the browser's localStorage as soon as
you enter it.

**Step 1 — Variant.** Choose the ruleset. Defaults to D&D 2024.

**Step 2 — Species.** Eleven PHB 2024 species (Dragonborn, Dwarf, Elf,
Gnome, Goliath, Halfling, Human, Orc, Tiefling, Aasimar, with subraces).
Species grant traits, speed, size, and darkvision; in 2024 they no
longer provide ability score increases or languages. Some require
additional choices (Dragonborn Draconic Ancestry, Elf subraces, etc.).

**Step 3 — Class.** All twelve PHB 2024 classes with their level 1–20
progression tables and the matching subclass. Pick the class skill
proficiencies here and, if applicable, the Fighting Style (Fighter
lv.1, Paladin lv.2, Ranger lv.2). Paladin and Ranger can swap the feat
for Blessed Warrior or Druidic Warrior (alternative cantrips).

**Step 4 — Abilities.** Three methods: standard array, point buy, 4d6
drop lowest. At ASI levels (4/8/12/16/19) the player chooses between
+2 to one ability, +1 to two, or a feat. The 20 cap is enforced
automatically (Epic Boons reach 30).

**Step 5 — Background.** Sixteen PHB 2024 backgrounds, each with its
ability score increases (splittable 2+1 or 1+1+1), Origin Feat, skills,
and tools. This step also picks the two additional languages (every
character knows Common by default).

**Step 6 — Equipment.** Weapons and armour from the PHB 2024 with
their assigned Weapon Mastery property. Mastery selection follows the
class slot count.

**Step 7 — Spells.** Cantrip and prepared spell selectors using the
class's table (not the 2014 formula). Each spell expands inline with
school, casting time, range, components, and description. Magic
Initiate adds two cantrips and a level-1 spell.

**Step 8 — Details.** Name, alignment, age, height, weight,
personality, ideals, bonds, flaws, backstory.

**Step 9 — Review.** Full sheet with all derived calculations (HP, AC,
save DC, attack bonuses). The selectors that depend on the final state
of the character also live here: ASI/feat, Weapon Mastery, Fighting
Style/Blessed Warrior/Druidic Warrior, Expertise (Bard lv.2 and lv.10,
Rogue lv.1 and lv.6, Wizard Scholar). The official PDF and JSON export
buttons are at the bottom.


### Importing and exporting characters

- **JSON.** Button in step 9. The file contains all character data and
  can be reimported later. Validated on load: malformed fields are
  silently dropped without breaking the rest.
- **Official PDF.** Fills the 2024 sheet (411 AcroForm fields) and adds
  a three-page appendix for data that does not fit in the base sheet
  (species traits, feats, magic items, weapon attacks with bonus
  breakdown, resources with tick boxes).


### Random generator

Button on the home screen. Creates a valid character in one click with
randomised species, class, abilities, background, and skills. Useful
for NPCs or as a quick starting point to refine afterwards.


### Privacy

Zero data collection. Everything runs in your browser. No cookies, no
analytics, no accounts. Characters are saved only to your browser's
localStorage. If you clear browser data, export the JSON first.


### For developers

```bash
npm run dev       # Dev server
npm run build     # Production build (outputs to docs/)
npm test          # Vitest once
npm run test:watch
```

**Stack:** Vue 3 (Composition API + TypeScript), Vite, Pinia, TailwindCSS
v4, pdf-lib for AcroForm, Vitest.

**Code layout:**

```
src/
  components/
    layout/      Header, step navigation
    steps/       Step1Variant through Step9Review
    shared/      Reusable pickers (Expertise, FightingStyle, etc.)
  composables/   usePdfExport, useGameTerms
  data/dnd5e/    Classes, species, spells, equipment, backgrounds, languages
  stores/        character.ts (character data), app.ts (settings)
  utils/         Calculations, PDF mapping, random generator, feature helpers
public/pdf/
  dnd-2024-sheet.pdf   Official 2024 sheet
scripts/
  smoke-test-pdf-mapping.test.ts   PDF end-to-end test
```

The change log lives in `changelog.txt` (project root). Each fix has an
entry with cause, fix, and affected files.


### License

MIT — see [LICENSE](LICENSE). D&D content from the SRD 5.1 under the
Open Gaming License; 2024 rules ported from the PHB 5.5 for local use.


### Credits

Based on [fullo/dnd-character-builder](https://github.com/fullo/dnd-character-builder)
(Vue 3 + TypeScript + Vite, AcroForm PDF export, 9-step wizard, JSON
import/export, offline PWA). The 2024 migration was done on top of that
scaffolding.
