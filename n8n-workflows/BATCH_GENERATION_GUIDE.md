# Guide : Modifier le workflow n8n pour la génération groupée

## 📋 Vue d'ensemble

Ce guide explique comment modifier le workflow n8n existant (`generate-playlist-ai.json`) pour qu'il accepte un **tableau de préférences** au lieu d'une seule préférence individuelle.

### Changement principal

**Avant** : 1 joueur → 1 appel webhook → 10 chansons ajoutées
**Après** : N joueurs → 1 appel webhook → ~50 chansons ajoutées (selon tous les goûts)

---

## 🔄 Ancien payload (actuel)

```json
{
  "playlistId": "spotify_playlist_id",
  "age": 25,
  "genres": ["Pop", "Rock", "Jazz"],
  "genre1Preferences": "J'aime danser",
  "genre2Preferences": "",
  "genre3Preferences": ""
}
```

## 🆕 Nouveau payload (groupé)

```json
{
  "playlistId": "spotify_playlist_id",
  "players": [
    {
      "name": "John",
      "age": 25,
      "genres": ["Pop", "Rock", "Jazz"],
      "specialPhrase": "J'aime danser"
    },
    {
      "name": "Marie",
      "age": 30,
      "genres": ["R&B", "Soul", "Funk"],
      "specialPhrase": "Groove is life"
    },
    {
      "name": "Pierre",
      "age": 28,
      "genres": ["Rock", "Métal", "Indie"],
      "specialPhrase": "Heavy all the way"
    }
  ]
}
```

---

## 📝 Étapes de modification

### Étape 1 : Dupliquer le workflow existant

1. Ouvrir n8n
2. Aller dans **Workflows**
3. Ouvrir `Blindtest Game - AI Playlist Generator`
4. Cliquer sur les **3 points** (⋯) en haut à droite
5. Cliquer sur **Duplicate**
6. Renommer en `Blindtest Game - BATCH AI Playlist Generator`

### Étape 2 : Modifier le webhook (entrée)

**Node à modifier** : `Player Input Webhook`

- Garder le type : `POST`
- Changer le path : `blindtest-batch-playlist` (au lieu de `blindtest-player-input`)
- Laisser le reste identique

**Nouveau webhook URL** : `https://votre-n8n.com/webhook/blindtest-batch-playlist`

### Étape 3 : Modifier le node "Format Player Data"

**Node actuel** : `Format Player Data` (type: Set)

Remplacer le contenu du champ `prompt` par :

```javascript
You are a music expert. Based on a group of {{ $json.body.players.length }} players with different tastes, recommend exactly 50 songs that would be perfect for a blindtest game that everyone will enjoy.

PLAYERS INFORMATION:
{{ $json.body.players.map((player, i) => `
Player ${i+1}: ${player.name}
- Age: ${player.age}
- Genres: ${player.genres.join(", ")}
- Notes: ${player.specialPhrase || "None"}
`).join("\n") }}

INSTRUCTIONS:
- Create a diverse playlist that appeals to all age groups ({{ Math.min(...$json.body.players.map(p => p.age)) }}-{{ Math.max(...$json.body.players.map(p => p.age)) }} years)
- Include songs from ALL mentioned genres: {{ [...new Set($json.body.players.flatMap(p => p.genres))].join(", ") }}
- Balance the distribution so everyone finds songs they like
- Prioritize popular, recognizable songs perfect for a blindtest
- Make sure all songs are available on Spotify

RESPOND WITH ONLY VALID JSON in this exact format, with no markdown code blocks or explanations:
[
  {"artist": "Artist Name", "song": "Song Title"},
  {"artist": "Artist Name", "song": "Song Title"},
  ... (50 songs total)
]

No markdown formatting, just pure JSON.
```

### Étape 4 : Ajuster le nombre de chansons

**Node à modifier** : `Parse Song List` (type: Code)

Le code actuel est déjà flexible (il itère sur tous les résultats), donc **aucune modification nécessaire**.

### Étape 5 : Tester le nouveau workflow

**Test avec cURL** :

```bash
curl -X POST https://votre-n8n.com/webhook/blindtest-batch-playlist \
  -H "Content-Type: application/json" \
  -d '{
    "playlistId": "VOTRE_PLAYLIST_ID",
    "players": [
      {
        "name": "John",
        "age": 25,
        "genres": ["Pop", "Rock", "Jazz"],
        "specialPhrase": "J'\''aime danser"
      },
      {
        "name": "Marie",
        "age": 30,
        "genres": ["R&B", "Soul", "Funk"],
        "specialPhrase": "Groove is life"
      }
    ]
  }'
```

**Résultat attendu** :
```json
{
  "success": true,
  "message": "Blindtest playlist filled successfully!",
  "playlistId": "VOTRE_PLAYLIST_ID",
  "totalSongs": 50,
  "songs": [...]
}
```

---

## 🔧 Modification côté application

### Dans `n8nService.js`

Ajouter la nouvelle fonction :

```javascript
// Nouvelle fonction pour la génération groupée
async generatePlaylistWithAllPreferences(payload) {
  try {
    const url = `${this.baseUrl}/webhook/blindtest-batch-playlist`;

    console.log('📤 Appel webhook n8n (batch):', url);
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Réponse n8n (batch):', result);

    return result;
  } catch (error) {
    console.error('❌ Erreur appel n8n (batch):', error);
    throw error;
  }
}
```

### Dans `Master.jsx`

Remplacer la ligne TODO par :

```javascript
// Ligne 573 actuelle :
// const result = await n8nService.generatePlaylistWithAllPreferences(payload);

// Remplacer par :
const result = await n8nService.generatePlaylistWithAllPreferences(payload);

if (result.success) {
  console.log(`✅ ${result.totalSongs} chansons ajoutées à la playlist`);
} else {
  throw new Error('Erreur lors de la génération de la playlist');
}
```

