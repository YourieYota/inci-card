# ============================================================
# INCI Card — Script de build de l'installeur Windows
#
# Usage : .\installer\build.ps1
# Prérequis :
#   - Inno Setup 6 installé (https://jrsoftware.org/isinfo.php)
#   - Git
#   - Connexion Internet pour télécharger Node.js et NSSM
#
# Ce script :
#   1. Télécharge Node.js 20 LTS portable (si absent)
#   2. Télécharge NSSM (si absent)
#   3. Génère le client Prisma pour SQLite
#   4. Build Next.js en mode SQLite
#   5. Copie les artefacts dans installer\build\
#   6. Copie le Canon Bridge depuis le Bureau
#   7. Lance iscc.exe pour compiler le setup.exe final
# ============================================================

param(
    [string]$NodeVersion = "20.18.1",
    [string]$NssmVersion = "2.24",
    [string]$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\iscc.exe",
    [string]$CanonBridgeSource = "$env:USERPROFILE\Desktop\canon-local-bridge"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$BuildDir = "$ScriptDir\build"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INCI Card - Build de l'installeur     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# ÉTAPE 1 : Préparer la structure build\
# ============================================================
Write-Host "[1/7] Preparation du repertoire de build..." -ForegroundColor Yellow
if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
New-Item -ItemType Directory -Path "$BuildDir\node", "$BuildDir\app", "$BuildDir\canon-bridge", "$BuildDir\nssm" -Force | Out-Null
New-Item -ItemType Directory -Path "$ScriptDir\dist" -Force | Out-Null

# ============================================================
# ÉTAPE 2 : Télécharger Node.js 20 LTS portable
# ============================================================
Write-Host "[2/7] Verification de Node.js $NodeVersion portable..." -ForegroundColor Yellow
$NodeZip = "$ScriptDir\node-v$NodeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"

if (-not (Test-Path $NodeZip)) {
    Write-Host "    Telechargement de Node.js $NodeVersion..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip -UseBasicParsing
    Write-Host "    Telechargement termine." -ForegroundColor Green
} else {
    Write-Host "    Node.js deja present en cache." -ForegroundColor Green
}

Write-Host "    Extraction de Node.js..." -ForegroundColor Gray
Expand-Archive -Path $NodeZip -DestinationPath "$BuildDir\node_temp" -Force
$NodeFolder = Get-ChildItem "$BuildDir\node_temp" -Directory | Select-Object -First 1
Move-Item "$($NodeFolder.FullName)\*" "$BuildDir\node\" -Force
Remove-Item "$BuildDir\node_temp" -Recurse -Force
Write-Host "    Node.js $NodeVersion pret." -ForegroundColor Green

# ============================================================
# ÉTAPE 3 : Télécharger NSSM
# ============================================================
Write-Host "[3/7] Verification de NSSM $NssmVersion..." -ForegroundColor Yellow
$NssmZip = "$ScriptDir\nssm-$NssmVersion.zip"
$NssmUrl = "https://nssm.cc/release/nssm-$NssmVersion.zip"

if (-not (Test-Path $NssmZip)) {
    Write-Host "    Telechargement de NSSM..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $NssmUrl -OutFile $NssmZip -UseBasicParsing
    Write-Host "    Telechargement termine." -ForegroundColor Green
} else {
    Write-Host "    NSSM deja present en cache." -ForegroundColor Green
}

Write-Host "    Extraction de NSSM..." -ForegroundColor Gray
Expand-Archive -Path $NssmZip -DestinationPath "$BuildDir\nssm_temp" -Force
$NssmExe = Get-ChildItem "$BuildDir\nssm_temp" -Recurse -Filter "nssm.exe" | Where-Object { $_.FullName -like "*win64*" } | Select-Object -First 1
if (-not $NssmExe) {
    $NssmExe = Get-ChildItem "$BuildDir\nssm_temp" -Recurse -Filter "nssm.exe" | Select-Object -First 1
}
Copy-Item $NssmExe.FullName "$BuildDir\nssm\nssm.exe" -Force
Remove-Item "$BuildDir\nssm_temp" -Recurse -Force
Write-Host "    NSSM pret." -ForegroundColor Green

# ============================================================
# ÉTAPE 4 : Copier le Canon Bridge
# ============================================================
Write-Host "[4/7] Copie du Canon Bridge..." -ForegroundColor Yellow
if (Test-Path $CanonBridgeSource) {
    Copy-Item "$CanonBridgeSource\*" "$BuildDir\canon-bridge\" -Recurse -Force
    Write-Host "    Canon Bridge copie depuis : $CanonBridgeSource" -ForegroundColor Green
} else {
    Write-Host "    ATTENTION : Canon Bridge introuvable a $CanonBridgeSource" -ForegroundColor Red
    Write-Host "    L'installeur sera cree sans le Canon Bridge." -ForegroundColor Red
}

# ============================================================
# ÉTAPE 5 : Générer le client Prisma SQLite
# ============================================================
Write-Host "[5/7] Generation du client Prisma pour SQLite..." -ForegroundColor Yellow
Set-Location $ProjectDir
$env:DATABASE_URL = "file:./data/inci-card.db"
$env:DB_PROVIDER = "sqlite"

# Générer le client Prisma avec le schéma SQLite
& node_modules\.bin\prisma generate --schema prisma\schema.sqlite.prisma
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : prisma generate a echoue." -ForegroundColor Red
    exit 1
}
Write-Host "    Client Prisma SQLite genere." -ForegroundColor Green

