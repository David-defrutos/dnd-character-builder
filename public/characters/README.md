# Shared Characters

Carpeta para JSONs de personajes que quieres tener disponibles en la web.

## Cómo añadir un personaje

1. Exporta el JSON del PJ desde la app (Step9 → Export JSON).
2. Copia el `.json` en esta carpeta. El nombre del archivo es libre
   (recomendado: `nombre-clase-lvN.json`, ej. `salusa-bard-lv10.json`).
3. Regenera el índice:

   ```bash
   npm run rebuild-characters
   ```

4. Reconstruye la web y despliega:

   ```bash
   npm run build
   git add -A
   git commit -m "Add character: Salusa lv.10"
   git push
   ```

## Cómo funciona

La app no puede listar el contenido de una carpeta desde el navegador, así
que mantenemos un `index.json` con la lista de archivos disponibles. El
script `scripts/rebuild-characters-index.ts` lo regenera automáticamente
escaneando esta carpeta.

Al abrir la app desde el móvil o cualquier navegador, una nueva vista
"Shared Characters" lista todos los PJs disponibles. Pulsa "Load" y se
importan al store local; desde ese momento puedes consultarlos en Step9
o exportar su PDF.

## Notas

- No incluir aquí PJs con datos sensibles: esta carpeta se publica con la
  web (es `public/characters/`).
- Los archivos del índice son los que el script encuentra con extensión
  `.json` exceptuando `index.json` (que es el propio índice).
- Si un PJ deja de ser interesante: borra el `.json` y vuelve a ejecutar
  `npm run rebuild-characters` (el índice quedará sin esa entrada).
