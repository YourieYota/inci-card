@echo off
set "APP_DIR=%~dp0"
set "NSSM=%APP_DIR%tools\nssm.exe"
echo [INCI Card] Demarrage manuel des services...
"%NSSM%" start INCI-Card-App
"%NSSM%" start INCI-Card-Canon 2>nul
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
exit /b 0
