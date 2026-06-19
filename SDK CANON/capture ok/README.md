# CanonCapture (EOS 90D)

Petite appli console .NET 8 pour déclencher un Canon EOS 90D via le SDK Canon (EDSDK) et rapatrier la dernière photo sur le PC.

## Prérequis
- Windows 64 bits, .NET 8 (`dotnet --version` doit répondre).
- Les DLL natives 64 bits `EDSDK.dll` et `EdsImage.dll`. Ici elles proviennent de Lightroom (`C:\Program Files\Adobe\Adobe Lightroom Classic`) et sont copiées dans `native/win64`. Vous pouvez les remplacer par celles du SDK Canon officiel si besoin.
- Fermez EOS Utility, Lightroom ou tout logiciel qui monopolise le boîtier avant d’exécuter l’appli.

## Installation
```powershell
dotnet restore
```

## Utilisation
- Déclenchement + téléchargement de la photo dans `captures/` :
```powershell
dotnet run
```

- Changer le dossier de sortie :
```powershell
dotnet run -- --out "D:\\Sessions\\shoot1"
```

La console affiche le chemin du fichier sauvegardé (ex. `captures\\IMG_XXXX.JPG`).

## Notes techniques
- Le projet force `win-x64` et ajoute `native/win64` au `PATH` au démarrage pour que le P/Invoke charge les DLL Canon.
- L’API haut niveau vient du paquet NuGet `EDSDKWrapper.Framework` (wrapper EDSDK).
- Le code attend ~1 seconde après le déclenchement avant de tirer la dernière image via `GetLastPhoto`, ce qui suffit pour le 90D en mode USB.
