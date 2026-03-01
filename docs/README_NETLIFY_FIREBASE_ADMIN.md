# Configuration Firebase Admin SDK pour Netlify Functions

## 🔒 Sécurité

Les préférences des joueurs sont maintenant sauvegardées via une **fonction Netlify sécurisée** qui utilise Firebase Admin SDK.

**Avantages :**
- ✅ Les joueurs ne peuvent PAS écrire directement dans Firebase
- ✅ Validation côté serveur (âge, genres, longueur du nom)
- ✅ Vérification que la session est active avant sauvegarde
- ✅ Protection contre le spam et l'injection

## Variables d'environnement requises

Ajoutez ces variables dans **Netlify Dashboard → Site Settings → Environment Variables** :

```env
FIREBASE_PROJECT_ID=blindtestapp-cd177
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@blindtestapp-cd177.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADA...\n-----END PRIVATE KEY-----
FIREBASE_DATABASE_URL=https://blindtestapp-cd177-default-rtdb.europe-west1.firebasedatabase.app
```

## Comment obtenir les credentials Firebase Admin

### 1. Aller sur Firebase Console

https://console.firebase.google.com/

### 2. Sélectionner votre projet

`blindtestapp-cd177`

### 3. Project Settings → Service Accounts

Cliquer sur l'onglet **"Service accounts"**

### 4. Generate New Private Key

Cliquer sur **"Generate New Private Key"**

Un fichier JSON sera téléchargé qui contient :
```json
{
  "type": "service_account",
  "project_id": "blindtestapp-cd177",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@blindtestapp-cd177.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

### 5. Copier les valeurs dans Netlify

Dans **Netlify → Environment Variables**, créer :

| Variable | Valeur (depuis le JSON) |
|----------|-------------------------|
| `FIREBASE_PROJECT_ID` | Copier `project_id` |
| `FIREBASE_CLIENT_EMAIL` | Copier `client_email` |
| `FIREBASE_PRIVATE_KEY` | Copier `private_key` **tel quel avec les \n** |
| `FIREBASE_DATABASE_URL` | `https://blindtestapp-cd177-default-rtdb.europe-west1.firebasedatabase.app` |

⚠️ **IMPORTANT pour FIREBASE_PRIVATE_KEY** :
- Copier la clé complète avec `-----BEGIN PRIVATE KEY-----` et `-----END PRIVATE KEY-----`
- Garder les `\n` (ne pas les remplacer par de vrais retours à la ligne)
- Exemple : `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADA...\n-----END PRIVATE KEY-----\n`

## Test local (optionnel)

Si vous voulez tester localement :

1. Créer un fichier `.env` à la racine :
```bash
FIREBASE_PROJECT_ID=blindtestapp-cd177
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://blindtestapp-cd177-default-rtdb.europe-west1.firebasedatabase.app
```

2. Installer netlify-cli :
```bash
npm install -g netlify-cli
```

3. Lancer en local :
```bash
netlify dev
```

## Fonction Netlify créée

**`netlify/functions/save-player-preferences.js`**

- Valide les préférences (nom, âge, genres)
- Vérifie que la session est active
- Écrit dans Firebase avec Admin SDK (bypass des règles de sécurité)
- Retourne un succès ou une erreur

## Règles Firebase

```json
"players_preferences": {
  ".read": "session active",
  ".write": false  // ❌ Les joueurs ne peuvent PAS écrire directement
}
```

Seule la fonction Netlify (avec Admin SDK) peut écrire.

## Déploiement

1. **Ajouter les variables d'environnement dans Netlify** (voir ci-dessus)

2. **Déployer les nouvelles règles Firebase** :
```bash
firebase deploy --only database
```

3. **Déployer sur Netlify** :
```bash
git push
```

Netlify détectera automatiquement la nouvelle fonction `save-player-preferences.js` et la déploiera.

## Dépannage

### Erreur "FIREBASE_PRIVATE_KEY is not defined"

Vérifier que la variable est bien définie dans Netlify et que vous avez redéployé le site après l'ajout.

### Erreur "Session invalide ou inactive"

La session doit avoir `active: true` dans Firebase pour que les joueurs puissent sauvegarder leurs préférences.

### Erreur 500 dans la fonction

Vérifier les logs Netlify : **Netlify Dashboard → Functions → save-player-preferences → Logs**

## Workflow complet (sécurisé)

```
1. Joueur → Remplit préférences
2. Joueur → Appelle /.netlify/functions/save-player-preferences
3. Netlify → Valide les données
4. Netlify → Écrit dans Firebase avec Admin SDK ✅
5. Master → Voit les préférences en temps réel
6. Master → Clique "Générer la playlist"
7. Master → Appelle n8n avec toutes les préférences
```

Tout est maintenant sécurisé côté serveur ! 🔒
