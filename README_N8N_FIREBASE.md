# Configuration n8n pour écrire dans Firebase

## 🔒 Problème de sécurité résolu

**Avant :** Les joueurs écrivaient directement dans Firebase depuis leur navigateur (violation des règles de sécurité)

**Maintenant :** Seul n8n écrit dans Firebase via Firebase Admin SDK (sécurisé)

## Architecture

```
Joueur (Buzzer)
    ↓ (envoie préférences)
n8n Workflow
    ↓ (génère playlist avec IA)
Spotify API
    ↓ (ajoute chansons)
n8n écrit dans Firebase
    ↓ (via Admin SDK)
Firebase Database
    ↓ (détecte changement)
Master recharge playlist automatiquement
```

## Workflow n8n : "blindtest-player-input"

### 1. Réception des données

Le workflow reçoit ces paramètres du joueur :

```json
{
  "playlistId": "spotify_playlist_id",
  "sessionId": "ABC123",
  "playerId": "temp_JohnDoe",
  "playerName": "John Doe",
  "age": 25,
  "genres": ["Pop", "Rock", "Electronic"],
  "genre1Preferences": "J'aime la pop française des années 2000",
  "genre2Preferences": "",
  "genre3Preferences": ""
}
```

### 2. Génération de la playlist avec IA

n8n utilise l'IA (OpenAI, Claude, etc.) pour :
- Générer une liste de chansons basée sur les préférences
- Rechercher les chansons sur Spotify
- Ajouter 10 chansons à la playlist Spotify

### 3. **NOUVEAU : Écrire dans Firebase**

⚠️ **IMPORTANT** : n8n doit maintenant écrire dans Firebase via Firebase Admin SDK.

#### Installation Firebase Admin dans n8n

Si vous utilisez n8n self-hosted avec Node.js :

```bash
npm install firebase-admin
```

Si vous utilisez n8n Cloud, ajoutez un node "Function" avec le code suivant.

#### Code à ajouter dans le workflow n8n

**Node "Firebase - Update lastPlaylistUpdate"** (Function Node) :

```javascript
const admin = require('firebase-admin');

// Initialiser Firebase Admin (une seule fois)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();

// Récupérer les données du workflow
const sessionId = $input.first().json.sessionId;
const playerName = $input.first().json.playerName;
const totalSongs = $input.first().json.totalSongs || 10;

// Écrire dans Firebase : lastPlaylistUpdate
await db.ref(`sessions/${sessionId}/lastPlaylistUpdate`).set({
  timestamp: Date.now(),
  playerName: playerName,
  songsAdded: totalSongs
});

console.log(`✅ lastPlaylistUpdate écrit dans Firebase pour ${playerName}`);

return { json: { success: true } };
```

**Node "Firebase - Update playerSongs"** (Function Node) :

```javascript
const admin = require('firebase-admin');
const db = admin.database();

// Récupérer les données
const sessionId = $input.first().json.sessionId;
const playerId = $input.first().json.playerId;
const playerName = $input.first().json.playerName;
const songs = $input.first().json.songs; // Array de { uri, title, artist }

// Extraire les URIs
const songUris = songs.map(song => song.uri);

// Écrire dans Firebase : playerSongs (pour le bonus personnel)
await db.ref(`sessions/${sessionId}/playerSongs/${playerId}`).set({
  playerName: playerName,
  uris: songUris,
  addedAt: Date.now()
});

console.log(`✅ ${songUris.length} chansons associées à ${playerName} pour le bonus personnel`);

return { json: { success: true } };
```

#### Variables d'environnement n8n

Ajoutez ces variables dans n8n (Settings → Environment Variables) :

```env
FIREBASE_PROJECT_ID=blindtestapp-cd177
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@blindtestapp-cd177.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----
FIREBASE_DATABASE_URL=https://blindtestapp-cd177-default-rtdb.europe-west1.firebasedatabase.app
```

