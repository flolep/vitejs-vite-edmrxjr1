# Workflow n8n : AI Playlist Generator

## 📋 Vue d'ensemble

Ce workflow génère et remplit automatiquement une playlist Spotify basée sur les préférences des joueurs en utilisant l'IA (GPT-4o).

**Fichier:** `generate-playlist-ai.json`

## 🎯 Cas d'usage

**Scénario :**
1. L'utilisateur crée une playlist vide via le workflow `create-playlist-simple`
2. L'application collecte les préférences du joueur (âge, genres musicaux, etc.)
3. L'application appelle ce workflow avec le `playlistId` et les préférences
4. Le workflow utilise l'IA pour recommander 10 chansons
5. Le workflow recherche et ajoute automatiquement les chansons à la playlist

## 🔧 Configuration requise

### Credentials nécessaires

1. **Spotify OAuth2 API**
   - Accès aux playlists
   - Recherche de tracks
   - Ajout de tracks aux playlists

2. **OpenAI API**
   - Modèle : GPT-4o
   - Génération de recommandations musicales

## 📥 Paramètres d'entrée

### Webhook URL
```
POST https://your-n8n.com/webhook/blindtest-player-input
```

### Body (JSON)

```json
{
  "playlistId": "37i9dQZF1DXcBWIGoYBM5M",
  "age": 30,
  "genres": ["Pop", "Rock", "Electronic"],
  "genre1Preferences": "Années 80, hits iconiques",
  "genre2Preferences": "Rock alternatif moderne",
  "genre3Preferences": "Dance, rythmes entraînants"
}
```

### Paramètres détaillés

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `playlistId` | string | ✅ | ID de la playlist Spotify vide (créée précédemment) |
| `age` | number | ✅ | Âge du joueur (pour cibler les recommandations) |
| `genres` | array | ✅ | Liste de 3 genres musicaux favoris |
| `genre1Preferences` | string | ❌ | Préférences détaillées pour le genre 1 |
| `genre2Preferences` | string | ❌ | Préférences détaillées pour le genre 2 |
| `genre3Preferences` | string | ❌ | Préférences détaillées pour le genre 3 |

## 📤 Réponse

### Succès (200)

```json
{
  "success": true,
  "message": "Blindtest playlist filled successfully!",
  "playlistId": "37i9dQZF1DXcBWIGoYBM5M",
  "totalSongs": 10,
  "songs": [
    {
      "name": "Take On Me",
      "artist": "a-ha",
      "uri": "spotify:track:2WfaOiMkCvy7F5fcp2zZ8L",
      "id": "2WfaOiMkCvy7F5fcp2zZ8L"
    },
    {
      "name": "Sweet Child O' Mine",
      "artist": "Guns N' Roses",
      "uri": "spotify:track:7o2CTH4ctstm8TNelqjb51",
      "id": "7o2CTH4ctstm8TNelqjb51"
    }
    // ... 8 autres chansons
  ]
}
```

### Erreur (4xx/5xx)

```json
{
  "error": "Error message",
  "details": "..."
}
```

## 🔄 Flux du workflow

```
┌──────────────────────────────────────────────────────────────┐
│  1. Player Input Webhook                                     │
│     Reçoit les préférences + playlistId                      │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  2. Format Player Data                                       │
│     Crée le prompt pour GPT-4o                               │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  3. AI Agent (GPT-4o)                                        │
│     Génère 10 recommandations de chansons                    │
│     Format: [{artist, song}, ...]                           │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  4. Parse Song List                                          │
│     Parse le JSON et prépare les recherches                  │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  5. Search Song on Spotify (parallèle)                       │
│     Recherche chaque chanson sur Spotify                     │
│     10 recherches en parallèle                               │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  6. Extract Track URIs                                       │
│     Agrège tous les URIs trouvés                            │
│     Format: "spotify:track:xxx,spotify:track:yyy,..."       │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  7. Add Songs to Playlist                                    │
│     Ajoute tous les tracks à la playlist                     │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  8. Format Success Response                                  │
│     Retourne le résultat avec la liste des chansons         │
└──────────────────────────────────────────────────────────────┘
```

