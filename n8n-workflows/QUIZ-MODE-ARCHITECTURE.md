# Architecture Mode Quiz - 2 Workflows Séparés

## 📋 Vue d'ensemble

Le mode Quiz utilise **2 workflows n8n séparés et indépendants** pour plus de simplicité, maintenabilité et réutilisabilité.

### Avantages de cette architecture

✅ **Simplicité** : Chaque workflow a une responsabilité unique
✅ **Réutilisabilité** : Le workflow Batch est partagé entre mode Équipe et mode Quiz
✅ **Maintenabilité** : Plus facile à debugger et à améliorer
✅ **Pas de problèmes de branches** : Évite la complexité des branches parallèles dans n8n

---

## 🔄 Les 2 Workflows

### Workflow 1 : Génération de Playlist (Batch)

**Fichier** : `generate-playlist-batch-ai-v3.json`

**Endpoint** : `POST /blindtest-batch-playlist`

**Fonction** :
- Génère une playlist Spotify basée sur les préférences de tous les joueurs
- Ajoute les chansons à la playlist Spotify

**Input** :
```json
{
  "playlistId": "spotify:playlist:xxxxx",
  "players": [
    {
      "name": "Alice",
      "age": 25,
      "genres": ["Pop", "Rock"],
      "specialPhrase": "J'aime les chansons dansantes"
    },
    {
      "name": "Bob",
      "age": 30,
      "genres": ["Jazz", "Soul"],
      "specialPhrase": ""
    }
  ]
}
```

**Output** :
```json
{
  "success": true,
  "playlistId": "spotify:playlist:xxxxx",
  "totalSongs": 50,
  "totalPlayers": 2,
  "songs": [
    {
      "uri": "spotify:track:abc123",
      "title": "Shape of You",
      "artist": "Ed Sheeran"
    },
    ...
  ]
}
```

---

### Workflow 2 : Génération des Mauvaises Réponses

**Fichier** : `generate-wrong-answers-v1.0.json`

**Endpoint** : `POST /blindtest-wrong-answers`

**Fonction** :
- Génère 3 mauvaises réponses pour chaque chanson
- Utilise l'IA (GPT-3.5-turbo) pour créer des réponses crédibles

**Input** :
```json
{
  "songs": [
    {
      "artist": "Ed Sheeran",
      "title": "Shape of You",
      "uri": "spotify:track:abc123"
    },
    {
      "artist": "Queen",
      "title": "Bohemian Rhapsody",
      "uri": "spotify:track:def456"
    },
    ...
  ]
}
```

**Output** :
```json
{
  "success": true,
  "totalSongs": 50,
  "wrongAnswers": {
    "0": {
      "artist": "Ed Sheeran",
      "title": "Shape of You",
      "uri": "spotify:track:abc123",
      "wrongAnswers": [
        "The Weeknd - Blinding Lights",
        "Dua Lipa - Levitating",
        "Justin Bieber - Peaches"
      ]
    },
    "1": {
      "artist": "Queen",
      "title": "Bohemian Rhapsody",
      "uri": "spotify:track:def456",
      "wrongAnswers": [
        "Led Zeppelin - Stairway to Heaven",
        "The Beatles - Hey Jude",
        "Pink Floyd - Comfortably Numb"
      ]
    },
    ...
  }
}
```

---

## 🎯 Flux Complet - Mode Quiz

### Dans l'application (Master.jsx)

```javascript
// 1. Appel du workflow 1 (Batch) - Génère la playlist
const playlistResponse = await n8nService.generatePlaylistWithAllPreferences({
  playlistId: "spotify:playlist:xxx",
  players: [...]
});

// Résultat : { songs: [{ uri, title, artist }, ...] }

// 2. Appel du workflow 2 (Wrong Answers) - Génère les mauvaises réponses
const wrongAnswersResponse = await n8nService.generateWrongAnswers(
  playlistResponse.songs
);

// Résultat : { wrongAnswers: { 0: {...}, 1: {...}, ... } }

// 3. Fusion des résultats
const songsWithWrongAnswers = playlistResponse.songs.map((song, index) => ({
  uri: song.uri,
  title: song.title,
  artist: song.artist,
  wrongAnswers: wrongAnswersResponse.wrongAnswers[index].wrongAnswers
}));
```

### Automatisation

La fonction `n8nService.fillPlaylistQuizMode()` fait **automatiquement** :
1. ✅ Appel workflow 1 (Batch)
2. ✅ Appel workflow 2 (Wrong Answers)
3. ✅ Fusion des résultats
4. ✅ Retour des chansons avec wrongAnswers

