# User Stories — Blind Test App

> Légende statut : `[DONE]` = implémenté et fonctionnel | `[PARTIAL]` = partiellement implémenté | `[TODO]` = non implémenté

---

## Epic 1 : Session & Configuration

### US-1.1 — Créer une nouvelle session `[DONE]`
**En tant qu'** Animateur, **je veux** créer une nouvelle session de blind test, **afin de** lancer une partie avec un code unique que les joueurs pourront utiliser pour rejoindre.

**Critères d'acceptance :**
- [x] Un code session de 6 caractères est généré automatiquement
- [x] La session est créée dans Firebase avec `active: true` et `createdBy: auth.uid`
- [x] Les scores sont initialisés à `{ team1: 0, team2: 0 }`
- [x] Le `gameMode` et `musicSource` sont enregistrés dans Firebase
- [x] La session précédente (si existante) est désactivée

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Firebase

---

### US-1.2 — Reprendre une session existante `[DONE]`
**En tant qu'** Animateur, **je veux** reprendre une session précédemment créée, **afin de** continuer une partie interrompue sans perdre les scores et l'historique.

**Critères d'acceptance :**
- [x] Le wizard propose l'option "Continuer" si un `lastSessionId` existe dans localStorage
- [x] Les scores, le numéro de piste et le mode de jeu sont restaurés
- [x] La session est réactivée dans Firebase (`active: true`)

**Priorité :** P2
**Complexité :** S
**Lien technologique :** Firebase

> **Note (commit 5de2e2e) :** 4 bugs corrigés sur le flow de reprise :
> 1. `musicSource`/`gameMode` sont maintenant persistés dans Firebase dès `handleConnectionComplete` (plus seulement au lancement)
> 2. Le token Spotify expiré est rafraîchi silencieusement avant la reprise (+ message "Reconnexion Spotify en cours...")
> 3. Race condition éliminée dans le `useEffect` de chargement de Master.jsx (dépendances réduites de 7 à 3, garde `hasLoadedPlaylistRef`)
> 4. Les joueurs connectés sont rechargés depuis Firebase (`players_session/team1` et `team2`) au lieu d'être perdus

---

### US-1.3 — Parcourir le wizard de configuration `[DONE]`
**En tant qu'** Animateur, **je veux** être guidé étape par étape pour configurer ma partie, **afin de** ne rien oublier (connexion, source musicale, mode de jeu).

**Critères d'acceptance :**
- [x] Le wizard comporte 6 étapes : connections → choice → source → gamemode → loading → ready
- [x] L'étape "gamemode" n'apparaît que pour le mode Spotify IA
- [x] Les connexions Firebase et Spotify sont vérifiées avant de continuer
- [x] Le wizard se rouvre automatiquement après le callback OAuth Spotify
- [x] Un indicateur de progression est affiché

**Priorité :** P1
**Complexité :** L
**Lien technologique :** React, Firebase, Spotify

---

### US-1.4 — Se connecter avec Firebase `[DONE]`
**En tant qu'** Animateur, **je veux** me connecter avec email et mot de passe, **afin d'** accéder aux fonctions de création et gestion de session.

**Critères d'acceptance :**
- [x] Formulaire email/password avec toggle inscription/connexion
- [x] Gestion des erreurs Firebase avec messages user-friendly
- [x] L'état d'authentification est persisté pendant la session

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Firebase

---

### US-1.5 — Se connecter à Spotify `[DONE]`
**En tant qu'** Animateur, **je veux** connecter mon compte Spotify, **afin d'** accéder à mes playlists et utiliser le lecteur Spotify.

**Critères d'acceptance :**
- [x] Bouton de connexion Spotify dans le wizard
- [x] Flux OAuth 2.0 complet (redirect → callback → token)
- [x] Scopes demandés : streaming, playlist-read-private, playlist-read-collaborative, playback state/control
- [x] Token stocké en sessionStorage (access_token, refresh_token, expiry)
- [x] Redirect URI dynamique selon l'environnement

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Spotify

---

### US-1.6 — Refresh automatique du token Spotify `[DONE]`
**En tant qu'** Animateur, **je veux** que mon token Spotify soit renouvelé automatiquement, **afin de** ne pas être interrompu en pleine partie.

**Critères d'acceptance :**
- [x] Vérification de l'expiration toutes les 60 secondes
- [x] Refresh automatique 5 minutes avant l'expiration
- [x] Protection contre les refresh simultanés
- [x] En cas d'échec, les tokens sont nettoyés et un état d'erreur est affiché

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Spotify, Netlify Functions

---

### US-1.7 — Terminer une partie `[DONE]`
**En tant qu'** Animateur, **je veux** mettre fin à la partie avec une confirmation, **afin d'** afficher le résultat final et éviter les fins accidentelles.

