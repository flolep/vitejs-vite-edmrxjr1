# Flux d'Authentification Complet - Blind Test

Ce document explique le flux d'authentification complet de l'application Blind Test.

## 🔐 Vue d'ensemble

Il existe **DEUX systèmes d'authentification indépendants** :

1. **Firebase Authentication** : Sécurise l'accès à l'application
2. **Spotify OAuth** : Permet d'accéder aux playlists et à l'API Spotify

## 📊 Diagramme du flux complet

```
┌─────────────────────────────────────────────────────────────────┐
│                    DÉMARRAGE APPLICATION                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              ÉCRAN PRINCIPAL (Home)                              │
│  - 🎮 ANIMATEUR                                                  │
│  - 📱 JOUEUR                                                     │
│  - 📺 TV                                                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
         ANIMATEUR       JOUEUR          TV
              │             │             │
              │             │             │
              ▼             ▼             ▼
```

---

## 🎮 FLUX ANIMATEUR (Master)

### Étape 1 : Authentification Firebase

```
Clic sur "ANIMATEUR"
   ↓
Écran de choix : Nouvelle partie / Reprendre
   ↓
Chargement du composant Master
   ↓
┌──────────────────────────────────┐
│   FIREBASE AUTH (OBLIGATOIRE)    │
│                                  │
│  Si non connecté:                │
│  → Affiche Login.jsx             │
│  → Email + Password              │
│  → Firebase Authentication       │
│                                  │
│  Si connecté:                    │
│  → Continue vers Master          │
└──────────────────────────────────┘
```

**Pourquoi Firebase Auth ?**
- ✅ Sécurise l'accès à Firebase Realtime Database
- ✅ Empêche les accès non autorisés
- ✅ Permet les règles de sécurité Firebase
- ✅ Un seul compte animateur par application

**Code actuel dans Master.jsx :**
```javascript
// Si pas connecté à Firebase, affiche le Login
if (!user) {
  return <Login onLoginSuccess={() => {}} />;
}
```

---

### Étape 2 : Choix du mode de jeu

Une fois connecté à Firebase, l'animateur voit l'interface Master avec **deux modes** :

```
┌─────────────────────────────────────┐
│        INTERFACE MASTER              │
│                                      │
│  📁 MODE MP3 LOCAL                   │
│  - Ajouter des fichiers MP3          │
│  - Pas besoin de Spotify             │
│                                      │
│  🎵 MODE SPOTIFY                     │
│  - Utilise les playlists Spotify    │
│  - Nécessite connexion Spotify      │
└─────────────────────────────────────┘
```

---

### Étape 3 : Si MODE SPOTIFY → Authentification Spotify

```
Clic sur "Se connecter à Spotify"
   ↓
┌──────────────────────────────────┐
│   SPOTIFY OAUTH (OPTIONNEL)     │
│                                  │
│  1. Redirection vers Spotify     │
│  2. Utilisateur autorise l'app   │
│  3. Callback avec code           │
│  4. Échange code → Access Token  │
│  5. Token stocké en sessionStorage│
└──────────────────────────────────┘
   ↓
Récupération du userId Spotify
(ex: "john.doe")
```

**Pourquoi Spotify OAuth ?**
- ✅ Accès aux playlists de l'utilisateur
- ✅ Lecture via Spotify Web Playback SDK
- ✅ Récupération du userId pour créer des playlists

**Code actuel :**
```javascript
const handleSpotifyLogin = () => {
  window.location.href = spotifyService.getAuthUrl();
};
```

---

## ⚠️ PROBLÈME ACTUEL AVEC LE WORKFLOW N8N

### Cas d'usage : Créer une playlist via n8n

**Flux actuel :**
```
1. Utilisateur connecté à Firebase ✅
2. Utilisateur connecté à Spotify ✅
3. App récupère le userId Spotify (ex: "john.doe") ✅
4. App appelle le webhook n8n avec { userId: "john.doe" }
5. n8n crée la playlist avec SES PROPRES credentials Spotify
   ❌ PROBLÈME : La playlist est créée sur le compte Spotify de n8n,
                  PAS sur le compte de l'utilisateur !
```

