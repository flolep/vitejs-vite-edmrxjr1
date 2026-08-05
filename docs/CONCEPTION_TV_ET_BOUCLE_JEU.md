# CONCEPTION — Rendu TV & Boucle de jeu autonome

**Date :** 5 août 2026
**Révisé le :** 5 août 2026 — corrections suite à l'audit du code réel (cause du bug B1 établie, inventaire des lecteurs de `game_status.ended` complété, règles de sécurité corrigées, chemins de fichiers vérifiés)
**Statut :** Conception — à valider avant génération des prompts Claude Code
**Périmètre :** deux chantiers indépendants, à traiter sur deux branches distinctes

| Chantier | Objet | Branche proposée | Dépendances |
|---|---|---|---|
| **A** | Lisibilité de l'écran TV sur Samsung The Frame 2023 | `fix/tv-scaling` | Aucune |
| **B** | Boucle de jeu quiz autonome (sans animateur actif) | `feat/quiz-autonome` | Aucune sur A |

Le chantier B regroupe trois demandes qui touchent **la même séquence de fin de question**. Les traiter séparément ferait repasser trois fois sur `Master.jsx`, `TV.jsx` et `QuizInterface.jsx` avec un risque élevé de correctifs contradictoires.

---

# CHANTIER A — Rendu TV

## A.1 Contexte matériel

- **Écran :** Samsung The Frame 2023 (LS03B), Tizen 7.0
- **Mode d'affichage :** navigateur web intégré (confirmé)
- **Viewport applicatif :** 1920×1080, `devicePixelRatio` = 1

**Point important :** sur Tizen, la résolution applicative est de 1920×1080 sur tous les modèles, y compris les 4K. Seule la vidéo sort en 3840×2160, avec un upscale matériel en sortie.

## A.2 Diagnostic

L'écran TV n'a pas un problème de résolution mais de **design 10-foot**. `TV.jsx` a été stylé comme un dashboard vu à 50 cm : les `0.75rem` font 12 px réels, illisibles à 3 mètres. Les navigateurs TV rendent en full-HD, ce qui est trop de résolution pour la distance de visionnage habituelle et rend tout trop petit.

**Correction d'une hypothèse initiale erronée :** j'avais d'abord supposé un viewport 4K (3840 px CSS) qui aurait divisé les tailles par deux. C'est faux dans le cas du navigateur intégré. Le diagnostic retenu est le design 10-foot.

## A.3 Correctifs

### A.3.1 — Base rem avec fallback

```css
/* index.css */
html.tv-mode { font-size: 26px; }           /* fallback sûr, moteur ancien */
@supports (font-size: clamp(1px, 1vw, 2px)) {
  html.tv-mode { font-size: clamp(24px, 1.35vw, 42px); }
}
html.tv-mode body {
  padding: 2.5vh 2.5vw;                      /* safe area overscan */
  box-sizing: border-box;
  overflow: hidden;
}
```

```js
// TV.jsx
useEffect(() => {
  document.documentElement.classList.add('tv-mode');
  return () => document.documentElement.classList.remove('tv-mode');
}, []);
```

Facteur ×1,625 sur tout ce qui est déjà en `rem`. Les `0.75rem` passent à ~20 px, les `1rem` à 26 px.

### A.3.2 — Conversion des px résiduels

Sans cette étape, ces éléments ne suivent pas l'agrandissement et cassent la grille.

| Emplacement | Avant | Après |
|---|---|---|
| Grille principale TV | `'1fr 380px'` | `'1fr 22rem'` |
| Nom joueur (troncature) | `maxWidth: '90px'` | `5rem` |
| Leaderboard | `maxHeight: '180px'` | `10rem` |
| Écran fin — conteneur | `maxWidth: '1200px'` | `70rem` |
| Écran fin — scores / prix | `maxWidth: '800px'` | `46rem` |
| QuizDisplay — réponses | `maxWidth: '1000px'` | `56rem` |
| Pastilles et barres | `8px` / `16px` / `4px` | `0.5rem` / `1rem` / `0.25rem` |
| QR code | `size={300}` | `size={420}` |

