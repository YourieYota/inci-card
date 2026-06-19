# LiveView90D

Appli console .NET 8 pour démarrer le LiveView du Canon EOS 90D via le SDK Canon (EDSDK) et écrire en continu les images JPEG sur le PC.

## Prérequis
- Windows 64 bits, .NET 8.
- DLL natives 64 bits `EDSDK.dll` et `EdsImage.dll` placées dans `native/win64` (celles de Lightroom conviennent).  
- Boîtier 90D branché en USB, allumé. Fermez EOS Utility / Lightroom pour libérer l’appareil.

## Build
```powershell
dotnet restore
dotnet build
```

## Utilisation
- Dossier de sortie par défaut : `liveview/` avec un fichier `live.jpg` écrasé à chaque frame (~5 fps) :
```powershell
dotnet run
```

- Changer le dossier de sortie :
```powershell
dotnet run -- --out "D:\LiveView"
```

- Conserver chaque frame (noms horodatés) :
```powershell
dotnet run -- --keep
```

- Ajuster l’intervalle entre frames (ms) :
```powershell
dotnet run -- --interval 100   # ~10 fps si USB suit
```

Arrêt : `Ctrl+C`.  
Le programme ajoute `native/win64` au `PATH` au démarrage pour charger le SDK.
