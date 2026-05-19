@echo off
cd /d "%~dp0"
start "ERP Viewer" cmd /c "node app.js"
echo ERP Viewer iniciado en http://localhost:3000
echo.
echo Presione cualquier tecla para verificar...
pause >nul
