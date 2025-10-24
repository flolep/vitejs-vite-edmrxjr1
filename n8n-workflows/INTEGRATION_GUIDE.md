# Guide d'intégration n8n avec Blind Test

Ce guide explique comment intégrer les workflows n8n dans votre application Blind Test.

## Architecture

```
Application Blind Test (React)
         ↓
    n8nService.js (Frontend)
         ↓
    Webhook n8n (Backend)
         ↓
    Spotify API
```

## Installation et Configuration

### 1. Configuration n8n

#### A. Importer le workflow

1. Connectez-vous à votre instance n8n
2. Allez dans "Workflows" > "Import from File"
3. Sélectionnez `create-playlist.json`
4. Le workflow sera importé avec 3 nodes :
   - **Webhook**: Reçoit les requêtes POST
   - **Spotify**: Crée la playlist
   - **Respond**: Retourne le résultat

#### B. Configurer les credentials Spotify

1. Dans n8n, allez dans "Credentials" > "New"
2. Cherchez "Spotify OAuth2 API"
3. Remplissez les informations :
   ```
   Name: Spotify account
   Client ID: [Votre Client ID Spotify]
   Client Secret: [Votre Client Secret Spotify]
   ```
4. Cliquez sur "Connect my account"
5. Autorisez n8n à accéder à votre compte Spotify

#### C. Obtenir vos credentials Spotify

1. Allez sur [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Créez une nouvelle app ou utilisez une existante
3. Dans "Edit Settings", ajoutez l'URL de callback n8n :
   ```
   https://your-n8n-instance.com/rest/oauth2-credential/callback
   ```
4. Copiez le **Client ID** et **Client Secret**

#### D. Activer le workflow

1. Dans n8n, ouvrez le workflow "Create Spotify Playlist"
2. Vérifiez que le node "Spotify" a bien les credentials associés
3. Activez le workflow (toggle en haut à droite)
4. Notez l'URL du webhook (ex: `https://your-n8n.com/webhook/create-playlist`)

### 2. Configuration de l'application

#### A. Variables d'environnement

1. Copiez `.env.example` vers `.env` :
   ```bash
   cp .env.example .env
   ```

2. Éditez `.env` et remplissez :
   ```env
   VITE_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
   ```

#### B. Utilisation dans le code

Le service `n8nService.js` est déjà créé et prêt à l'emploi.

**Exemple d'utilisation dans Master.jsx :**

```javascript
import { n8nService } from './n8nService';

// Dans votre composant Master
const handleCreatePlaylistAI = async () => {
  try {
    setDebugInfo('⏳ Création de la playlist...');

    // Créer une playlist vide via n8n
    const result = await n8nService.createPlaylistWithToken(
      spotifyToken,
      'Blind Test Spécial Années 80',
      'Playlist générée pour le blind test'
    );

    console.log('✅ Playlist créée:', result);
    setDebugInfo(`✅ Playlist créée: ${result.playlistName}`);

    // Charger la playlist dans l'application
    await handleSelectPlaylist(result.playlistId);

  } catch (error) {
    console.error('❌ Erreur:', error);
    setDebugInfo('❌ Erreur création playlist');
  }
};
```

## Utilisation dans l'interface

### Option 1 : Ajouter un bouton dans Master.jsx

Ajoutez un bouton dans la section Spotify du Master :

```jsx
<button
  onClick={handleCreatePlaylistAI}
  className="btn btn-blue"
  style={{ width: '100%', padding: '1rem' }}
  disabled={!spotifyToken}
>
  🤖 CRÉER UNE PLAYLIST AI
</button>
```

### Option 2 : Dans le sélecteur de playlists

Modifiez `PlaylistSelector.jsx` pour ajouter l'option :

```jsx
<div className="space-y">
  <button
    onClick={onCreatePlaylistAI}
    className="btn btn-purple"
  >
    ✨ GÉNÉRER PLAYLIST IA
  </button>

  <div className="divider">OU</div>

  {/* Liste des playlists existantes */}
</div>
```

## Flux complet d'utilisation

1. **L'animateur se connecte à Spotify** dans l'application
2. **Il clique sur "Créer Playlist AI"**
3. L'application appelle `n8nService.createPlaylistWithToken()`
4. Le service récupère l'userId Spotify
5. Le service envoie une requête au webhook n8n
6. n8n crée la playlist vide sur Spotify
7. n8n retourne l'ID de la playlist
8. L'application charge automatiquement la playlist

## Tests

### Test du webhook directement

Vous pouvez tester le webhook avec curl :

```bash
curl -X POST https://your-n8n.com/webhook/create-playlist \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your_spotify_user_id",
    "playlistName": "Test Playlist",
    "description": "Test depuis curl"
  }'
```

Réponse attendue :
```json
{
  "success": true,
  "playlistId": "37i9dQZF1DXcBWIGoYBM5M",
  "playlistName": "Test Playlist",
  "playlistUrl": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
}
```

### Test dans la console du navigateur

```javascript
// 1. Récupérer le token Spotify (dans Master.jsx)
console.log('Token:', spotifyToken);

// 2. Test de création de playlist
const test = await n8nService.createPlaylistWithToken(
  spotifyToken,
  'Test Playlist',
  'Test depuis la console'
);

console.log('Résultat:', test);
```

## Dépannage

### Erreur : "Failed to get Spotify user info"
- Vérifiez que le token Spotify est valide
- Le token peut avoir expiré, reconnectez-vous

### Erreur : "n8n webhook error: 404"
- Vérifiez l'URL du webhook dans `.env`
- Assurez-vous que le workflow est activé dans n8n

### Erreur : "Spotify API error: 401"
- Les credentials Spotify dans n8n ont peut-être expiré
- Re-connectez le compte Spotify dans n8n

### La playlist est créée mais vide
- C'est normal ! Le workflow ne fait que créer le contenant
- Un autre workflow sera nécessaire pour remplir la playlist

## Prochaines étapes

Une fois ce workflow en place, vous pourrez créer :

1. **Workflow "Add Tracks to Playlist"**
   - Webhook qui reçoit une liste de chansons
   - Recherche chaque chanson sur Spotify
   - Ajoute les tracks à la playlist

2. **Workflow "Generate Playlist with AI"**
   - Reçoit un thème/prompt
   - Appelle ChatGPT/Claude pour générer une liste
   - Crée la playlist et ajoute les morceaux

3. **Workflow "Search Tracks"**
   - Recherche des morceaux sur Spotify
   - Retourne les résultats avec métadonnées

## Support

- [Documentation n8n](https://docs.n8n.io)
- [Spotify Web API Reference](https://developer.spotify.com/documentation/web-api)
- [Guide OAuth2 n8n](https://docs.n8n.io/integrations/builtin/credentials/spotify/)
