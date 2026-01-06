# Structure Firebase - Mode Quiz

## Vue d'ensemble

Cette documentation définit la structure complète de Firebase pour le mode Quiz, compatible avec la structure existante du mode Équipe.

---

## Structure complète

```
sessions/{sessionId}/
├── playMode: "quiz"                      // Indicateur du mode de jeu
├── currentTrackNumber: 0                 // Numéro de piste actuelle
├── isPlaying: true/false                 // État de lecture
├── chrono: 12.5                          // Chronomètre en secondes
├── songDuration: 30                      // Durée de la chanson
├── currentSong: {...}                    // Chanson actuelle (mode Team)
├── game_status: "waiting"                // État du jeu
├── showQRCode: true/false                // Affichage du QR code
│
├── quiz/                                 // ⭐ Question actuelle (Quiz)
│   ├── trackNumber: 0
│   ├── answers: [                        // Les 4 réponses (A, B, C, D)
│   │     {
│   │       label: "A",
│   │       text: "Ed Sheeran - Shape of You",
│   │       isCorrect: true
│   │     },
│   │     {
│   │       label: "B",
│   │       text: "The Weeknd - Blinding Lights",
│   │       isCorrect: false
│   │     },
│   │     {
│   │       label: "C",
│   │       text: "Dua Lipa - Levitating",
│   │       isCorrect: false
│   │     },
│   │     {
│   │       label: "D",
│   │       text: "Justin Bieber - Peaches",
│   │       isCorrect: false
│   │     }
│   │   ]
│   ├── correctAnswer: "A"                // Lettre de la bonne réponse
│   └── revealed: false                   // La réponse a-t-elle été révélée ?
│
├── quiz_data/                            // ⭐ Données de toutes les questions
│   └── {trackNumber}/
│       ├── correctAnswer: {
│       │     title: "Shape of You",
│       │     artist: "Ed Sheeran",
│       │     uri: "spotify:track:xxx"
│       │   }
│       └── wrongAnswers: [
│             "The Weeknd - Blinding Lights",
│             "Dua Lipa - Levitating",
│             "Justin Bieber - Peaches"
│           ]
│
├── quiz_answers/                         // ⭐ Réponses des joueurs par chanson
│   └── {trackNumber}/
│       └── {playerId}/
│           ├── playerName: "Alice"
│           ├── answer: "A"               // Réponse choisie
│           ├── time: 2.3                 // Temps de réponse (secondes)
│           ├── timestamp: 1699999999     // Timestamp de réponse
│           └── isCorrect: true           // Bonne réponse ? (calculé après révélation)
│
├── quiz_leaderboard/                     // ⭐ Classement général cumulé
│   └── {playerId}/
│       ├── playerName: "Alice"
│       ├── totalPoints: 3250
│       └── correctAnswers: 5
│
├── players_session/                      // Joueurs connectés
│   └── team1/                            // Même structure que mode Team
│       └── {playerId}/
│           ├── name: "Alice"
│           ├── connected: true
│           └── lastSeen: timestamp
│
├── scores/                               // Scores équipes (mode Team uniquement)
│   ├── team1: 1200
│   └── team2: 800
│
├── buzz/                                 // Système de buzz (mode Team uniquement)
│   ├── team: "team1"
│   └── playerKey: "player1"
│
└── buzz_times/                           // Temps de buzz (mode Team uniquement)
    └── {trackNumber}/
        └── {teamKey}/
            └── {playerKey}/
                └── time: 1.5
```

---

## Flux de données - Mode Quiz

### 1. Chargement de la playlist

**Backend n8n génère** :
```json
{
  "playlistId": "spotify:playlist:xxx",
  "songs": [
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
  ]
}
```

**Master stocke dans Firebase** :
- Playlist Spotify (pour le lecteur audio)
- `quiz_data/{trackNumber}` pour chaque chanson

---

### 2. Démarrage d'une chanson

**Master (useQuizMode.js)** :
1. Lit `quiz_data/{currentTrack}`
2. Mélange les 4 réponses (1 bonne + 3 mauvaises)
3. Écrit dans `sessions/{sessionId}/quiz` :
   ```json
   {
     "trackNumber": 0,
     "answers": [...],  // Mélangées
     "correctAnswer": "C",
     "revealed": false
   }
   ```

**TV lit** : `sessions/{sessionId}/quiz` pour afficher les 4 options

**Joueurs lisent** : `sessions/{sessionId}/quiz` pour afficher les boutons

---

### 3. Joueur répond

**Joueur écrit** dans `quiz_answers/{trackNumber}/{playerId}` :
```json
{
  "playerName": "Alice",
  "answer": "C",
  "time": 2.3,
  "timestamp": 1699999999,
  "isCorrect": null  // Sera calculé après révélation
}
```

**TV lit** : `quiz_answers/{trackNumber}` en temps réel
- Affiche les joueurs au fur et à mesure

---

### 4. Master révèle la réponse

**Master (revealQuizAnswer)** :
1. Met à jour `quiz.revealed = true`
2. Pour chaque joueur dans `quiz_answers/{trackNumber}` :
   - Vérifie si `answer === correctAnswer`
   - Met à jour `isCorrect`
   - Calcule les points selon le temps et le rang
3. Met à jour `quiz_leaderboard/{playerId}` :
   - Ajoute les points gagnés
   - Incrémente `correctAnswers` si correct

