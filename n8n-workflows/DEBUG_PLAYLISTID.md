# 🔍 DEBUG : Trouver la bonne syntaxe pour playlistId

## Le problème

Dans le nœud **"Add Songs to Playlist"**, l'accès au `playlistId` du webhook initial ne fonctionne pas avec la syntaxe habituelle.

## 🧪 Syntaxes à tester (dans l'ordre)

### Option 1 : Accès au premier item du workflow
```javascript
={{ $item(0, 0).json.body.playlistId }}
```

### Option 2 : Accès via le node par index
```javascript
={{ $('Batch Player Input Webhook').item.json.body.playlistId }}
```

### Option 3 : Accès au body sans .first()
```javascript
={{ $('Batch Player Input Webhook').json.body.playlistId }}
```

### Option 4 : Si body est un objet simple
```javascript
={{ $('Batch Player Input Webhook').first().json.playlistId }}
```

### Option 5 : Si le webhook structure différemment
```javascript
={{ $node["Batch Player Input Webhook"].json["body"]["playlistId"] }}
```

### Option 6 : Via le contexte global
```javascript
={{ $workflow.nodes["Batch Player Input Webhook"].data.main[0][0].json.body.playlistId }}
```

---

## 🎯 SOLUTION ALTERNATIVE : Passer par un nœud intermédiaire

Au lieu de chercher le playlistId depuis le nœud "Add Songs to Playlist", **ajoutons-le dans le output du nœud "Extract Track URIs"**.

### Modifier le nœud "Extract Track URIs" (Code)

**Ajouter à la fin du code (avant le return) :**

```javascript
// Récupérer le playlistId du webhook initial
const webhookData = $('Batch Player Input Webhook').first().json;
const playlistId = webhookData.body?.playlistId || webhookData.playlistId;

console.log('PlaylistId récupéré:', playlistId);

return [{
  json: {
    trackUris: trackUris,
    trackUrisString: trackUrisString,
    trackIds: trackUris.map(uri => uri.split(':')[2]),
    foundSongs: foundSongs,
    totalFound: trackUris.length,
    playlistId: playlistId  // ✅ AJOUT ICI
  }
}];
```

### Ensuite dans "Add Songs to Playlist"

**Champ "Playlist ID" :**
```javascript
={{ $json.playlistId }}
```

C'est beaucoup plus simple et fiable !

---

## 🔧 Instructions pas à pas

1. **Ouvrez le nœud "Extract Track URIs"**
2. **Remplacez tout le code** par celui ci-dessous
3. **Sauvegardez**
4. **Dans "Add Songs to Playlist"**, mettez simplement : `={{ $json.playlistId }}`

---

## 📄 Code complet pour "Extract Track URIs"

```javascript
// Aggregate all Spotify track URIs
const allItems = $input.all();
const trackUris = [];
const foundSongs = [];

console.log('Processing', allItems.length, 'items from Spotify');

for (const item of allItems) {
  const track = item.json;

  // The Spotify node returns the track object directly
  if (track && track.uri && track.id && track.name) {
    trackUris.push(track.uri);
    foundSongs.push({
      name: track.name,
      artist: track.artists?.[0]?.name || 'Unknown',
      uri: track.uri,
      id: track.id
    });

    console.log('Found:', track.name, 'by', track.artists?.[0]?.name);
  }
}

console.log('Total tracks found:', trackUris.length);

if (trackUris.length === 0) {
  throw new Error(`No valid tracks found`);
}

// Create comma-separated string of URIs for Spotify node
const trackUrisString = trackUris.join(',');

console.log('Track URIs string:', trackUrisString);

// ✅ AJOUT : Récupérer le playlistId du webhook initial
const webhookData = $('Batch Player Input Webhook').first().json;
const playlistId = webhookData.body?.playlistId || webhookData.playlistId;

console.log('PlaylistId récupéré pour Add Songs:', playlistId);

return [{
  json: {
    trackUris: trackUris,
    trackUrisString: trackUrisString,
    trackIds: trackUris.map(uri => uri.split(':')[2]),
    foundSongs: foundSongs,
    totalFound: trackUris.length,
    playlistId: playlistId  // ✅ NOUVEAU
  }
}];
```

---

## ✅ Résumé

**Au lieu de :**
- Essayer 10 syntaxes différentes dans "Add Songs to Playlist"

**On fait :**
- On récupère le playlistId dans "Extract Track URIs" (où ça marche)
- On le passe dans le output
- On utilise simplement `$json.playlistId` dans "Add Songs to Playlist"

**C'est la méthode la plus propre et la plus fiable !**
