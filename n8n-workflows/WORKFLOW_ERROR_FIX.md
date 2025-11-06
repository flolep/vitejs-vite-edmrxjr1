# 🔧 Correction des erreurs Spotify dans le workflow n8n

## 📋 Erreurs rencontrées

### Erreur 1 : "Cannot read properties of undefined (reading 'replace')"

```
TypeError: Cannot read properties of undefined (reading 'replace')
at ExecuteContext.execute (/usr/local/lib/node_modules/n8n/node_modules/.pnpm/n8n-nodes-base@file+packages+nodes-base_@aws-sdk+credential-providers@3.808.0_asn1.js@5_afd197edb2c1f848eae21a96a97fab23/node_modules/n8n-nodes-base/nodes/Spotify/Spotify.node.ts:1083:22)
```

### Erreur 2 : "Bad request - please check your parameters"

```
NodeApiError: Bad request - please check your parameters
at ExecuteContext.httpRequestWithAuthentication
at ExecuteContext.spotifyApiRequest
at ExecuteContext.execute (/usr/local/lib/node_modules/n8n/node_modules/.pnpm/n8n-nodes-base@file+packages+nodes-base_@aws-sdk+credential-providers@3.808.0_asn1.js@5_afd197edb2c1f848eae21a96a97fab23/node_modules/n8n-nodes-base/nodes/Spotify/Spotify.node.ts:1148:23)
```

## 🔍 Cause des problèmes

Les erreurs se produisaient dans le nœud **"Add Songs to Playlist"** du workflow n8n. Les problèmes étaient :

1. **Syntaxe incorrecte pour accéder au `playlistId`** (Erreur 1) :
   - Ancienne syntaxe : `$node['Batch Player Input Webhook'].json.body.playlistId`
   - Cette syntaxe ne fonctionnait pas correctement dans le contexte d'exécution
   - Le nœud Spotify recevait `undefined` et tentait de faire `.replace()` dessus → TypeError

2. **Format incorrect pour les `trackIDs`** (Erreur 2) :
   - Ancienne syntaxe : `$('Extract Track URIs').item.json.trackUrisString`
   - Problème : Spotify API exige des **URIs complets** au format `spotify:track:XXXXX`
   - Si on envoie juste les IDs (`XXXXX`) sans le préfixe, l'API retourne "Bad request"

## ✅ Solutions appliquées

### 1. Correction du nœud "Add Songs to Playlist"

**Avant :**
```json
{
  "resource": "playlist",
  "id": "={{ $node['Batch Player Input Webhook'].json.body.playlistId }}",
  "trackID": "={{ $('Extract Track URIs').item.json.trackUrisString }}",
  "additionalFields": {}
}
```

**Après :**
```json
{
  "resource": "playlist",
  "id": "={{ $('Batch Player Input Webhook').first().json.body.playlistId }}",
  "trackID": "={{ $json.trackUrisString }}",
  "additionalFields": {}
}
```

**Changements :**
- ✅ Utilisation de `$('Node Name').first()` pour accéder de manière fiable au premier item du webhook
- ✅ Utilisation de `$json.trackUrisString` pour accéder aux URIs complets des tracks (format requis par Spotify API)

### 2. Correction du nœud "Format Success Response"

**Changements similaires pour la cohérence :**
- `playlistId` : Utilise maintenant `$('Batch Player Input Webhook').first().json.body.playlistId`
- `totalPlayers` : Utilise maintenant `$('Batch Player Input Webhook').first().json.body.players.length`

### 3. Optimisation du nœud "Parse Song List"

**Changement :**
- Suppression de la référence au webhook dans le log (non essentielle)
- Le code fonctionne désormais de manière autonome

### 4. Format des URIs Spotify - IMPORTANT ⚠️

Le nœud **"Extract Track URIs"** génère 3 formats différents :

```javascript
{
  trackUris: ["spotify:track:ABC123", "spotify:track:DEF456"],        // ✅ URIs complets (ARRAY)
  trackUrisString: "spotify:track:ABC123,spotify:track:DEF456",       // ✅ URIs complets (STRING)
  trackIds: ["ABC123", "DEF456"]                                       // ❌ IDs seulement (ne marche PAS)
}
```

**Spotify API exige le format avec préfixe :**
- ✅ CORRECT : `spotify:track:ABC123,spotify:track:DEF456`
- ❌ INCORRECT : `ABC123,DEF456`

**C'est pourquoi on utilise `$json.trackUrisString` et PAS `$json.trackIds.join(',')`**

## 🧪 Comment tester le workflow corrigé

### 1. Vérifier le payload envoyé depuis l'application

