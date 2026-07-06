:: ============================================================
:: INCI Card — Lanceur (substitut au launcher.exe)
:: Ce script ouvre INCI Card dans le navigateur par défaut
:: Il vérifie que le service est démarré avant d'ouvrir
:: ============================================================
@echo off
setlocal

set "NSSM=%~dp0tools\nssm.exe"
set "URL=http://localhost:3000"

:: Vérifier si le service App est démarré
"%NSSM%" status INCI-Card-App 2>nul | findstr /i "running" >nul
if errorlevel 1 (
    echo [INCI Card] Demarrage du service...
    "%NSSM%" start INCI-Card-App 2>nul
    :: Attendre que le serveur soit prêt (max 30s)
    set /a count=0
    :wait_loop
    timeout /t 2 /nobreak >nul
    powershell -Command "try { $r = Invoke-WebRequest -Uri '%URL%' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" 2>nul
    if errorlevel 1 (
        set /a count+=1
        if !count! lss 15 goto wait_loop
        echo [INCI Card] Le serveur tarde a demarrer. Ouverture quand meme...
    )
)

:: Ouvrir dans le navigateur par défaut
start "" "%URL%"
exit /b 0