### A.3.3 — Gestion de la hauteur

Le navigateur Samsung conserve sa barre d'URL : la hauteur utile est d'environ 980 px, pas 1080. Avec un facteur ×1,6, débordement garanti.

- Wrapper principal : `minHeight: 100vh` → `height: 100vh` + `overflow: hidden`
- Panneaux listes : `overflow-y: auto`
- Leaderboard : réduire de 5 à 4 entrées affichées
- **Ne pas utiliser `dvh`** — non supporté par ce moteur

### A.3.4 — Allègement des animations

Le GPU de The Frame est faible pour du DOM animé. Les `animation: pulse infinite` combinées aux `box-shadow: 0 0 40px` et aux gradients saccadent, et cela se voit pendant les buzz.

- Remplacer les `box-shadow` animés par des `opacity` / `transform` (composités GPU)
- Supprimer les `infinite` sur les éléments non critiques

### A.3.5 — Veille écran (hors code)

Le navigateur Tizen n'expose pas la Wake Lock API. Sans interaction télécommande, The Frame peut basculer en mode Art ou en veille pendant une partie. **Désactiver l'économiseur d'écran dans les réglages TV avant chaque soirée** — à ajouter à la checklist animateur.

## A.4 Incertitudes du chantier A

- Version exacte de Chromium sous Tizen 7.0 non vérifiée → support de `@supports`, `clamp()` et comportement de `100vh` avec la barre d'URL à confirmer empiriquement sur la TV. Le fallback à 26 px protège dans tous les cas.
- Comportement d'overscan selon le réglage image de la TV non testé.

---

# CHANTIER B — Boucle de jeu quiz autonome

## B.1 Principe directeur

**Jouer sans admin ne signifie pas supprimer le Master.** Le Master reste le *device audio* : il porte le Spotify Web Playback SDK et produit le son. Il devient un **serveur headless piloté par les buzzers**.

Ce cadrage évite l'erreur de vouloir déplacer la lecture audio sur les mobiles (latence, silencieux, multiplication des sorties son).

## B.2 Machine à états

État unique en base : `sessions/{id}/game_status.phase`

```
playing ──────► revealed ──────► last_reveal ──────► ended
   ▲               │                                    
   └───────────────┘  (question suivante, si reste des pistes)
```

| Phase | Signification | Écran TV |
|---|---|---|
| `playing` | Question en cours, chrono actif | QuizDisplay, chrono live |
| `revealed` | Réponse révélée, points attribués, musique jouable | QuizDisplay + pochette grand format |
| `last_reveal` | Dernière question révélée, en attente du déclenchement final | QuizDisplay + bandeau « classement final en attente » |
| `ended` | Partie terminée | Écran de victoire |

Le booléen `game_status.ended` existant est **conservé en écriture** (expand/contract) tant que tous ses lecteurs ne sont pas tracés. L'inventaire complet — 4 fichiers lecteurs, 3 écriveurs — est en **§B.9**.

## B.3 Nouveaux nœuds Firebase

Tous calqués sur le pattern existant `quiz_next_song_request`.

```
sessions/{id}/
├─ game_status/
│   ├─ phase: 'playing' | 'revealed' | 'last_reveal' | 'ended'
│   ├─ ended: bool          ← déprécié, maintenu temporairement
│   ├─ winner, final_scores, timestamp
├─ quiz_next_song_request   ← EXISTANT
│   └─ { playerId, playerName, timestamp }
├─ quiz_playback_request    ← NOUVEAU
│   └─ { action: 'play'|'pause', playerId, timestamp }
└─ final_reveal_request     ← NOUVEAU
    └─ { playerId, playerName, timestamp }
```

### Règles de sécurité — ne pas copier l'existant

⚠️ La règle réelle de `quiz_next_song_request` (`database.rules.json:75-78`) est :

```json
"quiz_next_song_request": {
  ".read": "root.child('sessions').child($sessionId).child('active').val() === true",
  ".write": "root.child('sessions').child($sessionId).child('active').val() === true"
}
```

