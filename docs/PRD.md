# PRD — Blind Test App

## 1. Vision du produit

### Mission
Blind Test App est une application de quiz musical multijoueur en temps réel, conçue comme **vitrine technologique** démontrant l'intégration concrète de technologies modernes : LLM, automatisation n8n, Firebase Realtime Database, Spotify Web Playback SDK, Netlify Functions et React.

### Proposition de valeur
Permettre à un animateur d'organiser un blind test interactif avec des joueurs sur mobile et un affichage spectaculaire sur grand écran, en s'appuyant sur l'IA pour générer des playlists personnalisées à partir des goûts musicaux des participants.

### Positionnement
Ce n'est pas un produit SaaS grand public. C'est un **projet vitrine** destiné à démontrer des compétences d'intégration technique dans un contexte ludique et engageant (soirées, événements, team building).

---

## 2. Personas

### Animateur (persona principal : Florian)
- **Rôle** : Crée et pilote la session de jeu depuis un PC/tablette.
- **Besoins** : Configurer rapidement une partie, contrôler la lecture musicale, arbitrer les buzz, gérer les scores.
- **Parcours** : Accueil → Wizard (connexion, choix session, source musicale, mode de jeu) → Interface Master.
- **Points de friction actuels** : Le wizard nécessite une connexion Firebase ET Spotify avant de continuer. La gestion du chrono Firebase est lourde (10 writes/s).

### Joueur (mobile)
- **Rôle** : Rejoint une session via code ou QR code, buzze pour répondre ou répond au QCM.
- **Besoins** : Rejoindre rapidement, buzzer de façon réactive, voir ses stats personnelles.
- **Parcours** : Accueil → Code session → Nom/Photo → Préférences (mode IA) → Choix équipe → Jeu.
- **Points de friction actuels** : L'onboarding comporte jusqu'à 8 étapes. Pas de debouncing sur le buzz.

### Spectateur (écran TV)
- **Rôle** : Observe le jeu sur un grand écran (scores, joueurs, chanson en cours).
- **Besoins** : Affichage lisible, animations des buzz, écran de fin avec stats.
- **Parcours** : Accueil → Code session → Affichage temps réel.
- **Points de friction actuels** : Aucun contrôle interactif. Dépend entièrement de Firebase pour les mises à jour.

---

## 3. Architecture technique (état réel du code)

### Stack
| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend | React + Vite | React 19.2, Vite 7.1 |
| Styling | Tailwind CSS | 4.1 |
| Base de données | Firebase Realtime Database | SDK 12.4 |
| Auth | Firebase Auth (email/password) | SDK 12.4 |
| Musique | Spotify Web Playback SDK + API REST | OAuth 2.0 |
| Backend | Netlify Functions (serverless) | Node.js |
| Automatisation | n8n (webhooks via proxy) | Cloud |
| Joueurs DB | localStorage (Airtable prévu mais non connecté) | — |
| Déploiement | Netlify | CI/CD |
| QR Code | qrcode.react | 4.2 |
| Icônes | Lucide React | 0.545 |

### Schéma d'architecture

```
┌─────────────────────────────────────────────────────┐
│                   CLIENTS (React)                    │
│  Master.jsx │ Buzzer.jsx │ TV.jsx │ MasterWizard.jsx │
└────────┬──────────┬──────────┬──────────────────────┘
         │          │          │
         ▼          ▼          ▼
┌─────────────────────────────────────────────────────┐
│              FIREBASE REALTIME DATABASE              │
│  sessions/{id}/scores, chrono, buzz, quiz, players  │
└────────┬────────────────────────────────────────────┘
         │
    ┌────┴────────────────────────────┐
    ▼                                 ▼
┌──────────────────┐    ┌───────────────────────┐
│ NETLIFY FUNCTIONS │    │   SPOTIFY WEB API     │
│ spotify-auth.js   │◄──│  OAuth + Playback SDK │
│ n8n-proxy.js      │    └───────────────────────┘
│ save-player-prefs │
└────────┬──────────┘
         │
         ▼
┌──────────────────┐
│    n8n CLOUD      │
│ Workflows IA      │
│ (playlist gen)    │
└──────────────────┘
```

### Structure des fichiers source (~10 600 LOC)

