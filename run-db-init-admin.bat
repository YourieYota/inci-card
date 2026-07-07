@echo off
cd /d "C:\Program Files\INCI-Card\app"
set DB_PROVIDER=sqlite
set DATABASE_URL=file:C:\Program Files\INCI-Card\app\data\inci-card.db

echo ==============================================
echo   INCI Card - Initialisation Manuelle DB     
echo ==============================================
echo.

echo [1/4] Copie du schema et de la configuration SQLite...
copy /y "d:\inci-card\prisma\schema.sqlite.prisma" "C:\Program Files\INCI-Card\app\prisma\schema.sqlite.prisma"
copy /y "d:\inci-card\prisma.config.sqlite.ts" "C:\Program Files\INCI-Card\app\prisma.config.sqlite.ts"

echo.
echo [2/4] Regeneration locale du client Prisma pour SQLite...
node node_modules\prisma\build\index.js generate --schema prisma\schema.sqlite.prisma --config prisma.config.sqlite.ts

echo.
echo [3/4] Application du schema SQLite...
node node_modules\prisma\build\index.js db push --schema prisma\schema.sqlite.prisma --config prisma.config.sqlite.ts

echo.
echo [4/4] Creation du compte Administrateur (seeding)...
node prisma\seed.js

echo.
echo ==============================================
echo   Initialisation terminee !
echo ==============================================
echo.
pause
