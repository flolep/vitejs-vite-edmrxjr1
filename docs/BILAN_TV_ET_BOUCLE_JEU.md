# BILAN — Rendu TV & Boucle de jeu autonome

**Date :** 5 août 2026
**Périmètre :** chantiers A, B1, B2, B3, B4 de `docs/CONCEPTION_TV_ET_BOUCLE_JEU.md`
**Branche cible :** `develop` (5 merges, `49743cc` → `1288abf`)

| Chantier | Branche | Merge | Diff |
|---|---|---|---|
| A — scaling TV | `fix/tv-scaling` | `49743cc` | 6 fichiers, +528/−125 |
| B4 — feedback buzz | `feat/buzz-feedback` | `9ae834b` | 9 fichiers, +528/−94 |
| B1 — machine à états | `feat/quiz-phase-state` | `96fd062` | 6 fichiers, +224/−26 |
| B2 — écran final | `feat/final-reveal-by-winner` | `44637d6` | 12 fichiers, +644 |
| B3 — lecture pilotée | `feat/winner-playback-control` | `1288abf` | 11 fichiers, +472/−35 |
| **Total** | | | **31 fichiers, +2393/−277** |

Ordre de réalisation : A → B4 → B1 → B2 → B3. B4 a été traité avant B1 parce qu'il
était annoncé parallélisable ; c'est le seul écart de séquencement.

> **Avertissement liminaire.** Rien de cette séquence n'a été exécuté. Aucune partie
> n'a été jouée, aucun écran n'a été affiché, aucun téléphone n'a été connecté. Les
> vérifications ci-dessous sont statiques (lecture du code, greps, 9 tests unitaires
> sur une seule règle). C'est la limite principale de ce bilan, et elle pèse sur les
> cinq chantiers.

---

## 1. État réel du code

### 1.1 Vérifications demandées

| # | Vérification | Résultat |
|---|---|---|
| 1 | `game_status` : tous les écrits en `update()` | ✅ avec une nuance (voir ci-dessous) |
| 2 | Les lecteurs de `.ended` migrés vers `phase` | ✅ 5/5 |
| 3 | `endGame()` relit Firebase, jamais le state React | ✅ |
| 4 | Chrono gelé sur `revealed`, découplé de l'audio | ✅ + couvert par tests |
| 5 | Nouveaux nœuds exigeant `auth != null` | ✅ 2/2 |
| 6 | `setTimeout` orphelins | ⚠️ 1 réel, 2 bénins |

**1 — Écrits `game_status`.** Les deux écritures de `Master.jsx` passent par
`update()` (l. 1047 dans `endGame()`, l. 1083 dans `writePhase()`). `handleEndGame`
(`MasterFlowContainer:447`) utilise des chemins scopés
(`'game_status/ended'`, `'game_status/phase'`) : fusion, pas d'écrasement.

**Nuance :** le reset de partie (`MasterFlowContainer:406`) affecte l'objet entier
`updates['sessions/{sid}/game_status'] = { ended: false, phase: 'playing' }`. Dans un
`update()` multi-chemins, affecter un objet à un chemin **remplace le nœud** — c'est
sémantiquement un `set()`. **C'est voulu ici** : un reset doit effacer `winner`,
`final_scores` et `timestamp`. Mais ce n'est pas « tous les écrits sont en update »
au sens strict, et si quelqu'un ajoute un champ persistant à `game_status`, ce reset
l'effacera silencieusement.

**2 — Lecteurs.** Aucun lecteur comportemental de `.ended` ne subsiste. Il reste
deux occurrences, toutes deux volontaires :
- `MasterFlowContainer:177` — champ d'un `console.log` de diagnostic (j'y ai ajouté
  `phase` à côté) ;
- `gamePhase.js:56` — le fallback de rétrocompatibilité, qui est précisément le
  point unique par lequel `.ended` doit encore être lu.

