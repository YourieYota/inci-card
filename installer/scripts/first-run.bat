@echo off
setlocal enabledelayedexpansion
:: ============================================================
:: INCI Card — Premier démarrage
:: Initialise la base de données SQLite et migre le schéma
:: ============================================================

set "APP_DIR=%~dp0"
set "NODE_EXE=%APP_DIR%node\node.exe"
set "NEXT_DIR=%APP_DIR%app"
set "DATA_DIR=%APP_DIR%app\data"
set "ENV_FILE=%NEXT_DIR%\.env"

echo [INCI Card] Initialisation de la base de donnees SQLite...

:: Créer le dossier data si absent
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

:: Vérifier que le .env existe (créé par Inno Setup, sinon le créer ici)
if not exist "%ENV_FILE%" (
    echo DB_PROVIDER=sqlite > "%ENV_FILE%"
    echo DATABASE_URL=file:%DATA_DIR%\inci-card.db >> "%ENV_FILE%"
    echo NEXTAUTH_SECRET=inci_card_local_secret_change_me >> "%ENV_FILE%"
    echo NEXTAUTH_URL=http://localhost:3000 >> "%ENV_FILE%"
    echo PHOTO_SERVER_URL=http://localhost:4000 >> "%ENV_FILE%"
    echo NEXT_PUBLIC_PHOTO_SERVER_URL=http://localhost:4000 >> "%ENV_FILE%"
)

:: Appliquer le schéma LibSQL/SQLite avec prisma db push
echo [INCI Card] Application du schema SQLite (LibSQL)...
cd /d "%NEXT_DIR%"
set DB_PROVIDER=sqlite
set DATABASE_URL=file:%DATA_DIR%\inci-card.db

"%NODE_EXE%" node_modules\prisma\build\index.js db push --schema prisma\schema.sqlite.prisma --config prisma.config.sqlite.ts --skip-generate 2>"%APP_DIR%logs\first-run.log"

if %errorlevel% equ 0 (
    echo [INCI Card] Base de donnees initialisee avec succes !
) else (
    echo [INCI Card] Erreur lors de l'initialisation. Voir logs\first-run.log
)

:: Créer un marqueur de premier démarrage
echo %date% %time% > "%DATA_DIR%\initialized.txt"

exit /b 0
