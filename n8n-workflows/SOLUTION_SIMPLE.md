# ✅ SOLUTION SIMPLE - Le playlistId est directement dans $json

## 🔍 Problème identifié

Le proxy Netlify (`netlify/functions/n8n-proxy.js` ligne 69) envoie **directement le payload** à n8n :

```javascript
body: JSON.stringify(payload || {})
```

Donc n8n reçoit :
```json
{
  "playlistId": "54Tfvba3cbYIFvqnTC1YE0",
  "players": [...]
}
```

**PAS** `{ body: { playlistId: ..., players: [...] } }`

---

## ✅ Solution : Utiliser `$json.playlistId` directement

### Nœud 1 : "Format Batch Data"

**Ajouter un assignment pour passer le playlistId :**

Nom : `playlistId`
Valeur : `={{ $json.playlistId }}`

### Nœud 2 : "Parse Song List"

**Ajouter `playlistId` dans chaque item :**

```javascript
// Récupérer le playlistId depuis Format Batch Data
const playlistId = $('Format Batch Data').first().json.playlistId;

// Return each song for parallel Spotify search with playlistId
return songs.map((song, index) => ({
  json: {
    artist: song.artist,
    song: song.song,
    searchQuery: `${song.song} ${song.artist}`,
    index: index,
    playlistId: playlistId  // ✅ AJOUTER
  }
}));
```

### Nœud 3 : "Extract Track URIs"

**Récupérer le playlistId depuis un item :**

```javascript
// Récupérer le playlistId depuis le premier item (tous l'ont)
const playlistId = allItems[0]?.json?.playlistId || null;

console.log('PlaylistId récupéré:', playlistId);

return [{
  json: {
    trackUris: trackUris,
    trackUrisString: trackUrisString,
    trackIds: trackUris.map(uri => uri.split(':')[2]),
    foundSongs: foundSongs,
    totalFound: trackUris.length,
    playlistId: playlistId  // ✅ AJOUTER
  }
}];
```

### Nœud 4 : "Add Songs to Playlist"

**Playlist ID :**
```
={{ $json.playlistId }}
```

**Tracks :**
```
={{ $json.trackUrisString }}
```

### Nœud 5 : "Format Success Response"

**playlistId :**
```
={{ $('Batch Player Input Webhook').first().json.playlistId }}
```

**totalPlayers :**
```
={{ $('Batch Player Input Webhook').first().json.players.length }}
```

---

## 📊 Flux du playlistId

1. **Webhook** reçoit : `{ playlistId: "...", players: [...] }`
2. **Format Batch Data** : Passe `playlistId` en tant qu'assignment
3. **Parse Song List** : Ajoute `playlistId` dans chaque item (50 items)
4. **Search Song on Spotify** : Les items passent (avec `playlistId`)
5. **Extract Track URIs** : Récupère `playlistId` du premier item
6. **Add Songs to Playlist** : Utilise `$json.playlistId` ✅

---

## 🎯 Modifications atomiques

| Nœud | Modification | Code |
|------|--------------|------|
| **Format Batch Data** | Ajouter assignment | `playlistId: {{ $json.playlistId }}` |
| **Parse Song List** | Ajouter playlistId dans output | Voir code ci-dessus |
| **Extract Track URIs** | Récupérer depuis items | `allItems[0]?.json?.playlistId` |
| **Add Songs to Playlist** | Utiliser directement | `{{ $json.playlistId }}` |
| **Format Success Response** | Accès direct webhook | `{{ $('Webhook').first().json.playlistId }}` |

---

## ✅ Simple, propre, efficace !
