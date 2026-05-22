@echo off
:: Documento generado el 2026-05-19-2245
:: arrancar.bat — arranca el servidor de desarrollo y abre el navegador
echo.
echo  D^&D 2024 Character Builder — Arrancar
echo  ========================================
echo.

:: Verificar que Node.js esta instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo  Ejecuta instalar.bat primero.
    pause
    exit /b 1
)

:: Verificar que las dependencias estan instaladas
if not exist "node_modules\" (
    echo  [ERROR] Las dependencias no estan instaladas.
    echo  Ejecuta instalar.bat primero.
    echo.
    pause
    exit /b 1
)

echo  Iniciando servidor...
echo  La app se abrira en tu navegador en unos segundos.
echo.
echo  Para detener el servidor cierra esta ventana o pulsa Ctrl+C
echo.

:: Abrir el navegador tras 3 segundos (tiempo suficiente para que Vite arranque)
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173/dnd-character-builder/"

:: Arrancar Vite
npm run dev
