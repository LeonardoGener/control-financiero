@echo off
REM Script para iniciar un servidor local y abrir la web en el navegador
cd /d "%~dp0"

REM Abre una nueva ventana de CMD que ejecuta http-server (usa npx si no está instalado globalmente)
start "Servidor" cmd /k "npx http-server -p 8080"

REM Abre la app en el navegador por defecto
start "" "http://localhost:8080"

exit /b 0
