# Configuration du callback n8n → Netlify → Firebase

Guide complet pour configurer le système de notification asynchrone pour la génération de playlists.

## Architecture

```
Client (StepPlayerConnection)
  ↓ Appel async avec netlifyCallbackUrl
n8n (generate-playlist-batch-ai-v3)
  ↓ Génère 50 chansons (> 30 secondes)
  ↓ Appel HTTP POST
Netlify Function (notify-playlist-ready)
  ↓ Valide le secret
  ↓ Écrit dans Firebase
Firebase (sessions/{sessionId}/playlistGeneration)
  ↓ Polling toutes les 3 secondes
Client (détecte completion)
```

---

## Étape 1 : Variables d'environnement Netlify

### Récupérer les credentials Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet
3. **⚙️ Paramètres** → **Comptes de service**
4. **Générer une nouvelle clé privée**
5. Téléchargez le fichier JSON

### Ajouter dans Netlify

1. [Netlify Dashboard](https://app.netlify.com/)
2. Site **blindtestflolep**
3. **Site settings** → **Environment variables**
4. Ajoutez ces 5 variables :

| Variable | Valeur | Source |
|----------|--------|--------|
| `N8N_WEBHOOK_SECRET` | `<votre_secret>` | Le **même** que dans Docker n8n |
| `FIREBASE_PROJECT_ID` | `votre-project-id` | Fichier JSON téléchargé |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxxxx@...` | Fichier JSON téléchargé |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` | Fichier JSON téléchargé (avec `\n`) |
| `FIREBASE_DATABASE_URL` | `https://votre-project-id.firebaseio.com` | Votre URL Firebase |

**⚠️ Important pour `FIREBASE_PRIVATE_KEY` :**
- Copiez la clé **telle quelle** avec les `\n`
- Elle doit commencer par `-----BEGIN PRIVATE KEY-----\n`
- Et finir par `\n-----END PRIVATE KEY-----\n`

---

## Étape 2 : Configuration du workflow n8n

### URLs Netlify

- **Production** : `https://blindtestflolep.netlify.app`
- **Develop** : `https://develop--blindtestflolep.netlify.app`

Le client enverra automatiquement la bonne URL selon l'environnement.

### Ajouter le node HTTP Request dans n8n

Dans le workflow `generate-playlist-batch-ai-v3` :

#### Position du node

```
Add Songs to Playlist1
         ↓
  Notify Playlist Ready  ← NOUVEAU NODE
         ↓
 Format Success Response
```

#### Configuration du node

**Type** : `HTTP Request`
**Name** : `Notify Playlist Ready`
**Method** : `POST`

**URL** :
```
={{ $('Parse JSON Body').first().json.netlifyCallbackUrl }}/.netlify/functions/notify-playlist-ready
```

**Send Body** : ✅ Yes
**Body Content Type** : `JSON`

**JSON Body** :
```json
{
  "sessionId": "={{ $('Parse JSON Body').first().json.playlistId.split('-')[0] }}",
  "playlistId": "={{ $('Parse JSON Body').first().json.playlistId }}",
  "totalSongs": "={{ $('Extract Track URIs').first().json.totalFound }}",
  "secret": "={{ $env.N8N_WEBHOOK_SECRET }}"
}
```

**Headers** :
```
Content-Type: application/json
```

**Options** :
- **Timeout** : `10000` (10 secondes)
- **Continue On Fail** : `false`

---

## Étape 3 : Déploiement Netlify

La fonction `netlify/functions/notify-playlist-ready.js` est déjà créée et sera déployée automatiquement avec la branche.

### Vérifier le déploiement

1. Pushez la branche sur GitHub
2. Attendez le déploiement Netlify
3. Testez la fonction :

```bash
curl -X POST https://blindtestflolep.netlify.app/.netlify/functions/notify-playlist-ready \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "TEST123",
    "playlistId": "TEST123-1234567890",
    "totalSongs": 50,
    "secret": "VOTRE_SECRET"
  }'
```

Réponse attendue :
```json
{
  "success": true,
  "message": "Playlist generation status updated in Firebase"
}
```

---

## Étape 4 : Code client (StepPlayerConnection)

Le polling Firebase est implémenté dans `StepPlayerConnection.jsx` :

- Appel async à n8n avec `netlifyCallbackUrl`
- Polling toutes les 3 secondes
- Timeout après 5 minutes
- Détection automatique de l'URL selon l'environnement

---

## Flux complet

### 1. Création de la session

```javascript
// StepPlayerConnection.jsx appelle n8n
await n8nService.generatePlaylistWithAllPreferences({
  playlistId: "ABC123-1234567890",
  players: [...],
  netlifyCallbackUrl: window.location.origin // Auto-détecte prod ou develop
});
```

### 2. n8n génère la playlist (30-120 secondes)

- Reçoit `netlifyCallbackUrl` dans le body
- Génère 50 chansons via IA
- Cherche sur Spotify
- Ajoute à la playlist
- **Appelle la Netlify Function** avec l'URL reçue

### 3. Netlify Function écrit dans Firebase

```
POST https://blindtestflolep.netlify.app/.netlify/functions/notify-playlist-ready
{
  "sessionId": "ABC123",
  "playlistId": "ABC123-1234567890",
  "totalSongs": 50,
  "secret": "***"
}
```

La fonction valide le secret et écrit :
```
sessions/ABC123/playlistGeneration = {
  status: "completed",
  playlistId: "ABC123-1234567890",
  totalSongs: 50,
  completedAt: 1702234567890
}
```

### 4. Client détecte le changement Firebase

Le polling détecte la mise à jour et continue le flow Master.

---

## Sécurité

### Secret partagé

- **Même valeur** dans n8n Docker et Netlify
- Validation côté Netlify Function
- Empêche les écritures non autorisées

### Firebase Admin SDK

- Credentials server-side uniquement (Netlify Function)
- Jamais exposés au client
- Validation stricte des paramètres

---

## Dépannage

### n8n ne trouve pas la variable N8N_WEBHOOK_SECRET

```bash
# Vérifier dans Docker
docker exec -it root-n8n-1 env | grep N8N_WEBHOOK_SECRET

# Si vide, redémarrer le conteneur
docker restart root-n8n-1
```

### Netlify Function retourne 403

- Vérifiez que `N8N_WEBHOOK_SECRET` est identique dans n8n et Netlify
- Vérifiez que le secret est bien passé dans le body n8n

### Polling timeout après 5 minutes

- Vérifiez que n8n a bien appelé la fonction Netlify
- Vérifiez les logs Netlify : Functions → Logs
- Vérifiez Firebase : sections/{sessionId}/playlistGeneration existe ?

### FIREBASE_PRIVATE_KEY invalide

- Assurez-vous de copier la clé avec les `\n` préservés
- Ne pas ajouter de quotes supplémentaires
- Format exact : `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`

---

## Test end-to-end

1. Ouvrez le Master Flow
2. Créez une session Quiz
3. Configurez "Spotify IA" comme source musicale
4. Vérifiez les logs :
   - Console navigateur : "🎵 Génération playlist GROUPÉE via n8n"
   - n8n : Workflow en cours
   - Netlify : Function appelée
   - Firebase : playlistGeneration créé
   - Console navigateur : "✅ Playlist générée avec succès"