**Critères d'acceptance :**
- [x] Modal de confirmation avant la fin
- [x] `game_status.ended = true` écrit dans Firebase
- [x] Le gagnant est déterminé (team1, team2 ou draw)
- [x] La session est désactivée (`active: false`)
- [x] L'écran TV affiche l'animation de victoire et le "buzz le plus rapide"

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Firebase

---

### US-1.8 — Nettoyer les données de session `[DONE]`
**En tant que** système, **je veux** nettoyer les données temporaires lors de la création d'une nouvelle session, **afin d'** éviter les interférences avec les données de la partie précédente.

**Critères d'acceptance :**
- [x] Le buzz en cours, currentSong, quiz et showQRCode sont supprimés
- [x] L'historique des buzz est conservé par défaut (option de suppression)
- [x] Le localStorage est nettoyé (flag wizardInProgress)
- [x] La session précédente est marquée inactive avec timestamp de fin

**Priorité :** P2
**Complexité :** S
**Lien technologique :** Firebase

---

## Epic 2 : Musique & Lecture

### US-2.1 — Charger des fichiers MP3 `[DONE]`
**En tant qu'** Animateur, **je veux** uploader des fichiers audio manuellement, **afin de** jouer un blind test avec ma propre musique sans dépendre de Spotify.

**Critères d'acceptance :**
- [x] Upload de fichiers MP3, WAV, OGG, M4A
- [x] Extraction automatique artiste/titre depuis le nom de fichier ("Artiste - Titre")
- [x] Détection de la durée via métadonnées audio
- [x] Possibilité d'ajouter une image par piste
- [x] Lecture via HTML5 Audio

**Priorité :** P1
**Complexité :** M
**Lien technologique :** React

> **`[KNOWN LIMITATION]`** La reprise de session MP3 n'est pas supportée (P3). Les fichiers uploadés sont stockés en mémoire (JavaScript `File` objects) et perdus au rechargement du navigateur. Un fix nécessiterait de persister les fichiers (Firebase Storage, IndexedDB ou URLs signées).

---

### US-2.2 — Importer une playlist Spotify `[DONE]`
**En tant qu'** Animateur, **je veux** sélectionner une de mes playlists Spotify, **afin de** jouer un blind test avec des morceaux de qualité en un clic.

**Critères d'acceptance :**
- [x] Liste des playlists de l'utilisateur affichée (jusqu'à 50)
- [x] Import des pistes avec métadonnées : titre, artiste, durée, image album, URI Spotify
- [x] Initialisation du Spotify Web Playback SDK après sélection
- [x] Le playlistId est stocké dans Firebase

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Spotify

---

### US-2.3 — Générer une playlist par IA `[DONE]`
**En tant qu'** Animateur, **je veux** qu'une playlist soit générée automatiquement à partir des goûts des joueurs, **afin de** créer une expérience personnalisée et surprenante.

**Critères d'acceptance :**
- [x] Une playlist Spotify vide est créée via n8n (`createSpotifyPlaylistSimple`)
- [x] Les préférences des joueurs (âge, genres, phrase spéciale) sont collectées
- [x] La génération batch est lancée via `generatePlaylistWithAllPreferences`
- [x] Le Master reçoit une notification Firebase quand des morceaux sont ajoutés
- [x] La playlist est rechargée automatiquement depuis l'API Spotify
- [x] Un feed des mises à jour est affiché (10 dernières)

**Priorité :** P1
**Complexité :** XL
**Lien technologique :** n8n, LLM, Spotify, Firebase

> **Note (commit 5de2e2e) :** La reprise de session en mode Spotify IA est maintenant stable (refresh token silencieux, chargement playlist via `loadPlaylistById` sans race condition).

---

### US-2.4 — Contrôler la lecture musicale `[DONE]`
**En tant qu'** Animateur, **je veux** contrôler la lecture (play, pause, précédent, suivant), **afin de** piloter le rythme de la partie.

**Critères d'acceptance :**
- [x] Boutons play/pause, précédent, suivant dans l'interface Master
- [x] L'état `isPlaying` est synchronisé en temps réel via Firebase
- [x] Le chrono démarre/s'arrête avec le play/pause
- [x] Navigation entre les pistes avec mise à jour du `currentTrackNumber`
- [x] Le chrono est remis à zéro au changement de piste

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Spotify, Firebase

---

### US-2.5 — Révéler la chanson en cours `[DONE]`
**En tant qu'** Animateur, **je veux** révéler le titre et l'artiste de la chanson en cours, **afin d'** afficher la réponse sur tous les écrans après le buzz.

**Critères d'acceptance :**
- [x] Bouton "Révéler" dans l'interface Master
- [x] Le titre et l'artiste sont écrits dans Firebase (`currentSong`)
- [x] L'écran TV et les joueurs voient la révélation en temps réel
- [x] L'image de l'album est affichée si disponible

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Firebase

---

