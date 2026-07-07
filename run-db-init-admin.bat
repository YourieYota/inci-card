@echo off
echo ==============================================
echo   INCI Card - Initialisation Manuelle DB     
echo ==============================================
echo.

echo [1/3] Arret temporaire du service application...
net stop INCI-Card-App 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/3] Initialisation de la base de donnees SQLite...
cd /d "C:\Program Files\INCI-Card\app"
node "d:\inci-card\init-db-direct.js"

echo.
echo [3/3] Redemarrage du service application...
net start INCI-Card-App

echo.
echo ==============================================
echo   Termine ! Connectez-vous avec admin/admin123
echo ==============================================
echo.
pause