---

## 🎯 Logique de l'IA

Le prompt modifié demande à l'IA de :

1. **Analyser tous les joueurs** : Âges, genres, phrases spéciales
2. **Identifier la plage d'âges** : Min-Max pour cibler la bonne époque
3. **Agréger tous les genres** : Créer un set unique de tous les genres mentionnés
4. **Équilibrer la playlist** : Chaque joueur doit trouver des chansons qu'il aime
5. **Choisir des hits** : Prioriser les chansons populaires et reconnaissables

### Exemple de distribution intelligente

**Entrée** :
- John (25 ans) : Pop, Rock, Jazz
- Marie (30 ans) : R&B, Soul, Funk
- Pierre (28 ans) : Rock, Métal, Indie

**Sortie attendue (50 chansons)** :
- ~10 chansons Pop/Rock (pour John)
- ~8 chansons R&B/Soul/Funk (pour Marie)
- ~8 chansons Rock/Métal/Indie (pour Pierre)
- ~12 chansons Rock (zone commune John + Pierre)
- ~12 chansons variées années 90-2000 (plage d'âge 25-30)

---

## ⚠️ Points d'attention

### 1. Limite OpenAI

Le prompt devient plus long avec plusieurs joueurs. Vérifier que :
- Le contexte reste sous la limite de tokens
- Tester avec 10-15 joueurs max

### 2. Temps de génération

- 1 joueur : ~10-15 secondes
- 5 joueurs : ~20-30 secondes
- 10 joueurs : ~30-40 secondes

Ajouter un indicateur de progression dans l'UI si nécessaire.

### 3. Gestion des erreurs

Si la génération échoue :
- Afficher un message clair à l'animateur
- Logger l'erreur complète dans la console
- Permettre de réessayer

### 4. Credentials Spotify

S'assurer que le compte Spotify OAuth dans n8n a les permissions :
- `playlist-modify-public`
- `playlist-modify-private`

---

## 🧪 Tests recommandés

### Test 1 : 2 joueurs avec genres différents

```json
{
  "playlistId": "test_playlist_id",
  "players": [
    {"name": "John", "age": 25, "genres": ["Pop", "Rock"], "specialPhrase": "Énergique"},
    {"name": "Marie", "age": 30, "genres": ["Jazz", "Soul"], "specialPhrase": "Smooth"}
  ]
}
```

**Attendu** : Mélange équilibré de Pop, Rock, Jazz, Soul

### Test 2 : 5 joueurs avec âges variés

```json
{
  "playlistId": "test_playlist_id",
  "players": [
    {"name": "A", "age": 20, "genres": ["Rap", "Hip-Hop"], "specialPhrase": ""},
    {"name": "B", "age": 30, "genres": ["Rock", "Pop"], "specialPhrase": ""},
    {"name": "C", "age": 40, "genres": ["Disco", "Funk"], "specialPhrase": ""},
    {"name": "D", "age": 25, "genres": ["Électro", "House"], "specialPhrase": ""},
    {"name": "E", "age": 35, "genres": ["R&B", "Soul"], "specialPhrase": ""}
  ]
}
```

**Attendu** : Playlist traversant les décennies (80s-2020s)

### Test 3 : Tous les joueurs aiment le Rock

```json
{
  "playlistId": "test_playlist_id",
  "players": [
    {"name": "A", "age": 25, "genres": ["Rock", "Métal"], "specialPhrase": ""},
    {"name": "B", "age": 28, "genres": ["Rock", "Indie"], "specialPhrase": ""},
    {"name": "C", "age": 30, "genres": ["Rock", "Grunge"], "specialPhrase": ""}
  ]
}
```

**Attendu** : 100% de Rock avec variété de sous-genres

---

## 📊 Comparaison des workflows

| Critère | Ancien (individuel) | Nouveau (groupé) |
|---------|---------------------|------------------|
| Appels webhook | N (par joueur) | 1 (tous ensemble) |
| Temps total | N × 15s | ~30s |
| Cohérence | Variable | Excellente |
| Contrôle | Joueurs | Animateur |
| Chansons/joueur | 10 | ~50 / N joueurs |

---

## ✅ Checklist finale

Avant de déployer :

- [ ] Workflow dupliqué et renommé
- [ ] Webhook path modifié (`blindtest-batch-playlist`)
- [ ] Prompt mis à jour pour tableau de joueurs
- [ ] Test avec 2 joueurs réussi
- [ ] Test avec 5 joueurs réussi
- [ ] `n8nService.js` mise à jour avec nouvelle fonction
- [ ] `Master.jsx` appelle le nouveau service
- [ ] Variables d'environnement mises à jour (si webhook URL change)
- [ ] Documentation partagée avec l'équipe

---

## 🚀 Activation

1. **Sauvegarder** le workflow modifié
2. **Activer** le workflow (toggle en haut à droite)
3. **Copier** l'URL du webhook
4. **Mettre à jour** `.env` dans l'application :
   ```
   VITE_N8N_BATCH_PLAYLIST_WEBHOOK_URL=https://votre-n8n.com/webhook/blindtest-batch-playlist
   ```
5. **Rebuild** l'application
6. **Tester** en production

---

## 🔄 Rollback

Si problème, revenir à l'ancien workflow :

1. Désactiver le nouveau workflow
2. Réactiver l'ancien workflow
3. Restaurer les variables d'environnement
4. Redéployer l'application

Le code supporte les deux modes grâce au flag `preferencesSubmitted`.

---

## 📞 Support

En cas de problème :
1. Vérifier les logs n8n (Executions)
2. Vérifier la console du navigateur
3. Tester le webhook avec cURL
4. Vérifier les credentials Spotify dans n8n