### US-2.6 — Abstraction du lecteur audio `[DONE]`
**En tant que** développeur, **je veux** une interface commune pour MP3 et Spotify, **afin de** gérer la lecture de manière uniforme quel que soit le mode.

**Critères d'acceptance :**
- [x] `MP3PlayerAdapter` utilise HTML5 Audio
- [x] `SpotifyPlayerAdapter` utilise le Web Playback SDK avec sauvegarde de position
- [x] Factory `createPlayerAdapter(mode, options)` instancie le bon adaptateur
- [x] Interface commune : `play()`, `pause()`, `loadTrack()`, `getDuration()`, `getCurrentPosition()`

**Priorité :** P2
**Complexité :** M
**Lien technologique :** React, Spotify

---

### US-2.7 — Paginer les playlists Spotify `[TODO]`
**En tant qu'** Animateur, **je veux** voir toutes mes playlists Spotify (pas seulement les 50 premières), **afin de** pouvoir choisir n'importe quelle playlist de ma bibliothèque.

**Critères d'acceptance :**
- [ ] Pagination ou scroll infini pour charger au-delà de 50 playlists
- [ ] Indicateur de chargement lors du chargement des pages suivantes
- [ ] Le nombre total de playlists est affiché

**Priorité :** P3
**Complexité :** S
**Lien technologique :** Spotify

---

## Epic 3 : Buzz & Scoring

### US-3.1 — Buzzer en temps réel `[DONE]`
**En tant que** Joueur, **je veux** appuyer sur un bouton pour buzzer, **afin d'** indiquer que je connais la chanson avant les autres.

**Critères d'acceptance :**
- [x] Le buzz est écrit dans Firebase (`sessions/{id}/buzz`) avec team, playerName, playerFirebaseKey
- [x] Le buzz est détecté en temps réel par le Master via listener Firebase
- [x] La musique s'arrête automatiquement à la réception du buzz
- [x] Un son de buzzer est joué (Web Audio API, sawtooth 800→400Hz)
- [x] Le buzz est enregistré dans `buzz_times/{trackNumber}` avec chrono, correct/incorrect, points

**Priorité :** P1
**Complexité :** L
**Lien technologique :** Firebase

---

### US-3.2 — Arbitrer un buzz `[DONE]`
**En tant qu'** Animateur, **je veux** valider ou invalider la réponse d'un joueur après son buzz, **afin d'** attribuer les points ou permettre un nouveau buzz.

**Critères d'acceptance :**
- [x] L'alerte buzz affiche : nom du joueur, photo, équipe, chrono, points disponibles
- [x] Boutons "Correct" et "Incorrect"
- [x] "Correct" : les points sont ajoutés à l'équipe, le buzz est marqué correct
- [x] "Incorrect" : le buzz est marqué incorrect (0 points), un nouveau buzz est possible
- [x] Le buzz est effacé de Firebase après traitement (`clearBuzz`)

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Firebase

---

### US-3.3 — Calcul de points par décroissance temporelle `[DONE]`
**En tant que** système, **je veux** calculer les points selon le temps écoulé avec un algorithme à 3 phases, **afin de** récompenser les réponses rapides.

**Critères d'acceptance :**
- [x] Phase 1 (0-5s) : 2500 points fixes
- [x] Phase 2 (5-15s) : décroissance rapide de 2000 à 1000 (-100 pts/s)
- [x] Phase 3 (15s-fin) : décroissance proportionnelle de 1000 à 0 (atteint 0 à songDuration)
- [x] Gestion des chansons courtes (<15s) avec décroissance adaptée
- [x] Les points sont arrondis à l'entier le plus proche

**Priorité :** P1
**Complexité :** M
**Lien technologique :** React

---

### US-3.4 — Bonus personnel (mode IA) `[DONE]`
**En tant que** Joueur, **je veux** recevoir un bonus de points si je reconnais une chanson que j'ai contribuée, **afin d'** être récompensé pour mes goûts musicaux.

**Critères d'acceptance :**
- [x] +500 points si l'URI de la chanson est dans `playerSongs/{playerId}/uris`
- [x] Le bonus est affiché distinctement dans l'alerte buzz (basePoints + bonusPoints)
- [x] Le bonus est enregistré dans `buzz_times` (hasPersonalBonus, basePoints, bonusPoints)

**Priorité :** P2
**Complexité :** S
**Lien technologique :** Firebase, Spotify

---

### US-3.5 — Système de cooldown `[DONE]`
**En tant qu'** Animateur, **je veux** qu'un joueur trop dominant soit temporairement empêché de buzzer, **afin d'** équilibrer le jeu.

**Critères d'acceptance :**
- [x] Après N bonnes réponses consécutives (seuil configurable, défaut 2), le joueur est en cooldown
- [x] Durée configurable (défaut 5000ms)
- [x] Le cooldown est activé après la navigation vers la piste suivante
- [x] Un timer visuel est affiché côté joueur et côté TV
- [x] Le streak est remis à zéro après un cooldown ou une mauvaise réponse

