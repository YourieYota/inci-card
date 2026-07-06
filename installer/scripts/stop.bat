@echo off
set "APP_DIR=%~dp0"
set "NSSM=%APP_DIR%tools\nssm.exe"
echo [INCI Card] Arret des services...
"%NSSM%" stop INCI-Card-App
"%NSSM%" stop INCI-Card-Canon 2>nul
echo [INCI Card] Services arretes.
exit /b 0
