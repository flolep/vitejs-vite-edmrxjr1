# Diagramme du Workflow n8n : Create Spotify Playlist

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION BLIND TEST                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Master.jsx                                               │  │
│  │                                                           │  │
│  │  - Utilisateur connecté à Spotify                        │  │
│  │  - Possède un accessToken Spotify valide                 │  │
│  │  - Clique sur "Créer Playlist AI"                        │  │
│  └─────────────────────┬────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  n8nService.js                                            │  │
│  │                                                           │  │
│  │  1. getSpotifyUserId(accessToken)                        │  │
│  │     → GET https://api.spotify.com/v1/me                  │  │
│  │     → Récupère l'userId (ex: "john.doe")                 │  │
│  │                                                           │  │
│  │  2. createSpotifyPlaylist(userId, name, desc)            │  │
│  │     → Prépare le payload JSON                            │  │
│  └─────────────────────┬────────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────────┘
                         │
                         │ POST Request
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          N8N WORKFLOW                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  NODE 1: Webhook Trigger                               │    │
│  │  Type: n8n-nodes-base.webhook                          │    │
│  │                                                         │    │
│  │  - Path: /create-playlist                              │    │
│  │  - Method: POST                                         │    │
│  │  - Response Mode: responseNode                         │    │
│  │                                                         │    │
│  │  Input:                                                 │    │
│  │  {                                                      │    │
│  │    "userId": "john.doe",                               │    │
│  │    "playlistName": "Blind Test 2024" (optionnel)       │    │
│  │    "description": "Ma playlist" (optionnel)            │    │
│  │  }                                                      │    │
│  └─────────────────────┬──────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  NODE 2: Edit Fields (Génération du nom)               │    │
│  │  Type: n8n-nodes-base.set                              │    │
│  │                                                         │    │
│  │  Génère automatiquement:                                │    │
│  │  - date: "2024-10-24" (YYYY-MM-DD)                     │    │
│  │  - orderKey: "742" (numéro à 3 chiffres)               │    │
│  │  - playlistName: "BlindTest-2024-10-24-742"            │    │
│  │    (si non fourni dans l'input)                        │    │
│  │                                                         │    │
│  │  Formule du numéro d'ordre:                            │    │
│  │  Math.floor(Date.now() / 1000) % 1000                  │    │
│  │  (timestamp secondes modulo 1000, sur 3 chiffres)      │    │
│  └─────────────────────┬──────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  NODE 3: Spotify Create Playlist                       │    │
│  │  Type: n8n-nodes-base.spotify                          │    │
│  │                                                         │    │
│  │  Resource: playlist                                     │    │
│  │  Operation: create                                      │    │
│  │                                                         │    │
│  │  Parameters:                                            │    │
│  │  - userId: {{ $json.userId }}                          │    │
│  │  - name: {{ $json.playlistName }}                      │    │
│  │    (ex: "BlindTest-2024-10-24-742")                    │    │
│  │  - description: {{ $json.description }}                │    │
│  │    (ex: "Playlist créée automatiquement...")           │    │
│  │  - public: false                                        │    │
│  │                                                         │    │
│  │  Credentials: Spotify OAuth2 (configuré)               │    │
│  └─────────────────────┬──────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  NODE 4: Respond to Webhook                            │    │
│  │  Type: n8n-nodes-base.respondToWebhook                 │    │
│  │                                                         │    │
│  │  Response Body:                                         │    │
│  │  {                                                      │    │
│  │    "success": true,                                     │    │
│  │    "playlistId": "{{ $json.id }}",                     │    │
│  │    "playlistName": "{{ $json.name }}",                 │    │
│  │      → "BlindTest-2024-10-24-742"                      │    │
│  │    "playlistUrl": "{{ $json.external_urls.spotify }}"  │    │
│  │  }                                                      │    │
│  └─────────────────────┬──────────────────────────────────┘    │
└────────────────────────┼────────────────────────────────────────┘
                         │
                         │ JSON Response
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION BLIND TEST                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  n8nService.js                                            │  │
│  │                                                           │  │
│  │  Reçoit:                                                  │  │
│  │  {                                                        │  │
│  │    "success": true,                                       │  │
│  │    "playlistId": "37i9dQZF1DXcBWIGoYBM5M",              │  │
│  │    "playlistName": "Blind Test 2024",                    │  │
│  │    "playlistUrl": "https://open.spotify.com/..."         │  │
│  │  }                                                        │  │
│  └─────────────────────┬────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Master.jsx                                               │  │
│  │                                                           │  │
│  │  - Affiche "✅ Playlist créée: Blind Test 2024"         │  │
│  │  - Charge la playlist avec handleSelectPlaylist()        │  │
│  │  - La playlist est prête à être remplie                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Flux détaillé étape par étape

### Étape 1 : Déclenchement
```
Utilisateur (Master) clique sur "Créer Playlist AI"
```

### Étape 2 : Récupération userId
```javascript
const userId = await n8nService.getSpotifyUserId(spotifyToken);
// → API Call: GET https://api.spotify.com/v1/me
// → Response: { "id": "john.doe", "display_name": "John", ... }
```

### Étape 3 : Appel webhook n8n
```javascript
// Option 1 : Nom automatique (recommandé)
const result = await n8nService.createSpotifyPlaylist(userId);

// Option 2 : Nom personnalisé
// const result = await n8nService.createSpotifyPlaylist(
//   userId,           // "john.doe"
//   playlistName,     // "Blind Test 2024"
//   description       // "Playlist pour blind test"
// );

// → API Call: POST https://n8n.example.com/webhook/create-playlist
// → Body: { userId }  OU  { userId, playlistName, description }
```

### Étape 4 : n8n reçoit la requête
```
Webhook Node reçoit:
{
  "userId": "john.doe"
  // playlistName et description sont optionnels
}
```

### Étape 4b : n8n génère le nom automatiquement (Edit Fields)
```
Edit Fields Node calcule:
- date: "2024-10-24"
- orderKey: "742" (basé sur timestamp)
- playlistName: "BlindTest-2024-10-24-742"
  (seulement si non fourni dans l'input)

Output:
{
  "userId": "john.doe",
  "date": "2024-10-24",
  "orderKey": "742",
  "playlistName": "BlindTest-2024-10-24-742",
  "description": "Playlist créée automatiquement pour Blind Test le 2024-10-24"
}
```

### Étape 5 : n8n appelle l'API Spotify
```
Spotify Node exécute:
POST https://api.spotify.com/v1/users/john.doe/playlists

Headers:
  Authorization: Bearer <spotify_oauth_token>

Body:
{
  "name": "BlindTest-2024-10-24-742",
  "description": "Playlist créée automatiquement pour Blind Test le 2024-10-24",
  "public": false
}
```

### Étape 6 : Spotify crée la playlist
```
Spotify répond:
{
  "id": "37i9dQZF1DXcBWIGoYBM5M",
  "name": "BlindTest-2024-10-24-742",
  "description": "Playlist créée automatiquement pour Blind Test le 2024-10-24",
  "external_urls": {
    "spotify": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
  },
  "public": false,
  "tracks": {
    "total": 0
  }
}
```

### Étape 7 : n8n formate la réponse
```
Respond Node transforme:
{
  "success": true,
  "playlistId": "37i9dQZF1DXcBWIGoYBM5M",
  "playlistName": "BlindTest-2024-10-24-742",
  "playlistUrl": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
}
```

### Étape 8 : L'application reçoit le résultat
```javascript
// Dans Master.jsx
console.log('✅ Playlist créée:', result);
// {
//   success: true,
//   playlistId: "37i9dQZF1DXcBWIGoYBM5M",
//   playlistName: "Blind Test 2024",
//   playlistUrl: "https://..."
// }

// Charger la playlist
await handleSelectPlaylist(result.playlistId);
```

## Données échangées

### Format de la requête
```json
{
  "userId": "string (requis)",
  "playlistName": "string (optionnel)",
  "description": "string (optionnel)"
}
```

### Format de la réponse (succès)
```json
{
  "success": true,
  "playlistId": "string",
  "playlistName": "string",
  "playlistUrl": "string"
}
```

### Format de la réponse (erreur)
```json
{
  "error": "string",
  "message": "string"
}
```

## Sécurité

### Authentification Spotify (OAuth2)
```
1. L'utilisateur se connecte à Spotify depuis l'application
2. L'application reçoit un accessToken
3. Cet accessToken est envoyé à n8n (via userId récupéré)
4. n8n utilise SES PROPRES credentials OAuth2 (configurés dans n8n)
5. n8n crée la playlist avec son propre compte (ou délégation)
```

**Important:**
- L'application NE stocke PAS le Client Secret Spotify
- n8n gère l'OAuth2 de manière sécurisée
- Le token utilisateur sert uniquement à récupérer l'userId

## Performance

- **Temps moyen**: 1-2 secondes
- **Timeout recommandé**: 10 secondes
- **Rate limiting Spotify**: 180 requêtes/minute

## Évolutions possibles

### Workflow 2 : Ajouter des chansons
```
POST /add-tracks-to-playlist
{
  "playlistId": "37i9dQZF1DXcBWIGoYBM5M",
  "tracks": [
    { "title": "Bohemian Rhapsody", "artist": "Queen" },
    { "title": "Imagine", "artist": "John Lennon" }
  ]
}
```

### Workflow 3 : Génération IA complète
```
POST /generate-playlist-ai
{
  "userId": "john.doe",
  "theme": "Rock des années 80",
  "numberOfTracks": 20,
  "difficulty": "medium"
}

→ Appelle ChatGPT/Claude
→ Génère liste de chansons
→ Crée la playlist
→ Ajoute les morceaux
→ Retourne la playlist complète
```