**Priorité :** P2
**Complexité :** M
**Lien technologique :** Firebase

---

### US-3.6 — Statistiques de buzz `[DONE]`
**En tant qu'** Animateur, **je veux** consulter les statistiques des buzz pendant la partie, **afin de** voir les performances des équipes et des joueurs.

**Critères d'acceptance :**
- [x] Modal de statistiques accessible depuis l'interface Master
- [x] Historique complet des buzz (chrono, joueur, correct/incorrect, points)
- [x] Top buzz (le plus rapide)
- [x] Moyennes par équipe

**Priorité :** P2
**Complexité :** S
**Lien technologique :** Firebase

---

### US-3.7 — Annuler un arbitrage `[TODO]`
**En tant qu'** Animateur, **je veux** pouvoir annuler un "correct" ou "incorrect" donné par erreur, **afin de** corriger une faute d'arbitrage.

**Critères d'acceptance :**
- [ ] Bouton "Annuler" disponible après l'arbitrage pendant un délai limité
- [ ] Les points sont restitués/retirés de l'équipe concernée
- [ ] Le buzz_times est mis à jour (correct revient à null)
- [ ] Le cooldown est recalculé si nécessaire

**Priorité :** P2
**Complexité :** M
**Lien technologique :** Firebase

---

### US-3.8 — Debouncing des buzz `[TODO]`
**En tant que** système, **je veux** empêcher un joueur d'envoyer plusieurs buzz en rafale, **afin d'** éviter le spam et les erreurs de traitement.

**Critères d'acceptance :**
- [ ] Un délai minimum de 500ms entre deux buzz du même joueur
- [ ] Les buzz supplémentaires sont ignorés silencieusement
- [ ] Le feedback visuel empêche les multi-taps

**Priorité :** P2
**Complexité :** S
**Lien technologique :** Firebase, React

---

## Epic 4 : Joueurs & Équipes

### US-4.1 — Rejoindre une session `[DONE]`
**En tant que** Joueur, **je veux** rejoindre une session en saisissant un code à 6 caractères, **afin de** participer au blind test.

**Critères d'acceptance :**
- [x] Champ de saisie du code session avec validation (6 caractères)
- [x] Vérification en temps réel que la session existe et est active dans Firebase
- [x] Message d'erreur si le code est invalide ou la session inactive

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Firebase

---

### US-4.2 — Rejoindre via QR Code `[DONE]`
**En tant que** Joueur, **je veux** scanner un QR code affiché sur l'écran TV, **afin de** rejoindre la session sans saisir de code manuellement.

**Critères d'acceptance :**
- [x] Le Master peut afficher/masquer le QR code (toggle)
- [x] Le QR code encode l'URL de la page Buzzer avec le paramètre session
- [x] L'écran TV affiche le QR code quand activé par le Master
- [x] Le Buzzer pré-remplit le code session depuis l'URL

**Priorité :** P2
**Complexité :** S
**Lien technologique :** React (qrcode.react)

---

### US-4.3 — S'identifier comme joueur `[DONE]`
**En tant que** Joueur, **je veux** saisir mon nom et prendre une photo, **afin d'** être identifié dans le jeu.

**Critères d'acceptance :**
- [x] Champ de saisie du nom
- [x] Recherche de joueurs existants (localStorage)
- [x] Capture photo via webcam (getUserMedia) ou sélection d'un avatar
- [x] Le joueur est enregistré dans Firebase (`players_session/{team}/{key}`)

**Priorité :** P1
**Complexité :** M
**Lien technologique :** React, Firebase

---

### US-4.4 — Saisir ses préférences musicales `[DONE]`
**En tant que** Joueur en mode Spotify IA, **je veux** indiquer mon âge, mes genres préférés et une phrase spéciale, **afin que** l'IA génère des chansons adaptées à mes goûts.

**Critères d'acceptance :**
- [x] Champ âge (numérique)
- [x] Sélection multiple de genres musicaux
- [x] Champ texte libre "phrase spéciale"
- [x] Les préférences sont envoyées via Netlify Function (`save-player-preferences`)
- [x] Validation serveur : nom max 50 chars, âge 1-120, genres 1-10

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Firebase, Netlify Functions

---

### US-4.5 — Choisir son équipe `[DONE]`
**En tant que** Joueur, **je veux** choisir l'équipe 1 ou l'équipe 2, **afin de** participer au jeu en équipe.

**Critères d'acceptance :**
- [x] Affichage des deux équipes avec les joueurs déjà présents
- [x] Le joueur est ajouté dans Firebase sous `players_session/{team}/{key}`
- [x] Les données incluent : nom, photo, stats initialisées à 0

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Firebase

---

### US-4.6 — Reconnexion automatique `[DONE]`
**En tant que** Joueur, **je veux** être reconnecté automatiquement si je recharge la page, **afin de** ne pas perdre ma place dans le jeu.

