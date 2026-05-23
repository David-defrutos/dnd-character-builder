@echo off
setlocal enabledelayedexpansion

echo.
echo === Subir cambios a GitHub ===
echo.

echo Regenerando indice de personajes...
call npm run rebuild-characters
if errorlevel 1 (
    echo.
    echo ERROR: Fallo al regenerar el indice. Abortando.
    echo.
    pause
    exit /b 1
)

echo.
set /p "MSG=Mensaje del commit (Enter para usar fecha/hora): "

if "!MSG!"=="" (
    set "MSG=update %date% %time%"
)

echo.
echo === Subiendo: !MSG! ===
echo.

git add -A
git commit -m "!MSG!"
git push

echo.
echo === Abriendo paginas ===
start "" "https://github.com/David-defrutos/dnd-character-builder/actions"
start "" "https://david-defrutos.github.io/dnd-character-builder/builder"

echo.