```javascript
// Appel simple depuis Master.jsx
const result = await n8nService.fillPlaylistQuizMode({
  playlistId: initialPlaylistId,
  players: players
});

// result.songs contient déjà les wrongAnswers !
```

---

## 📊 Comparaison des Architectures

| Aspect | v3.0.4 (1 workflow complexe) | v4.0 (2 workflows) |
|--------|------------------------------|-------------------|
| **Simplicité** | ❌ Branches parallèles complexes | ✅ 2 workflows simples |
| **Maintenabilité** | ❌ Difficile à debugger | ✅ Facile à modifier |
| **Réutilisabilité** | ❌ Code dupliqué | ✅ Batch partagé Équipe/Quiz |
| **Problèmes n8n** | ❌ Connexions visuelles | ✅ Aucun problème |
| **Performance** | ⚠️ Parallèle (théorique) | ⚠️ Séquentiel |
| **Coût IA** | Identique (~$0.002/playlist) | Identique (~$0.002/playlist) |

---

## ⚙️ Installation dans n8n

### Workflow 1 (Batch) - Déjà installé

Si vous avez déjà le workflow Batch pour le mode Équipe, **aucune action requise** ✅

Sinon, importer `generate-playlist-batch-ai-v3.json`.

### Workflow 2 (Wrong Answers) - Nouveau

1. Ouvrir n8n
2. Menu → **Import from File**
3. Sélectionner `generate-wrong-answers-v1.0.json`
4. Vérifier les credentials OpenAI (GPT-3.5-turbo)
5. Activer le workflow

---

## 🧪 Tests

### Test Workflow 1 (Batch)

```bash
curl -X POST https://your-n8n.com/webhook/blindtest-batch-playlist \
  -H "Content-Type: application/json" \
  -d '{
    "playlistId": "spotify:playlist:xxxxx",
    "players": [
      {"name": "Test", "age": 25, "genres": ["Pop"], "specialPhrase": ""}
    ]
  }'
```

### Test Workflow 2 (Wrong Answers)

```bash
curl -X POST https://your-n8n.com/webhook/blindtest-wrong-answers \
  -H "Content-Type: application/json" \
  -d '{
    "songs": [
      {"artist": "Ed Sheeran", "title": "Shape of You", "uri": "spotify:track:xxx"}
    ]
  }'
```

---

## 🔧 Configuration Netlify Function

Dans `netlify/functions/n8n-proxy.js`, ajouter la route pour le nouveau workflow :

```javascript
const ENDPOINTS = {
  // ... autres endpoints existants
  'blindtest-batch-playlist': 'https://your-n8n.com/webhook/blindtest-batch-playlist',
  'blindtest-wrong-answers': 'https://your-n8n.com/webhook/blindtest-wrong-answers'
};
```

---

## 📝 Notes de Migration

### Depuis v3.0.x (workflow parallèle)

1. ✅ L'ancien workflow `generate-playlist-quiz-ai-v3.0.json` peut être **supprimé ou désactivé**
2. ✅ Importer le nouveau workflow `generate-wrong-answers-v1.0.json`
3. ✅ Le code côté application est déjà mis à jour (version actuelle)
4. ✅ Aucune modification de structure Firebase requise

### Rétrocompatibilité

✅ **Le mode Équipe** continue de fonctionner normalement avec le workflow Batch
✅ **Le mode Quiz** utilise maintenant 2 workflows mais l'API reste identique

---

## 📈 Performance

### Workflow 1 (Batch)
- **50 chansons** : ~15-20 secondes
- Génération IA + Recherche Spotify + Ajout playlist

### Workflow 2 (Wrong Answers)
- **50 chansons** : ~30-40 secondes
- 50 appels IA en parallèle (GPT-3.5-turbo)

### Total Mode Quiz
- **Environ 50-60 secondes** pour 50 chansons
- Légèrement plus lent que v3.0.x parallèle (30-35s) mais **beaucoup plus fiable**

---

## 🎨 Workflow Visuel (n8n)

### Workflow 1 (Batch)

```
Webhook → Parse Body → Format Data → AI Generate Songs
  → Parse Songs → Search Spotify (50x parallèle)
  → Aggregate → Add to Playlist → Response
```

### Workflow 2 (Wrong Answers)

```
Webhook → Parse Body → Split Songs
  → Format Prompt (50x parallèle)
  → AI Generate Wrong Answers (50x parallèle)
  → Parse Wrong Answers
  → Aggregate → Response
```

---

*Documentation créée le 2025-11-16*
*Version : 4.0 - Architecture 2 Workflows*