# ============================================================
# ÉTAPE 6 : Build Next.js en mode SQLite
# ============================================================
Write-Host "[6/7] Build de l'application Next.js (mode SQLite)..." -ForegroundColor Yellow
$env:DB_PROVIDER = "sqlite"
$env:DATABASE_URL = "file:./data/inci-card.db"
$env:NODE_ENV = "production"

& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : next build a echoue." -ForegroundColor Red
    exit 1
}

# Copier les fichiers buildés
Write-Host "    Copie des artefacts Next.js..." -ForegroundColor Gray
$AppFiles = @(".next", "node_modules", "public", "prisma", "package.json", "next.config.ts", "prisma.config.sqlite.ts")
foreach ($f in $AppFiles) {
    if (Test-Path "$ProjectDir\$f") {
        Copy-Item "$ProjectDir\$f" "$BuildDir\app\$f" -Recurse -Force
    }
}
Write-Host "    Application buildee." -ForegroundColor Green

# ============================================================
# ÉTAPE 7 : Compiler l'installeur avec Inno Setup
# ============================================================
Write-Host "[7/7] Compilation de l'installeur..." -ForegroundColor Yellow

if (-not (Test-Path $InnoSetupPath)) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  INNO SETUP NON TROUVE !" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Inno Setup n'est pas installe sur cette machine." -ForegroundColor Yellow
    Write-Host "Telechargez-le ici : https://jrsoftware.org/isinfo.php" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Une fois installe, relancez ce script ou compilez manuellement :" -ForegroundColor Gray
    Write-Host '  & "C:\Program Files (x86)\Inno Setup 6\iscc.exe" installer\setup.iss' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Les artefacts de build sont prets dans : installer\build\" -ForegroundColor Green
    exit 0
}

& $InnoSetupPath "$ScriptDir\setup.iss"
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  INSTALLEUR CREE AVEC SUCCES !         " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    $Installer = Get-ChildItem "$ScriptDir\dist" -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Write-Host "  Fichier : $($Installer.FullName)" -ForegroundColor Cyan
    Write-Host "  Taille  : $([math]::Round($Installer.Length / 1MB, 1)) MB" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "ERREUR : La compilation Inno Setup a echoue." -ForegroundColor Red
    exit 1
}
