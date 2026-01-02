# Workflow n8n - Mode Quiz

## 📋 Vue d'ensemble

Ce workflow génère une playlist Spotify avec **3 mauvaises réponses** pour chaque chanson, permettant de créer un quiz musical à choix multiples.

**Fichier** : `generate-playlist-quiz-ai.json`

---

## 🚀 Installation

### 1. Importer le workflow dans n8n

1. Ouvrir n8n (`https://votre-instance-n8n.com`)
2. Cliquer sur **"Add workflow"** → **"Import from File"**
3. Sélectionner le fichier `generate-playlist-quiz-ai.json`
4. Le workflow apparaît avec tous les nodes connectés

### 2. Configurer les credentials

#### a) OpenAI API (pour l'IA)

**Node concerné** : `OpenAI Chat Model` + `OpenAI Chat Model (Mini)`

1. Cliquer sur le node `OpenAI Chat Model`
2. Dans "Credentials", cliquer sur **"Select credential"**
3. Si pas encore configuré : **"Create New"**
   - Name: `OpenAi account`
   - API Key: `sk-...` (votre clé OpenAI)
4. Répéter pour le node `OpenAI Chat Model (Mini)`

**💡 Note** : Le workflow utilise `gpt-4o` pour générer les chansons et `gpt-4o-mini` pour les mauvaises réponses (plus économique)

#### b) Spotify API (pour ajouter à la playlist)

**Node concerné** : `Search Song on Spotify` + `Add Songs to Playlist`

1. Cliquer sur le node `Search Song on Spotify`
2. Dans "Credentials", cliquer sur **"Select credential"**
3. Si pas encore configuré : **"Create New"**
   - Name: `Spotify account`
   - Client ID: `...` (depuis Spotify Developer Dashboard)
   - Client Secret: `...`
   - OAuth Callback URL: `https://votre-instance-n8n.com/rest/oauth2-credential/callback`
4. Autoriser l'accès à votre compte Spotify
5. Répéter pour le node `Add Songs to Playlist`

### 3. Activer le workflow

1. En haut à droite, basculer le switch **"Inactive"** → **"Active"**
2. Le webhook devient accessible

---

## 📡 Endpoint webhook

Une fois activé, le workflow est accessible via :

```
POST https://votre-instance-n8n.com/webhook/blindtest-quiz-mode
```

**Headers** :
```
Content-Type: application/json
```

**Body (JSON)** :
```json
{
  "playlistId": "spotify:playlist:xxxxx",
  "age": 30,
  "genres": ["Pop", "Rock", "Electronic"],
  "genre1Preferences": "J'aime les chansons dansantes",
  "genre2Preferences": "",
  "genre3Preferences": ""
}
```

---

## 📊 Flux du workflow

```
1. Quiz Mode Webhook (receive request)
   ↓
2. Format Quiz Input (prepare AI prompt)
   ↓
3. AI Agent - Generate Songs (OpenAI GPT-4o)
   ↓ Generates 10 songs
4. Parse Song List (parse JSON response)
   ↓
   ─────────────────────────────────────
   │ LOOP: For each of 10 songs (parallel)
   ├─→ 5. Format Wrong Answers Prompt
   ├─→ 6. AI Agent - Generate Wrong Answers (GPT-4o-mini)
   ├─→ 7. Combine Song + Wrong Answers
   ├─→ 8. Search Song on Spotify
   └─→ 9. Merge Spotify + Wrong Answers
   ─────────────────────────────────────
   ↓
10. Aggregate All Songs (combine all results)
   ↓
11. Add Songs to Playlist (Spotify API)
   ↓
12. Format Success Response
   ↓
13. Send Response (return JSON)
```

---

## 📤 Réponse attendue

Le workflow retourne :

```json
{
  "success": true,
  "playlistId": "spotify:playlist:xxxxx",
  "totalSongs": 10,
  "songs": [
    {
      "uri": "spotify:track:abc123",
      "title": "Shape of You",
      "artist": "Ed Sheeran",
      "wrongAnswers": [
        "The Weeknd - Blinding Lights",
        "Dua Lipa - Levitating",
        "Justin Bieber - Peaches"
      ]
    },
    {
      "uri": "spotify:track:def456",
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "wrongAnswers": [
        "Led Zeppelin - Stairway to Heaven",
        "The Beatles - Hey Jude",
        "Pink Floyd - Comfortably Numb"
      ]
    }
    // ... 8 autres chansons
  ]
}
```

---

## 🎯 Points clés de l'implémentation

### ✅ Génération des mauvaises réponses

**Node** : `AI Agent - Generate Wrong Answers`

**Prompt utilisé** :
```
For this song, generate 3 WRONG answers for a music quiz. The wrong answers must be:

Correct answer: {{ artist }} - {{ song }}

Rules:
- 3 real, well-known songs from the SAME or SIMILAR genre
- Same musical era (±5 years if possible)
- Comparable popularity level
- Format: "Artist - Song Title"
- DO NOT repeat the correct answer
- Make them credible but clearly different songs

RESPOND WITH ONLY VALID JSON:
["Artist 1 - Song Title 1", "Artist 2 - Song Title 2", "Artist 3 - Song Title 3"]
```