**Aucun `auth != null`.** N'importe quel client non authentifié connaissant l'ID de session peut écrire dans ce nœud. Copier « le modèle exact » ouvrirait un nœud non authentifié capable de **terminer la partie**.

**Décision :** les deux nouveaux nœuds `final_reveal_request` et `quiz_playback_request` exigent `auth != null && session active` — plus stricts que l'existant :

```json
".write": "auth != null && root.child('sessions').child($sessionId).child('active').val() === true"
```

La **validation du demandeur** (est-ce bien le vainqueur ?) reste **côté Master**, pas dans les règles.

> **Note — hors périmètre :** le trou de sécurité sur les nœuds existants (`quiz_next_song_request`, `quiz_answers`) fera l'objet d'une **PR séparée**. Ce chantier ne le corrige pas, il évite seulement de le reproduire.

## B.4 Sujet B1 — Bug : points de la dernière question non comptés

### Symptôme
À la dernière question, on passe directement à l'écran des résultats sans que les points de cette question soient ajoutés.

### Cause — établie par audit du code

Le déclencheur de la fin automatique est `src/Master.jsx:1008-1022` :

```js
if (currentSong?.revealed && playlist.length > 0 && currentTrack === playlist.length && !gameEnded) {
  endGame();
}
```

Il **exige `currentSong?.revealed`**. La révélation a donc bien lieu, et les points sont calculés normalement. Une hypothèse antérieure supposait que la séquence sautait la révélation à la dernière piste (`canNavigateNext()` à `false`) : le code la contredit, elle est abandonnée.

**Seule cause en jeu — `endGame()` lit le state React au lieu de Firebase.** Dans `Master.jsx:971-972` :
```js
winner: scores.team1 > scores.team2 ? 'team1' : ...
final_scores: scores
```
`endGame()` part dans le **même cycle de rendu** que la révélation et lit `scores` avant que l'attribution des points ne soit propagée dans le state. `final_scores` est donc figé sur l'avant-dernier score. Race condition de closure.

### Correctif

1. **Dernière question :** révélation normale (manuelle ou auto quand tous ont répondu), points attribués comme d'habitude. Le Master écrit `phase: 'last_reveal'` — **et non** `ended: true`.
2. **TV :** ne bascule sur l'écran de victoire que sur `phase === 'ended'`. En `last_reveal`, affiche le résultat de la question + bandeau d'attente.
3. **`endGame()` relit systématiquement Firebase :**
```js
const snap = await get(ref(database, `sessions/${sessionId}/scores`));
const finalScores = snap.val() || { team1: 0, team2: 0 };
// idem pour quiz_leaderboard
```
C'est le correctif de fond. **Jamais le state React pour les données de fin de partie.**

4. **Passer tous les écrits de `game_status` en `update()`.** `endGame()` utilise aujourd'hui `set()` sur le nœud `game_status` (`Master.jsx:968-974`), ce qui **écrase l'intégralité du nœud**. Un `phase: 'last_reveal'` écrit juste avant serait effacé au moment du passage en `ended`. La machine à états B.2 ne peut pas fonctionner tant que cet écrit reste un `set()`.

5. **Brancher le calcul du vainqueur sur `playMode`.** `endGame()` calcule aujourd'hui `winner` sur `team1`/`team2` uniquement (`Master.jsx:971`), ce qui est sans objet en mode quiz où les scores sont individuels dans `quiz_leaderboard`.
   - mode `quiz` → tête de `quiz_leaderboard`
   - mode `team` → comparaison des scores d'équipe (comportement actuel)

## B.5 Sujet B2 — Déclenchement de l'écran final par le vainqueur

### Comportement cible
Le vainqueur dispose sur son buzzer d'un bouton « 🏆 Révéler le classement final » qui commande l'affichage de l'écran de victoire sur la TV.

### Flux
1. `phase === 'last_reveal'` → le bouton apparaît chez le vainqueur
2. Clic → écriture de `final_reveal_request`
3. Master écoute, **vérifie que `playerId` est bien le leader**, appelle `endGame()`
4. `phase: 'ended'` → bascule TV