### 🔴 Le problème

**Dans le workflow n8n actuel :**
- n8n a ses propres credentials Spotify OAuth2 configurés
- Quand n8n crée une playlist, il la crée sur **le compte configuré dans n8n**
- Même si on passe `userId: "john.doe"`, ça ne suffit pas car on n'a pas le token de John

**Résultat :**
- ❌ Toutes les playlists sont créées sur le compte Spotify de n8n (compte "master")
- ❌ L'utilisateur ne voit pas les playlists dans son propre compte

---

## ✅ SOLUTIONS POSSIBLES

### Solution 1 : Compte Spotify Master (SIMPLE)

**Accepter que toutes les playlists soient créées sur un compte Spotify central**

**Avantages :**
- ✅ Simple à mettre en place
- ✅ Le workflow n8n actuel fonctionne tel quel
- ✅ Pas besoin de passer le token utilisateur

**Inconvénients :**
- ❌ Les playlists ne sont pas sur le compte personnel de l'utilisateur
- ❌ Il faut partager les playlists ou donner l'accès au compte

**Utilisation :**
```javascript
// L'userId n'est plus nécessaire
const result = await n8nService.createSpotifyPlaylist(
  'master_account',  // Toujours le même compte
  null,              // Nom auto
  null               // Description auto
);
```

---

### Solution 2 : Passer le token Spotify à n8n (MOYEN)

**Passer l'access token de l'utilisateur au webhook n8n**

**Architecture :**
```
Application
  ↓ Envoie { accessToken: "BQD..." }
Webhook n8n
  ↓ Utilise ce token au lieu de ses credentials
API Spotify
  ↓ Crée la playlist sur le compte de l'utilisateur
```

**Modifications nécessaires :**

1. **Workflow n8n :**
   - Retirer le node Spotify (qui utilise les credentials OAuth2)
   - Ajouter un node HTTP Request pour appeler directement l'API Spotify
   - Utiliser le token passé dans la requête

2. **n8nService.js :**
```javascript
async createSpotifyPlaylist(accessToken, playlistName, description) {
  const payload = {
    accessToken: accessToken,  // Token de l'utilisateur
    playlistName: playlistName,
    description: description
  };
  // ...
}
```

3. **Workflow n8n (exemple) :**
```json
{
  "node": "HTTP Request",
  "method": "POST",
  "url": "https://api.spotify.com/v1/users/{{ $json.userId }}/playlists",
  "authentication": "headerAuth",
  "headerAuth": {
    "name": "Authorization",
    "value": "Bearer {{ $json.accessToken }}"
  }
}
```

**Avantages :**
- ✅ Playlist créée sur le compte de l'utilisateur
- ✅ Pas de configuration OAuth dans n8n

**Inconvénients :**
- ⚠️ Sécurité : Le token transite par le webhook
- ⚠️ Il faut récupérer le userId depuis le token (appel API supplémentaire)

---

### Solution 3 : Créer la playlist côté client (RECOMMANDÉ)

**Ne pas utiliser n8n pour créer la playlist, le faire directement dans l'app**

**Architecture :**
```
Application Frontend
  ↓ Utilise le token Spotify déjà récupéré
  ↓ Appelle directement l'API Spotify
  ↓ POST /v1/users/{userId}/playlists
Spotify API
  ↓ Crée la playlist sur le compte de l'utilisateur
```

**Modifications :**

