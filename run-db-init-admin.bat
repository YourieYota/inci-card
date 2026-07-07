@echo off
echo ==============================================
echo   INCI Card - Initialisation Manuelle DB     
echo ==============================================
echo.

echo [1/6] Arret temporaire des services pour deverrouiller les fichiers...
net stop INCI-Card-App
net stop INCI-Card-Canon

echo.
echo [2/6] Copie du schema et de la configuration SQLite...
cd /d "C:\Program Files\INCI-Card\app"
copy /y "d:\inci-card\prisma\schema.sqlite.prisma" "C:\Program Files\INCI-Card\app\prisma\schema.sqlite.prisma"
copy /y "d:\inci-card\prisma.config.sqlite.ts" "C:\Program Files\INCI-Card\app\prisma.config.sqlite.ts"

echo.
echo [3/6] Regeneration locale du client Prisma pour SQLite...
node node_modules\prisma\build\index.js generate --schema prisma\schema.sqlite.prisma --config prisma.config.sqlite.ts

echo.
echo [4/6] Application du schema SQLite...
node node_modules\prisma\build\index.js db push --schema prisma\schema.sqlite.prisma --config prisma.config.sqlite.ts

echo.
echo [5/6] Creation du compte Administrateur (seeding)...
node prisma\seed.js

echo.
echo [6/6] Redemarrage des services INCI Card...
net start INCI-Card-App
net start INCI-Card-Canon

echo.
echo ==============================================
echo   Initialisation terminee avec succes !
echo ==============================================
echo.
pause