```
src/
├── App.jsx                  (110 LOC)   Routeur principal
├── Master.jsx               (1424 LOC)  Interface animateur
├── Buzzer.jsx               (1678 LOC)  Interface joueur
├── TV.jsx                   (1055 LOC)  Écran spectateur
├── SpotifyCallback.jsx      (77 LOC)    Callback OAuth
├── hooks/
│   ├── useGameSession.js    (123 LOC)   Session, scores, chrono
│   ├── useBuzzer.js         (114 LOC)   Détection buzz
│   ├── useScoring.js        (174 LOC)   Calcul de points
│   ├── usePlaylist.js       (43 LOC)    Navigation playlist
│   └── useSpotifyTokenRefresh.js (145 LOC) Refresh token auto
├── modes/
│   ├── useMP3Mode.js        (85 LOC)    Upload MP3
│   ├── useSpotifyAutoMode.js (98 LOC)   Import playlist Spotify
│   ├── useSpotifyAIMode.js  (170 LOC)   Génération IA
│   └── useQuizMode.js       (231 LOC)   Mode QCM
├── components/
│   ├── MasterWizard.jsx     (786 LOC)   Wizard de configuration
│   ├── Login.jsx            (118 LOC)   Auth Firebase
│   └── master/
│       ├── PlayerControls.jsx    Lecture/pause/navigation
│       ├── BuzzAlert.jsx         Alerte buzz
│       ├── ScoreDisplay.jsx      Affichage scores
│       ├── GameSettings.jsx      Stats et fin de partie
│       ├── PlaylistSelector.jsx  Sélection playlist
│       ├── QuizControls.jsx      Interface QCM Master
│       ├── QuizLeaderboard.jsx   Classement Quiz
│       └── SpotifyConnection.jsx Connexion Spotify
├── services/
│   ├── playerAdapter.js     (125 LOC)   Abstraction MP3/Spotify
│   ├── spotifyService.js    (294 LOC)   Client Spotify API
│   └── firebase.js          (17 LOC)    Init Firebase
├── utils/
│   └── sessionCleanup.js    (133 LOC)   Nettoyage session
├── n8nService.js            (369 LOC)   Client n8n
├── airtableService.js       (50 LOC)    Fallback localStorage
└── index.css                            Styles Tailwind
```

### Schéma Firebase Realtime Database

```
sessions/{sessionId}/
├── active: boolean
├── createdBy: string (uid Firebase)
├── gameMode: string ("mp3-team" | "spotify-auto-team" | "spotify-ai-team" | "spotify-ai-quiz")
├── musicSource: string ("mp3" | "spotify-auto" | "spotify-ai")
├── playMode: string ("team" | "quiz")
├── playlistId: string (Spotify playlist ID)
├── scores: { team1: number, team2: number }
├── chrono: number (incrémenté toutes les 100ms)
├── isPlaying: boolean
├── currentTrackNumber: number
├── songDuration: number (secondes)
├── currentSong: { title, artist, imageUrl, revealed }
├── showQRCode: boolean
├── buzz/
│   ├── team: string
│   ├── playerName: string
│   └── playerFirebaseKey: string
├── buzz_times/{trackNumber}/[array]
│   ├── team, teamName, time, playerName
│   ├── songTitle, songArtist, trackNumber
│   ├── timestamp, correct, points
│   └── hasPersonalBonus, basePoints, bonusPoints
├── players_session/
│   ├── team1/{playerKey}: { name, photo, consecutiveCorrect, correctCount, buzzCount, hasCooldownPending }
│   └── team2/{playerKey}: { ... }
├── players_preferences/{playerId}: { name, age, genres[], specialPhrase, photo }
├── playerSongs/{playerId}: { uris[] }
├── lastPlaylistUpdate: { timestamp, playerName, songsAdded }
├── quiz/
│   ├── trackNumber, revealed
│   ├── answers[]: { label, text, isCorrect }
│   └── correctAnswer: string (A/B/C/D)
├── quiz_answers/{trackNumber}/{playerId}: { playerName, answer, time, timestamp, isCorrect }
├── quiz_leaderboard/{playerId}: { playerName, totalPoints, correctAnswers }
└── game_status: { ended, winner, final_scores }
```

---

## 4. Fonctionnalités existantes (implémentées et fonctionnelles)

