# Documentation des Workflows n8n (Mode Quiz)

Ce document détaille l'architecture et le fonctionnement des workflows n8n utilisés pour le **Mode Quiz** de l'application BlindTest.

En mode Quiz, l'application utilise une architecture en **deux étapes distinctes** :
1.  **Génération de la Playlist** (Workflow Batch) : Crée une liste de chansons basée sur les préférences des joueurs.
2.  **Génération des Mauvaises Réponses** (Workflow Wrong Answers) : Analyse les chansons générées et crée 3 mauvaises réponses crédibles pour chacune (QCM).

Cette séparation permet d'optimiser les performances et d'éviter les timeouts, chaque étape étant gérée indépendamment.

---

## 1. Workflow : Génération de Playlist (Batch)

**Fichier :** `n8n-workflows/generate-playlist-batch-ai-v3.json`
**Webhook :** `POST /blindtest-batch-playlist`

Ce workflow est responsable de la création de la playlist Spotify partagée.

### Étapes du processus :

1.  **Webhook & Parsing** :
    *   Reçoit un payload contenant `playlistId` et un tableau de `players` (avec préférences : âge, genres, phrase spéciale).
    *   Le nœud "Parse JSON Body" valide les données entrantes.

2.  **Formatage pour l'IA** :
    *   Le nœud "Format Batch Data" construit un prompt unique incluant les profils de tous les joueurs.
    *   Il demande à l'IA de sélectionner 50 chansons équilibrées pour plaire à tout le groupe.

3.  **Génération IA (Agent OpenAI)** :
    *   Utilise `gpt-3.5-turbo`.
    *   Retourne un tableau JSON de 50 objets `{ "artist": "...", "song": "..." }`.

4.  **Recherche Spotify (Parallélisée)** :
    *   Le nœud "Parse Song List" sépare le tableau en items individuels.
    *   Le nœud "Search Song on Spotify" effectue une recherche pour chaque chanson afin de récupérer son URI Spotify (`spotify:track:...`).

5.  **Agrégation & Écriture** :
    *   Le nœud "Extract Track URIs" rassemble tous les URIs trouvés.
    *   **Action Critique** : Le nœud "🔥 Write to Firebase" écrit directement dans la base de données Realtime Database.
        *   **Chemin :** `playlists/{playlistId}`
        *   **Données :** `status: "playlist_ready"`, `tracks: [...]`
    *   C'est cette écriture qui débloque l'interface utilisateur (StepReadyToStart).

6.  **Réponse API** :
    *   Renvoie un succès immédiat au client (n8nService), bien que l'écriture Firebase soit la véritable notification de fin.

---

## 2. Workflow : Génération des Mauvaises Réponses

**Fichier :** `n8n-workflows/generate-wrong-answers-v1.0.json`
**Webhook :** `POST /blindtest-wrong-answers`

Une fois la playlist prête, l'application Frontend découpe la liste des chansons en "batches" (paquets de 10) et appelle ce workflow pour chaque paquet.

### Étapes du processus :

1.  **Webhook & Parsing** :
    *   Reçoit un tableau de `songs` (titre, artiste, uri).

2.  **Traitement Parallèle (Split)** :
    *   Le nœud "Split Songs" divise le tableau pour traiter chaque chanson individuellement.

3.  **Génération IA (Par Chanson)** :
    *   Pour chaque chanson, le nœud "Format Wrong Answers Prompt" crée un prompt demandant 3 chansons du même genre/époque mais différentes.
    *   L'Agent IA (`gpt-3.5-turbo`) génère ces 3 faux titres.

4.  **Parsing & Fallback** :
    *   Le nœud "Parse Wrong Answers" vérifie que l'IA a bien renvoyé un tableau de 3 éléments.
    *   En cas d'erreur ou de format invalide, des "Fallbacks" génériques sont utilisés pour garantir que le jeu ne plante pas.

5.  **Agrégation** :
    *   Le nœud "Aggregate Wrong Answers" rassemble tous les résultats (bonnes réponses + 3 mauvaises) dans un objet map indexé par l'index de la chanson.

6.  **Réponse API** :
    *   Renvoie l'objet complet `wrongAnswers` au Frontend.
    *   Le Frontend (via `quizMode.storeQuizData`) se charge ensuite de stocker ces données dans Firebase (`sessions/{sessionId}/quiz_data`).

---

## Résumé des Flux de Données

| Étape | Source | Destination | Méthode | Trigger |
| :--- | :--- | :--- | :--- | :--- |
| **1. Playlist** | Frontend | n8n (Batch Workflow) | HTTP POST | Utilisateur clique sur "Générer" |
| **2. Notification** | n8n | Firebase (`playlists/{id}`) | HTTP PATCH | Fin de la recherche Spotify |
| **3. Détection** | Firebase | Frontend (`StepReadyToStart`) | WebSocket (`onValue`) | Changement de status `playlist_ready` |
| **4. Questions** | Frontend | n8n (Wrong Answers) | HTTP POST | Playlist détectée comme prête |
| **5. Stockage** | n8n | Frontend (Réponse) | HTTP Response | Fin de génération IA |
| **6. Persistance** | Frontend | Firebase (`sessions/{id}/quiz_data`) | SDK Firebase | Réception des questions |

Ce découpage assure que :
1.  L'utilisateur voit rapidement que la playlist est en cours de création.
2.  La génération des questions (plus lente) se fait en arrière-plan ou par petits paquets pour éviter les timeouts HTTP.