## 💡 Prompt GPT-4o

Le prompt envoyé à GPT-4o est :

```
You are a music expert. Based on the following player information, recommend exactly 10 songs that would be perfect for a blindtest game.

Player Age: {age}
Favorite Genres: {genres}
Genre 1 Preferences: {genre1Preferences}
Genre 2 Preferences: {genre2Preferences}
Genre 3 Preferences: {genre3Preferences}

RESPOND WITH ONLY VALID JSON in this exact format:
[
  {"artist": "Artist Name", "song": "Song Title"},
  {"artist": "Artist Name", "song": "Song Title"},
  ...
]

Make sure songs are popular and on Spotify. No markdown formatting.
```

## 🎮 Exemple complet d'utilisation

### 1. Créer la playlist vide

```javascript
// Via le workflow create-playlist-simple
const playlist = await n8nService.createSpotifyPlaylistSimple();
// → { playlistId: "37i9dQZF1DXcBWIGoYBM5M", ... }
```

### 2. Remplir avec l'IA

```javascript
const response = await fetch('https://n8n.com/webhook/blindtest-player-input', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    playlistId: playlist.playlistId,
    age: 30,
    genres: ["Pop", "Rock", "Electronic"],
    genre1Preferences: "Années 80, hits iconiques",
    genre2Preferences: "Rock alternatif moderne",
    genre3Preferences: "Dance, rythmes entraînants"
  })
});

const result = await response.json();
console.log(`✅ ${result.totalSongs} chansons ajoutées !`);
```

### 3. Charger la playlist dans l'app

```javascript
await handleSelectPlaylist(playlist.playlistId);
// La playlist est maintenant remplie et prête à jouer !
```

## ⚡ Performance

- **Temps moyen** : 15-30 secondes
  - GPT-4o : ~5-10 secondes
  - Recherches Spotify (parallèle) : ~5-10 secondes
  - Ajout à la playlist : ~1-2 secondes

- **Nombre de chansons** : Fixé à 10 (modifiable dans le prompt)

## 🐛 Dépannage

### Erreur : "No valid tracks found"
- Vérifiez que les noms d'artistes/chansons sont corrects
- GPT-4o peut parfois suggérer des chansons qui n'existent pas sur Spotify
- Les recherches Spotify sont assez tolérantes

### Erreur : "Expected array but got..."
- Le parsing de la réponse GPT-4o a échoué
- Vérifiez les logs du node "Parse Song List"
- GPT-4o doit retourner un JSON valide sans markdown

### Playlist non remplie
- Vérifiez que le `playlistId` est correct
- Vérifiez les credentials Spotify dans n8n
- Assurez-vous que la playlist existe et n'est pas privée

## 🔐 Sécurité

- **Credentials** : Stockés de manière sécurisée dans n8n (non exportés)
- **Token OpenAI** : Nécessite une clé API valide
- **Spotify OAuth** : Utilise vos credentials configurés dans n8n
- **Playlist** : Créée sur votre compte Spotify personnel

## 📊 Coûts

### OpenAI
- **Modèle** : GPT-4o
- **Coût estimé** : ~$0.01 par appel
- **Tokens** : ~200-300 tokens par requête

### Spotify
- **Gratuit** : API Spotify gratuite
- **Rate limits** : 180 requêtes/minute

## 🎯 Recommandation

**Workflow complet recommandé :**

```javascript
// 1. Créer playlist vide
const playlist = await n8nService.createSpotifyPlaylistSimple();

// 2. Remplir avec IA (basé sur préférences joueur)
const filled = await n8nService.fillPlaylistWithAI({
  playlistId: playlist.playlistId,
  age: playerAge,
  genres: playerGenres,
  genre1Preferences: preferences1,
  genre2Preferences: preferences2,
  genre3Preferences: preferences3
});

// 3. Charger dans l'app
await handleSelectPlaylist(playlist.playlistId);

// 4. Lancer le jeu !
```

**Temps total** : ~20-35 secondes pour une playlist complète prête à jouer
