# ⚡ Modifications atomiques à faire dans n8n (2 minutes)

## 🎯 Nœud 1 : "Add Songs to Playlist"

Cliquez sur le nœud **"Add Songs to Playlist"** et modifiez ces 2 champs :

### Champ "Playlist ID" :
```
={{ $('Batch Player Input Webhook').first().json.body.playlistId }}
```

### Champ "Tracks" :
```
={{ $json.trackUrisString }}
```

---

## 🎯 Nœud 2 : "Format Success Response"

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

Ces 4 modifications corrigent :
- ✅ L'erreur "Cannot read properties of undefined (reading 'replace')"
- ✅ L'erreur "Bad request - please check your parameters"

Sauvegardez le workflow et testez-le !

---

## 💡 Pourquoi ces changements ?

1. **`$('Node').first()`** : Syntaxe fiable pour accéder aux données du webhook
2. **`$json.trackUrisString`** : Contient les URIs complets Spotify au format requis (`spotify:track:ID`)
