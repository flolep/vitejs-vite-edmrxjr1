# Prompts Claude Code — Rendu TV & Boucle de jeu autonome

**Document de référence :** `CONCEPTION_TV_ET_BOUCLE_JEU.md` (à committer dans le repo avant de lancer les agents)

## Ordre d'exécution

```
Agent A  ─┐ (parallèle)
Agent B4 ─┘

Agent B1 ──► Agent B2 ──► Agent B3   (séquentiel, mêmes fichiers)
```

**A** et **B4** sont indépendants et peuvent tourner en parallèle avec le reste.
**B1 → B2 → B3** touchent `Master.jsx` et `TV.jsx` : chaque agent doit partir de la branche précédente **mergée**.

---

# AGENT A — Scaling TV

**Branche :** `fix/tv-scaling`

````
Tu travailles sur Blindtest, une app React/Vite de blind test musical multijoueur.
Trois interfaces : Master (animateur), Buzzer (mobile joueur), TV (écran spectateur).
Lis d'abord `CONCEPTION_TV_ET_BOUCLE_JEU.md`, chantier A. Il fait référence.

## Contexte
L'écran TV s'affiche trop petit sur un Samsung The Frame 2023 (Tizen 7.0), via le
navigateur web intégré. Viewport applicatif 1920x1080, devicePixelRatio = 1.
Ce n'est PAS un problème de résolution : le layout a été conçu comme un dashboard
vu à 50 cm, alors qu'il est regardé à 3 mètres. Problème de design 10-foot.

## Tâches

1. Dans `index.css`, ajouter :
   - `html.tv-mode { font-size: 26px; }` en fallback
   - un bloc `@supports (font-size: clamp(1px, 1vw, 2px))` qui surcharge avec
     `clamp(24px, 1.35vw, 42px)`
   - `html.tv-mode body` : padding `2.5vh 2.5vw`, `box-sizing: border-box`,
     `overflow: hidden`

2. Dans `TV.jsx`, ajouter un useEffect qui pose la classe `tv-mode` sur
   `document.documentElement` au montage et la retire au démontage.

3. Convertir tous les px fixes en rem dans `TV.jsx` et `components/tv/QuizDisplay.jsx` :
   - grille principale `'1fr 380px'` -> `'1fr 22rem'`
   - nom joueur `maxWidth: '90px'` -> `5rem`
   - leaderboard `maxHeight: '180px'` -> `10rem`
   - écran de fin : `1200px` -> `70rem`, `800px` -> `46rem`
   - QuizDisplay réponses : `1000px` -> `56rem`
   - pastilles/barres : `8px` -> `0.5rem`, `16px` -> `1rem`, `4px` -> `0.25rem`
   - QRCodeSVG `size={300}` -> `size={420}`
   Fais un grep exhaustif : toute valeur en px restante qui participe à la mise en
   page doit être convertie. Les bordures de 1-2px peuvent rester.

4. Hauteur : le navigateur Samsung garde sa barre d'URL, hauteur utile ~980px.
   - wrapper principal : `minHeight: 100vh` -> `height: 100vh` + `overflow: hidden`
   - panneaux listes : `overflow-y: auto`
   - leaderboard : réduire de 5 à 4 entrées affichées
   - N'UTILISE PAS `dvh`, non supporté par ce moteur.

5. Alléger les animations (GPU faible sur cette TV) :
   - remplacer les `box-shadow` animés par des `opacity`/`transform`
   - supprimer les `animation: ... infinite` sur les éléments non critiques
     (garder le pulse du buzz gagnant, retirer le reste)

## Contraintes
- Ne touche QUE la route TV. Master et Buzzer ne doivent pas être affectés :
  la classe `tv-mode` est scopée, vérifie qu'aucune règle ne fuit.
- Moteur Chromium ancien : pas de `dvh`, pas de `:has()`, pas de container queries.
- Ne refactore pas les styles inline vers Tailwind. Conversion de valeurs uniquement.

## Livrable
Commits atomiques, un par tâche. Ouvre une PR vers `develop` avec un résumé
listant les fichiers touchés et les conversions faites.
Précise dans la PR que la validation se fait sur deploy preview Netlify affiché
sur la vraie TV — pas en local.
````

---

# AGENT B1 — Machine à états + correctif des points

**Branche :** `feat/quiz-phase-state`
**Prérequis :** aucun

