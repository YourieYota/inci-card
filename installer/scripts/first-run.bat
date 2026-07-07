@echo off
setlocal enabledelayedexpansion
:: ============================================================
:: INCI Card — Premier démarrage
:: Initialise la base de données SQLite et crée le compte admin
:: Prisma 7 : bypass CLI, utilise @libsql/client directement
:: ============================================================

set "APP_DIR=%~dp0"
set "NODE_EXE=%APP_DIR%node\node.exe"
set "NEXT_DIR=%APP_DIR%app"
set "DATA_DIR=%APP_DIR%app\data"
set "LOG_DIR=%APP_DIR%logs"
set "ENV_FILE=%NEXT_DIR%\.env"

echo [INCI Card] Initialisation de la base de donnees SQLite...

:: Créer les dossiers si absents
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Créer le .env s'il n'existe pas
if not exist "%ENV_FILE%" (
    echo DB_PROVIDER=sqlite > "%ENV_FILE%"
    echo DATABASE_URL=file:%DATA_DIR%\inci-card.db >> "%ENV_FILE%"
    echo NEXTAUTH_SECRET=inci_card_local_secret_change_me >> "%ENV_FILE%"
    echo NEXTAUTH_URL=http://localhost:3000 >> "%ENV_FILE%"
    echo PHOTO_SERVER_URL=http://localhost:4000 >> "%ENV_FILE%"
    echo NEXT_PUBLIC_PHOTO_SERVER_URL=http://localhost:4000 >> "%ENV_FILE%"
)

cd /d "%NEXT_DIR%"
set DB_PROVIDER=sqlite
set DATABASE_URL=file:%DATA_DIR%\inci-card.db

:: ---- Étape 1 : Patch du client Prisma (injection URL dans inlineSchema) ----
echo [INCI Card] Patch du client Prisma (injection URL SQLite)...
"%NODE_EXE%" -e "const fs=require('fs'),p=require('path');const f=p.join(__dirname,'node_modules','.prisma','client','index.js');let c=fs.readFileSync(f,'utf8');const s='datasource db {\\n  provider = \\\"sqlite\\\"\\n}';const r='datasource db {\\n  provider = \\\"sqlite\\\"\\n  url      = \\\"file:./data/inci-card.db\\\"\\n}';if(c.includes(s)){c=c.replace(s,r);fs.writeFileSync(f,c);console.log('Prisma client patched OK')}else if(c.includes('file:./data/inci-card.db')){console.log('Already patched')}else{console.log('WARNING: pattern not found')}" >> "%LOG_DIR%\first-run.log" 2>&1
echo [INCI Card] Patch Prisma termine.

:: ---- Étape 2 : Créer les tables SQLite directement via @libsql/client ----
echo [INCI Card] Creation des tables SQLite...
"%NODE_EXE%" "%NEXT_DIR%\scripts\init-db.js" >> "%LOG_DIR%\first-run.log" 2>&1
if !errorlevel! equ 0 (
    echo [INCI Card] Base de donnees initialisee avec succes !
) else (
    echo [INCI Card] Erreur lors de l'initialisation. Voir logs\first-run.log
)

:: Créer un marqueur de premier démarrage
echo %date% %time% > "%DATA_DIR%\initialized.txt"

exit /b 0