**Pour obtenir ces credentials :**

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet `blindtestapp-cd177`
3. Allez dans **Project Settings** (⚙️) → **Service Accounts**
4. Cliquez sur **Generate New Private Key**
5. Téléchargez le fichier JSON
6. Copiez les valeurs dans les variables d'environnement n8n

### 4. Structure du workflow n8n (résumé)

```
1. Webhook/Trigger → Reçoit les données du joueur
2. OpenAI/Claude → Génère liste de chansons
3. Spotify Search → Cherche chaque chanson
4. Spotify Add to Playlist → Ajoute les 10 chansons
5. ✅ Firebase Update lastPlaylistUpdate → Signale la mise à jour
6. ✅ Firebase Update playerSongs → Associe chansons au joueur
7. Response → Retourne { success: true, totalSongs: 10, songs: [...] }
```

## Structure Firebase attendue

Après l'exécution du workflow, Firebase doit contenir :

```json
{
  "sessions": {
    "ABC123": {
      "lastPlaylistUpdate": {
        "timestamp": 1699123456789,
        "playerName": "John Doe",
        "songsAdded": 10
      },
      "playerSongs": {
        "temp_JohnDoe": {
          "playerName": "John Doe",
          "uris": [
            "spotify:track:xxxxx1",
            "spotify:track:xxxxx2",
            "spotify:track:xxxxx3",
            ...
          ],
          "addedAt": 1699123456789
        }
      }
    }
  }
}
```

## Règles Firebase (aucune modification nécessaire)

Les joueurs **NE PEUVENT PAS** écrire dans `lastPlaylistUpdate` ni `playerSongs` car ces chemins n'ont pas de règles d'écriture publiques dans `database.rules.json`.

Seul **n8n avec Firebase Admin SDK** peut écrire, car Admin SDK bypasse les règles de sécurité.

## Test du workflow

### 1. Tester depuis Buzzer.jsx

1. Connectez-vous en tant que joueur
2. Remplissez vos préférences (âge + genres)
3. Cliquez sur "Valider"
4. Vérifiez les logs :
   - `📤 Envoi des préférences au workflow n8n`
   - `✅ Playlist remplie avec succès`
   - `📝 n8n a mis à jour Firebase`

### 2. Vérifier Firebase

Dans Firebase Console → Realtime Database :

```
sessions/ABC123/
  ├── lastPlaylistUpdate ← DOIT apparaître
  └── playerSongs/
      └── temp_JohnDoe ← DOIT apparaître
```

### 3. Vérifier le Master

Le Master détecte automatiquement `lastPlaylistUpdate` et recharge la playlist :

```
🔄 [MASTER] Synchronisation de la playlist Spotify IA: 10 chansons
```

## Dépannage

### Erreur "Permission denied" côté joueur

✅ **NORMAL** : Les joueurs ne doivent PAS pouvoir écrire dans Firebase.
❌ **Cause** : n8n n'écrit pas dans Firebase avec Admin SDK.
🔧 **Solution** : Vérifier que n8n a Firebase Admin SDK configuré.

### lastPlaylistUpdate n'apparaît pas dans Firebase

- Vérifier que le node Firebase est bien ajouté dans le workflow n8n
- Vérifier les logs n8n pour voir si l'écriture a réussi
- Vérifier que les credentials Firebase Admin sont corrects

### playerSongs n'apparaît pas dans Firebase

- Même causes que ci-dessus
- Vérifier que `songs` est bien un array avec des objets `{ uri, title, artist }`

### Le Master ne recharge pas la playlist

- Vérifier que `lastPlaylistUpdate/timestamp` change bien
- Vérifier dans Master.jsx qu'il y a bien un useEffect qui écoute `lastPlaylistUpdate`
- Voir `src/modes/useSpotifyAIMode.js:useEffect` pour le code de détection

## Support

Pour toute question :
- Firebase Admin SDK : https://firebase.google.com/docs/admin/setup
- n8n Function Nodes : https://docs.n8n.io/code/builtin/function/
