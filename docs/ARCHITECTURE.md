# Architecture Refactorée - Blind Test

## Vue d'ensemble

L'application a été refactorée pour séparer deux dimensions indépendantes :
1. **Source de musique** : Comment charger/gérer la playlist
2. **Mode de jeu** : Comment jouer (règles, scoring, interactions)

Cette architecture permet de combiner n'importe quelle source de musique avec n'importe quel mode de jeu.

## Structure des dossiers

```
src/
├── hooks/                      # Hooks réutilisables (logique commune)
│   ├── useGameSession.js       # Gestion session, scores, chrono
│   ├── useBuzzer.js           # Système de buzzer
│   ├── usePlaylist.js         # Navigation dans la playlist
│   └── useScoring.js          # Calcul et attribution des points
│
├── modes/                     # Hooks spécifiques par mode
│   ├── useMP3Mode.js          # Source : Upload manuel MP3
│   ├── useSpotifyAutoMode.js  # Source : Import playlist Spotify
│   ├── useSpotifyAIMode.js    # Source : Génération IA
│   └── useQuizMode.js         # Mode de jeu : Quiz (à créer)
│
├── services/
│   ├── playerAdapter.js       # Adaptateurs pour unifier MP3/Spotify
│   ├── spotifyService.js      # API Spotify
│   ├── n8nService.js          # Workflows n8n
│   └── firebase.js            # Config Firebase
│
├── components/
│   ├── master/                # Composants réutilisables
│   │   ├── BuzzAlert.jsx
│   │   ├── ScoreDisplay.jsx
│   │   ├── PlayerControls.jsx
│   │   └── ...
│   └── MasterWizard.jsx       # Configuration initiale
│
├── Master.jsx                 # Composant principal (à refactoriser)
└── ...
```

## Hooks de base (logique commune)

### 1. `useGameSession.js`
Gère l'état de la session de jeu :
- Scores des équipes
- Chrono (synchronisé avec Firebase)
- État de lecture (play/pause)
- Piste actuelle
- Durée de la chanson

**Utilisé par** : Tous les modes

### 2. `useBuzzer.js`
Gère le système de buzzer :
- Écoute des buzz Firebase
- Son de buzzer
- Enregistrement des tentatives
- Équipe qui a buzzé

**Utilisé par** : Mode Équipe (pas Quiz)

### 3. `usePlaylist.js`
Gère la playlist :
- Navigation (next, prev)
- Ajout/modification de pistes
- Révélation des réponses

**Utilisé par** : Tous les modes

### 4. `useScoring.js`
Gère le scoring :
- Calcul des points (décroissance temporelle)
- Attribution des points
- Marquage des buzz (correct/incorrect)
- Stats des joueurs

**Utilisé par** : Tous les modes

## Hooks spécifiques par source de musique

### 1. `useMP3Mode.js`
Logique spécifique au mode MP3 :
- Upload de fichiers
- Extraction métadonnées (artiste/titre)
- Référence audio HTML5

### 2. `useSpotifyAutoMode.js`
Logique spécifique au mode Spotify Auto :
- Chargement des playlists utilisateur
- Sélection de playlist
- Initialisation du player Spotify SDK

### 3. `useSpotifyAIMode.js`
Logique spécifique au mode Spotify IA :
- Création de playlist via n8n
- Écoute des contributions des joueurs
- Feed des mises à jour
- Vérification du bonus personnel

## Adaptateurs (abstraction)

### `playerAdapter.js`
Fournit une interface unifiée pour la lecture audio :

```javascript
// Interface commune
class PlayerAdapter {
  play(track)
  pause()
  loadTrack(track)
  getDuration()
  getCurrentPosition()
}

// Implémentations
- MP3PlayerAdapter (HTML5 Audio)
- SpotifyPlayerAdapter (Spotify Web SDK)
```

## Modes de jeu

### Mode Équipe (actuel)
- **Gameplay** : Buzzer par équipe (team1 vs team2)
- **Scoring** : Points par temps de réponse (2500→0)
- **Cooldown** : Après N bonnes réponses consécutives
- **Bonus** : Bonus personnel en mode Spotify-IA (+500 pts)
- **Compatible avec** : MP3, Spotify-auto, Spotify-IA

### Mode Quiz
- **Gameplay** : QCM avec 4 réponses proposées
- **Joueurs** : Individuels (pas d'équipes)
- **Interaction** : Chaque joueur buzze sur la réponse qu'il pense correcte (A/B/C/D)
- **Scoring** : Points par rapidité de réponse
- **Affichage** : Classement individuel en temps réel sur TV
- **Compatible avec** : Spotify-IA uniquement

## Combinaisons possibles

| Source de musique | Mode de jeu | Valide | Notes |
|------------------|-------------|--------|-------|
| MP3 | Équipe | ✅ | Blind test classique avec fichiers locaux |
| MP3 | Quiz | ❌ | Mode Quiz réservé à Spotify-IA |
| Spotify Auto | Équipe | ✅ | Blind test avec playlist Spotify |
| Spotify Auto | Quiz | ❌ | Mode Quiz réservé à Spotify-IA |
| Spotify IA | Équipe | ✅ | Blind test collaboratif avec génération IA |
| Spotify IA | Quiz | ✅ | Quiz musical avec classement temps réel |

## Migration progressive

### Phase 1 : Création des hooks ✅
- [x] useGameSession.js
- [x] useBuzzer.js
- [x] usePlaylist.js
- [x] useScoring.js
- [x] useMP3Mode.js
- [x] useSpotifyAutoMode.js
- [x] useSpotifyAIMode.js

### Phase 2 : Adaptateurs ✅
- [x] playerAdapter.js (MP3 + Spotify)

### Phase 3 : Refactorisation Master.jsx ⏳
- [ ] Remplacer la logique inline par les hooks
- [ ] Utiliser les adaptateurs pour la lecture
- [ ] Simplifier la gestion des modes

### Phase 4 : Mode Quiz 🔜
- [ ] Définir les specs du mode Quiz
- [ ] Créer useQuizMode.js
- [ ] Créer QuizControls.jsx
- [ ] Intégrer au wizard

## Avantages de cette architecture

✅ **Séparation des préoccupations** : Logique commune vs spécifique
✅ **Réutilisabilité** : Les hooks sont composables
✅ **Maintenabilité** : Chaque mode dans son propre fichier
✅ **Extensibilité** : Facile d'ajouter de nouveaux modes
✅ **Testabilité** : Les hooks peuvent être testés isolément
✅ **Lisibilité** : Master.jsx passera de 2286 à ~500 lignes

## Prochaines étapes

1. **Clarifier les specs du mode Quiz**
   - Type de questions
   - Système de scoring
   - Interface joueur/animateur

2. **Refactoriser Master.jsx**
   - Utiliser les nouveaux hooks
   - Supprimer la logique dupliquée
   - Réduire la complexité

3. **Implémenter le mode Quiz**
   - Créer les composants nécessaires
   - Intégrer au wizard
   - Tester les combinaisons