**Critères d'acceptance :**
- [x] Les données de session sont sauvegardées dans localStorage (session, nom, équipe, clé Firebase)
- [x] Au rechargement, le Buzzer tente une reconnexion avec les données sauvegardées
- [x] Le joueur retrouve son équipe et ses stats

**Priorité :** P1
**Complexité :** M
**Lien technologique :** React, Firebase

---

### US-4.7 — Voir ses statistiques personnelles `[DONE]`
**En tant que** Joueur, **je veux** consulter mes stats pendant la partie, **afin de** suivre ma performance.

**Critères d'acceptance :**
- [x] Modal accessible depuis l'interface Buzzer
- [x] Affichage du nombre de buzz, bonnes/mauvaises réponses, points
- [x] Historique des buzz avec chrono et chanson

**Priorité :** P3
**Complexité :** S
**Lien technologique :** Firebase

---

### US-4.8 — Profils joueurs persistants `[TODO]`
**En tant que** Joueur, **je veux** retrouver mon profil (nom, photo, stats cumulées) entre les sessions, **afin de** ne pas tout re-saisir à chaque partie.

**Critères d'acceptance :**
- [ ] Base de données de joueurs persistante (Airtable ou Firebase)
- [ ] Recherche par nom avec auto-complétion
- [ ] Stats cumulées cross-sessions (parties jouées, buzz total, taux de bonnes réponses)
- [ ] Photo de profil réutilisable

**Priorité :** P2
**Complexité :** L
**Lien technologique :** Firebase (ou Airtable)

> **Note :** `airtableService.js` existe mais utilise actuellement localStorage en fallback. L'API Airtable n'est pas connectée.

---

## Epic 5 : TV & Spectateurs

### US-5.1 — Afficher les scores en temps réel `[DONE]`
**En tant que** Spectateur, **je veux** voir les scores des deux équipes en grand, **afin de** suivre l'avancement de la partie.

**Critères d'acceptance :**
- [x] Scores affichés en gros avec les noms d'équipes
- [x] Effet de surbrillance sur l'équipe qui vient de buzzer
- [x] Mise à jour en temps réel via Firebase listener

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Firebase

---

### US-5.2 — Afficher les joueurs par équipe `[DONE]`
**En tant que** Spectateur, **je veux** voir les avatars/photos des joueurs de chaque équipe, **afin d'** identifier les participants.

**Critères d'acceptance :**
- [x] Grille responsive des joueurs par équipe
- [x] Photo ou avatar par joueur
- [x] Indicateur visuel de cooldown par joueur
- [x] Mise à jour dynamique quand un joueur rejoint

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Firebase

---

### US-5.3 — Afficher le chrono et les points disponibles `[DONE]`
**En tant que** Spectateur, **je veux** voir le temps écoulé et les points encore disponibles, **afin de** suivre la tension du jeu.

**Critères d'acceptance :**
- [x] Chronomètre affiché en temps réel
- [x] Points disponibles calculés selon l'algorithme à 3 phases
- [x] Barre de progression avec zones colorées (vert 0-5s, orange 5-15s, rouge 15s+)

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Firebase, React

---

### US-5.4 — Afficher le buzz gagnant `[DONE]`
**En tant que** Spectateur, **je veux** voir qui a buzzé avec sa photo et son équipe, **afin de** vivre le moment de suspense.

**Critères d'acceptance :**
- [x] Affichage du nom du joueur, sa photo et son équipe
- [x] Animation d'apparition
- [x] Disparition après traitement du buzz par le Master

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Firebase

---

### US-5.5 — Afficher la révélation de la chanson `[DONE]`
**En tant que** Spectateur, **je veux** voir le titre et l'artiste de la chanson révélée, **afin de** connaître la bonne réponse.

**Critères d'acceptance :**
- [x] Affichage du titre et de l'artiste après révélation par le Master
- [x] Image de l'album si disponible
- [x] Animation de transition

**Priorité :** P1
**Complexité :** XS
**Lien technologique :** Firebase

---

### US-5.6 — Écran de fin de partie `[DONE]`
**En tant que** Spectateur, **je veux** voir un écran de victoire avec le gagnant et des stats, **afin de** célébrer la fin du jeu.

**Critères d'acceptance :**
- [x] Animation de victoire avec le nom de l'équipe gagnante
- [x] Scores finaux affichés
- [x] "Buzz le plus rapide" affiché (joueur + temps)
- [x] Gestion du cas d'égalité

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Firebase, React

---

### US-5.7 — Mode spectateur interactif `[TODO]`
**En tant que** Spectateur, **je veux** pouvoir voter ou réagir depuis l'écran TV, **afin de** participer à l'ambiance du jeu.

**Critères d'acceptance :**
- [ ] Boutons de réaction (emoji, applaudissements)
- [ ] Sondage rapide affiché sur l'écran
- [ ] Compteur de réactions en temps réel

