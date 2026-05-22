<script setup lang="ts">
import { useAppStore } from '@/stores/app'
const appStore = useAppStore()
</script>

<template>
  <!-- Overlay -->
  <Transition name="fade">
    <div v-if="appStore.helpOpen"
      class="fixed inset-0 bg-black/50 z-40"
      @click="appStore.helpOpen = false"
      aria-hidden="true" />
  </Transition>

  <!-- Panel -->
  <Transition name="slide">
    <aside v-if="appStore.helpOpen"
      class="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-stone-900 border-l border-amber-700/40 z-50 flex flex-col shadow-2xl"
      role="dialog" aria-modal="true" aria-label="Guía de creación de personaje">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-stone-700 bg-stone-800/80 shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-2xl">📖</span>
          <h2 class="text-lg font-bold text-amber-400">Guía del Creador</h2>
          <span class="text-xs text-stone-500 ml-1">D&amp;D 2024</span>
        </div>
        <button @click="appStore.helpOpen = false"
          class="text-stone-400 hover:text-stone-200 cursor-pointer p-1 rounded"
          aria-label="Cerrar ayuda">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content scrollable -->
      <div class="flex-1 overflow-y-auto px-5 py-4 text-sm text-stone-300 space-y-6">

        <!-- Intro -->
        <section>
          <p class="text-stone-400 text-xs leading-relaxed">
            Este creador sigue las reglas de <strong class="text-stone-300">D&amp;D 2024 (Player's Handbook)</strong>.
            Puedes navegar los pasos en orden o saltar directamente a la ficha final y ajustar todo allí.
          </p>
        </section>

        <!-- Paso 1 -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-1 flex items-center gap-2">
            <span class="bg-amber-700/40 text-amber-300 text-xs px-1.5 py-0.5 rounded">Paso 1</span>
            Especie (Race)
          </h3>
          <p class="text-stone-400 leading-relaxed mb-2">
            Elige la especie de tu personaje. En 2024 <strong class="text-stone-300">las especies no otorgan bonificaciones de característica</strong> — esos bonuses vienen del trasfondo.
          </p>
          <ul class="space-y-1 text-stone-400 text-xs list-none">
            <li>⚡ <strong class="text-stone-300">Dragonborn</strong> — Aliento elemental, resistencia a ese elemento</li>
            <li>🌿 <strong class="text-stone-300">Elf</strong> — Fey Ancestry, Trance, Keen Senses</li>
            <li>⛏ <strong class="text-stone-300">Dwarf</strong> — Darkvision, Dwarven Resilience, Stonecunning</li>
            <li>🌟 <strong class="text-stone-300">Human</strong> — Resourceful (Heroic Inspiration) + Feat de origen gratis</li>
            <li>🦶 <strong class="text-stone-300">Halfling</strong> — Lucky (relanzar 1s), Naturally Stealthy</li>
            <li>🔮 <strong class="text-stone-300">Gnome</strong> — Darkvision, Gnomish Cunning (ventaja en saves INT/WIS/CHA)</li>
            <li>⚔ <strong class="text-stone-300">Half-Elf / Tiefling / Half-Orc / Aasimar</strong> — rasgos únicos según especie</li>
          </ul>
        </section>

        <!-- Paso 2 -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-1 flex items-center gap-2">
            <span class="bg-amber-700/40 text-amber-300 text-xs px-1.5 py-0.5 rounded">Paso 2</span>
            Clase
          </h3>
          <p class="text-stone-400 leading-relaxed mb-2">
            Define tu rol en combate y exploración. A <strong class="text-stone-300">nivel 3</strong> eliges subclase, que especializa aún más tu personaje.
          </p>
          <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-400">
            <div>⚔ <strong class="text-stone-300">Barbarian</strong> — d12, STR, Rage</div>
            <div>🎵 <strong class="text-stone-300">Bard</strong> — d8, CHA, Bardic Inspiration</div>
            <div>✨ <strong class="text-stone-300">Cleric</strong> — d8, WIS, Channel Divinity</div>
            <div>🌿 <strong class="text-stone-300">Druid</strong> — d8, WIS, Wild Shape</div>
            <div>⚔ <strong class="text-stone-300">Fighter</strong> — d10, STR/DEX, Action Surge</div>
            <div>🥋 <strong class="text-stone-300">Monk</strong> — d8, DEX/WIS, Ki</div>
            <div>⚜ <strong class="text-stone-300">Paladin</strong> — d10, STR/CHA, Divine Smite</div>
            <div>🏹 <strong class="text-stone-300">Ranger</strong> — d10, DEX/WIS, Favored Enemy</div>
            <div>🗡 <strong class="text-stone-300">Rogue</strong> — d8, DEX, Sneak Attack</div>
            <div>🔥 <strong class="text-stone-300">Sorcerer</strong> — d6, CHA, Metamagic</div>
            <div>👁 <strong class="text-stone-300">Warlock</strong> — d8, CHA, Eldritch Blast</div>
            <div>📚 <strong class="text-stone-300">Wizard</strong> — d6, INT, Spellbook</div>
          </div>
          <p class="text-stone-500 text-xs mt-2">El selector de subclase aparece automáticamente al llegar al nivel correspondiente.</p>
        </section>

        <!-- Paso 3 -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-1 flex items-center gap-2">
            <span class="bg-amber-700/40 text-amber-300 text-xs px-1.5 py-0.5 rounded">Paso 3</span>
            Características (Ability Scores)
          </h3>
          <p class="text-stone-400 leading-relaxed mb-2">
            Tienes tres métodos para asignar las 6 características (STR, DEX, CON, INT, WIS, CHA):
          </p>
          <ul class="space-y-1.5 text-xs text-stone-400">
            <li>
              <strong class="text-stone-300">Standard Array</strong> — Reparte los valores fijos
              <span class="text-amber-400">15, 14, 13, 12, 10, 8</span> como quieras.
              Rápido y equilibrado.
            </li>
            <li>
              <strong class="text-stone-300">Point Buy</strong> — Empieza con 8 en todo y gasta
              <span class="text-amber-400">27 puntos</span>. Subir de 13 a 14 cuesta 2 puntos;
              de 14 a 15 cuesta 3. Máximo 15 antes de bonuses.
            </li>
            <li>
              <strong class="text-stone-300">Roll</strong> — Tira 4d6, descarta el menor, anota el total.
              Repite 6 veces. Más emocionante pero impredecible.
            </li>
          </ul>
          <p class="text-stone-500 text-xs mt-2">
            Los bonuses de trasfondo (+2/+1/+1+1+1) se aplican encima de estos valores base.
          </p>
        </section>

        <!-- Paso 4 -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-1 flex items-center gap-2">
            <span class="bg-amber-700/40 text-amber-300 text-xs px-1.5 py-0.5 rounded">Paso 4</span>
            Trasfondo (Background)
          </h3>
          <p class="text-stone-400 leading-relaxed mb-2">
            En 2024 el trasfondo es donde van los <strong class="text-stone-300">bonuses de características</strong>: elige entre
            <span class="text-amber-400">+2 a uno y +1 a otro</span>, o <span class="text-amber-400">+1 a tres diferentes</span>,
            de entre las tres características asociadas al trasfondo.
          </p>
          <p class="text-stone-400 text-xs mb-1">Cada trasfondo también otorga:</p>
          <ul class="text-xs text-stone-400 space-y-1">
            <li>✦ <strong class="text-stone-300">Feat de Origen</strong> — un feat gratuito de la lista Origin</li>
            <li>✦ <strong class="text-stone-300">2 competencias de habilidad</strong></li>
            <li>✦ <strong class="text-stone-300">Equipo inicial</strong> y monedas de partida</li>
          </ul>
          <p class="text-stone-500 text-xs mt-2">
            Usa el filtro de atributos para ver qué trasfondos potencian las características clave de tu clase.
          </p>
        </section>

        <!-- Paso 5 -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-1 flex items-center gap-2">
            <span class="bg-amber-700/40 text-amber-300 text-xs px-1.5 py-0.5 rounded">Paso 5</span>
            Equipo
          </h3>
          <p class="text-stone-400 leading-relaxed mb-2">
            Añade armas, armaduras y objetos mágicos a tu inventario. Usa las pestañas:
          </p>
          <ul class="text-xs text-stone-400 space-y-1">
            <li>⚔ <strong class="text-stone-300">Weapons</strong> — armas simples y marciales. Pulsa el nombre para añadir la versión normal, o <span class="text-amber-400">+1/+2/+3</span> para la versión mágica.</li>
            <li>🛡 <strong class="text-stone-300">Armor</strong> — armaduras ligeras, medias, pesadas y escudos. También con opciones <span class="text-amber-400">+1/+2/+3</span>.</li>
            <li>✨ <strong class="text-stone-300">Magic Items</strong> — pociones, anillos, varitas, objetos maravillosos y más. Filtra por categoría, rareza o sintonización.</li>
            <li>📦 <strong class="text-stone-300">Inventory</strong> — vista de todo lo que llevas. Edita notas, cantidad o sintonización.</li>
          </ul>
        </section>

        <!-- Paso 6 -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-1 flex items-center gap-2">
            <span class="bg-amber-700/40 text-amber-300 text-xs px-1.5 py-0.5 rounded">Paso 6</span>
            Conjuros (Spells)
          </h3>
          <p class="text-stone-400 leading-relaxed mb-1">
            Solo aparece si tu clase tiene magia. En 2024 <strong class="text-stone-300">todos los lanzadores son preparadores</strong>:
            preparas un número de conjuros igual a tu modificador de característica + nivel de clase.
          </p>
          <ul class="text-xs text-stone-400 space-y-1">
            <li>🕯 <strong class="text-stone-300">Cantrips</strong> — siempre disponibles, sin slots.</li>
            <li>📜 <strong class="text-stone-300">Conjuros preparados</strong> — puedes cambiarlos al terminar un Descanso Largo.</li>
            <li>⚡ <strong class="text-stone-300">Warlock</strong> — usa Pact Slots que se recuperan en Descanso Corto.</li>
          </ul>
          <p class="text-stone-500 text-xs mt-2">
            Si subes de nivel sin pasar por este paso, el panel de conjuros aparece directamente en la ficha final.
          </p>
        </section>

        <!-- Paso 7 -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-1 flex items-center gap-2">
            <span class="bg-amber-700/40 text-amber-300 text-xs px-1.5 py-0.5 rounded">Paso 7</span>
            Detalles del Personaje
          </h3>
          <p class="text-stone-400 leading-relaxed mb-1">
            Nombre, nivel, alineamiento, historia y descripción física. También es donde subes el nivel:
            cambia el número de <strong class="text-stone-300">Nivel</strong> y los HP se recalculan automáticamente
            (d[hitDie]/2+1 + modificador CON por nivel, + nivel×2 si tienes el feat <em>Tough</em>).
          </p>
          <p class="text-stone-500 text-xs">
            La subclase aparece aquí si llegas al nivel correspondiente sin haberla elegido antes.
          </p>
        </section>

        <!-- Paso 8 -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-1 flex items-center gap-2">
            <span class="bg-amber-700/40 text-amber-300 text-xs px-1.5 py-0.5 rounded">Paso 8</span>
            Ficha Final (Review)
          </h3>
          <p class="text-stone-400 leading-relaxed mb-1">
            Vista completa del personaje. Desde aquí puedes:
          </p>
          <ul class="text-xs text-stone-400 space-y-1">
            <li>🎯 <strong class="text-stone-300">ASI / Feats</strong> — elige Ability Score Improvements y feats de los checkpoints de nivel (nivel 4, 8, 12, 16, 19 + extras para Fighter y Rogue).</li>
            <li>📖 <strong class="text-stone-300">Conjuros</strong> — si hay slots disponibles, aparece el selector de hechizos en azul.</li>
            <li>💾 <strong class="text-stone-300">Guardar / Exportar</strong> — guarda el personaje en el navegador o descarga el JSON.</li>
            <li>📄 <strong class="text-stone-300">Descargar PDF</strong> — genera la ficha oficial 2024 rellena con todos los datos.</li>
          </ul>
        </section>

        <!-- Subida de nivel -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-2 flex items-center gap-2">
            <span class="text-lg">⬆</span>
            Subida de Nivel
          </h3>
          <p class="text-stone-400 leading-relaxed mb-2">
            No hace falta empezar de cero. Puedes subir el nivel directamente en <strong class="text-stone-300">Paso 7 (Detalles)</strong>
            y la ficha se actualiza sola. Lo que cambia automáticamente:
          </p>
          <ul class="text-xs text-stone-400 space-y-1.5">
            <li>❤ <strong class="text-stone-300">HP</strong> — se recalcula: base + (hitDie/2+1 + CON mod) × nivel. Tough añade nivel×2.</li>
            <li>🎓 <strong class="text-stone-300">Proficiency Bonus</strong> — sube cada 4 niveles (×2 lv.1-4, ×3 lv.5-8, ×4 lv.9-12...).</li>
            <li>⚔ <strong class="text-stone-300">Class Features</strong> — los rasgos nuevos del nivel se añaden a la ficha.</li>
            <li>📖 <strong class="text-stone-300">Subclase</strong> — aparece selector en la ficha cuando alcanzas el nivel 3 (o el correspondiente a tu clase).</li>
            <li>✨ <strong class="text-stone-300">ASI / Feat</strong> — a niveles 4, 8, 12, 16, 19 (Fighter también 6 y 14; Rogue también 10) aparece el selector en la ficha.</li>
            <li>🔮 <strong class="text-stone-300">Conjuros</strong> — si eres lanzador y te quedan slots libres, el panel azul de conjuros aparece en la ficha.</li>
          </ul>
        </section>

        <!-- ASI y Feats -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-2 flex items-center gap-2">
            <span class="text-lg">📈</span>
            ASI y Feats
          </h3>
          <p class="text-stone-400 leading-relaxed mb-2">
            En cada checkpoint de nivel (4, 8, 12, 16, 19) eliges entre:
          </p>
          <ul class="text-xs text-stone-400 space-y-1.5">
            <li>
              <strong class="text-stone-300">Ability Score Improvement</strong> — +2 a una característica,
              o +1 a dos diferentes. Las características tienen un máximo de 20 (salvo Epic Boons, que llegan a 30).
            </li>
            <li>
              <strong class="text-stone-300">Feat General</strong> — rasgos como <em>Lucky</em>, <em>Alert</em>,
              <em>Tough</em> (+2 HP/nivel), <em>War Caster</em>, <em>Sentinel</em>, etc.
              Algunos tienen requisitos previos.
            </li>
            <li>
              <strong class="text-stone-300">Fighting Style Feat</strong> — solo accesible para clases marciales.
            </li>
            <li>
              <strong class="text-stone-300">Epic Boon</strong> (nivel 19) — rasgos de poder excepcional,
              forzosamente en el último checkpoint.
            </li>
          </ul>
          <p class="text-stone-500 text-xs mt-2">
            El buscador del selector de feats filtra simultáneamente por nombre y descripción.
          </p>
        </section>

        <!-- PDF -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-2 flex items-center gap-2">
            <span class="text-lg">📄</span>
            Exportar a PDF
          </h3>
          <p class="text-stone-400 leading-relaxed mb-1">
            El botón <strong class="text-stone-300">Descargar PDF</strong> genera la ficha oficial D&amp;D 2024 rellenada.
            Los campos que se rellenan automáticamente:
          </p>
          <ul class="text-xs text-stone-400 space-y-1">
            <li>✦ Características, modificadores y tiradas de salvación</li>
            <li>✦ Habilidades con proficiencia marcada</li>
            <li>✦ CA, Iniciativa, Velocidad, HP máximos</li>
            <li>✦ Proficiencias de armadura, armas y herramientas (desde la clase)</li>
            <li>✦ Idiomas conocidos</li>
            <li>✦ Armas equipadas (desde el inventario)</li>
            <li>✦ Rasgos de clase, subclase y feats elegidos</li>
            <li>✦ Rasgos de especie</li>
            <li>✦ Datos de lanzamiento de conjuros (DC, bonus de ataque)</li>
          </ul>
        </section>

        <!-- Preguntas frecuentes -->
        <section>
          <h3 class="text-amber-400 font-semibold mb-2 flex items-center gap-2">
            <span class="text-lg">❓</span>
            Preguntas Frecuentes
          </h3>
          <div class="space-y-3 text-xs">
            <div>
              <p class="text-stone-300 font-medium">¿Puedo saltarme pasos?</p>
              <p class="text-stone-500">Sí. Puedes ir directamente a la ficha final (paso 8) y rellenar todo desde allí. Los selectores de subclase, ASI, feats y conjuros aparecen en la ficha cuando corresponde.</p>
            </div>
            <div>
              <p class="text-stone-300 font-medium">¿Se guarda automáticamente?</p>
              <p class="text-stone-500">El personaje activo se guarda en el navegador automáticamente. Para guardarlo en la lista de personajes usa el botón <em>Guardar</em> de la ficha final.</p>
            </div>
            <div>
              <p class="text-stone-300 font-medium">¿Puedo importar un personaje de otra sesión?</p>
              <p class="text-stone-500">Sí. Exporta el personaje como JSON desde la ficha final, y en la pantalla de inicio usa el botón de importar JSON.</p>
            </div>
            <div>
              <p class="text-stone-300 font-medium">¿Qué es el "Proficiency Bonus"?</p>
              <p class="text-stone-500">Un bonus que se suma a ataques, saves y habilidades para los que tienes competencia. Empieza en +2 y sube a +3 en nivel 5, +4 en nivel 9, +5 en nivel 13 y +6 en nivel 17.</p>
            </div>
            <div>
              <p class="text-stone-300 font-medium">El feat Tough no me sube los HP</p>
              <p class="text-stone-500">Elige Tough en el selector de ASI/Feat de la ficha y los HP se recalculan automáticamente. Si luego cambias el nivel, los HP vuelven a recalcularse incluyendo el bonus de Tough.</p>
            </div>
            <div>
              <p class="text-stone-300 font-medium">¿Las armas +1/+2/+3 funcionan?</p>
              <p class="text-stone-500">En la pestaña Weapons/Armor usa los botones <span class="text-amber-400">+1 +2 +3</span> a la derecha de cada ítem. Se añaden al inventario y aparecen en el PDF como armas del personaje.</p>
            </div>
          </div>
        </section>

        <p class="text-stone-600 text-xs text-center pb-2">
          D&amp;D 2024 Player's Handbook · Uso personal de mesa de juego
        </p>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active { transition: transform 0.25s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>