### 4.1 Authentification et connexion
- **Firebase Auth** : inscription et connexion email/password (`Login.jsx`)
- **Spotify OAuth 2.0** : flux complet via Netlify Function (`spotify-auth.js`), scopes streaming + playlists + playback
- **Token refresh automatique** : vérification toutes les 60s, refresh 5 min avant expiration (`useSpotifyTokenRefresh.js`)
- **Persistance token** : stockage sessionStorage (access_token, refresh_token, expiry)

### 4.2 Wizard de configuration (MasterWizard.jsx)
- 6 étapes séquentielles avec progression visuelle
- Détection auto des connexions Firebase et Spotify
- Choix "Nouvelle session" ou "Continuer session précédente"
- 3 sources musicales : MP3 upload, Spotify Auto, Spotify IA
- 2 modes de jeu : Équipes (buzzer) ou Quiz (QCM) — le choix de mode n'apparaît qu'en mode Spotify IA
- Reprise automatique du wizard après callback OAuth Spotify (flag localStorage `wizardInProgress`)
- Parsing intelligent des IDs/URLs Spotify (`extractPlaylistId`)

### 4.3 Sources musicales

#### MP3 (useMP3Mode.js)
- Upload de fichiers audio (MP3/WAV/OGG/M4A)
- Extraction automatique artiste/titre depuis le nom de fichier (format "Artiste - Titre")
- Upload d'image par piste
- Détection de durée via métadonnées audio
- Lecture via HTML5 Audio (`MP3PlayerAdapter`)

#### Spotify Auto (useSpotifyAutoMode.js)
- Récupération des playlists de l'utilisateur (limite 50)
- Import one-click des pistes avec métadonnées complètes (titre, artiste, durée, image album, URI, preview URL)
- Initialisation du Spotify Web Playback SDK

#### Spotify IA (useSpotifyAIMode.js)
- Création d'une playlist Spotify vide via n8n (`createSpotifyPlaylistSimple`)
- Collecte des préférences musicales des joueurs (âge, genres, phrase spéciale)
- Génération batch via n8n : `generatePlaylistWithAllPreferences`
- Écoute temps réel des mises à jour Firebase (`lastPlaylistUpdate`)
- Rechargement automatique de la playlist quand de nouveaux morceaux sont ajoutés
- Feed des 10 dernières mises à jour (nom joueur, nb chansons, heure)
- Vérification du bonus personnel : +500 pts si le joueur a ajouté la chanson en cours

### 4.4 Lecture audio (playerAdapter.js)
- **Pattern Strategy** : abstraction commune MP3/Spotify
- `MP3PlayerAdapter` : HTML5 `<audio>` — play, pause, loadTrack, getDuration, getCurrentPosition
- `SpotifyPlayerAdapter` : Spotify Web Playback SDK — play avec reprise de position, pause avec sauvegarde position, transfert de device
- Factory `createPlayerAdapter(mode, options)` pour instanciation

### 4.5 Système de buzz (useBuzzer.js)
- Détection en temps réel via listener Firebase sur `sessions/{id}/buzz`
- Pause automatique de la musique à réception du buzz
- Son de buzzer synthétisé (Web Audio API : oscillateur sawtooth 800→400Hz, envelope de gain)
- Enregistrement de tous les buzz dans `buzz_times/{trackNumber}` (même les incorrects)
- Données enregistrées : équipe, joueur, chrono, chanson, timestamp, correct/incorrect, points

### 4.6 Scoring (useScoring.js)
- **Algorithme de décroissance à 3 phases** :
  - Phase 1 (0-5s) : 2500 points fixes
  - Phase 2 (5-15s) : décroissance rapide de 2000 à 1000 (-100 pts/sec)
  - Phase 3 (15s-fin) : décroissance proportionnelle de 1000 à 0 (atteint exactement 0 à songDuration)
  - Gestion des chansons courtes (<15s) avec décroissance adaptée
- **Bonus personnel** : +500 points si le joueur qui buzze a contribué la chanson (mode Spotify IA)
- **Cooldown** : après N bonnes réponses consécutives (configurable, défaut 2), le joueur est temporairement bloqué (durée configurable, défaut 5s)
- Tracking des stats joueur : `consecutiveCorrect`, `correctCount`, `buzzCount`

