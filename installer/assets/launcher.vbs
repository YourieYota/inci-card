' Lanceur silencieux INCI Card
' Ouvre http://localhost:3000 sans afficher de fenêtre console
Dim shell, fso, scriptDir, nssm
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
nssm = """" & scriptDir & "\tools\nssm.exe"""

' Demarrer le service si necessaire
On Error Resume Next
shell.Run nssm & " start INCI-Card-App", 0, False
On Error GoTo 0

' Attendre 2 secondes puis ouvrir le navigateur
WScript.Sleep 2000
shell.Run "http://localhost:3000", 1, False
