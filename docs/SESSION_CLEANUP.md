# Système de Nettoyage des Sessions

## 🎯 Objectif

Assurer qu'une nouvelle partie démarre avec un état propre, sans pollution de données de la session précédente.

## 📦 Fichier : `src/utils/sessionCleanup.js`

Utilitaire centralisé pour gérer le cycle de vie des sessions.

## 🔧 Fonctions disponibles

### 1. `deactivatePreviousSession(sessionId)`

Désactive une session dans Firebase sans supprimer ses données.

```javascript
await deactivatePreviousSession('ABC123');
```

**Actions** :
- Marque `active: false` dans Firebase
- Ajoute `endedAt: timestamp`
- **Conserve** toutes les données (historique, scores, etc.)

**Utilisé par** :
- `MasterWizard.jsx` lors de la création d'une nouvelle session
- `Master.jsx` lors de la fin d'une partie

---

### 2. `cleanupSessionData(sessionId)`

Nettoie les données temporaires d'une session.

```javascript
await cleanupSessionData('ABC123');
```

**Données nettoyées** :
- `buzz` - Buzz en cours
- `currentSong` - Chanson actuelle
- `quiz` - État du quiz actuel
- `showQRCode` - Affichage QR Code

**Données conservées** :
- `buzz_times` - Historique complet des buzz
- `quiz_answers` - Historique des réponses Quiz
- `quiz_leaderboard` - Classement final Quiz
- `scores` - Scores finaux
- `game_status` - Statut de fin de partie

**Utilisé par** :
- Nettoyage manuel si nécessaire

---

### 3. `fullSessionCleanup(sessionId, keepHistory)`

Nettoyage complet d'une session (désactivation + nettoyage données).

```javascript
// Nettoyer en gardant l'historique
await fullSessionCleanup('ABC123', true);

// Nettoyer complètement (supprimer historique aussi)
await fullSessionCleanup('ABC123', false);
```

**Actions** :
1. Désactive la session
2. Nettoie les données temporaires
3. Optionnel : Supprime l'historique complet

**Utilisé par** :
- Maintenance manuelle
- Suppression de parties de test

---

### 4. `cleanupLocalStorage()`

Nettoie le localStorage des données temporaires.

```javascript
cleanupLocalStorage();
```

**Données nettoyées** :
- `wizardInProgress` - Flag wizard en cours

**Données conservées** :
- `lastSessionId` - Permet "Continuer la dernière partie"

---

### 5. `prepareNewSession(previousSessionId, fullClean)`

**Fonction principale** - Prépare une nouvelle session en nettoyant l'ancienne.

```javascript
// Nettoyage léger (désactiver + localStorage)
await prepareNewSession('ABC123', false);

// Nettoyage complet
await prepareNewSession('ABC123', true);
```

**Actions** :
1. Nettoie le localStorage
2. Désactive la session précédente (ou nettoyage complet si `fullClean = true`)
3. Prépare pour une nouvelle session

**Utilisé par** :
- `MasterWizard.jsx` lors de la création d'une nouvelle session

---

## 🔄 Flow de Nettoyage

### **Scénario 1 : Nouvelle partie**

```
Wizard → Nouvelle Partie
  ↓
prepareNewSession(lastSessionId, false)
  ├─ cleanupLocalStorage()
  │   └─ Supprime wizardInProgress
  │
  ├─ deactivatePreviousSession(lastSessionId)
  │   ├─ active: false
  │   └─ endedAt: timestamp
  │
  └─ createSession(newSessionId)
      └─ Création de la nouvelle session
```

### **Scénario 2 : Fin de partie**

```
Master → Bouton "Terminer"
  ↓
endGame()
  ├─ game_status: { ended: true, winner, scores, timestamp }
  ├─ deactivatePreviousSession(sessionId)
  │   ├─ active: false
  │   └─ endedAt: timestamp
  │
  └─ Message: "Partie terminée !"
```

### **Scénario 3 : Continuer une partie**

```
Wizard → Continuer
  ↓
loadSession(lastSessionId)
  ├─ Vérifie active: true
  ├─ Charge playlist, scores, etc.
  └─ Lance Master avec config existante
```

## 📊 Structure Firebase d'une session

### **Session active**
```javascript
sessions/ABC123/
├─ active: true
├─ createdBy: "user123"
├─ createdAt: 1234567890
├─ musicSource: "spotify-ai"
├─ playMode: "quiz"
├─ scores: { team1: 2500, team2: 3000 }
├─ chrono: 12.5
├─ isPlaying: false
├─ currentSong: { title, artist, revealed }
├─ game_status: { ended: false }
├─ buzz_times/
│   ├─ 0/
│   │   └─ [{ team, time, correct, points, ... }]
│   └─ 1/
│       └─ [...]
└─ ...
```

### **Session terminée**
```javascript
sessions/ABC123/
├─ active: false          ← Désactivée
├─ endedAt: 1234567900    ← Timestamp de fin
├─ createdBy: "user123"
├─ createdAt: 1234567890
├─ game_status: {
│     ended: true,
│     winner: "team1",
│     final_scores: { team1: 5000, team2: 3500 },
│     timestamp: 1234567900
│   }
├─ buzz_times/            ← Historique conservé
│   └─ ...
└─ ...
```

## ✅ Garanties

### **Lors d'une nouvelle partie** :
- ✅ Ancienne session désactivée
- ✅ localStorage nettoyé
- ✅ Nouvelle session avec état propre
- ✅ Pas de pollution de données

### **Lors de la fin de partie** :
- ✅ Session marquée comme terminée
- ✅ Session désactivée
- ✅ Historique conservé
- ✅ Scores finaux enregistrés

### **Données toujours conservées** :
- ✅ Historique complet des buzz (`buzz_times`)
- ✅ Réponses Quiz (`quiz_answers`)
- ✅ Classement Quiz (`quiz_leaderboard`)
- ✅ Scores finaux
- ✅ Statut de fin de partie

## 🛠️ Utilisation

### **Création d'une nouvelle session** (automatique)
```javascript
// Dans MasterWizard.jsx
const createSession = async (source, playMode) => {
  // Nettoyage automatique
  if (lastSessionId) {
    await prepareNewSession(lastSessionId, false);
  }

  // Création nouvelle session
  const newSessionId = generateId();
  await createSessionInFirebase(newSessionId);
  // ...
};
```

### **Fin de partie** (automatique)
```javascript
// Dans Master.jsx
const endGame = async () => {
  // Marquer comme terminée
  await set(gameStatusRef, { ended: true, ... });

  // Désactiver la session
  await deactivatePreviousSession(sessionId);
};
```

### **Nettoyage manuel** (si nécessaire)
```javascript
import { fullSessionCleanup } from './utils/sessionCleanup';

// Nettoyer une session de test
await fullSessionCleanup('TEST123', false);
```

## 🔍 Logs

Tous les appels aux fonctions de nettoyage génèrent des logs console :

```
🧹 Préparation pour une nouvelle session...
🧹 Nettoyage du localStorage...
✅ Clé wizardInProgress supprimée du localStorage
🧹 Désactivation de la session ABC123...
✅ Session ABC123 désactivée
✅ Prêt pour une nouvelle session
```

## 🚀 Améliorations futures possibles

- [ ] Garbage collection automatique (supprimer sessions > 30 jours)
- [ ] Export des statistiques avant nettoyage
- [ ] Interface admin pour gérer les sessions
- [ ] Archivage des parties terminées