**3 — `endGame()`.** `get()` sur `sessions/{id}/scores` et sur
`sessions/{id}/quiz_leaderboard`. Aucune lecture du state React. Le calcul de
`winner` est branché sur `playMode`.

**4 — Chrono.** `useGameSession(sessionId, chronoFrozen)` n'incrémente que si
`isPlaying && !chronoFrozen`. La règle est isolée dans `utils/chronoGate.js` et
couverte par 9 tests. C'est le **seul** point de toute la séquence à avoir une
couverture automatisée.

**5 — Règles.** `final_reveal_request` et `quiz_playback_request` exigent bien
`auth != null && session active`.

**6 — Timers.** Audit complet des `setTimeout`/`setInterval` des fichiers touchés :

| Emplacement | État |
|---|---|
| `Master:1321` timer 90 s (`nextQuestionTimerRef`) | ✅ annulé au démontage |
| `Master:1376` timer 45 s (`finalRevealTimerRef`) | ✅ annulé au démontage |
| `TV:419`, `TV:447` décomptes | ✅ `clearInterval` en retour |
| `FinalRevealPanel:28` décompte | ✅ `clearInterval` en retour |
| `useGameSession:131` chrono | ✅ `clearInterval` en retour |
| `Master:1212`, `Master:1279` (`isProcessing = false`) | ⚠️ non annulés — **bénins** |
| `Master:1325` (`await new Promise(setTimeout 600)`) | ❌ **orphelin réel** |

- Les deux `isProcessing` ne font que remettre une variable locale à `false` : après
  démontage ils écrivent dans un objet mort, sans effet de bord. Ils reprennent le
  pattern préexistant du listener `quiz_next_song_request` (`Master:481`).
- **`Master:1325` est un vrai orphelin** : si le timeout de 90 s se déclenche puis
  que le composant est démonté pendant l'attente de 600 ms, `togglePlayRef.current()`
  est quand même appelé et écrit dans Firebase après démontage. La fenêtre est
  étroite et le pattern est copié du code préexistant (`Master:470`), mais je l'ai
  introduit et il n'est pas couvert par le nettoyage annoncé dans la PR B3.

### 1.2 Chantier A — scaling TV

**Livré conformément :** base rem `.tv-mode` (26 px + `clamp`), les 8 conversions du
tableau de conception, les conversions supplémentaires trouvées au grep, contrainte
de hauteur, allègement des animations, scope CSS vérifié (aucune fuite vers Master
ou Buzzer).

**Écart assumé :** `height: 100%` au lieu du `height: 100vh` spécifié. Le body porte
le padding safe-area `2.5vh 2.5vw` : un enfant en `100vh` déborde de 5vh et, avec
`overflow: hidden`, ces 5vh sont rognés définitivement. Documenté dans la PR.

**Ajouté sans être demandé :** conversion de `GameEndDashboard.jsx` (polices 12–16 px
en dur). Hors de la liste du chantier, mais c'est l'écran de fin du mode quiz sur la
route TV : sans lui, il serait resté le seul texte illisible de l'écran.

**Problème réel, non résolu — travail en grande partie sans effet.**
`QuizDisplay.jsx` (553 lignes) est **importé par `TV.jsx:5` mais jamais rendu**. Le
mode quiz passe par le rendu principal de `TV.jsx`. J'ai converti ce fichier parce
qu'il figurait explicitement dans le périmètre, et je l'ai signalé dans la PR — mais
la conception elle-même ciblait un composant mort. **Une part non négligeable du
chantier A est sans effet visible.**

**Deux risques signalés et non traités :**
- L'écran de fin équipe empile un `h1` 5rem, un `h2` 6rem, un score 4rem, la grille
  des scores et le prix de la rapidité. À 26 px de base cela dépasse largement les
  ~980 px utiles. Mis en `overflowY: auto` pour que rien ne soit inatteignable —
  mais **personne ne scrolle une TV**. La densité typographique reste à revoir.
