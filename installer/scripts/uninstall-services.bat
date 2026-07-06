@echo off
:: ============================================================
:: INCI Card — Désinstallation des services Windows
:: ============================================================
set "APP_DIR=%~dp0"
set "NSSM=%APP_DIR%tools\nssm.exe"

echo [INCI Card] Arret et suppression des services Windows...

"%NSSM%" stop INCI-Card-App 2>nul
"%NSSM%" remove INCI-Card-App confirm 2>nul

"%NSSM%" stop INCI-Card-Canon 2>nul
"%NSSM%" remove INCI-Card-Canon confirm 2>nul

echo [INCI Card] Services supprimes.
exit /b 0
