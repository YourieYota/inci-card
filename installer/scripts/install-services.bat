@echo off
setlocal enabledelayedexpansion
:: ============================================================
:: INCI Card — Installation des services Windows
:: Exécuté automatiquement par l'installeur Inno Setup
:: ============================================================

set "APP_DIR=%~dp0"
set "NODE_EXE=%APP_DIR%node\node.exe"
set "NSSM=%APP_DIR%tools\nssm.exe"
set "NEXT_DIR=%APP_DIR%app"
set "CANON_EXE=%APP_DIR%canon-bridge\canon-bridge.exe"

echo [INCI Card] Installation des services Windows...

:: --- Supprimer les anciens services si existants ---
"%NSSM%" stop INCI-Card-App 2>nul
"%NSSM%" remove INCI-Card-App confirm 2>nul
"%NSSM%" stop INCI-Card-Canon 2>nul
"%NSSM%" remove INCI-Card-Canon confirm 2>nul

:: --- Service 1 : Application Next.js ---
echo [INCI Card] Creation du service INCI-Card-App...
"%NSSM%" install INCI-Card-App "%NODE_EXE%"
"%NSSM%" set INCI-Card-App AppDirectory "%NEXT_DIR%"
"%NSSM%" set INCI-Card-App AppParameters "node_modules\next\dist\bin\next start -p 3000"
"%NSSM%" set INCI-Card-App DisplayName "INCI Card - Application"
"%NSSM%" set INCI-Card-App Description "Serveur INCI Card (Next.js) - Port 3000"
"%NSSM%" set INCI-Card-App Start SERVICE_AUTO_START
"%NSSM%" set INCI-Card-App AppEnvironmentExtra "DB_PROVIDER=sqlite" "NODE_ENV=production"
"%NSSM%" set INCI-Card-App AppStdout "%APP_DIR%logs\app.log"
"%NSSM%" set INCI-Card-App AppStderr "%APP_DIR%logs\app-error.log"
"%NSSM%" set INCI-Card-App AppRotateFiles 1
"%NSSM%" set INCI-Card-App AppRotateBytes 1048576

:: --- Service 2 : Canon Bridge ---
if exist "%CANON_EXE%" (
    echo [INCI Card] Creation du service INCI-Card-Canon...
    "%NSSM%" install INCI-Card-Canon "%CANON_EXE%"
    "%NSSM%" set INCI-Card-Canon AppDirectory "%APP_DIR%canon-bridge"
    "%NSSM%" set INCI-Card-Canon DisplayName "INCI Card - Canon Bridge"
    "%NSSM%" set INCI-Card-Canon Description "Pont Canon EDSDK - Port 4000"
    "%NSSM%" set INCI-Card-Canon Start SERVICE_AUTO_START
    "%NSSM%" set INCI-Card-Canon AppStdout "%APP_DIR%logs\canon.log"
    "%NSSM%" set INCI-Card-Canon AppStderr "%APP_DIR%logs\canon-error.log"
    "%NSSM%" set INCI-Card-Canon AppRotateFiles 1
) else (
    echo [INCI Card] Canon Bridge introuvable - service non installe.
)

:: --- Créer le dossier logs ---
if not exist "%APP_DIR%logs" mkdir "%APP_DIR%logs"

:: --- Démarrer les services ---
echo [INCI Card] Demarrage des services...
"%NSSM%" start INCI-Card-App
timeout /t 3 /nobreak >nul
if exist "%CANON_EXE%" "%NSSM%" start INCI-Card-Canon

echo [INCI Card] Services installes avec succes !
exit /b 0