1. **Créer un nouveau service spotifyService.js :**
```javascript
// Dans spotifyService.js
async createEmptyPlaylist(accessToken, userId, playlistName, description) {
  // 1. Générer le nom automatiquement si besoin
  if (!playlistName) {
    const date = new Date().toISOString().split('T')[0];
    const orderKey = String(Math.floor(Date.now() / 1000) % 1000).padStart(3, '0');
    playlistName = `BlindTest-${date}-${orderKey}`;
  }

  // 2. Créer la playlist
  const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: playlistName,
      description: description || `Playlist créée automatiquement pour Blind Test`,
      public: false
    })
  });

  if (!response.ok) throw new Error('Failed to create playlist');

  const data = await response.json();
  return {
    success: true,
    playlistId: data.id,
    playlistName: data.name,
    playlistUrl: data.external_urls.spotify
  };
}
```

2. **Utilisation dans Master.jsx :**
```javascript
const handleCreatePlaylistAI = async () => {
  try {
    setDebugInfo('⏳ Création de la playlist...');

    // Récupérer l'userId Spotify
    const userId = await spotifyService.getSpotifyUserId(spotifyToken);

    // Créer la playlist directement via l'API Spotify
    const result = await spotifyService.createEmptyPlaylist(
      spotifyToken,
      userId,
      null,  // Nom auto
      null   // Description auto
    );

    console.log('✅ Playlist créée:', result);
    setDebugInfo(`✅ Playlist créée: ${result.playlistName}`);

    // Charger la playlist
    await handleSelectPlaylist(result.playlistId);

  } catch (error) {
    console.error('❌ Erreur:', error);
    setDebugInfo('❌ Erreur création playlist');
  }
};
```

**Avantages :**
- ✅ Playlist créée sur le compte de l'utilisateur
- ✅ Pas besoin de n8n pour cette partie
- ✅ Plus sécurisé (token ne quitte pas le client)
- ✅ Génération du nom côté client (même logique)
- ✅ Moins de dépendances externes

**Inconvénients :**
- ❌ n8n ne sert plus pour créer la playlist vide
- ❌ Mais n8n peut toujours servir pour REMPLIR la playlist avec IA

---

## 🎯 RECOMMANDATION

### Pour créer une PLAYLIST VIDE :
**→ Solution 3 : Créer côté client** (dans spotifyService.js)

### Pour REMPLIR la playlist avec IA :
**→ Utiliser n8n** avec workflow :
```
Webhook n8n
  ↓ Reçoit { theme: "Années 80", numberOfTracks: 20, playlistId: "xxx" }
  ↓ Appelle ChatGPT/Claude pour générer liste
  ↓ Recherche chaque chanson sur Spotify (avec credentials n8n)
  ↓ Ajoute les tracks à la playlist (avec credentials n8n)
  ↓ Retourne la liste des tracks ajoutés
```

**Avec cette approche :**
- ✅ Playlist créée sur le compte utilisateur (côté client)
- ✅ IA utilisée pour générer la liste (via n8n)
- ✅ n8n peut rechercher et ajouter les tracks (avec ses credentials)

---

## 📝 Résumé du flux recommandé

```
1. Firebase Auth (obligatoire)
   → Sécurise l'accès à l'app

2. Choix du mode
   → MP3 local : Pas besoin de Spotify
   → Spotify : Nécessite connexion Spotify

3. Spotify OAuth (si mode Spotify)
   → Accès aux playlists
   → Récupération userId

4. Créer playlist vide (côté client)
   → Via spotifyService.createEmptyPlaylist()
   → Nom auto : BlindTest-2024-10-24-XXX

5. Remplir playlist avec IA (via n8n)
   → Webhook n8n avec theme + playlistId
   → n8n génère liste et ajoute les tracks
```

---

## 🔧 Action à prendre

**Voulez-vous que je :**

1. **Implémente la Solution 3** (créer playlist côté client) ?
   → Je modifie spotifyService.js pour créer la playlist directement

2. **Crée le workflow n8n "Remplir Playlist AI"** ?
   → Nouveau workflow qui prend une playlist vide et la remplit avec ChatGPT

3. **Garde le workflow n8n actuel** avec un compte Spotify master ?
   → Simple mais toutes les playlists sont sur un seul compte

Quelle approche préférez-vous ?