**Priorité :** P3
**Complexité :** L
**Lien technologique :** Firebase

---

## Epic 6 : Mode Quiz

### US-6.1 — Générer un QCM pour chaque piste `[DONE]`
**En tant qu'** Animateur en mode Quiz, **je veux** qu'un QCM à 4 choix soit généré automatiquement, **afin de** proposer un mode de jeu individuel.

**Critères d'acceptance :**
- [x] 4 réponses générées : 1 correcte + 3 incorrectes tirées de la playlist
- [x] Les réponses sont mélangées aléatoirement (A, B, C, D)
- [x] Les réponses sont synchronisées avec Firebase (`sessions/{id}/quiz`)
- [x] Le QCM est réinitialisé à chaque changement de piste

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Firebase

---

### US-6.2 — Répondre au QCM `[DONE]`
**En tant que** Joueur en mode Quiz, **je veux** sélectionner une réponse parmi les 4 proposées, **afin de** marquer des points.

**Critères d'acceptance :**
- [x] 4 boutons de réponse (A, B, C, D) affichés sur le mobile
- [x] La réponse est envoyée à Firebase avec le temps de réponse
- [x] Le joueur ne peut répondre qu'une seule fois par piste
- [x] Feedback visuel après soumission

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Firebase

---

### US-6.3 — Révéler la bonne réponse et scorer `[DONE]`
**En tant qu'** Animateur, **je veux** révéler la bonne réponse et voir les scores se mettre à jour, **afin de** poursuivre le quiz.

**Critères d'acceptance :**
- [x] Bouton "Révéler" qui marque le quiz comme `revealed: true`
- [x] Les réponses des joueurs sont validées (isCorrect calculé)
- [x] Scoring : basePoints(1000) + timeBonus(max 500) + rankBonus(max 500)
- [x] Affichage du nombre de joueurs ayant répondu avant la révélation

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Firebase

---

### US-6.4 — Leaderboard Quiz temps réel `[DONE]`
**En tant que** Joueur/Animateur, **je veux** voir un classement en temps réel des joueurs du quiz, **afin de** suivre la compétition.

**Critères d'acceptance :**
- [x] Classement trié par totalPoints décroissant
- [x] Affichage du nombre de bonnes réponses par joueur
- [x] Mise à jour en temps réel via Firebase (`quiz_leaderboard`)
- [x] Cumul des points sur l'ensemble des pistes

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Firebase

---

### US-6.5 — Améliorer la génération des mauvaises réponses `[TODO]`
**En tant que** système, **je veux** générer des mauvaises réponses plausibles et diversifiées, **afin d'** augmenter la difficulté et l'intérêt du quiz.

**Critères d'acceptance :**
- [ ] Les mauvaises réponses sont choisies parmi des artistes du même genre
- [ ] Pas de doublons dans les réponses (même artiste)
- [ ] Gestion du cas où la playlist a < 4 artistes différents
- [ ] Option : utiliser un LLM pour générer des réponses plausibles

**Priorité :** P2
**Complexité :** M
**Lien technologique :** LLM, React

---

## Epic 7 : Admin & Robustesse

### US-7.1 — Sécuriser les accès Firebase `[DONE]`
**En tant que** développeur, **je veux** que les règles de sécurité Firebase protègent les données, **afin d'** empêcher les accès non autorisés.

**Critères d'acceptance :**
- [x] Lecture conditionnelle : session active uniquement
- [x] Écriture scores/isPlaying/currentSong : créateur de session uniquement
- [x] Écriture buzz/chrono/players_session : tout utilisateur authentifié (session active)
- [x] players_preferences : écriture interdite côté client (uniquement via Cloud Functions)

**Priorité :** P1
**Complexité :** M
**Lien technologique :** Firebase

---

### US-7.2 — Proxy sécurisé pour n8n `[DONE]`
**En tant que** développeur, **je veux** un proxy Netlify avec whitelist d'endpoints, **afin de** sécuriser les appels vers n8n.

**Critères d'acceptance :**
- [x] 5 endpoints whitelistés : create-playlist-simple, create-playlist, blindtest-player-input, blindtest-quiz-mode, blindtest-batch-playlist
- [x] Authentification par header X-Auth-Token
- [x] Headers CORS configurés
- [x] Gestion OPTIONS preflight

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Netlify Functions, n8n

---

### US-7.3 — Valider les préférences joueur côté serveur `[DONE]`
**En tant que** développeur, **je veux** valider les données des joueurs côté serveur, **afin d'** empêcher les données corrompues.

**Critères d'acceptance :**
- [x] Validation du nom (string, max 50 chars)
- [x] Validation de l'âge (number, 1-120)
- [x] Validation des genres (array, 1-10 éléments)
- [x] Vérification que la session est active
- [x] Écriture via Firebase Admin SDK

