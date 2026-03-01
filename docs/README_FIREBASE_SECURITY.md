# Configuration de la sécurité Firebase

## Vue d'ensemble

Ce projet utilise Firebase Authentication et des règles de sécurité pour protéger les données de jeu. Chaque partie de Blind Test dispose d'une session unique avec un code à 6 caractères.

## Architecture de sécurité

### 1. Authentification de l'animateur

- L'animateur doit se connecter avec un compte Firebase (email/mot de passe)
- Seuls les utilisateurs authentifiés peuvent créer et gérer des parties
- Le composant `Login` gère la création de compte et la connexion

### 2. Sessions de jeu

Chaque partie génère automatiquement :
- **Session ID** : Code unique à 6 caractères (ex: ABC123)
- **QR Code** : Permet aux joueurs de rejoindre rapidement
- **Structure Firebase** :
  ```
  sessions/
    ABC123/
      createdBy: "uid_animateur"
      createdAt: timestamp
      active: true
      scores/
      players_session/
      buzz/
      currentSong/
      ...
  ```

### 3. Flux de connexion

#### Animateur (Master)
1. Se connecte avec email/mot de passe
2. Une session est automatiquement créée
3. Affiche le QR Code et le code de session
4. Contrôle la partie

#### Joueurs (Buzzer)
1. Scannent le QR Code OU entrent le code manuellement
2. Saisissent leur nom
3. Choisissent leur équipe
4. Jouent sans authentification

#### Écran TV
1. Entre le même code de session que l'animateur
2. Affiche les scores et joueurs en temps réel

## Déploiement des règles de sécurité

### Étape 1 : Installer Firebase CLI

```bash
npm install -g firebase-tools
```

### Étape 2 : Se connecter à Firebase

```bash
firebase login
```

### Étape 3 : Initialiser Firebase (si ce n'est pas déjà fait)

```bash
firebase init database
```

Sélectionnez votre projet : `blindtestapp-cd177`

### Étape 4 : Déployer les règles

```bash
firebase deploy --only database
```

Les règles dans `database.rules.json` seront appliquées à votre Realtime Database.

## Règles de sécurité expliquées

### Lecture (read)
- **Sessions** : Tout le monde peut lire les sessions actives
- **Données de jeu** : Accessibles uniquement si la session est active

### Écriture (write)
- **Création de session** : Uniquement les utilisateurs authentifiés
- **Données de jeu** :
  - L'animateur (créateur) peut modifier les données de contrôle (scores, chanson actuelle, etc.)
  - Tous les participants peuvent écrire dans `buzz`, `players_session` et `chrono` (car le chrono est synchronisé depuis TV)

### Sécurité des données

Les règles garantissent que :
1. ✅ Seul un animateur authentifié peut créer une partie
2. ✅ Les joueurs ne peuvent rejoindre que des sessions actives
3. ✅ Chaque session est isolée des autres
4. ✅ Les données sont protégées après la fin de la partie

## Activation de Firebase Authentication

### Dans la console Firebase :

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet `blindtestapp-cd177`
3. Allez dans **Authentication** > **Sign-in method**
4. Activez **Email/Password**
5. (Optionnel) Configurez des règles de mot de passe fort

## Utilisation

### Créer un compte animateur

1. Aller sur la page Master
2. Cliquer sur "Pas de compte ? Créer un compte"
3. Entrer email et mot de passe (min 6 caractères)
4. Une session sera automatiquement créée après connexion

### Rejoindre une partie (Joueur)

**Option 1 : QR Code**
1. Scanner le QR Code affiché par l'animateur
2. Vous serez redirigé vers `/buzzer?session=ABC123`

**Option 2 : Code manuel**
1. Aller sur `/buzzer`
2. Entrer le code à 6 caractères
3. Cliquer sur "Rejoindre la partie"

### Afficher sur TV

1. Aller sur `/tv`
2. Entrer le code de session
3. L'écran affichera les scores et joueurs en temps réel

## Maintenance

### Nettoyer les anciennes sessions

Il est recommandé de créer une Cloud Function pour supprimer automatiquement les sessions de plus de 24h :

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.cleanOldSessions = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const db = admin.database();
    const sessionsRef = db.ref('sessions');
    const snapshot = await sessionsRef.once('value');

    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    const updates = {};
    snapshot.forEach((child) => {
      const session = child.val();
      if (session.createdAt < oneDayAgo) {
        updates[child.key] = null; // Supprimer
      }
    });

    await sessionsRef.update(updates);
    console.log(`Deleted ${Object.keys(updates).length} old sessions`);
  });
```

## Dépannage

### "Code de session invalide"
- Vérifiez que la session existe dans Firebase Console
- Vérifiez que `active: true`
- Le code est sensible à la casse (toujours en majuscules)

### Impossible de créer une session
- Vérifiez que Firebase Authentication est activé
- Vérifiez que les règles de sécurité sont déployées
- Consultez la console Firebase pour les erreurs

### Les joueurs ne peuvent pas rejoindre
- Vérifiez que la session est active
- Vérifiez que le code est correct
- Regardez la console du navigateur pour les erreurs Firebase

## Support

Pour toute question sur la configuration Firebase, consultez :
- [Documentation Firebase Authentication](https://firebase.google.com/docs/auth)
- [Documentation Realtime Database Rules](https://firebase.google.com/docs/database/security)