- Le leaderboard à 4 entrées dans `maxHeight: 10rem` : 10 rem = 260 px pour ~325 px
  de contenu. La valeur vient de la conception, je l'ai gardée ; le panneau
  scrollera probablement.

**Critère de validation non rempli :** le chantier devait être validé sur The Frame
via deploy preview. **Ça n'a pas été fait.** Or c'était le seul critère d'acceptation
du chantier A — tout le reste n'est qu'une hypothèse sur le rendu.

### 1.3 Chantier B4 — feedback buzz

**Livré conformément :** beep sinus 880 Hz / 80 ms à attaque douce, uniforme, sans
progression tonale ; ducking Spotify 40 % / 150 ms ; exposition préalable de
`setVolume`/`getVolume` (confirmé absent du service) ; flash à deux niveaux sur le
buzzer à 1,25 Hz et 0,5 Hz, très sous la limite de 3 Hz ; `navigator.vibrate` gardé
par détection de support.

**Interprétation non validée :** la consigne dit « le beep spécial du dernier buzz
est CONSERVÉ tel quel ». **Ce beep n'existait pas.** Or la conception fait reposer
l'information « c'est bouclé » sur le contraste entre deux sons. J'ai promu le
sawtooth 800→400 Hz de `useBuzzer.js` au rôle de son final : il est conservé tel
quel, mais son déclenchement change. **C'est une décision que j'ai prise seul et qui
n'a pas été arbitrée.**

**Ajouté sans être demandé :** retrait du beep de `TV.jsx` (il y était déjà, sur
chaque réponse). TV et Master étant dans la même pièce sur deux sorties, on entendait
deux beeps décalés. Décision défendable, mais c'est un retrait de comportement
existant qui n'était pas au périmètre.

**Ajouté sans être demandé :** `useBuzzer.js` ne crée plus son propre `AudioContext`
et délègue à `services/buzzSounds.js`. **Ce refactor touche le chemin du mode
équipe** — c'est le point d'entrée du son de buzz en mode équipe. Justifié (une seule
définition du son), mais il élargit la surface de régression du mode équipe.

**Non testé :** le livrable demandait un test sur iPhone **et** Android, précisément
parce que le comportement diffère. **Aucun des deux n'a été fait.**

### 1.4 Chantier B1 — machine à états + points dernière question

**Livré conformément :** `phase` à 4 valeurs, expand sur les 3 écriveurs, migration
des 5 lecteurs, `endGame()` relisant Firebase, `set()` → `update()`, `winner` branché
sur `playMode`, `last_reveal` sur la dernière question, bandeau TV.

**Inventaire confirmé :** le grep sur `game_status`, `.ended` et `gameEnded` dans
`src/`, `netlify/`, `n8n-workflows/`, `scripts/` et `database.rules.json` donne
exactement les 5 lecteurs et 3 écriveurs annoncés. Rien à ajouter.

