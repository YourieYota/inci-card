# INCI Card — Guide de création de l'installeur Windows

## Prérequis

Avant de créer l'installeur, assurez-vous d'avoir :

1. **Inno Setup 6** — [Télécharger](https://jrsoftware.org/isinfo.php)
2. **Git** installé
3. **Node.js 20+** installé (pour le build)
4. Le **Canon Bridge** dans `C:\Users\YOURIE\Desktop\canon-local-bridge\`
5. Une connexion Internet (pour télécharger Node.js portable et NSSM)

---

## Étapes de création

### 1. Préparer et compiler l'installeur

```powershell
# Dans le répertoire racine du projet
.\installer\build.ps1
```

Ce script fait automatiquement :
- ✅ Télécharge Node.js 20 LTS portable (~28 MB)
- ✅ Télécharge NSSM 2.24 (~300 KB)
- ✅ Copie le Canon Bridge depuis votre Bureau
- ✅ Génère le client Prisma pour SQLite
- ✅ Build Next.js en mode SQLite
- ✅ Compile l'installeur avec Inno Setup

### 2. Résultat

L'installeur se trouve dans :
```
installer\dist\INCI-Card-Setup-v1.0.0.exe
```

---

## Ce que fait l'installeur sur la machine cible

### Installation dans `C:\Program Files\INCI-Card\`

```
INCI-Card\
├── node\               ← Node.js 20 portable (pas d'installation système)
├── app\
│   ├── .next\          ← Application Next.js buildée
│   ├── node_modules\   ← Dépendances
│   ├── prisma\         ← Schéma SQLite
│   ├── data\
│   │   └── inci-card.db ← Base de données SQLite (créée au 1er lancement)
│   └── .env            ← Configuration (générée automatiquement)
├── canon-bridge\
│   └── canon-bridge.exe ← Pont Canon (autonome)
├── tools\
│   └── nssm.exe        ← Gestionnaire de services Windows
├── logs\               ← Journaux d'application
└── scripts\            ← Scripts de gestion
```

### Services Windows créés

| Service | Description | Port |
|---|---|---|
| `INCI-Card-App` | Serveur Next.js | 3000 |
| `INCI-Card-Canon` | Pont Canon EDSDK | 4000 |

Les deux services **démarrent automatiquement avec Windows**.

### Raccourcis créés
- **Bureau** : "INCI Card" → ouvre `http://localhost:3000`
- **Menu Démarrer** : INCI Card + Arrêter INCI Card + Désinstaller

---

## Synchronisation avec le serveur central

Pour que l'installation locale synchronise ses données avec le serveur central :

1. Ouvrir `C:\Program Files\INCI-Card\app\.env`
2. Renseigner la ligne :
   ```
   CENTRAL_SERVER_URL=https://votre-app.onrender.com
   ```
3. Redémarrer le service :
   ```
   C:\Program Files\INCI-Card\scripts\stop.bat
   C:\Program Files\INCI-Card\scripts\start.bat
   ```

---

## Commandes utiles post-installation

```batch
:: Démarrer manuellement
C:\Program Files\INCI-Card\scripts\start.bat

:: Arrêter manuellement
C:\Program Files\INCI-Card\scripts\stop.bat

:: Voir les logs
type "C:\Program Files\INCI-Card\logs\app.log"
type "C:\Program Files\INCI-Card\logs\canon.log"

:: Explorer la base SQLite (nécessite Prisma Studio)
cd "C:\Program Files\INCI-Card\app"
..\node\node.exe node_modules\.bin\prisma studio --schema prisma\schema.sqlite.prisma
```

---

## En cas de problème

### Le service ne démarre pas
```batch
:: Vérifier le statut
"C:\Program Files\INCI-Card\tools\nssm.exe" status INCI-Card-App

:: Voir les logs d'erreur
type "C:\Program Files\INCI-Card\logs\app-error.log"
```

### Réinitialiser la base de données
```batch
:: ATTENTION : supprime toutes les données locales
del "C:\Program Files\INCI-Card\app\data\inci-card.db"
"C:\Program Files\INCI-Card\scripts\first-run.bat"
```

### Port 3000 déjà utilisé
Modifier `install-services.bat` et changer `-p 3000` par `-p 3001`, puis relancer `install-services.bat`.