### 4.7 Mode Quiz (useQuizMode.js)
- Génération de 4 réponses (1 correcte + 3 incorrectes tirées aléatoirement de la playlist)
- Synchronisation des réponses via Firebase (`quiz`, `quiz_answers`)
- Validation au moment de la révélation par le Master
- **Scoring Quiz** : `basePoints(1000) + timeBonus(max 500, -10/s) + rankBonus(max 500, -100/rang)`
- Leaderboard temps réel par joueur (`quiz_leaderboard`)
- Reset automatique du quiz entre les pistes

### 4.8 Interface Master (Master.jsx — 1424 LOC)
- Affichage des scores des deux équipes
- Contrôles de lecture : play/pause, précédent/suivant, révélation chanson
- Alerte buzz avec photo du joueur, chrono, points disponibles, boutons correct/incorrect
- Statistiques de buzz (historique, top buzz, moyennes par équipe)
- Confirmation de fin de partie avec animation de victoire
- QR code pour les joueurs
- Sélection de playlist Spotify
- Contrôles Quiz (QCM, révélation, leaderboard)
- Configuration du cooldown (seuil et durée)
- Intégration complète des 3 sources et 2 modes via hooks

### 4.9 Interface Joueur / Buzzer (Buzzer.jsx — 1678 LOC)
- Onboarding en 8 étapes : session → nom → recherche → sélection → photo → préférences → équipe → jeu
- Validation du code session (6 caractères) contre Firebase
- Recherche de joueurs existants (localStorage via `airtableService`)
- Capture photo via webcam (`getUserMedia`)
- Saisie des préférences musicales (âge, genres, phrase spéciale) en mode Spotify IA
- Sélection d'équipe (1 ou 2) avec affichage des joueurs déjà présents
- Buzz avec son synthétisé et feedback visuel
- Affichage des scores en temps réel
- Statistiques personnelles (modal avec historique des buzz)
- Reconnexion automatique via localStorage (`buzzer_session`, `buzzer_playerName`, etc.)
- Affichage du cooldown (timer visuel)
- Mode Quiz : interface QCM avec 4 boutons de réponse

### 4.10 Écran TV (TV.jsx — 1055 LOC)
- Validation du code session
- Affichage des scores avec effet de surbrillance au buzz
- Grille des joueurs par équipe avec avatars/photos
- Chronometer avec calcul des points disponibles en temps réel
- Barre de progression avec zones colorées (vert/orange/rouge)
- Affichage du buzz gagnant avec photo du joueur
- Révélation de la chanson (titre + artiste)
- QR code pour rejoindre la session
- Écran de fin avec animation de victoire et "buzz le plus rapide"
- Indicateur visuel de cooldown par joueur

### 4.11 Gestion de session (sessionCleanup.js)
- `deactivatePreviousSession` : marque la session inactive + timestamp de fin
- `cleanupSessionData` : supprime buzz en cours, currentSong, quiz, showQRCode
- `fullSessionCleanup` : désactivation + nettoyage (option : supprimer historique)
- `cleanupLocalStorage` : nettoyage des flags temporaires
- `prepareNewSession` : enchaîne nettoyage ancien + préparation nouveau

### 4.12 Backend serverless (Netlify Functions)

#### spotify-auth.js
- Échange code OAuth contre tokens (access + refresh)
- Refresh de token via refresh_token grant
- Credentials en variables d'environnement (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)

#### n8n-proxy.js
- Proxy CORS vers les webhooks n8n
- Whitelist d'endpoints : `create-playlist-simple`, `create-playlist`, `blindtest-player-input`, `blindtest-quiz-mode`, `blindtest-batch-playlist`
- Authentification par header `X-Auth-Token`
- Gestion flexible des réponses (JSON ou texte brut)

#### save-player-preferences.js
- Validation stricte des données joueur (nom max 50 chars, âge 1-120, genres 1-10)
- Vérification de la validité de session
- Écriture via Firebase Admin SDK
- Schéma : `sessions/{id}/players_preferences/{playerId}`

### 4.13 Sécurité Firebase (database.rules.json)
- Lecture conditionnelle : session doit être `active === true`
- Écriture session : créateur uniquement (`createdBy === auth.uid`)
- Scores, isPlaying, currentSong, songDuration : créateur uniquement
- Buzz, chrono, players_session : tout utilisateur authentifié (session active)
- players_preferences : écriture interdite côté client (uniquement via Cloud Functions)
- quiz : créateur uniquement ; quiz_answers : tout utilisateur authentifié