### ✅ Fallback automatique

**Node** : `Combine Song + Wrong Answers`

Si l'IA ne génère pas 3 réponses valides, un fallback automatique est activé :
```javascript
wrongAnswers = [
  `Unknown Artist 1 - Song ${index + 1}A`,
  `Unknown Artist 2 - Song ${index + 1}B`,
  `Unknown Artist 3 - Song ${index + 1}C`
];
```

### ✅ Traitement parallèle

Les 10 chansons sont traitées **en parallèle** pour optimiser le temps d'exécution :
- Génération des wrongAnswers : ~10 secondes par chanson
- Avec parallélisation : ~10-15 secondes total (au lieu de 100 secondes)

---

## 🧪 Test du workflow

### 1. Test manuel dans n8n

1. Ouvrir le workflow
2. Cliquer sur le node `Quiz Mode Webhook`
3. Cliquer sur **"Listen for Test Event"**
4. Dans un autre onglet, envoyer une requête POST :

```bash
curl -X POST https://votre-instance-n8n.com/webhook-test/blindtest-quiz-mode \
  -H "Content-Type: application/json" \
  -d '{
    "playlistId": "spotify:playlist:VOTRE_PLAYLIST_ID",
    "age": 30,
    "genres": ["Pop", "Rock"],
    "genre1Preferences": "Chansons dansantes",
    "genre2Preferences": "",
    "genre3Preferences": ""
  }'
```

5. Vérifier les résultats dans n8n

### 2. Test depuis l'application

1. Créer une session en mode Quiz
2. Sélectionner "Spotify IA" comme source
3. Vérifier les logs dans la console (`📦 Stockage des données quiz...`)
4. Lancer une chanson et vérifier que les 4 options s'affichent

---

## 🐛 Débogage

### Problème : "No valid tracks found"

**Cause** : L'IA a généré des chansons introuvables sur Spotify

**Solution** :
1. Vérifier le prompt dans `Format Quiz Input`
2. Ajouter "Make sure songs are popular and on Spotify"
3. Utiliser des genres plus précis

### Problème : "Invalid wrong answers, using fallback"

**Cause** : L'IA n'a pas retourné un JSON valide

**Solution** :
1. Vérifier les logs du node `AI Agent - Generate Wrong Answers`
2. Ajuster le prompt pour insister sur le format JSON
3. Augmenter la température du modèle si les réponses sont trop répétitives

### Problème : Timeout (504 Gateway Timeout)

**Cause** : Le workflow prend trop de temps (>30 secondes)

**Solutions** :
1. **Option A** : Réduire le nombre de chansons (10 → 5)
2. **Option B** : Utiliser `gpt-4o-mini` au lieu de `gpt-4o` (plus rapide)
3. **Option C** : Augmenter le timeout de Netlify Functions

### Problème : Coût élevé de l'API OpenAI

**Solution** : Utiliser `gpt-3.5-turbo` au lieu de `gpt-4o` :
1. Node `OpenAI Chat Model` : changer `gpt-4o` → `gpt-3.5-turbo`
2. Node `OpenAI Chat Model (Mini)` : garder `gpt-4o-mini`

---

## 💰 Estimation des coûts

### OpenAI API

**Par génération de playlist (10 chansons)** :
- Génération des chansons (GPT-4o) : ~500 tokens → $0.01
- Génération des wrongAnswers (GPT-4o-mini × 10) : ~3000 tokens → $0.003
- **Total par playlist** : ~$0.013

**Optimisation** : Utiliser GPT-3.5-turbo : ~$0.002 par playlist

### Spotify API

Gratuit (dans les limites : 10,000 requêtes/jour)

---

## 📝 Checklist de production

- [ ] Credentials OpenAI configurés
- [ ] Credentials Spotify configurés
- [ ] Workflow activé (switch "Active")
- [ ] Webhook accessible depuis l'application
- [ ] Test avec une vraie playlist réussi
- [ ] Les wrongAnswers sont bien générés
- [ ] Frontend reçoit le bon format JSON
- [ ] Firebase stocke correctement les `quiz_data/`
- [ ] Logs activés pour debug

---

## 🔧 Modifications possibles

### Changer le nombre de chansons

**Node** : `Format Quiz Input`
Modifier le prompt :
```
recommend exactly 15 songs  // Au lieu de 10
```

### Changer la langue des mauvaises réponses

**Node** : `Format Wrong Answers Prompt`
Ajouter :
```
- Use French song titles if available
```

### Utiliser un autre modèle IA

**Node** : `OpenAI Chat Model`
Changer le modèle :
- `gpt-4o` → meilleur qualité, plus cher
- `gpt-4o-mini` → bon compromis
- `gpt-3.5-turbo` → moins cher, qualité correcte

---

## 📚 Ressources

- **n8n Documentation** : https://docs.n8n.io/
- **OpenAI API** : https://platform.openai.com/docs/
- **Spotify Web API** : https://developer.spotify.com/documentation/web-api/
- **Frontend Integration** : Voir `docs/QUIZ_MODE_FIREBASE_STRUCTURE.md`

---

*Dernière mise à jour : 2025-11-11*
