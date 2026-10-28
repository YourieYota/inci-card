# ============================================================
# INCI CARD - Installation d'un kit terrain sur le PC terrain
#
# Utilisation (depuis le dossier du projet) :
#   powershell -ExecutionPolicy Bypass -File scripts\installer-kit-terrain.ps1 -Kit "C:\chemin\kit-terrain-xxxx.sql"
#
# Le script démarre la base Docker, installe le kit (structure + données
# + mode terrain activé) puis démarre l'application.
# ATTENTION : la base de CE PC est entièrement remplacée.
# ============================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$Kit
)

$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$container = 'inci_card_db'

function Get-EnvValue([string]$name, [string]$default) {
    $envFile = Join-Path $projectDir '.env'
    if (Test-Path $envFile) {
        $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
        if ($line) { return ($line -split '=', 2)[1].Trim().Trim('"') }
    }
    return $default
}

if (-not (Test-Path $Kit)) {
    Write-Host "Fichier kit introuvable : $Kit" -ForegroundColor Red
    exit 1
}
$Kit = (Resolve-Path $Kit).Path

$header = Get-Content $Kit -TotalCount 3 -Encoding UTF8
if (-not ($header -match 'KIT TERRAIN')) {
    Write-Host "Ce fichier n'est pas un kit terrain INCI CARD." -ForegroundColor Red
    exit 1
}

$dbUser = Get-EnvValue 'POSTGRES_USER' 'incicard'
$dbName = Get-EnvValue 'POSTGRES_DB' 'incicard_db'

Write-Host ""
Write-Host "Kit : $Kit" -ForegroundColor Cyan
Get-Content $Kit -TotalCount 6 -Encoding UTF8 | Select-Object -Skip 2 | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "ATTENTION : la base de donnees de CE PC va etre entierement remplacee par le kit." -ForegroundColor Yellow
Write-Host "Ne lancez JAMAIS ce script sur le serveur principal." -ForegroundColor Yellow
$answer = Read-Host "Tapez TERRAIN pour continuer"
if ($answer -ne 'TERRAIN') {
    Write-Host "Installation annulee."
    exit 0
}

Push-Location $projectDir
try {
    Write-Host "`n[1/4] Demarrage de la base de donnees..." -ForegroundColor Cyan
    docker compose up -d db
    if ($LASTEXITCODE -ne 0) { throw "Impossible de demarrer la base (docker compose up -d db)." }

    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        docker exec $container pg_isready -U $dbUser -d $dbName *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw "La base ne repond pas apres 60 secondes." }

    Write-Host "[2/4] Copie du kit dans le conteneur..." -ForegroundColor Cyan
    docker cp $Kit "${container}:/tmp/kit-terrain.sql"
    if ($LASTEXITCODE -ne 0) { throw "Copie du kit impossible." }

    Write-Host "[3/4] Installation du kit..." -ForegroundColor Cyan
    docker exec $container psql -v ON_ERROR_STOP=1 -q -U $dbUser -d $dbName -f /tmp/kit-terrain.sql
    $installCode = $LASTEXITCODE
    docker exec $container rm -f /tmp/kit-terrain.sql *> $null
    if ($installCode -ne 0) { throw "L'installation du kit a echoue (voir le message ci-dessus). La base n'a pas ete modifiee." }

    Write-Host "[4/4] Demarrage de l'application..." -ForegroundColor Cyan
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { throw "Impossible de demarrer l'application (docker compose up -d)." }

    Write-Host "`nKit terrain installe. Le mode terrain est actif." -ForegroundColor Green
    Write-Host "Les autres PC du reseau peuvent se connecter avec l'adresse IP de ce PC."
}
catch {
    Write-Host "`n$_" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