### Définition du vainqueur — VALIDÉ
- **Mode quiz :** tête de `quiz_leaderboard` — non ambigu
- **Mode équipe :** le bouton apparaît chez **tous les joueurs de l'équipe en tête**, premier clic gagnant

### Garde-fous obligatoires
- **Fallback animateur :** bouton « Afficher le classement final » sur le Master, actif dès `phase === 'last_reveal'`
- **Timeout 45 s** (voir §B.8)

## B.6 Sujet B3 — Lecture de la chanson pilotée par le vainqueur

### Symptôme
On enchaîne les questions sans jamais écouter la chanson. Le vainqueur n'a qu'un bouton « Continuer ».

### Cause
Dans `QuizControls.jsx`, l'auto-reveal coupe la musique pile au moment de la révélation :
```js
if (isPlaying && onPause) { onPause(); }
if (onReveal) { onReveal(); }
```

### Correctif

1. **Retirer le `onPause()` de l'auto-reveal.** La chanson continue pendant la découverte du titre et du classement — c'est précisément le moment où on veut l'entendre.

2. **Contrôle play/pause côté vainqueur** via `quiz_playback_request`. Le Master vérifie le demandeur et appelle `togglePlay()`. Le `SpotifyPlayerAdapter` sauvegarde déjà `currentPosition` au pause : la reprise repart au bon endroit sans travail supplémentaire.

3. **UI du vainqueur — deux boutons :**
   - `▶️ / ⏸️` Écouter la chanson
   - `➡️ Continuer` (existant)

4. **Geler le chrono après révélation.** ⚠️ **Point critique.** Si la musique repart, le chrono repart et le calcul des points disponibles s'affole sur la TV. Il faut **découpler « lecture audio » et « chrono de scoring »** : figer le chrono dès `quiz.revealed === true`. Sans cela, corriger l'audio casse le scoring.

5. **TV en phase `revealed` :** pochette en grand format + titre/artiste. C'est le moment d'écoute, autant qu'il soit soigné.

6. **Timeout 90 s** après révélation → passage automatique à la question suivante.

## B.7 Sujet B4 — Feedback sonore et visuel des buzz

### Besoin
Quand on écoute, on ne regarde pas la TV : on ignore si l'on est le dernier à ne pas avoir répondu.

### B.7.1 — Beep progressif

**Localisation : sur le Master, pas sur les téléphones.** Un beep par mobile produirait un décalage de latence et une cacophonie, et la moitié des téléphones sont en silencieux. Point d'entrée : le son de buzzer existant dans `useBuzzer.js`.

**Décision : beep uniforme, pas de progression tonale.**
- Un beep **identique** à chaque buzz : oscillator Web Audio, sinus, 80 ms, attaque douce (éviter le clic)
- **Le beep spécial du dernier buzz est conservé tel quel** — le contraste entre les deux sons porte à lui seul l'information « c'est bouclé »

**Conséquence à assumer :** l'audio ne signale plus « il en manque un ». Le flash sur le buzzer (§B.7.2) devient **le seul canal** pour savoir qu'on est le dernier. L'escalade à deux niveaux doit donc être soignée, elle n'a pas de filet.

**Mixage :** le beep passe par Web Audio, la musique par le SDK Spotify — deux chaînes indépendantes. Baisser le volume Spotify à ~40 % pendant 150 ms puis restaurer, sinon le beep est noyé.

⚠️ **`spotifyService.setVolume()` n'existe pas.** Le seul réglage de volume dans `src/spotifyService.js` est `volume: 0.8` passé à la construction du player (l.150). Le SDK expose `player.setVolume()` et `player.getVolume()` sur l'instance : il faut d'abord **exposer ces méthodes dans le service** avant de pouvoir faire le ducking. Étape préalable à ne pas oublier dans le chiffrage de B4.

### B.7.2 — Flash sur le buzzer

**Calcul local dans le Buzzer**, pas dans la TV : comparaison `quiz_answers` / nombre de joueurs de la session.