**Priorité :** P1
**Complexité :** S
**Lien technologique :** Netlify Functions, Firebase

---

### US-7.4 — Ajouter des tests automatisés `[TODO]`
**En tant que** développeur, **je veux** des tests unitaires et d'intégration, **afin de** détecter les régressions.

**Critères d'acceptance :**
- [ ] Tests unitaires pour `calculatePoints()` (toutes les phases, edge cases)
- [ ] Tests unitaires pour `useQuizMode` (génération réponses, scoring)
- [ ] Tests d'intégration pour le flux wizard
- [ ] Tests E2E pour le flux complet (créer session → buzzer → scorer)
- [ ] CI configurée (GitHub Actions ou Netlify build)

**Priorité :** P2
**Complexité :** XL
**Lien technologique :** React (Vitest, Playwright)

---

### US-7.5 — Migrer vers TypeScript `[TODO]`
**En tant que** développeur, **je veux** migrer le code en TypeScript, **afin d'** améliorer la maintenabilité et la détection d'erreurs.

**Critères d'acceptance :**
- [ ] Tous les fichiers `.js`/`.jsx` convertis en `.ts`/`.tsx`
- [ ] Types définis pour les structures Firebase (Session, Player, BuzzData, etc.)
- [ ] Types pour les props de tous les composants
- [ ] Configuration `tsconfig.json` stricte
- [ ] 0 erreur TypeScript au build

**Priorité :** P3
**Complexité :** XL
**Lien technologique :** React

---

### US-7.6 — Ajouter du rate limiting `[TODO]`
**En tant que** développeur, **je veux** limiter le nombre de requêtes par IP sur les Netlify Functions, **afin d'** empêcher les abus.

**Critères d'acceptance :**
- [ ] Rate limit sur `spotify-auth` (max 10 req/min/IP)
- [ ] Rate limit sur `n8n-proxy` (max 5 req/min/IP)
- [ ] Rate limit sur `save-player-preferences` (max 20 req/min/IP)
- [ ] Réponse HTTP 429 avec header Retry-After

**Priorité :** P2
**Complexité :** M
**Lien technologique :** Netlify Functions

---

### US-7.7 — Intégrer un service de monitoring `[TODO]`
**En tant que** développeur, **je veux** tracer les erreurs en production, **afin de** détecter et corriger les bugs rapidement.

**Critères d'acceptance :**
- [ ] Intégration Sentry (ou équivalent) dans le frontend
- [ ] Capture automatique des erreurs non catchées
- [ ] Contexte utilisateur (sessionId, page, gameMode) dans les reports
- [ ] Alertes configurées pour les erreurs critiques

**Priorité :** P2
**Complexité :** M
**Lien technologique :** React

---

### US-7.8 — Réduire la fréquence d'écriture du chrono `[TODO]`
**En tant que** développeur, **je veux** réduire les écritures Firebase du chrono de 10/s à 1/s, **afin de** diminuer les coûts et la charge.

**Critères d'acceptance :**
- [ ] Le chrono local est mis à jour toutes les 100ms (affichage fluide)
- [ ] L'écriture Firebase ne se fait qu'une fois par seconde
- [ ] Le chrono est synchronisé avec la position réelle de lecture audio
- [ ] Le chrono ne dépasse jamais `songDuration`
- [ ] Le chrono gère correctement le throttling navigateur (onglet arrière-plan)

**Priorité :** P2
**Complexité :** M
**Lien technologique :** Firebase

---

### US-7.9 — Supprimer le dead code `[TODO]`
**En tant que** développeur, **je veux** supprimer `Master.old.jsx` et le code inutilisé, **afin de** garder le repository propre.

**Critères d'acceptance :**
- [ ] `Master.old.jsx` (2285 LOC) supprimé
- [ ] Vérification qu'aucun import ne le référence
- [ ] Revue des imports inutilisés dans les autres fichiers

**Priorité :** P3
**Complexité :** XS
**Lien technologique :** React

---

### US-7.10 — Gérer la perte de connexion `[TODO]`
**En tant que** Joueur, **je veux** être averti si ma connexion est perdue et retrouver ma session automatiquement, **afin de** ne pas être exclu du jeu.

**Critères d'acceptance :**
- [ ] Listener Firebase `.info/connected` pour détecter la perte de connexion
- [ ] Bannière visuelle "Connexion perdue" avec tentative de reconnexion
- [ ] Re-sync automatique de l'état (scores, buzz, équipe) à la reconnexion
- [ ] Timeout configurable avant déconnexion définitive

**Priorité :** P2
**Complexité :** L
**Lien technologique :** Firebase

---

## Epic 8 : Vitrine Tech

### US-8.1 — Intégration n8n pour l'automatisation `[DONE]`
**En tant que** visiteur de la vitrine, **je veux** voir comment n8n orchestre la génération de playlists, **afin de** comprendre les capacités d'automatisation.