````
Tu travailles sur Blindtest, une app React/Vite + Firebase Realtime Database de
blind test musical. Master (animateur, porte le SDK Spotify), Buzzer (mobile),
TV (spectateur). Firebase est le bus de synchronisation entre les trois.
Lis d'abord `CONCEPTION_TV_ET_BOUCLE_JEU.md`, sections B.2, B.4 et B.9. Il fait référence.

## Bug à corriger
À la dernière question du quiz, on bascule directement sur l'écran des résultats
sans que les points de cette dernière question soient comptés.

Deux causes possibles, non départagées :
(a) `endGame()` dans `Master.jsx` lit le state React `scores` au lieu de Firebase.
    Si l'attribution des points n'est pas encore propagée, `final_scores` est figé
    sur l'avant-dernier score. Race condition de closure.
(b) La séquence saute la révélation : à la dernière piste `canNavigateNext()`
    retourne false et la bascule vers la fin se produit sans que `quiz.revealed`
    passe à true, donc les points ne sont jamais calculés.

Commence par LOCALISER le code qui déclenche la fin automatique à la dernière
piste. Je ne l'ai pas trouvé. Documente ce que tu trouves dans la PR.

## Tâches

1. Introduire `sessions/{id}/game_status.phase` avec 4 valeurs :
   'playing' | 'revealed' | 'last_reveal' | 'ended'
   Transitions : playing -> revealed -> (question suivante -> playing)
                 dernière question : playing -> revealed -> last_reveal -> ended

2. EXPAND/CONTRACT sur `game_status.ended` :
   - continue d'écrire `ended: true` EN PARALLÈLE de `phase: 'ended'`
   - migre les lecteurs connus vers `phase` : listener de `TV.jsx`,
     `MasterFlowContainer.handleEndGame`
   - fais un grep exhaustif des lecteurs de `ended` et liste-les dans la PR
   - NE SUPPRIME PAS le champ `ended`. Le contract est hors périmètre.

3. Corriger `endGame()` dans `Master.jsx` : relire systématiquement les scores
   depuis Firebase avec `get()`, jamais depuis le state React.
   ```js
   const snap = await get(ref(database, `sessions/${sessionId}/scores`));
   const finalScores = snap.val() || { team1: 0, team2: 0 };
   ```
   Idem pour `quiz_leaderboard`. C'est le correctif de fond.

4. Dernière question : le Master écrit `phase: 'last_reveal'` après révélation
   et attribution des points, PAS `ended: true`.

5. `TV.jsx` : ne bascule sur l'écran de victoire que sur `phase === 'ended'`.
   En `last_reveal`, reste sur le résultat de la question avec un bandeau
   « Dernière question — classement final en attente ».

## Contraintes
- Règle absolue : aucune donnée de fin de partie ne doit être lue depuis un state
  React. Toujours Firebase.
