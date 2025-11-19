# Workflow n8n - Génération des mauvaises réponses pour le Mode Quiz

## Vue d'ensemble

Le workflow n8n doit générer une playlist Spotify avec des **mauvaises réponses** pour chaque chanson afin de créer des questions à choix multiples (QCM) pour le mode Quiz.

---

## Endpoint existant à modifier

### `blindtest-quiz-mode` (déjà présent dans n8nService.js)

**URL** : `/.netlify/functions/n8n-proxy`
**Endpoint** : `blindtest-quiz-mode`
**Méthode** : POST

---

## Format de la requête

```json
{
  "endpoint": "blindtest-quiz-mode",
  "payload": {
    "playlistId": "spotify:playlist:xxxxx",
    "age": 30,
    "genres": ["Pop", "Rock", "Electronic"],
    "genre1Preferences": "J'aime les chansons dansantes",
    "genre2Preferences": "",
    "genre3Preferences": ""
  }
}
```

---

## Format de la réponse attendu

Le workflow n8n doit retourner une structure avec les **wrongAnswers** pour chaque chanson :

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

## Contraintes pour les mauvaises réponses

### ✅ Règles à respecter

1. **3 mauvaises réponses par chanson** : Exactement 3, ni plus ni moins
2. **Format cohérent** : "Artiste - Titre" pour toutes les réponses
3. **Crédibilité** : Les mauvaises réponses doivent être plausibles
   - Vraies chansons connues (recommandé)
   - OU titres/artistes inventés mais réalistes
4. **Pas de doublons** : Les mauvaises réponses ne doivent PAS être dans la playlist des bonnes réponses
5. **Diversité** : Varier les mauvaises réponses (ne pas toujours utiliser les mêmes)

### ❌ Ce qu'il faut éviter

- ❌ Utiliser une chanson de la playlist comme mauvaise réponse
- ❌ Réponses trop évidentes (genres complètement différents)
- ❌ Doublons dans les mauvaises réponses d'une même question
- ❌ Format incohérent ("Titre" au lieu de "Artiste - Titre")

---

## Exemples de bonnes mauvaises réponses

### Exemple 1 : Pop moderne
**Bonne réponse** : Ed Sheeran - Shape of You
**Mauvaises réponses** ✅ :
- The Weeknd - Blinding Lights
- Dua Lipa - Levitating
- Justin Bieber - Peaches

**Pourquoi c'est bien** : Même époque, même genre, artistes similaires → crédible

---

### Exemple 2 : Rock classique
**Bonne réponse** : Queen - Bohemian Rhapsody
**Mauvaises réponses** ✅ :
- Led Zeppelin - Stairway to Heaven
- The Beatles - Hey Jude
- Pink Floyd - Comfortably Numb

**Pourquoi c'est bien** : Même genre, même époque, artistes comparables

---

### Exemple 3 : Électro
**Bonne réponse** : Daft Punk - Get Lucky
**Mauvaises réponses** ❌ :
- Mozart - Symphonie n°40
- Johnny Cash - Hurt
- Céline Dion - My Heart Will Go On

**Pourquoi c'est mauvais** : Genres complètement différents, trop évident

---

## Stratégies de génération avec l'IA

### Option 1 : Utiliser l'API Spotify

1. Pour chaque chanson de la playlist :
   - Récupérer les artistes similaires (Spotify API : `/artists/{id}/related-artists`)
   - Récupérer les top tracks de ces artistes similaires
   - Sélectionner 3 chansons aléatoires parmi ces résultats
   - S'assurer qu'elles ne sont pas dans la playlist principale

**Avantages** :
- Garantie que les chansons existent
- Cohérence stylistique assurée
- Pas besoin de l'IA pour générer

**Inconvénients** :
- Plus d'appels API
- Peut être lent

---

### Option 2 : Utiliser l'IA (ChatGPT/Claude) avec prompt

**Prompt suggéré** :

```
Pour la chanson suivante, génère 3 mauvaises réponses crédibles pour un quiz musical :

Chanson correcte : {artist} - {title}
Genre : {genre}
Année : {year}

Règles :
- Les 3 réponses doivent être de VRAIES chansons connues
- Même genre musical ou genre proche
- Même époque (±5 ans)
- Artistes comparables en popularité
- Format : "Artiste - Titre"
- Ne pas répéter la chanson correcte

Retourne uniquement les 3 réponses au format JSON :
["Artiste 1 - Titre 1", "Artiste 2 - Titre 2", "Artiste 3 - Titre 3"]
```

**Avantages** :
- Rapide et simple
- Bonnes réponses crédibles
- Pas besoin de multiple API calls

**Inconvénients** :
- Coût de l'API IA
- Peut inventer des chansons inexistantes (mais pas grave pour le quiz)

---

### Option 3 : Hybride (recommandé)

1. Utiliser l'IA pour générer les noms
2. Valider avec Spotify API si possible
3. Fallback sur d'autres chansons de la playlist si besoin