Le payload doit contenir **obligatoirement** :
```json
{
  "playlistId": "SPOTIFY_PLAYLIST_ID_ICI",
  "players": [
    {
      "name": "Alice",
      "age": 25,
      "genres": ["Pop", "Rock"],
      "specialPhrase": "J'adore les années 80"
    },
    {
      "name": "Bob",
      "age": 30,
      "genres": ["Hip-Hop", "R&B"],
      "specialPhrase": ""
    }
  ]
}
```

**⚠️ IMPORTANT :** Le `playlistId` doit être **l'ID Spotify de la playlist** (ex: `37i9dQZF1DXcBWIGoYBM5M`), PAS l'URL complète.

### 2. Tester avec un exemple cURL

```bash
curl -X POST https://VOTRE_N8N_URL/webhook/blindtest-batch-playlist \
  -H "Content-Type: application/json" \
  -d '{
    "playlistId": "37i9dQZF1DXcBWIGoYBM5M",
    "players": [
      {
        "name": "Test Player",
        "age": 25,
        "genres": ["Pop", "Rock"],
        "specialPhrase": "Test"
      }
    ]
  }'
```

### 3. Vérifier dans n8n

1. **Ouvrir le workflow dans n8n**
2. **Cliquer sur "Execute Workflow"** ou attendre un appel webhook réel
3. **Vérifier chaque nœud** :
   - ✅ **Batch Player Input Webhook** : Doit recevoir le payload avec `playlistId` et `players[]`
   - ✅ **Format Batch Data** : Doit créer le prompt avec les infos des joueurs
   - ✅ **AI Agent** : Doit retourner un tableau de 50 chansons
   - ✅ **Parse Song List** : Doit transformer en 50 items individuels
   - ✅ **Search Song on Spotify** : Doit trouver les chansons sur Spotify (50 recherches)
   - ✅ **Extract Track URIs** : Doit agréger tous les URIs trouvés
   - ✅ **Add Songs to Playlist** : **NE DOIT PLUS AVOIR D'ERREUR** ✅
   - ✅ **Format Success Response** : Doit retourner le résumé

## 🐛 Débogage si l'erreur persiste

### Vérifier que le playlistId est bien envoyé

**Ajouter un nœud de débogage temporaire :**

1. Dans n8n, entre "Batch Player Input Webhook" et "Format Batch Data"
2. Ajouter un nœud **"Code"**
3. Mettre ce code :
```javascript
const webhookData = $input.first().json;
console.log('=== WEBHOOK DATA DEBUG ===');
console.log('Full body:', JSON.stringify(webhookData.body, null, 2));
console.log('playlistId:', webhookData.body?.playlistId);
console.log('Players count:', webhookData.body?.players?.length);
console.log('=========================');

// Vérifier que playlistId existe
if (!webhookData.body?.playlistId) {
  throw new Error('❌ playlistId est manquant dans le payload !');
}

// Passer les données au nœud suivant
return [$input.first()];
```

### Vérifier le code frontend

**Dans `src/Master.jsx` (ligne ~450) :**

```javascript
const payload = {
  playlistId: playlistId,  // ← VÉRIFIER que playlistId est bien défini
  players: playersPreferences.map(pref => ({
    name: pref.name,
    age: pref.age,
    genres: pref.genres,
    specialPhrase: pref.specialPhrase || ''
  }))
};

console.log('📦 Payload envoyé à n8n:', payload); // ← AJOUTER CE LOG
```

**Vérifier dans la console du navigateur :**
- Le `playlistId` doit être une string comme `"37i9dQZF1DXcBWIGoYBM5M"`
- Le tableau `players` doit contenir au moins 1 joueur

## 📝 Résumé des corrections

| Élément corrigé | Problème | Solution |
|----------------|----------|----------|
| `playlistId` dans "Add Songs to Playlist" | Syntaxe `$node[...]` ne fonctionnait pas | Utilisation de `$('Node').first().json` |
| `trackID` dans "Add Songs to Playlist" | Mauvais accès au contexte | Utilisation de `$json.trackIds.join(',')` |
| Références au webhook | Syntaxe incohérente | Uniformisation avec `$('Node').first()` |

## ✅ Fichier corrigé

Le fichier `generate-playlist-batch-ai.json` a été mis à jour avec toutes les corrections.

**Pour l'utiliser :**
1. Supprimer l'ancien workflow dans n8n (ou le désactiver)
2. Importer le nouveau fichier `generate-playlist-batch-ai.json`
3. Configurer vos credentials Spotify et OpenAI
4. Activer le workflow
5. Tester !

---

**Si le problème persiste après ces corrections, partagez les logs complets de n8n pour un diagnostic plus approfondi.**