**Cas non listé, trouvé en route :** `'ended'` devait être un état terminal. Le
pilote de phase dérive la phase de `currentSong.revealed` ; un Master remonté sur une
partie terminée réécrivait `'last_reveal'` par-dessus `'ended'`, et la TV lisait ce
retour en arrière comme un reset → boucle de rechargement. Corrigé (`writePhase()`
relit avant d'écrire).

**Changement de comportement assumé :** la dernière question ne termine plus la
partie automatiquement. Intentionnel — terminer dans le même cycle que la révélation
est *la* cause du bug. Entre B1 et B2 la partie ne se terminait que par le bouton
animateur ; B2 a comblé le trou.

**Ajouté sans être demandé :** `winner_name` dans `game_status`, pour rendre le
vainqueur quiz lisible sans recharger le classement.

### 1.5 Chantier B2 — écran final déclenché par le vainqueur

**Livré conformément :** nœud `final_reveal_request`, bouton chez le vainqueur (quiz :
tête du classement ; équipe : tous les joueurs de l'équipe en tête), validation côté
Master relue depuis Firebase, fallback animateur, timeout 45 s porté par le Master
seul, décompte TV sur les 10 dernières secondes, règle plus stricte que l'existant.

**Ajout majeur non demandé — et bloquant :** **le Buzzer ne s'authentifiait pas du
tout.** Seul le Master se connecte (email/mot de passe). La règle `auth != null`
demandée aurait fait échouer le bouton en `PERMISSION_DENIED`. J'ai donc ajouté une
connexion anonyme (`utils/buzzerAuth.js`) déclenchée au montage de
`useBuzzerSession`.

⚠️ **Cela suppose que le fournisseur « Anonyme » soit activé dans la console Firebase
(Authentication → Sign-in method). Ce réglage n'a pas été fait et ne peut pas l'être
depuis le code.** Tant qu'il ne l'est pas :
- le bouton du vainqueur (B2) est inopérant ;
- le contrôle play/pause (B3) est inopérant ;
- les deux dégradent proprement (message explicite, fallback animateur, timeouts),
  la partie ne se bloque pas — mais **deux chantiers sur cinq sont partiellement
  morts en production**.

**Décision de conception prise seule :** en cas d'égalité (mode équipe), les deux
équipes comptent comme « en tête ». Bloquer aurait figé la partie sans rien protéger,
le résultat étant un match nul. Appliqué à l'identique côté buzzer et côté validation
Master.

**Ajouté sans être demandé :** `FinalRevealPanel`, un bandeau plutôt qu'un simple
bouton, parce que le décompte devait être visible par l'animateur.

### 1.6 Chantier B3 — lecture pilotée par le vainqueur

**Livré conformément :** musique non coupée à la révélation, nœud
`quiz_playback_request` avec la même règle que `final_reveal_request`, validation du
vainqueur de la question côté Master, deux boutons sur le buzzer, gel du chrono,
pochette grand format sur la TV, timeout 90 s avec reset sur action.

**Écart par rapport au brief :** le brief ne cite qu'un point de pause
(`QuizControls`). **Il y en avait trois** — le handler `onReveal` de `Master.jsx` et
`revealAnswer()` pausaient aussi. Retirer le premier seul n'aurait rien changé. Les
trois sont traités, en mode quiz uniquement.

**Ajouté sans être demandé :** `utils/chronoGate.js` + 9 tests. La règle de gel du
chrono était le risque central du chantier ; l'extraire en fonction pure la rend
vérifiable par `npm test` plutôt que par relecture.

**Réutilisation plutôt qu'ajout :** « vainqueur de la question » =
`nextSongTriggerPlayerId`, la définition qui donnait déjà le bouton « Continuer ».
Pas de nouvelle notion à maintenir.

---

## 2. Dette laissée derrière

### 2.1 `game_status.ended` — expand fait, contract non fait

| Étape | État |
|---|---|
| 1. Expand (écrire `phase` **et** `ended`) | ✅ fait, 3 écriveurs |
| 2. Migration des lecteurs vers `phase` | ✅ fait, 5 lecteurs |
| 3. Contract (arrêt d'écriture puis suppression) | ❌ **non fait, hors périmètre** |

**Aucun lecteur comportemental de `.ended` ne subsiste dans le code.** Le seul point
de lecture restant est le fallback de `resolveGamePhase()`, qui existe pour les
sessions créées **avant** l'introduction de `phase`.

Le contract est donc réalisable dès qu'on peut affirmer qu'aucune session
antérieure ne circule plus en base. Il n'y a pas de tracer en place pour l'affirmer :
c'est le seul bloquant. Concrètement, une session Firebase créée avant le merge de B1
et rouverte après suppression du fallback ferait boucler la TV sur l'écran de
victoire — le mode de défaillance exact que le fallback évite.

### 2.2 Règles Firebase — 5 nœuds toujours ouverts

Inventaire exhaustif des `.write` de `sessions/$sessionId` :

| Nœud | `auth != null` |
|---|---|
| `chrono` | ❌ **ouvert** |
| `buzz` | ❌ **ouvert** |
| `players_session` | ❌ **ouvert** |
| `quiz_answers` | ❌ **ouvert** |
| `quiz_next_song_request` | ❌ **ouvert** |
| `final_reveal_request` | ✅ (posé par B2) |
| `quiz_playback_request` | ✅ (posé par B3) |
| tous les autres (`scores`, `game_status`, `quiz`, …) | ✅ |

**C'était hors périmètre et ça l'est resté** : les deux nouveaux nœuds sont plus
stricts que l'existant, on a évité de reproduire le trou, on ne l'a pas bouché.

Le plus exposé est **`quiz_next_song_request`** : n'importe quel client non
authentifié connaissant l'ID de session peut y écrire et faire enchaîner les
questions. `quiz_answers` permet d'écrire des réponses arbitraires (donc des scores),
et `chrono` de fausser les temps de réponse de tout le monde.

À relativiser : l'ID de session est un code court affiché à l'écran, le modèle de
menace est « un invité de la soirée qui s'amuse », pas une attaque distante. Mais
c'est une PR séparée qui reste à faire.

### 2.3 `famille_genre` (Trésor)

**Aucune occurrence dans le code.** Le terme n'apparaît que dans
`docs/CONCEPTION_TV_ET_BOUCLE_JEU.md` et `docs/INTEGRATION_GUIDE.md`, où il sert
d'exemple de pattern expand/contract. **Rien à faire côté code.**

### 2.4 Code mort et divers

- **`QuizDisplay.jsx` — 553 lignes de code mort.** Importé par `TV.jsx:5`, jamais
  rendu. Converti en rem par le chantier A pour rien. Soit le brancher (il paraît
  plus soigné que le rendu quiz actuel de `TV.jsx`), soit le supprimer. Laisser un
  composant mort *et maintenu* est le pire des trois.
- **Double appel possible de `endGame()`.** Le listener `final_reveal_request` et le
  timer 45 s l'appellent tous deux. Le timer est annulé quand `gamePhase` passe à
  `'ended'`, mais cette transition passe par un aller-retour Firebase : il existe une
  fenêtre étroite où les deux peuvent partir. `endGame()` est quasi idempotent
  (relecture Firebase, `update()`, `deactivatePreviousSession`), donc l'effet serait
  une double écriture, pas une corruption. Non protégé.
- **`Master:1325`** — l'orphelin décrit en 1.1.
- **Aucun TODO, FIXME ou commentaire de contournement** n'a été introduit dans les
  15 fichiers créés. Vérifié par grep.
- **Lint :** 48 problèmes sur `src/`, strictement identiques à l'état d'avant la
  séquence. Aucune erreur nouvelle introduite, aucune erreur préexistante corrigée
  non plus.

---

## 3. Ce qui n'a pas été testé

**Rien n'a été exécuté.** Ni `npm run dev`, ni une partie, ni un écran, ni un
téléphone. Le seul code exécuté de toute la séquence est la suite de tests unitaires.

### 3.1 Couverture automatisée : 9 tests sur un seul fichier

`npx vitest run` : 69 tests passent, dont **9 écrits pendant cette séquence**, tous
sur `utils/chronoGate.js`. Les 60 autres sont antérieurs (Trésor, taxonomie).

Non couvert par un test : `gamePhase.js` (`resolveGamePhase`, y compris la
rétrocompatibilité dont dépend la non-régression de la TV),
`finalRevealValidation.js` (la validation qui empêche un joueur non vainqueur de
terminer la partie), `buzzerAuth.js`, `buzzSounds.js`, tous les hooks, tous les
listeners Firebase, toutes les règles de sécurité.

`finalRevealValidation.js` est le plus regrettable : c'est de la logique pure, sans
dépendance React, directement testable, et c'est un contrôle de sécurité.

### 3.2 Mode équipe — traversé par 4 chantiers sur 5, jamais testé

C'est le principal angle mort. Ce que chaque chantier lui a fait :

| Chantier | Impact sur le mode équipe |
|---|---|
| A | Écran de victoire équipe converti en rem — et c'est l'écran identifié comme débordant |
| B4 | **`useBuzzer.js` refactoré** — c'est le chemin du son de buzz en mode équipe |
| B1 | `phase`, `endGame()`, `winner` : la branche équipe est modifiée |
| B2 | Bouton du vainqueur en mode équipe + validation par appartenance à l'équipe en tête |
| B3 | Isolé par construction (`isChronoFrozen` renvoie `false`, `QuizControls` est quiz-only) |

Seul B3 a une garantie structurelle. **B4 et B1 modifient du code que le mode équipe
exécute**, et B2 y ajoute un chemin entièrement neuf (bouton chez tous les joueurs de
l'équipe en tête, premier clic gagnant) qui n'a jamais tourné.

Le scénario minimal jamais joué : une partie équipe complète, buzz → son → attribution
de points → dernière question → `last_reveal` → bouton chez l'équipe en tête → écran
de victoire avec les bons scores.

### 3.3 Vainqueur déconnecté pendant `last_reveal`

**Couvert par construction, jamais exécuté.** Le raisonnement : le vainqueur
déconnecté reste en tête de `quiz_leaderboard` (historique de scores, pas de
présence), donc aucun autre joueur n'hérite du bouton, et c'est le timeout de 45 s
porté par le Master qui débloque.

Ce raisonnement n'a pas été vérifié. En particulier, `endGame()` appelle
`deactivatePreviousSession()` qui passe `active` à `false` — or les règles de lecture
exigent `active === true`. Les buzzers reçoivent l'événement `ended` **avant** la
désactivation (ordre des écritures dans `endGame()`), mais ce n'est pas prouvé, et
c'est le genre de course qui ne se voit qu'en conditions réelles.

### 3.4 Les trois timeouts

Aucun n'a tourné : 45 s (classement final), 90 s (question suivante), 150 ms
(ducking Spotify). Les valeurs 45 s et 90 s sont des hypothèses de la conception,
explicitement « à réajuster après une vraie partie ».

Le point le moins sûr est leur **interaction** : le timer 90 s ne tourne pas sur la
dernière question (condition `!isLastTrack`) pour laisser la main au timer 45 s. Cette
exclusion mutuelle est écrite mais n'a jamais été observée.

### 3.5 Le matériel

Zéro validation sur The Frame — qui était le seul critère d'acceptation du chantier A.
Zéro validation sur iPhone et Android — que le livrable de B4 demandait explicitement.
Zéro validation du ducking Spotify, qui dépend d'un SDK réel.

---

## 4. Prochaines étapes

Ordonnées par ratio risque/effort. Aucun refactor de confort.

### P0 — Débloquer ce qui est livré mais inerte

**1. Activer le fournisseur « Anonyme » dans la console Firebase**
*Effort : 2 minutes. Risque de régression : nul.*
Sans ce réglage, le bouton du vainqueur (B2) et le contrôle play/pause (B3) sont
inopérants en production. C'est la seule action qui débloque deux chantiers d'un
coup, et elle ne touche pas au code.

**2. Déployer les règles Firebase**
*Effort : 5 minutes. Risque : faible, les deux nouvelles règles sont additives.*
`database.rules.json` a été modifié par B2 et B3 mais n'est appliqué que par un
déploiement explicite. Sans lui, les écritures sur les deux nouveaux nœuds sont
refusées par la règle parente.

### P1 — Valider ce qui n'a jamais tourné

**3. Une partie quiz complète sur deploy preview, 2 joueurs, 3 pistes**
*Effort : 30 min. Risque : nul (observation).*
Couvre d'un coup B1 (points de la dernière question dans `final_scores`), B2 (bouton
chez le vainqueur seul, refus du perdant), B3 (musique qui continue, chrono figé,
play/pause), B4 (beep, flash). C'est le test à faire avant tout le reste : il dira si
la séquence fonctionne ou non.

**4. Une partie en mode équipe complète**
*Effort : 20 min. Risque : nul (observation).*
Le principal angle mort. Quatre chantiers ont modifié du code qu'il exécute, aucun ne
l'a vérifié. À faire même si le mode équipe n'est plus la cible : il est toujours
dans le produit.

**5. Le chantier A sur The Frame**
*Effort : 15 min. Risque : nul (observation).*
Seul critère d'acceptation de A, jamais rempli. Vérifier en priorité l'écran de fin
équipe (débordement attendu) et le leaderboard à 4 entrées (scroll attendu). Les deux
sont des problèmes connus et documentés, pas des surprises.

### P2 — Combler les manques identifiés

**6. Tester `finalRevealValidation.js`**
*Effort : 1 h. Risque : nul (ajout de tests).*
Logique pure, sans dépendance React, et c'est un contrôle de sécurité : c'est lui qui
empêche un joueur non vainqueur de terminer la partie. Il n'a aucune couverture. Même
raisonnement pour `resolveGamePhase()`, dont la branche de rétrocompatibilité est ce
qui empêche la TV de boucler sur les anciennes sessions.

**7. Trancher le sort de `QuizDisplay.jsx`**
*Effort : 15 min (suppression) ou 2 h (branchement). Risque : faible / moyen.*
553 lignes mortes, converties pour rien. La suppression est sans risque (le composant
n'est pas rendu). Le branchement est un choix produit : ce composant paraît plus
soigné que le rendu quiz actuel de `TV.jsx`, mais il faudrait le comparer à l'écran.
**Décision à prendre, pas à reporter** — c'est du code maintenu à chaque chantier TV.

**8. Fermer l'orphelin `Master:1325`**
*Effort : 30 min. Risque : faible.*
Rendre annulable l'attente de 600 ms du timeout 90 s (drapeau `cancelled` capturé par
la closure et testé après l'attente). Corrige aussi, au passage, le même pattern
préexistant à `Master:470`.

**9. Garde d'idempotence sur `endGame()`**
*Effort : 30 min. Risque : faible.*
Un drapeau `isEndingRef` empêche le double appel possible entre le listener
`final_reveal_request` et le timer 45 s. L'effet actuel serait une double écriture,
pas une corruption — d'où la priorité basse.

### P3 — Dette de fond

**10. Fermer les 5 nœuds Firebase sans `auth != null`**
*Effort : 2 h. Risque : **élevé**.*
`chrono`, `buzz`, `players_session`, `quiz_answers`, `quiz_next_song_request`. Le
risque n'est pas dans la règle mais dans le fait que **les buzzers n'étaient pas
authentifiés du tout jusqu'à B2** : ajouter `auth != null` sur ces nœuds casse tous
les buzzers si l'auth anonyme n'est pas fiable en production. **À ne faire qu'après
que l'étape 1 soit validée en conditions réelles**, nœud par nœud, en commençant par
`quiz_next_song_request` (le plus exposé) et en finissant par `buzz` (le plus critique
au jeu). PR séparée, comme prévu par la conception.

**11. Contract de `game_status.ended`**
*Effort : 1 h. Risque : moyen.*
Techniquement prêt : aucun lecteur comportemental ne subsiste. Le seul bloquant est
l'absence de tracer confirmant qu'aucune session antérieure à B1 ne circule plus.
Le plus simple est d'attendre un délai calendaire (les sessions sont éphémères, une
soirée) plutôt que d'instrumenter. **Aucun gain fonctionnel** — uniquement de la
propreté. À faire en dernier, ou jamais.

**12. Revoir la densité de l'écran de fin équipe**
*Effort : 2 h. Risque : faible.*
Conditionné à l'étape 5. Si le débordement se confirme, c'est un travail de design
(échelle typographique), pas une conversion de valeurs — et donc une décision
produit, pas technique.