---

## Implémentation du workflow n8n

### Étapes suggérées

```
1. [HTTP Request] Recevoir la requête avec playlistId, age, genres
2. [Spotify API] Créer la playlist vide
3. [IA/ChatGPT] Générer 10 chansons basées sur les préférences
   ↓
4. Pour chaque chanson :
   4a. [Spotify API] Ajouter la chanson à la playlist
   4b. [IA/ChatGPT OU Spotify API] Générer 3 mauvaises réponses
   4c. Stocker : { uri, title, artist, wrongAnswers: [...] }
   ↓
5. [Return] Retourner le JSON complet avec toutes les chansons + wrongAnswers
```

---

## Exemple de node n8n pour générer les mauvaises réponses

### Node "Generate Wrong Answers" (Code JavaScript)

```javascript
// Pour chaque chanson de la playlist
for (let i = 0; i < items.length; i++) {
  const song = items[i].json;

  // Option A : Utiliser l'IA
  const prompt = `Pour cette chanson, génère 3 fausses réponses crédibles pour un quiz :

  Chanson correcte : ${song.artist} - ${song.title}
  Genre : ${song.genre || 'Pop'}

  Règles :
  - 3 vraies chansons connues du même genre
  - Format : "Artiste - Titre"
  - Ne pas répéter la chanson correcte

  Retourne JSON : ["Artist1 - Title1", "Artist2 - Title2", "Artist3 - Title3"]`;

  // Appel à l'API IA (à connecter avec un node HTTP Request)
  items[i].json.prompt = prompt;

  // Option B : Utiliser des chansons d'autres artistes de la playlist
  // (fallback si pas d'IA)
  const otherSongs = items
    .filter((_, idx) => idx !== i)
    .map(item => `${item.json.artist} - ${item.json.title}`)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  items[i].json.wrongAnswers = otherSongs;
}

return items;
```

---

## Testing du workflow

### 1. Test unitaire d'une chanson

**Input** :
```json
{
  "uri": "spotify:track:abc",
  "title": "Shape of You",
  "artist": "Ed Sheeran"
}
```

**Output attendu** :
```json
{
  "uri": "spotify:track:abc",
  "title": "Shape of You",
  "artist": "Ed Sheeran",
  "wrongAnswers": [
    "The Weeknd - Blinding Lights",
    "Dua Lipa - Levitating",
    "Justin Bieber - Peaches"
  ]
}
```

### 2. Test de la playlist complète

**Vérifications** :
- ✅ Chaque chanson a exactement 3 wrongAnswers
- ✅ Format cohérent "Artiste - Titre"
- ✅ Pas de doublons entre bonnes et mauvaises réponses
- ✅ Les mauvaises réponses sont crédibles

---

## Intégration côté frontend

Le frontend attend ce format dans `spotifyAIMode.loadPlaylistById()` :

```javascript
// src/modes/useSpotifyAIMode.js
const tracks = await spotifyService.getPlaylistTracks(token, playlistId);

// Après chargement, si mode Quiz actif :
if (playMode === 'quiz' && tracks[0]?.wrongAnswers) {
  await quizMode.storeQuizData(tracks);
}
```

**Le champ `wrongAnswers` doit donc être présent dans chaque track retourné par Spotify.**

---

## Gestion des erreurs

### Cas 1 : L'IA ne génère pas 3 réponses

**Solution** :
- Fallback sur d'autres chansons de la playlist
- OU générer des réponses par défaut

### Cas 2 : Timeout n8n

**Solution** :
- Le frontend utilise déjà un système de polling (rechargement automatique)
- Le workflow peut continuer en arrière-plan

### Cas 3 : Pas de wrongAnswers dans la réponse

**Solution** :
- Le frontend affiche un warning dans la console
- L'animateur peut générer manuellement ou changer de playlist

---

## Checklist de déploiement

- [ ] Le workflow n8n génère bien les wrongAnswers pour chaque chanson
- [ ] Le format est respecté : `["Artiste - Titre", ...]`
- [ ] Les mauvaises réponses sont crédibles et cohérentes
- [ ] Pas de doublons entre bonnes et mauvaises réponses
- [ ] Le endpoint `blindtest-quiz-mode` retourne le bon format JSON
- [ ] Test avec une vraie playlist de 10 chansons
- [ ] Test de rechargement (polling) si génération lente
- [ ] Logs appropriés pour debug

---

## Ressources utiles

- **Spotify API - Related Artists** : https://developer.spotify.com/documentation/web-api/reference/get-an-artists-related-artists
- **Spotify API - Artist Top Tracks** : https://developer.spotify.com/documentation/web-api/reference/get-an-artists-top-tracks
- **OpenAI API (pour génération IA)** : https://platform.openai.com/docs/api-reference/chat
- **n8n Workflow Templates** : https://n8n.io/workflows

---

*Dernière mise à jour : 2025-11-11*
