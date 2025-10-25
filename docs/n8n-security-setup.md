# Sécurisation du webhook n8n

## 🔒 Pourquoi sécuriser ?

Sans authentification, n'importe qui peut appeler votre webhook n8n et :
- Créer des playlists Spotify en masse
- Abuser de votre compte Spotify
- Saturer votre instance n8n

## 📋 Configuration en 3 étapes

### 1️⃣ Ajouter le token dans Netlify

**Netlify UI** → **Site settings** → **Environment variables** → **Add a variable**

```
Name: N8N_AUTH_TOKEN
Value: 88znh7m0if/LcoL1nPeKPDbLhOuVnSVq
Scopes: All scopes
```

> ⚠️ **Utilisez ce token généré aléatoirement** ou générez le vôtre avec :
> ```bash
> openssl rand -base64 32 | head -c 32
> ```

### 2️⃣ Configurer n8n pour vérifier le token

Dans chaque workflow n8n (create-playlist-simple, blindtest-player-input) :

#### Option A : Avec un nœud "IF" (recommandé)

1. **Après le nœud Webhook**, ajoutez un nœud **"IF"**
2. Configurez la condition :
   ```
   {{ $('Webhook').item.json.headers['x-auth-token'] }}
   equal to
   88znh7m0if/LcoL1nPeKPDbLhOuVnSVq
   ```
3. **Branche TRUE** : Continuez le workflow
4. **Branche FALSE** : Ajoutez un nœud "Respond to Webhook" avec :
   ```json
   {
     "error": "Unauthorized",
     "message": "Invalid authentication token"
   }
   ```
   Status Code: 401

#### Option B : Avec Header Authentication (si supporté)

Dans les paramètres du nœud Webhook :
- **Authentication** : Header Auth
- **Header Name** : `X-Auth-Token`
- **Header Value** : `88znh7m0if/LcoL1nPeKPDbLhOuVnSVq`

### 3️⃣ Tester la sécurité

**Test avec token valide** :
```bash
curl -X POST https://develop--blindtestflolep.netlify.app/.netlify/functions/n8n-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "create-playlist-simple",
    "payload": {"playlistName": "Test"}
  }'
```
✅ Devrait fonctionner (code 200)

**Test sans token (attaque simulée)** :
```bash
curl -X POST https://n8n.srv1038816.hstgr.cloud/webhook/create-playlist-simple \
  -H "Content-Type: application/json" \
  -d '{"playlistName": "Hack"}'
```
✅ Devrait être bloqué (code 401)

## 🔐 Rotation du token

Pour changer le token (recommandé tous les 6 mois) :

1. Générez un nouveau token : `openssl rand -base64 32 | head -c 32`
2. Mettez à jour dans Netlify UI : `N8N_AUTH_TOKEN`
3. Mettez à jour dans tous vos workflows n8n
4. Redéployez Netlify

## ⚠️ Important

- **Ne jamais** commiter le token dans git
- **Ne jamais** partager le token publiquement
- **Stocker** le token uniquement dans Netlify Environment Variables
- **Utiliser** un token différent pour chaque environnement (production/staging)

## 🎯 Architecture finale

```
Frontend (Browser)
    ↓
Netlify Function (/n8n-proxy)
    ↓ (avec header X-Auth-Token: 88znh7m0...)
n8n Webhook (vérifie le token)
    ↓ (si token valide)
Workflow n8n (crée playlist Spotify)
```

**Sans le token, impossible d'atteindre n8n ! 🛡️**
