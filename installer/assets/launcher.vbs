// Lanceur silencieux INCI Card
// Ouvre http://localhost:3000 sans afficher de fenêtre console
var shell = new ActiveXObject("WScript.Shell");
var fso = new ActiveXObject("Scripting.FileSystemObject");
var scriptDir = fso.GetParentFolderName(WScript.ScriptFullName);
var nssm = '"' + scriptDir + '\\tools\\nssm.exe"';

// Démarrer le service si nécessaire
try {
  shell.Run(nssm + ' start INCI-Card-App', 0, false);
} catch(e) {}

// Attendre 2 secondes puis ouvrir le navigateur
WScript.Sleep(2000);
shell.Run('http://localhost:3000', 1, false);
