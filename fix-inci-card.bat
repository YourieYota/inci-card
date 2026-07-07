@echo off
echo ==============================================
echo   INCI Card - FIX COMPLET (Admin requis)     
echo ==============================================
echo.

:: Verify admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERREUR: Ce script doit etre lance en tant qu'Administrateur !
    echo Clic droit ^> Executer en tant qu'administrateur
    pause
    exit /b 1
)

echo [1/5] Arret du service INCI-Card-App...
net stop INCI-Card-App 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/5] Patch du client Prisma (injection URL SQLite)...
cd /d "C:\Program Files\INCI-Card\app"
node "d:\inci-card\patch-prisma-client.js"
if %errorLevel% neq 0 (
    echo ERREUR lors du patch Prisma !
    pause
    exit /b 1
)

echo.
echo [3/5] Creation de la base de donnees et tables...
node "d:\inci-card\init-db-direct.js"
if %errorLevel% neq 0 (
    echo ERREUR lors de la creation de la base !
    pause
    exit /b 1
)

echo.
echo [4/5] Test de connexion Prisma...
node -e "const path=require('path'); const {PrismaClient}=require(path.join('C:\\Program Files\\INCI-Card\\app','node_modules','@prisma','client')); const {createClient}=require('@libsql/client'); const {PrismaLibSql}=require('@prisma/adapter-libsql'); const url='file:C:/Program Files/INCI-Card/app/data/inci-card.db'; const libsql=createClient({url}); const adapter=new PrismaLibSql(libsql); const prisma=new PrismaClient({adapter}); prisma.user.findMany().then(r=>{console.log('    Connexion OK! Utilisateurs:',r.map(u=>u.login)); process.exit(0)}).catch(e=>{console.error('    ERREUR:',e.message.substring(0,200)); process.exit(1)})"
if %errorLevel% neq 0 (
    echo ERREUR: Le test Prisma a echoue !
    pause
    exit /b 1
)

echo.
echo [5/5] Redemarrage du service INCI-Card-App...
net start INCI-Card-App

echo.
echo ==============================================
echo   TERMINE AVEC SUCCES !
echo   Connectez-vous avec: admin / admin123
echo ==============================================
echo.
pause