- Ne casse pas le mode équipe : `phase` doit fonctionner pour les deux playModes.
- Aucune modification de `database.rules.json` dans cette PR (B2 s'en charge).

## Livrable
PR vers `develop`. Dans le résumé : où était le déclencheur de fin automatique,
quelle cause (a) ou (b) était réellement en jeu, et la liste complète des lecteurs
de `game_status.ended` trouvés par grep.
Test manuel à décrire : lancer une partie quiz de 2 pistes, vérifier que les points
de la piste 2 sont bien dans `final_scores`.
````

---

# AGENT B2 — Déclenchement de l'écran final par le vainqueur

**Branche :** `feat/final-reveal-by-winner`
**Prérequis :** B1 mergée

````
Tu travailles sur Blindtest (React/Vite + Firebase RTDB). Master = device audio,
Buzzer = mobile joueur, TV = écran spectateur.
Lis `CONCEPTION_TV_ET_BOUCLE_JEU.md`, sections B.3, B.5 et B.8. Il fait référence.
La machine à états `game_status.phase` a été introduite par la PR précédente.

## Objectif
Le vainqueur déclenche lui-même l'affichage de l'écran final sur la TV depuis son
buzzer. On joue sans animateur actif : le Master reste le device audio mais devient
un serveur headless piloté par les buzzers.

## Pattern à réutiliser
`sessions/{id}/quiz_next_song_request` existe déjà : le joueur écrit une requête,
le Master l'écoute, la valide, l'exécute et la supprime. Calque-toi dessus.

## Tâches

1. Nouveau nœud `sessions/{id}/final_reveal_request` :
   `{ playerId, playerName, timestamp }`

2. Buzzer : quand `phase === 'last_reveal'`, afficher un bouton
   « 🏆 Révéler le classement final » chez le vainqueur uniquement.
   Définition du vainqueur :
   - mode quiz : tête de `quiz_leaderboard`
   - mode équipe : TOUS les joueurs de l'équipe en tête, premier clic gagnant

3. Master : écouter `final_reveal_request`, VÉRIFIER que le `playerId` est bien
   le vainqueur selon la règle ci-dessus (sinon n'importe quel joueur peut
   déclencher), puis appeler `endGame()` et supprimer la requête.
   Reprends le flag anti-double-traitement du listener `quiz_next_song_request`.

4. Fallback animateur : bouton « Afficher le classement final » sur le Master,
   actif dès `phase === 'last_reveal'`.

5. Timeout 45 s porté par le Master : si personne ne clique, bascule automatique
   en `phase: 'ended'`. Le timer se reset sur toute action du vainqueur.
   Compte à rebours visible sur la TV les 10 dernières secondes.

6. `database.rules.json` : autoriser l'écriture de `final_reveal_request` pour
   tout utilisateur authentifié sur session active, sur le modèle EXACT de
   `quiz_next_song_request`. La validation du demandeur reste côté Master.

## Contraintes
- Le timer est porté par le Master uniquement. Jamais par le buzzer ou la TV :
  source de vérité unique, sinon tu auras des déclenchements concurrents.
- Le timeout doit être annulé proprement au démontage (pas de setTimeout orphelin).
- Teste le cas où le vainqueur se déconnecte pendant `last_reveal`.

## Livrable
PR vers `develop`. Décris le scénario de test à 2 joueurs et le comportement
attendu si le vainqueur ne clique pas.
````

---

# AGENT B3 — Lecture de la chanson pilotée par le vainqueur

**Branche :** `feat/winner-playback-control`
**Prérequis :** B2 mergée

````
Tu travailles sur Blindtest (React/Vite + Firebase RTDB + Spotify Web Playback SDK).
Le Master porte le SDK Spotify et produit le son. Les buzzers le pilotent via Firebase.
Lis `CONCEPTION_TV_ET_BOUCLE_JEU.md`, sections B.1, B.6 et B.8. Il fait référence.

## Problème
On enchaîne les questions sans jamais écouter la chanson. Dans `QuizControls.jsx`,
l'auto-reveal coupe la musique pile au moment de la révélation :
```js
if (isPlaying && onPause) { onPause(); }
if (onReveal) { onReveal(); }
```
Le vainqueur n'a qu'un bouton « Continuer ». On veut qu'il puisse écouter la
chanson autant qu'il veut avant de passer à la suite.

## Tâches

1. Retirer le `onPause()` de l'auto-reveal dans `QuizControls.jsx`. La chanson
   continue pendant la découverte du titre et du classement.

2. Nouveau nœud `sessions/{id}/quiz_playback_request` :
   `{ action: 'play' | 'pause', playerId, timestamp }`
   Même pattern que `final_reveal_request` : le Master écoute, valide que le
   playerId est bien le vainqueur de la question, appelle `togglePlay()`,
   supprime la requête.

3. Buzzer du vainqueur : deux boutons au lieu d'un
   - ▶️/⏸️ « Écouter la chanson »
   - ➡️ « Continuer » (existant)

4. ⚠️ POINT CRITIQUE — Geler le chrono après révélation.
   Si la musique repart, le chrono repart et le calcul des points disponibles
   s'affole sur la TV. Il faut DÉCOUPLER « lecture audio » et « chrono de scoring » :
   figer le chrono dès `quiz.revealed === true`.
   Sans ça, corriger l'audio casse le scoring. Vérifie explicitement que
   `calculatePoints()` n'est plus appelé avec un chrono qui avance après révélation.

5. TV en phase `revealed` : afficher la pochette en grand format + titre/artiste.

6. Timeout 90 s après révélation -> passage automatique à la question suivante.
   Timer porté par le Master, reset sur toute action du vainqueur (play, pause,
   continuer). Compte à rebours visible sur la TV les 10 dernières secondes.

7. `database.rules.json` : ajouter `quiz_playback_request` sur le même modèle.

## Contraintes
- Le `SpotifyPlayerAdapter` sauvegarde déjà `currentPosition` au pause : la reprise
  doit repartir au bon endroit, ne réimplémente pas cette logique.
- RÉGRESSION À SURVEILLER : le scoring. Après cette PR, vérifie qu'une partie
  complète attribue les mêmes points qu'avant sur les questions non-dernières.
- Ne casse pas le mode équipe.

## Livrable
PR vers `develop`. Le résumé doit inclure une vérification explicite du non-régression
du scoring : décris comment tu t'en es assuré.
````

---

# AGENT B4 — Feedback sonore et visuel des buzz

**Branche :** `feat/buzz-feedback`
**Prérequis :** aucun (parallélisable)

````
Tu travailles sur Blindtest (React/Vite + Firebase RTDB + Spotify Web Playback SDK).
Master = device audio, Buzzer = mobile joueur.
Lis `CONCEPTION_TV_ET_BOUCLE_JEU.md`, section B.7. Il fait référence.

## Besoin
Quand on écoute la musique, on ne regarde pas la TV : on ignore si l'on est le
dernier à ne pas avoir répondu. Deux canaux de feedback à ajouter.

## Tâche 1 — Beep à chaque buzz (sur le MASTER)

Le beep sort sur le Master, PAS sur les téléphones : un beep par mobile produirait
un décalage de latence et une cacophonie, et la moitié des téléphones sont en
silencieux. Point d'entrée : le son de buzzer existant dans `useBuzzer.js`.

- Un beep IDENTIQUE à chaque buzz : oscillator Web Audio, sinus, 80 ms,
  attaque douce pour éviter le clic
- Le beep spécial du dernier buzz est CONSERVÉ tel quel — le contraste entre les
  deux sons porte l'information « c'est bouclé »
- PAS de progression tonale. Décision explicite, ne l'implémente pas.
- Mixage : baisser le volume Spotify à ~40% pendant 150 ms via
  `spotifyService.setVolume()` puis restaurer, sinon le beep est noyé sous la
  musique (deux chaînes audio indépendantes : Web Audio vs SDK Spotify)

## Tâche 2 — Flash sur le buzzer (sur le MOBILE)

Calcul local dans le Buzzer, pas dans la TV : comparaison de `quiz_answers` avec
le nombre de joueurs de la session.

Escalade à deux niveaux :
- 2 non-répondants restants : pulsation lente du bord d'écran, discrète
- 1 seul et c'est toi : flash plein écran + « ⚡ Tu es le dernier ! »

CONTRAINTE DE SÉCURITÉ : fréquence de flash strictement sous 3 Hz. Au-delà, risque
photosensible, et c'est agressif sur un écran tenu à 30 cm.

Ce flash est le SEUL canal indiquant qu'on est le dernier (le beep étant uniforme,
l'audio ne le signale plus). Soigne-le, il n'a pas de filet.

## Pièges techniques à gérer

1. `navigator.vibrate()` n'existe pas sur iOS Safari. Si tu ajoutes une vibration,
   elle ne partira jamais sur iPhone. Le feedback visuel doit fonctionner SEUL.
   Détecte le support avant d'appeler, ne fais pas planter.

2. Si tu ajoutes un son local sur le mobile : l'AudioContext doit être débloqué sur
   une interaction utilisateur préalable, sinon le navigateur bloque le son au
   moment utile. Le bon moment est le tap de rejoindre la session.

## Livrable
PR vers `develop`. Test à décrire sur iPhone ET Android — le comportement diffère.
````

---

# Note sur l'autonomie

Chaque agent est autonome **dans son périmètre** : il a le contexte produit, le
diagnostic, les contraintes techniques et les pièges connus. Aucun n'a besoin de
revenir vers toi en cours de route.

En revanche, **B1 → B2 → B3 restent séquentiels**. Les trois modifient `Master.jsx`
et `TV.jsx` sur la même séquence de fin de question. Les lancer en parallèle
produirait trois branches en conflit sur les mêmes fonctions — et B3 peut faire
régresser le scoring, ce qui doit être vérifié sur une base stable, pas sur trois
changements empilés.

Les points de validation restent aux merges de PR, via deploy preview Netlify.