Escalade en deux temps :
| Non-répondants restants | Feedback |
|---|---|
| 2 | Pulsation lente du bord d'écran, discrète |
| 1 (c'est toi) | Flash plein écran + « ⚡ Tu es le dernier ! » |

**Fréquence de flash à maintenir sous 3 Hz** — au-delà, risque photosensible, et agressif sur un écran tenu à 30 cm.

### B.7.3 — Deux pièges techniques

- **`navigator.vibrate()` n'existe pas sur iOS Safari.** Si les joueurs sont sur iPhone, la vibration ne partira jamais. Le feedback visuel doit fonctionner seul — ne pas construire l'alerte sur la vibration.
- **Déblocage de l'`AudioContext` :** pour tout son local sur mobile, l'`AudioContext` doit être débloqué sur une interaction utilisateur préalable. Le bon moment est le tap de rejoindre la session, sinon le navigateur bloquera le son au moment utile.

## B.8 — Timeouts de sécurité

### Pourquoi
Donner le contrôle à un joueur crée un point de blocage. Le vainqueur d'une question peut reposer son téléphone, s'absenter, ou ne pas comprendre que c'est à lui d'agir. **Sans animateur pour débloquer, la partie est figée** : la TV attend, les autres joueurs attendent, rien ne se passe.

Le timeout est un filet de sécurité, pas une fonctionnalité visible.

### Spécification

| Contexte | Durée | Action au déclenchement |
|---|---|---|
| Phase `revealed` — attente du « Continuer » | 90 s | Passage automatique à la question suivante |
| Phase `last_reveal` — attente du « Révéler le classement » | 45 s | Bascule automatique en `phase: 'ended'` |

**Comportement :**
- Compte à rebours **visible sur la TV les 10 dernières secondes** — pour que ce soit lu comme une intention, pas comme un bug
- **Toute action du vainqueur remet le compteur à zéro** : play, pause, ou continuer
- Le timer est porté par le **Master** (source de vérité unique), jamais par le buzzer ou la TV

### Calibrage
90 s après révélation correspond au temps d'écouter un refrain et de commenter. 45 s pour l'écran final est plus court car à ce moment tout le monde regarde déjà la TV. **À réajuster après une vraie partie** — ces valeurs sont des hypothèses, pas des mesures.

## B.9 — Dépréciation de `game_status.ended`

`phase` et `ended` expriment la même information, mais `phase` est plus riche. Supprimer `ended` immédiatement casserait tous les lecteurs non identifiés.

### Inventaire complet — établi par grep sur le code réel

**Lecteurs (4) — tous à migrer vers `phase` :**

| Emplacement | Usage |
|---|---|
| `src/TV.jsx:354` | `if (status && status.ended)` → bascule sur l'écran de victoire |
| `src/TV.jsx:379` | `else if (status && !status.ended && gameEnded)` → **détection du reset** de partie |
| `src/BuzzerQuiz.jsx:137` | `if (status?.ended === true)` → écran de fin côté joueur quiz |
| `src/BuzzerTeam.jsx:57` | `if (status?.ended === true)` → écran de fin côté joueur équipe |
| `src/pages/MasterFlow/MasterFlowContainer.jsx:165` | `game_status?.ended !== true` → **garde de reprise de session** |

⚠️ `TV.jsx:379` lit `ended === false` pour détecter un **reset**, pas une fin. Une migration naïve vers `phase === 'ended'` casserait la reprise d'une nouvelle partie sur la TV.

**Écriveurs (3)** — le document classait à tort `handleEndGame` parmi les lecteurs :

| Emplacement | Écrit | À faire |
|---|---|---|
| `src/Master.jsx:966-974` `endGame()` | `set()` sur `game_status` | **passer en `update()`** (cf. B.4), puis écrire `ended: true` **et** `phase: 'ended'` |
| `src/pages/MasterFlow/MasterFlowContainer.jsx:440` `handleEndGame` | `'game_status/ended': true` | ajouter `'game_status/phase': 'ended'` |
| `src/pages/MasterFlow/MasterFlowContainer.jsx:402` reset | `game_status = { ended: false }` | doit **aussi écrire `phase: 'playing'`**, sinon la TV reste sur l'écran de victoire après un reset |

### Pattern expand/contract (identique à `famille_genre` dans Trésor)

1. **Expand** *(ce chantier)* — écriture des deux champs en parallèle : `ended: true` **et** `phase: 'ended'`, sur les 3 écriveurs ci-dessus. Rien ne casse, les lecteurs existants continuent de fonctionner.
2. **Migration** *(ce chantier)* — bascule des 5 points de lecture ci-dessus vers `phase`, un par un, avec vérification.
3. **Contract** *(hors périmètre)* — quand un tracer confirme qu'aucun lecteur ne subsiste, arrêt de l'écriture puis suppression du champ.

**L'étape 3 n'est pas dans ce chantier.** Elle attend la confirmation du tracer.

---

# Phasage recommandé

| Phase | Contenu | Point d'arrêt |
|---|---|---|
| **A** | Chantier A complet (scaling TV) | Validation visuelle sur The Frame via deploy preview |
| **B1** | Machine à états `phase` + correctif `endGame()` lecture Firebase | Vérifier que les points de la dernière question sont comptés |
| **B2** | `final_reveal_request` + bouton vainqueur + fallback Master + timeout | Test à 2 joueurs minimum |
| **B3** | `quiz_playback_request` + gel du chrono + UI deux boutons | ⚠️ Vérifier que le scoring n'a pas régressé |
| **B4** | Beep progressif + flash buzzer | Test sur iPhone ET Android |

Les phases B1 → B3 sont **séquentielles** : elles modifient les mêmes fichiers. B4 est parallélisable sur une branche séparée une fois B1 mergée.

---

# Décisions — toutes tranchées

| # | Sujet | Décision |
|---|---|---|
| 1 | Mode équipe — déclencheur de l'écran final | Tous les joueurs de l'équipe en tête, premier clic gagnant ✅ |
| 2 | Timeouts | 90 s (question suivante) / 45 s (écran final), reset sur action, compte à rebours TV sur les 10 dernières secondes ✅ |
| 3 | Beep progressif | **Abandonné.** Beep uniforme + beep spécial dernier buzz ✅ |
| 4 | Suppression de `game_status.ended` | Expand/contract — étapes 1 et 2 dans ce chantier, contract reporté ✅ |
| 5 | Règles de sécurité des nouveaux nœuds | `auth != null && session active` — **plus strictes** que `quiz_next_song_request`, qui n'exige aucune authentification. Correction de l'existant en PR séparée ✅ |

---

# Fichiers impactés

Chemins vérifiés sur le code réel.

**Chantier A :** `src/index.css`, `src/TV.jsx`, `src/components/tv/QuizDisplay.jsx`

**Chantier B :** `src/Master.jsx`, `src/TV.jsx`, `src/BuzzerQuiz.jsx`, `src/BuzzerTeam.jsx`, `src/pages/MasterFlow/MasterFlowContainer.jsx`, `src/components/master/QuizControls.jsx`, `src/components/buzzer/QuizInterface.jsx`, `src/hooks/useBuzzer.js`, `src/hooks/useScoring.js`, `src/spotifyService.js`, `database.rules.json`, `src/utils/firebaseCleanup.js` (liste des nœuds à purger)

**Corrections de chemins par rapport à la version initiale :**

| Cité initialement | Chemin réel |
|---|---|
| `services/spotifyService.js` | `src/spotifyService.js` (racine de `src/`) |
| `utils/sessionCleanup.js` | `src/utils/firebaseCleanup.js` — c'est là qu'est la liste des nœuds à purger (l.117, contient déjà `quiz_next_song_request`). `sessionCleanup.js` existe mais ne fait que désactiver la session. |
| `canNavigateNext()` rattaché au scoring | `src/hooks/usePlaylist.js:28` |
| `spotifyService.setVolume()` | **N'existe pas.** Le seul réglage de volume est `volume: 0.8` à l'init du player (`src/spotifyService.js:150`). Le SDK Spotify expose bien `player.setVolume()`, mais il faut d'abord l'exposer dans le service — cf. B.7.1. |

`BuzzerQuiz.jsx` et `BuzzerTeam.jsx` s'ajoutent à la liste : ce sont des lecteurs de `game_status.ended` (cf. B.9), initialement non identifiés.
