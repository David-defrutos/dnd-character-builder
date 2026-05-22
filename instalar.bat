@echo off
:: Documento generado el 2026-05-19-2245
:: instalar.bat — instala las dependencias del proyecto (solo hace falta la primera vez)
echo.
echo  D^&D 2024 Character Builder — Instalacion
echo  ==========================================
echo.

:: Verificar que Node.js esta instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo.
    echo  Descargalo desde: https://nodejs.org/
    echo  Elige la version LTS ^(boton verde^) e instalala con la configuracion
    echo  por defecto. Luego cierra esta ventana y vuelve a ejecutar instalar.bat
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  Node.js detectado: %NODE_VER%
echo.
echo  Instalando dependencias ^(puede tardar 2-3 minutos la primera vez^)...
echo.

npm install

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] La instalacion fallo. Comprueba tu conexion a internet
    echo  e intentalo de nuevo.
    pause
    exit /b 1
)

echo.
echo  Instalacion completada correctamente.
echo  Ahora puedes ejecutar: arrancar.bat
echo.
pause
