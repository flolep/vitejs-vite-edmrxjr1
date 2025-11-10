# ⚡ Modifications atomiques à faire dans n8n (3 minutes)

## 🎯 Nœud 1 : "Extract Track URIs" (Code)

Cliquez sur le nœud **"Extract Track URIs"** et **ajoutez ces lignes AVANT le `return` final** :

```javascript
// Récupérer le playlistId du webhook initial
const webhookData = $('Batch Player Input Webhook').first().json;
const playlistId = webhookData.body?.playlistId || webhookData.playlistId;

console.log('PlaylistId récupéré pour Add Songs:', playlistId);
```

**Et modifiez le `return` pour ajouter `playlistId` :**

```javascript
return [{
  json: {
    trackUris: trackUris,
    trackUrisString: trackUrisString,
    trackIds: trackUris.map(uri => uri.split(':')[2]),
    foundSongs: foundSongs,
    totalFound: trackUris.length,
    playlistId: playlistId  // ✅ AJOUTER CETTE LIGNE
  }
}];
```

---

## 🎯 Nœud 2 : "Add Songs to Playlist"

Cliquez sur le nœud **"Add Songs to Playlist"** et modifiez ces 2 champs :

### Champ "Playlist ID" :
```
={{ $json.playlistId }}
```

### Champ "Tracks" :
```
={{ $json.trackUrisString }}
```

---

## 🎯 Nœud 3 : "Format Success Response"

Cliquez sur le nœud **"Format Success Response"** et modifiez ces 2 assignations :

### Assignment "playlistId" (valeur) :
```
={{ $('Batch Player Input Webhook').first().json.body.playlistId }}
```

### Assignment "totalPlayers" (valeur) :
```
={{ $('Batch Player Input Webhook').first().json.body.players.length }}
```

---

## ✅ C'est tout !

Ces modifications corrigent :
- ✅ L'erreur "Cannot read properties of undefined (reading 'replace')"
- ✅ L'erreur "Bad request - please check your parameters"

**3 nœuds modifiés, ~5 changements au total**

Sauvegardez le workflow et testez-le !

---

## 💡 Pourquoi ces changements ?

1. **Nœud "Extract Track URIs"** : On récupère le `playlistId` du webhook et on le passe dans le output. C'est plus fiable que d'essayer d'y accéder depuis "Add Songs to Playlist"

2. **Nœud "Add Songs to Playlist"** :
   - `$json.playlistId` : Utilise le playlistId qu'on vient d'ajouter dans le nœud précédent
   - `$json.trackUrisString` : Contient les URIs complets Spotify au format requis (`spotify:track:ID`)

3. **Nœud "Format Success Response"** : Utilise `$('Node').first()` pour accéder de manière fiable aux données du webhook

---

## 📋 Récapitulatif ultra-rapide

| Nœud | Modification | Valeur |
|------|--------------|--------|
| **Extract Track URIs** | Ajouter playlistId dans le code | Voir code ci-dessus |
| **Add Songs to Playlist** | Playlist ID | `$json.playlistId` |
| **Add Songs to Playlist** | Tracks | `$json.trackUrisString` |
| **Format Success Response** | playlistId | `$('Batch Player Input Webhook').first().json.body.playlistId` |
| **Format Success Response** | totalPlayers | `$('Batch Player Input Webhook').first().json.body.players.length` |