**TV affiche** :
- ✅ sur la bonne réponse
- Points attribués à chaque joueur
- Mise à jour du leaderboard général (sidebar)

---

### 5. Chanson suivante

**Master (resetQuiz)** :
1. Supprime `sessions/{sessionId}/quiz`
2. Les données restent dans `quiz_answers/{trackNumber}` (historique)
3. Le `quiz_leaderboard` garde les scores cumulés

**TV/Joueurs** :
- Effacent l'affichage de la question précédente
- Attendent la nouvelle question

---

## Points clés de l'architecture

### ✅ Données partagées (Team + Quiz)
- `currentTrackNumber`
- `isPlaying`
- `chrono`
- `songDuration`
- `game_status`
- `players_session`

### ⭐ Données spécifiques au Quiz
- `quiz/` : Question actuelle
- `quiz_data/` : Toutes les questions (stockage permanent)
- `quiz_answers/` : Réponses des joueurs par chanson
- `quiz_leaderboard/` : Classement général

### 🔒 Données inutilisées en mode Quiz
- `scores` (remplacé par `quiz_leaderboard`)
- `buzz` (pas de buzzer en mode Quiz)
- `buzz_times` (remplacé par `quiz_answers.time`)
- `currentSong` (remplacé par `quiz`)

---

## Calcul des points

### Formule
```javascript
const basePoints = 1000;
const timeBonus = Math.max(0, 500 - (responseTime * 10));
const rankBonus = Math.max(0, 500 - (rank * 100));
const totalPoints = basePoints + timeBonus + rankBonus;
```

### Exemples
- **1er à répondre en 2.3s** : 1000 + 477 + 500 = **1977 pts**
- **2e à répondre en 3.1s** : 1000 + 469 + 400 = **1869 pts**
- **3e à répondre en 5.0s** : 1000 + 450 + 300 = **1750 pts**
- **Mauvaise réponse** : **0 pts**

---

## Gestion des joueurs non-répondants

### Déclencheurs d'affichage
Les joueurs qui n'ont pas répondu apparaissent lors de :
1. **Pause** : `isPlaying = false`
2. **Arrêt** : `game_status = "stopped"`
3. **Révélation** : `quiz.revealed = true`

### Logique TV
```javascript
// Liste des joueurs connectés
const allPlayers = Object.values(players_session.team1);

// Liste des joueurs ayant répondu
const respondedPlayerIds = Object.keys(quiz_answers[trackNumber]);

// Joueurs non-répondants
const nonRespondents = allPlayers.filter(
  player => !respondedPlayerIds.includes(player.id)
);

// Afficher si pause/arrêt/révélé
if (!isPlaying || gameStatus === "stopped" || quiz.revealed) {
  // Afficher nonRespondents avec "(Pas de réponse)"
}
```

---

## Migration depuis le code actuel

### Changements nécessaires

1. **useQuizMode.js** (ligne 19-63)
   - ❌ **Ancien** : Génère les mauvaises réponses depuis la playlist
   - ✅ **Nouveau** : Lit les mauvaises réponses depuis `quiz_data/`

2. **Master.jsx** (ligne 385)
   - ❌ **Ancien** : `generateQuizAnswers(track, playlist)`
   - ✅ **Nouveau** : `generateQuizAnswers(track, quizData[trackNumber])`

3. **n8nService.js** (ligne 227-288)
   - ✅ **Déjà prévu** : `fillPlaylistQuizMode()` retourne les `wrongAnswers`
   - ⚠️ **À vérifier** : Le workflow n8n génère-t-il bien les mauvaises réponses ?

4. **Nouveaux fichiers à créer** :
   - `Buzzer.jsx` : Interface Quiz (4 boutons A/B/C/D)
   - `TV.jsx` : Affichage Quiz (options + classement + sidebar)

---

## Checklist d'implémentation

- [ ] Stocker `quiz_data` lors du chargement de playlist (Master.jsx)
- [ ] Modifier `generateQuizAnswers()` pour lire depuis `quiz_data`
- [ ] Créer interface Joueur (Buzzer.jsx)
- [ ] Créer interface TV (TV.jsx)
- [ ] Tester le workflow n8n pour génération des mauvaises réponses
- [ ] Gérer l'affichage des non-répondants
- [ ] Tests end-to-end du flux complet

---

## Annexe : Format de données n8n attendu

Lorsque l'IA génère la playlist, elle doit retourner :

```json
{
  "success": true,
  "playlistId": "spotify:playlist:xxx",
  "totalSongs": 10,
  "songs": [
    {
      "uri": "spotify:track:abc",
      "title": "Shape of You",
      "artist": "Ed Sheeran",
      "wrongAnswers": [
        "The Weeknd - Blinding Lights",
        "Dua Lipa - Levitating",
        "Justin Bieber - Peaches"
      ]
    },
    // ... 9 autres chansons
  ]
}
```

**Contraintes pour l'IA** :
- Les mauvaises réponses doivent être crédibles (vraies chansons ou titres inventés réalistes)
- Elles ne doivent PAS être dans la playlist (pour éviter les doublons visuels)
- Format : "Artiste - Titre" ou "Titre - Artiste" (cohérent)
- 3 mauvaises réponses par chanson

---

*Dernière mise à jour : 2025-11-11*
