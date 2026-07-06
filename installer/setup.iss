; ============================================================
; INCI Card — Script Inno Setup
; Compiler depuis le dossier racine du projet :
;   & "C:\Program Files (x86)\Inno Setup 6\iscc.exe" installer\setup.iss
;
; IMPORTANT : Les chemins relatifs sont résolus depuis le dossier
; contenant ce fichier .iss, c'est-à-dire installer\
; ============================================================

#define AppName       "INCI Card"
#define AppVersion    "1.0.0"
#define AppPublisher  "INCI"
#define AppURL        "http://localhost:3000"
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
OutputDir=dist
OutputBaseFilename=INCI-Card-Setup-v{#AppVersion}
SetupIconFile=assets\icon.ico
WizardImageFile=assets\banner.bmp
WizardSmallImageFile=assets\icon_small.bmp
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\tools\nssm.exe
MinVersion=10.0.17763
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; GroupDescription: "Options :"
Name: "autostart"; Description: "Demarrer INCI Card automatiquement avec Windows"; GroupDescription: "Options :"; Flags: unchecked

; ============================================================
; FICHIERS À INCLURE
; Chemins relatifs au dossier installer\
; ============================================================
[Files]
; Node.js portable
Source: "build\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs

; Application Next.js — production (le cache dev/ a ete supprime avant compilation)
Source: "build\app\.next\*"; DestDir: "{app}\app\.next"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "\dev\*"
Source: "build\app\node_modules\*"; DestDir: "{app}\app\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "build\app\public\*";       DestDir: "{app}\app\public";       Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "\*.md"
Source: "build\app\prisma\*";       DestDir: "{app}\app\prisma";       Flags: ignoreversion recursesubdirs createallsubdirs
Source: "build\app\package.json";   DestDir: "{app}\app";              Flags: ignoreversion
Source: "build\app\next.config.ts"; DestDir: "{app}\app";              Flags: ignoreversion skipifsourcedoesntexist

; Canon Bridge
Source: "build\canon-bridge\*"; DestDir: "{app}\canon-bridge"; Flags: ignoreversion recursesubdirs createallsubdirs

; NSSM
Source: "build\nssm\nssm.exe"; DestDir: "{app}\tools"; Flags: ignoreversion

; Scripts de gestion
Source: "scripts\install-services.bat";   DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\uninstall-services.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\first-run.bat";          DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\start.bat";              DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\stop.bat";               DestDir: "{app}"; Flags: ignoreversion

; Lanceur silencieux VBS (remplace launcher.exe)
Source: "assets\launcher.vbs"; DestDir: "{app}"; Flags: ignoreversion

; ============================================================
; RACCOURCIS
; ============================================================
[Icons]
; Bureau
Name: "{autodesktop}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\tools\nssm.exe"; Tasks: desktopicon
; Menu Démarrer
Name: "{group}\{#AppName}";              Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\tools\nssm.exe"
Name: "{group}\Arrêter INCI Card";       Filename: "{app}\stop.bat";    WorkingDir: "{app}"
Name: "{group}\Désinstaller {#AppName}"; Filename: "{uninstallexe}"
; Démarrage automatique
Name: "{autostartup}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher.vbs"""; WorkingDir: "{app}"; Tasks: autostart

; ============================================================
; COMMANDES POST-INSTALLATION
; ============================================================
[Run]
; 1. Créer le dossier data et logs
Filename: "{cmd}"; Parameters: "/c mkdir ""{app}\app\data"" 2>nul & mkdir ""{app}\logs"" 2>nul"; Flags: runhidden

; 2. Créer le .env et initialiser la base SQLite
Filename: "{cmd}"; Parameters: "/c ""{app}\first-run.bat"""; WorkingDir: "{app}"; Flags: runhidden waituntilterminated; StatusMsg: "Initialisation de la base de données..."

; 3. Installer les services Windows
Filename: "{cmd}"; Parameters: "/c ""{app}\install-services.bat"""; WorkingDir: "{app}"; Flags: runhidden waituntilterminated; StatusMsg: "Création des services Windows..."

; 4. Ouvrir l'application
Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher.vbs"""; Description: "Ouvrir INCI Card maintenant"; Flags: nowait postinstall skipifsilent

; ============================================================
; DÉSINSTALLATION
; ============================================================
[UninstallRun]
Filename: "{cmd}"; Parameters: "/c ""{app}\uninstall-services.bat"""; WorkingDir: "{app}"; Flags: runhidden waituntilterminated

; ============================================================
; CODE PASCAL — Générer le .env avec secret aléatoire
; ============================================================
[Code]
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

procedure CurStepChanged(CurStep: TSetupStep);
var
  envContent: TArrayOfString;
  envPath: String;
  secret: String;
  dataPath: String;
begin
  if CurStep = ssPostInstall then
  begin
    envPath := ExpandConstant('{app}\app\.env');
    dataPath := ExpandConstant('{app}\app\data');
    secret := GenerateSecret();

    SetArrayLength(envContent, 9);
    envContent[0] := 'DB_PROVIDER=sqlite';
    envContent[1] := 'DATABASE_URL=file:' + dataPath + '\inci-card.db';
    envContent[2] := 'NEXTAUTH_SECRET=' + secret;
    envContent[3] := 'NEXTAUTH_URL=http://localhost:3000';
    envContent[4] := 'PHOTO_SERVER_URL=http://localhost:4000';
    envContent[5] := 'NEXT_PUBLIC_PHOTO_SERVER_URL=http://localhost:4000';
    envContent[6] := 'STORAGE_PATH=' + ExpandConstant('{app}') + '\app\local-photos';
    envContent[7] := 'NODE_ENV=production';
    envContent[8] := 'CENTRAL_SERVER_URL=';

    SaveStringsToFile(envPath, envContent, False);
  end;
end;