---

## 5. Fonctionnalités partiellement implémentées

### 5.1 Service Airtable (airtableService.js)
- **État** : fallback sur localStorage. Les fonctions `findPlayer()` et `createPlayer()` existent mais stockent dans `localStorage['blindtest_players']` au lieu d'appeler l'API Airtable.
- **Impact** : les profils joueurs ne sont pas persistés entre les navigateurs/appareils.
- **Travail restant** : connecter les appels HTTP à l'API Airtable ou remplacer par Firebase.

### 5.2 Génération des réponses Quiz
- **État** : les 3 mauvaises réponses sont tirées aléatoirement parmi les autres artistes de la playlist (`filter + sort(random) + slice(0,3)`).
- **Limitations** : aucune garantie de diversité (un même artiste peut apparaître plusieurs fois), pas de réponses plausibles (même genre musical), pas de gestion du cas où la playlist a < 4 artistes différents.
- **Travail restant** : algorithme de sélection plus intelligent, gestion des edge cases.

### 5.3 Synchronisation playlist en mode IA
- **État** : le Master écoute `lastPlaylistUpdate` via Firebase listener. Quand un nouveau timestamp est détecté, il recharge la playlist depuis l'API Spotify.
- **Limitation** : dépendant du timing de l'écriture Firebase par n8n. Si n8n écrit avant que Spotify ait indexé les pistes, le rechargement peut être incomplet.
- **Travail restant** : retry avec backoff si le nombre de pistes est inférieur à l'attendu.

### 5.4 Chrono et performances Firebase
- **État** : le chrono est incrémenté toutes les 100ms côté client et écrit dans Firebase à chaque tick (10 writes/seconde).
- **Impact** : consommation Firebase élevée, potentiel de drift si l'onglet passe en arrière-plan (browser throttling), pas de synchronisation avec la position réelle de lecture audio.
- **Travail restant** : réduire la fréquence d'écriture Firebase (ex: 1 write/s), synchroniser le chrono avec la position audio réelle.

### 5.5 Gestion de la reconnexion joueur
- **État** : le Buzzer sauvegarde les données de session dans localStorage et tente une reconnexion automatique au rechargement. Côté Master, les joueurs connectés (`players_session/team1` et `team2`) sont désormais rechargés depuis Firebase lors d'une reprise de session (commit `5de2e2e`).
- **Limitation** : la reconnexion côté Buzzer peut échouer si la session a changé d'état entre-temps. Pas de gestion de la perte de connexion Firebase (offline).
- **Travail restant** : Firebase `.info/connected` listener, re-sync automatique, UI de reconnexion explicite.

---

## 6. Fonctionnalités manquantes (vision complète)

### 6.1 Robustesse & qualité
| Manque | Détail |
|--------|--------|
| Tests | Aucun test unitaire, d'intégration ou E2E. 0 fichier `*.test.*` ou `*.spec.*`. |
| TypeScript | Tout le code est en JavaScript pur malgré `@types/react` dans les devDependencies. |
| Error tracking | Aucune intégration Sentry, LogRocket ou équivalent. Uniquement `console.log/error`. |
| Rate limiting | Aucune protection sur les Netlify Functions (spam possible sur spotify-auth, n8n-proxy). |
| Debouncing buzz | Un joueur peut envoyer plusieurs buzz en rafale sans limitation côté client. |
| Dead code | `Master.old.jsx` (2285 LOC) toujours présent dans le repository. |