**Critères d'acceptance :**
- [x] Workflows n8n documentés dans `n8n-workflows/`
- [x] 5 endpoints exposés via proxy Netlify
- [x] Génération batch de playlists à partir des préférences de tous les joueurs
- [x] Feed temps réel des mises à jour de playlist

**Priorité :** P1
**Complexité :** L
**Lien technologique :** n8n, LLM

---

### US-8.2 — Intégration Firebase temps réel `[DONE]`
**En tant que** visiteur de la vitrine, **je veux** voir la synchronisation temps réel entre Master, Buzzer et TV, **afin de** comprendre les capacités de Firebase.

**Critères d'acceptance :**
- [x] Scores synchronisés en temps réel sur 3 interfaces
- [x] Buzz détecté et affiché en <500ms
- [x] Joueurs apparaissent sur tous les écrans à l'inscription
- [x] QR code toggle piloté depuis le Master

**Priorité :** P1
**Complexité :** L
**Lien technologique :** Firebase

---

### US-8.3 — Intégration Spotify Web Playback SDK `[DONE]`
**En tant que** visiteur de la vitrine, **je veux** voir le contrôle natif de Spotify depuis l'application, **afin de** comprendre l'intégration de l'API Spotify.

**Critères d'acceptance :**
- [x] Lecture/pause contrôlées depuis l'interface Master
- [x] Métadonnées des pistes récupérées via l'API
- [x] Transfert de device automatique
- [x] Gestion du token et du refresh

**Priorité :** P1
**Complexité :** L
**Lien technologique :** Spotify

---

### US-8.4 — Exposer les fonctionnalités via MCP Server `[TODO]`
**En tant que** visiteur de la vitrine, **je veux** interagir avec le blind test via un MCP Server, **afin de** voir l'intégration avec des agents IA.

**Critères d'acceptance :**
- [ ] MCP Server exposant des tools : create_session, add_player, buzz, get_scores
- [ ] Connexion depuis un client MCP (ex: Claude Code)
- [ ] Documentation des tools disponibles
- [ ] Démonstration d'un agent jouant au blind test

**Priorité :** P2
**Complexité :** XL
**Lien technologique :** MCP

---

### US-8.5 — Appel direct à un LLM `[TODO]`
**En tant que** visiteur de la vitrine, **je veux** voir un LLM utilisé directement (pas via n8n), **afin de** démontrer l'intégration API d'un modèle de langage.

**Critères d'acceptance :**
- [ ] Appel API direct à Claude ou GPT pour la génération de réponses quiz
- [ ] Génération de mauvaises réponses plausibles basées sur le contexte musical
- [ ] Génération d'indices pour aider les joueurs
- [ ] Streaming de la réponse pour un rendu progressif

**Priorité :** P3
**Complexité :** L
**Lien technologique :** LLM

---

### US-8.6 — Accessibilité (a11y) `[TODO]`
**En tant que** visiteur de la vitrine, **je veux** que l'application soit accessible, **afin de** démontrer les bonnes pratiques front-end.

**Critères d'acceptance :**
- [ ] Attributs ARIA sur tous les éléments interactifs
- [ ] Navigation clavier complète (focus management, tab order)
- [ ] Contraste WCAG AA vérifié
- [ ] Lecteur d'écran compatible
- [ ] Taille des cibles tactiles >= 44px

**Priorité :** P3
**Complexité :** L
**Lien technologique :** React

---

### US-8.7 — Internationalisation (i18n) `[TODO]`
**En tant qu'** Animateur, **je veux** choisir la langue de l'interface, **afin d'** utiliser l'application avec des joueurs internationaux.

**Critères d'acceptance :**
- [ ] Extraction de toutes les chaînes dans des fichiers de traduction
- [ ] Support français et anglais minimum
- [ ] Sélecteur de langue dans le wizard
- [ ] Persistance du choix de langue

**Priorité :** P3
**Complexité :** L
**Lien technologique :** React (react-i18next)

---

### US-8.8 — Historique des parties `[TODO]`
**En tant qu'** Animateur, **je veux** consulter l'historique des parties passées, **afin de** revoir les résultats et stats cumulées.

**Critères d'acceptance :**
- [ ] Liste des sessions terminées avec date, scores, mode de jeu
- [ ] Détail d'une session avec tous les buzz_times
- [ ] Export des résultats (CSV ou PDF)
- [ ] Graphiques de performance (optionnel)

**Priorité :** P3
**Complexité :** L
**Lien technologique :** Firebase

---

## Résumé par statut

| Statut | Count |
|--------|-------|
| `[DONE]` | 31 |
| `[PARTIAL]` (couvert dans le PRD §5) | 5 |
| `[TODO]` | 14 |
| **Total** | 45+ |

## Résumé par priorité

| Priorité | DONE | TODO |
|----------|------|------|
| P1 | 26 | 0 |
| P2 | 5 | 8 |
| P3 | 0 | 6 |
