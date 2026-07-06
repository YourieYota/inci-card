; ============================================================
; INCI Card — Script Inno Setup
; Génère un installeur Windows tout-en-un
;
; Prérequis avant de compiler :
;   1. Inno Setup 6 installé (https://jrsoftware.org/isinfo.php)
;   2. Avoir exécuté installer\build.ps1 (prépare les artefacts)
;
; Compiler : iscc.exe installer\setup.iss
; ============================================================

#define AppName       "INCI Card"
#define AppVersion    "1.0.0"
#define AppPublisher  "INCI - Imprimerie Nationale"
#define AppURL        "http://localhost:3000"
#define AppExeName    "INCI-Card.exe"
#define ServiceApp    "INCI-Card-App"
#define ServiceCanon  "INCI-Card-Canon"
#define InstallDir    "{autopf}\INCI-Card"

[Setup]
AppId={{B7A2C4D1-E8F3-4A5B-9C2D-1E6F8A0B3C4D}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={#InstallDir}
DefaultGroupName={#AppName}
OutputDir=installer\dist
OutputBaseFilename=INCI-Card-Setup-v{#AppVersion}
SetupIconFile=installer\assets\icon.ico
WizardImageFile=installer\assets\banner.bmp
WizardSmallImageFile=installer\assets\icon_small.bmp
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\launcher.exe
MinVersion=10.0.17763
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Messages]
french.BeveledLabel=INCI Card {#AppVersion}

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; GroupDescription: "Icônes supplémentaires :"; Flags: checked
Name: "startmenu"; Description: "Créer un raccourci dans le Menu Démarrer"; GroupDescription: "Icônes supplémentaires :"; Flags: checked
Name: "autostart"; Description: "Démarrer INCI Card automatiquement avec Windows"; GroupDescription: "Démarrage :"; Flags: unchecked

; ============================================================
; FICHIERS À INCLURE
; ============================================================
[Files]
; Node.js portable (dossier node\ préparé par build.ps1)
Source: "installer\build\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs

; Application Next.js buildée
Source: "installer\build\app\.next\*";      DestDir: "{app}\app\.next";       Flags: ignoreversion recursesubdirs createallsubdirs
Source: "installer\build\app\node_modules\*"; DestDir: "{app}\app\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "installer\build\app\public\*";     DestDir: "{app}\app\public";      Flags: ignoreversion recursesubdirs createallsubdirs
Source: "installer\build\app\prisma\*";     DestDir: "{app}\app\prisma";      Flags: ignoreversion recursesubdirs createallsubdirs
Source: "installer\build\app\package.json"; DestDir: "{app}\app";             Flags: ignoreversion
Source: "installer\build\app\next.config.ts"; DestDir: "{app}\app";           Flags: ignoreversion
Source: "installer\build\app\prisma.config.sqlite.ts"; DestDir: "{app}\app";  Flags: ignoreversion

; Canon Bridge (exe autonome)
Source: "installer\build\canon-bridge\*"; DestDir: "{app}\canon-bridge"; Flags: ignoreversion recursesubdirs createallsubdirs

; NSSM (gestionnaire de services Windows)
Source: "installer\build\nssm\nssm.exe"; DestDir: "{app}\tools"; Flags: ignoreversion

; Scripts de gestion
Source: "installer\scripts\install-services.bat";   DestDir: "{app}"; Flags: ignoreversion
Source: "installer\scripts\uninstall-services.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer\scripts\first-run.bat";          DestDir: "{app}"; Flags: ignoreversion
Source: "installer\scripts\start.bat";              DestDir: "{app}"; Flags: ignoreversion
Source: "installer\scripts\stop.bat";               DestDir: "{app}"; Flags: ignoreversion
Source: "installer\assets\launcher.exe";            DestDir: "{app}"; Flags: ignoreversion

; ============================================================
; RACCOURCIS
; ============================================================
[Icons]
; Bureau
Name: "{autodesktop}\{#AppName}";         Filename: "{app}\launcher.exe";    WorkingDir: "{app}";        IconFilename: "{app}\launcher.exe"; Tasks: desktopicon
Name: "{autodesktop}\Canon Bridge";       Filename: "{app}\scripts\start.bat"; WorkingDir: "{app}";      Tasks: desktopicon

; Menu Démarrer
Name: "{group}\{#AppName}";              Filename: "{app}\launcher.exe";    WorkingDir: "{app}";        IconFilename: "{app}\launcher.exe"; Tasks: startmenu
Name: "{group}\Arrêter INCI Card";       Filename: "{app}\scripts\stop.bat"; WorkingDir: "{app}";       Tasks: startmenu
Name: "{group}\Désinstaller {#AppName}"; Filename: "{uninstallexe}";         Tasks: startmenu

; Démarrage automatique Windows
Name: "{autostartup}\{#AppName}";        Filename: "{app}\launcher.exe";    WorkingDir: "{app}"; Tasks: autostart

; ============================================================
; COMMANDES POST-INSTALLATION
; ============================================================
[Run]
; 1. Créer le dossier data pour SQLite
Filename: "{cmd}"; Parameters: "/c mkdir ""{app}\app\data"""; Flags: runhidden

; 2. Créer le fichier .env pour le mode local
Filename: "{cmd}"; Parameters: "/c ""{app}\scripts\first-run.bat"""; WorkingDir: "{app}"; Flags: runhidden waituntilterminated; StatusMsg: "Initialisation de la base de données SQLite...";

; 3. Installer les services Windows avec NSSM
Filename: "{cmd}"; Parameters: "/c ""{app}\scripts\install-services.bat"""; WorkingDir: "{app}"; Flags: runhidden waituntilterminated; StatusMsg: "Création des services Windows...";

; 4. Proposer d'ouvrir l'application
Filename: "{app}\launcher.exe"; Description: "Ouvrir INCI Card maintenant"; Flags: nowait postinstall skipifsilent

; ============================================================
; COMMANDES PRÉ-DÉSINSTALLATION
; ============================================================
[UninstallRun]
Filename: "{cmd}"; Parameters: "/c ""{app}\scripts\uninstall-services.bat"""; WorkingDir: "{app}"; Flags: runhidden waituntilterminated

; ============================================================
; CODE PASCAL — Logique personnalisée
; ============================================================
[Code]
// Vérifier si une ancienne installation existe et avertir l'utilisateur
function InitializeSetup(): Boolean;
begin
  Result := True;
end;

// Générer un NEXTAUTH_SECRET aléatoire
function GenerateSecret(): String;
var
  i: Integer;
  chars: String;
  secret: String;
begin
  chars := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  secret := '';
  for i := 1 to 32 do
    secret := secret + chars[Random(Length(chars)) + 1];
  Result := secret;
end;

procedure CreateEnvFile();
var
  envContent: TArrayOfString;
  envPath: String;
  secret: String;
begin
  envPath := ExpandConstant('{app}\app\.env');
  secret := GenerateSecret();

  SetArrayLength(envContent, 10);
  envContent[0] := '# INCI Card — Configuration locale (générée à l''installation)';
  envContent[1] := 'DB_PROVIDER=sqlite';
  envContent[2] := 'DATABASE_URL=file:' + ExpandConstant('{app}') + '\app\data\inci-card.db';
  envContent[3] := 'NEXTAUTH_SECRET=' + secret;
  envContent[4] := 'NEXTAUTH_URL=http://localhost:3000';
  envContent[5] := 'PHOTO_SERVER_URL=http://localhost:4000';
  envContent[6] := 'NEXT_PUBLIC_PHOTO_SERVER_URL=http://localhost:4000';
  envContent[7] := 'STORAGE_PATH=' + ExpandConstant('{app}') + '\app\local-photos';
  envContent[8] := '# URL du serveur central pour la synchronisation (optionnel)';
  envContent[9] := 'CENTRAL_SERVER_URL=';

  SaveStringsToFile(envPath, envContent, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    CreateEnvFile();
  end;
end;
