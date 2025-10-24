# Workflows n8n pour Blind Test

Ce dossier contient les workflows n8n pour l'intégration avec Spotify.

## 1. Create Spotify Playlist

**Fichier:** `create-playlist.json`

### Description
Crée une playlist vide sur Spotify via webhook.

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
  "playlistName": "Ma Super Playlist",
  "description": "Description de la playlist (optionnel)"
}
```

**Paramètres :**
- `userId` (requis) : L'ID utilisateur Spotify (ex: "john.doe")
- `playlistName` (optionnel) : Nom de la playlist. Si non fourni, génère "Blind Test - YYYY-MM-DD"
- `description` (optionnel) : Description de la playlist. Par défaut : "Playlist créée pour Blind Test"

#### Réponse

```json
{
  "success": true,
  "playlistId": "37i9dQZF1DXcBWIGoYBM5M",
  "playlistName": "Ma Super Playlist",
  "playlistUrl": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
}
```

### Exemple d'appel depuis JavaScript

```javascript
// Appel depuis l'application Blind Test
const createSpotifyPlaylist = async (userId, playlistName, description) => {
  try {
    const response = await fetch('https://your-n8n-instance.com/webhook/create-playlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: userId,
        playlistName: playlistName || `Blind Test - ${new Date().toLocaleDateString()}`,
        description: description || 'Playlist générée pour Blind Test'
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

// Utilisation
const result = await createSpotifyPlaylist(
  'john.doe',
  'Blind Test Années 80',
  'Playlist pour le blind test de ce soir'
);

console.log('Playlist ID:', result.playlistId);
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