### 6.2 Fonctionnalités produit
| Manque | Détail |
|--------|--------|
| Undo arbitrage | L'animateur ne peut pas annuler un "correct" ou "incorrect" une fois attribué. |
| Profils joueurs persistants | Pas de base de données joueurs cross-session (Airtable non connecté). |
| Historique des parties | Pas de consultation des parties passées, stats cumulées. |
| Gestion offline | Aucun support offline ou mode dégradé. |
| Accessibilité (a11y) | Pas d'attributs ARIA, pas de navigation clavier dédiée, pas de contraste vérifié. |
| Internationalisation (i18n) | Toutes les chaînes sont en français, hardcodées dans les composants. |
| Mode spectateur interactif | L'écran TV est passif, pas de vote/réaction du public. |
| Thèmes / customisation | Pas de thème visuel personnalisable (couleurs d'équipes, logo événement). |

### 6.3 Vitrine technologique (extensions prévues)
| Extension | Détail |
|-----------|--------|
| MCP Server | Non implémenté. Potentiel pour exposer les fonctionnalités du blind test comme outils MCP. |
| LLM direct | L'IA passe par n8n. Pas d'appel direct à un LLM (Claude, GPT) depuis le code. |
| Analytics avancés | Pas de tableau de bord analytics (temps de buzz moyen, progression, heat maps). |

---

## 7. Contraintes techniques identifiées

### 7.1 Firebase Realtime Database
- **Chrono : 10 writes/seconde** par session active. Sur le plan gratuit (Spark), cela peut atteindre les quotas rapidement lors de sessions longues.
- **buzz_times utilise des arrays** (`[...existingBuzzes, newBuzz]`) au lieu de `push()` Firebase, ce qui crée des risques de race condition en écriture concurrente.
- **Listeners multiples** : Master, Buzzer et TV écoutent chacun plusieurs nœuds Firebase simultanément. Une session active peut générer >20 listeners permanents.

### 7.2 Spotify
- **OAuth token** : expire après 1h. Le refresh automatique fonctionne mais n'a pas de retry en cas d'échec.
- **Web Playback SDK** : nécessite un compte Spotify Premium pour la lecture. Le SDK n'est chargé que côté Master (pas de lecture côté joueur/TV).
- **Délai de transfert de device** : 1000ms hardcodé après initialisation du SDK avant le premier `transferPlayback`.
- **Limite playlists** : `getUserPlaylists` est limité à 50 résultats (pas de pagination).

### 7.3 n8n
- **Proxy CORS** : toutes les requêtes passent par `/.netlify/functions/n8n-proxy` (ajout de latence).
- **Pas de retry** : si un webhook n8n échoue, l'erreur est remontée sans tentative de réessai.
- **Dépendance externe** : la génération IA dépend entièrement de la disponibilité de n8n Cloud et des modèles LLM configurés dans les workflows.

### 7.4 Architecture frontend
- **Fichiers volumineux** : `Buzzer.jsx` (1678 LOC) et `Master.jsx` (1424 LOC) concentrent beaucoup de logique. Risque de maintenabilité.
- **Pas de state management global** : pas de Context React, Redux ou Zustand. L'état est distribué entre les hooks et Firebase. La coordination se fait via les props et les callbacks.
- **Routage basique** : utilisation de `window.location.pathname` et `window.history.pushState` au lieu d'un router (React Router absent des dépendances).

### 7.5 Sécurité
- **Tokens en sessionStorage** : vulnérable aux attaques XSS. Pas de HttpOnly cookie possible dans l'architecture SPA actuelle.
- **Pas de CSRF** : aucune protection CSRF sur les Netlify Functions.
- **Pas de CSP strict** : les headers de sécurité dans `.netlify.toml` sont basiques (X-Frame-Options, X-XSS-Protection).

---

## 8. Métriques de succès (proposées)

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Temps de setup | < 3 min | Du lancement à la première chanson |
| Latence buzz | < 200ms | Du tap joueur à la pause musique |
| Joueurs simultanés | 10+ | Sans dégradation perceptible |
| Uptime session | 100% | Pas de crash pendant une partie complète |
| Taux de reconnexion | > 90% | Joueurs qui reviennent après un rechargement |

---

## 9. Modes de jeu — Matrice de compatibilité

| Source musicale | Mode Équipe (buzz) | Mode Quiz (QCM) |
|-----------------|-------------------|-----------------|
| MP3 upload | Fonctionnel | Non disponible |
| Spotify Auto | Fonctionnel | Non disponible |
| Spotify IA | Fonctionnel | Fonctionnel |

> Le mode Quiz n'est proposé dans le wizard que lorsque la source est "Spotify IA".

---

## 10. Netlify Functions — Endpoints

| Fonction | Méthode | Usage |
|----------|---------|-------|
| `/.netlify/functions/spotify-auth` | POST | Échange code OAuth / refresh token |
| `/.netlify/functions/n8n-proxy/{endpoint}` | POST | Proxy vers webhooks n8n (5 endpoints whitelistés) |
| `/.netlify/functions/save-player-preferences` | POST | Sauvegarde préférences joueur via Firebase Admin |
