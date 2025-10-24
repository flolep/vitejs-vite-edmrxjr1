# Workflows n8n pour Blind Test

Ce dossier contient les workflows n8n pour l'intégration avec Spotify.

## 1. Create Spotify Playlist

**Fichier:** `create-playlist.json`

### Description
Crée une playlist vide sur Spotify via webhook avec un nom généré automatiquement au format **`BlindTest-YYYY-MM-DD-XXX`** où :
- **YYYY-MM-DD** : Date du jour
- **XXX** : Numéro d'ordre à 3 chiffres (basé sur le timestamp)

### Installation

1. Ouvrez votre instance n8n
2. Cliquez sur "Import from File" (ou "Workflows" > "Import")
3. Sélectionnez le fichier `create-playlist.json`
4. Configurez les credentials Spotify OAuth2 :
   - Allez dans "Credentials" > "New"
   - Sélectionnez "Spotify OAuth2 API"
   - Renseignez :
     - **Client ID:** Votre Client ID Spotify
     - **Client Secret:** Votre Client Secret Spotify
     - **Callback URL:** L'URL de callback n8n (ex: `https://your-n8n.com/rest/oauth2-credential/callback`)
   - Autorisez l'accès à votre compte Spotify
5. Associez ces credentials au node "Spotify: Create Playlist"
6. Activez le workflow

### Configuration Spotify App

Pour obtenir les credentials Spotify :

1. Allez sur [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Créez une nouvelle application (ou utilisez une existante)
3. Dans "Edit Settings", ajoutez l'URL de callback n8n :
   ```
   https://your-n8n-instance.com/rest/oauth2-credential/callback
   ```
4. Notez le **Client ID** et **Client Secret**
5. Assurez-vous que les scopes suivants sont disponibles :
   - `playlist-modify-public`
   - `playlist-modify-private`
   - `user-read-email`

### Utilisation

#### Endpoint Webhook
```
POST https://your-n8n-instance.com/webhook/create-playlist
```

#### Paramètres d'entrée (JSON)

```json
{
  "userId": "spotify_user_id",
  "playlistName": "Ma Super Playlist (optionnel)",
  "description": "Description de la playlist (optionnel)"
}
```

**Paramètres :**
- `userId` (requis) : L'ID utilisateur Spotify (ex: "john.doe")
- `playlistName` (optionnel) : Nom personnalisé de la playlist. Si non fourni, génère automatiquement **`BlindTest-YYYY-MM-DD-XXX`** (ex: "BlindTest-2024-10-24-742")
- `description` (optionnel) : Description de la playlist. Par défaut : "Playlist créée automatiquement pour Blind Test le YYYY-MM-DD"

#### Réponse

```json
{
  "success": true,
  "playlistId": "37i9dQZF1DXcBWIGoYBM5M",
  "playlistName": "BlindTest-2024-10-24-742",
  "playlistUrl": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
}
```

### Exemple d'appel depuis JavaScript

```javascript
// Appel depuis l'application Blind Test
const createSpotifyPlaylist = async (userId, playlistName = null, description = null) => {
  try {
    const response = await fetch('https://your-n8n-instance.com/webhook/create-playlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: userId,
        // playlistName est optionnel - si non fourni, générera "BlindTest-2024-10-24-742"
        ...(playlistName && { playlistName }),
        ...(description && { description })
      })
    });

    if (!response.ok) throw new Error('Failed to create playlist');

    const data = await response.json();
    console.log('Playlist créée:', data);
    return data;
  } catch (error) {
    console.error('Erreur création playlist:', error);
    throw error;
  }
};

// Utilisation 1 : Nom automatique (BlindTest-2024-10-24-XXX)
const result1 = await createSpotifyPlaylist('john.doe');
console.log('Playlist créée:', result1.playlistName); // "BlindTest-2024-10-24-742"

// Utilisation 2 : Nom personnalisé
const result2 = await createSpotifyPlaylist(
  'john.doe',
  'Blind Test Années 80',
  'Playlist pour le blind test de ce soir'
);
console.log('Playlist ID:', result2.playlistId);
```

### Notes

- La playlist est créée en **mode privé** par défaut
- Vous pouvez modifier le paramètre `public` dans le node Spotify si vous voulez des playlists publiques
- Le workflow retourne l'ID de la playlist qui peut ensuite être utilisé pour ajouter des chansons

## Workflow à venir

- **add-tracks-to-playlist** : Ajouter des morceaux à une playlist existante
- **generate-playlist-ai** : Générer une playlist avec IA (ChatGPT/Claude)
- **search-spotify-tracks** : Rechercher des morceaux sur Spotify

## Support

Pour toute question sur les workflows n8n, consultez :
- [Documentation n8n](https://docs.n8n.io)
- [Spotify API Reference](https://developer.spotify.com/documentation/web-api)
