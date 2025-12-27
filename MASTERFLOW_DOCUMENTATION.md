# Documentation du fonctionnement de Masterflow

## Vue d'ensemble

**Masterflow** est le système d'orchestration de l'interface "Maître du Jeu" (Host). Il gère le cycle de vie complet d'une session de jeu, de la configuration initiale jusqu'à la fin de la partie.

L'architecture repose sur une machine à états (State Machine) implémentée dans `MasterFlowContainer.jsx`, qui guide l'utilisateur à travers différentes étapes de configuration avant de lancer la logique de jeu proprement dite.

## Architecture Technique

Le flux est géré principalement par les composants suivants :

1.  **`MasterFlowContainer.jsx`** : Le chef d'orchestre. Il maintient l'état global de la session (`sessionData`) et l'état courant du flux (`flowState`).
2.  **Steps (Étapes)** : Composants dédiés à chaque phase de configuration (`StepModeSelection`, `StepPlayerConnection`, `StepReadyToStart`).
3.  **`ActiveGameContainer.jsx`** : Wrapper qui charge le jeu une fois configuré.
4.  **`Master.jsx`** : Le composant historique contenant la logique de jeu (lecture audio, scores, buzzers).

## États du Flux (Flow States)

La machine à états définit les étapes suivantes :

### 1. `LOADING`
*   **Description** : État initial.
*   **Actions** :
    *   Vérifie l'authentification Firebase.
    *   Vérifie si une partie est déjà en cours (récupération via `localStorage` et validation dans Firebase).
    *   Gère le retour de l'authentification OAuth Spotify.

### 2. `MODE_SELECTION` (Étape 1)
*   **Composant** : `StepModeSelection.jsx`
*   **Fonctionnalité** : Permet au Maître du Jeu de choisir le mode de jeu.
*   **Options** :
    *   **Mode Équipe** : Affrontement classique entre deux équipes.
    *   **Mode Quiz** : QCM individuel.
    *   **Reprendre la partie** : Apparaît si une partie active a été détectée lors du chargement.

### 3. `PLAYER_CONNECTION` (Étape 2)
*   **Composant** : `StepPlayerConnection.jsx`
*   **Fonctionnalité** :
    *   Affiche le QR Code pour que les joueurs rejoignent la session.
    *   Permet de configurer la **source musicale**.
*   **Sources Musicales** :
    *   **MP3 Local** : Upload de fichiers MP3.
    *   **Spotify Playlist** : Sélection d'une playlist existante.
    *   **Spotify AI** : Génération de playlist basée sur les préférences des joueurs connectés (via n8n).

### 4. `READY` (Étape 3)
*   **Composant** : `StepReadyToStart.jsx`
*   **Fonctionnalité** :
    *   Récapitulatif de la configuration (joueurs, mode, musique).
    *   **Génération Automatique** : Lance la génération de la playlist (via n8n/Spotify) et des questions (si Mode Quiz).
    *   Attend que tout soit prêt (Playlist chargée + Questions générées) pour activer le démarrage.
    *   Transitionne automatiquement vers le jeu une fois prêt.

### 5. `GAME_PLAYING`
*   **Composant** : `ActiveGameContainer.jsx` (qui rend `Master.jsx`)
*   **Fonctionnalité** : La partie est active.
*   **Gestion** :
    *   Le `MasterFlowContainer` passe toutes les données de session (`sessionData`, `playlist`, `musicSource`) à `ActiveGameContainer`.
    *   `ActiveGameContainer` initialise `Master.jsx` avec ces props, évitant ainsi à `Master.jsx` de devoir recharger ces données depuis Firebase (optimisation "Nouveau Flux").

## Intégrations Externes

### Firebase Realtime Database
*   Synchronisation en temps réel de l'état de la session (`sessions/{sessionId}`).
*   Gestion des joueurs, des scores, et de l'état "buzzer".

### n8n (Backend Automation)
*   **Génération de Playlist** : En mode "Spotify AI", n8n reçoit les préférences des joueurs et crée une playlist Spotify sur mesure.
*   **Génération de Quiz** : En mode "Quiz", n8n analyse les titres de la playlist et génère des mauvaises réponses crédibles pour le QCM.

### Spotify API
*   Utilisé pour la recherche de playlists, la lecture audio (via Web Playback SDK), et la gestion des tokens OAuth.

## Données de Session (`sessionData`)

L'objet `sessionData` circule entre les étapes et contient :
*   `sessionId`: Identifiant unique de la session.
*   `playMode`: 'team' ou 'quiz'.
*   `musicSource`: 'mp3', 'spotify-auto', ou 'spotify-ai'.
*   `players`: Liste des joueurs.
*   `playlist`: Tableau des pistes audio.
*   `playlistId`: ID Spotify (si applicable).
*   `spotifyToken`: Token d'accès.

---
*Ce document décrit l'architecture actuelle basée sur le refactoring "MasterFlow".*
