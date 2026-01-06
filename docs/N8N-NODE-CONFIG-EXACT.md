# Configuration exacte du node n8n "Notify Playlist Ready"

## ⚠️ SUIVEZ EXACTEMENT CES INSTRUCTIONS

### 1. Créer le node HTTP Request

- **Type** : HTTP Request
- **Name** : `Notify Playlist Ready`
- **Position** : Après "Add Songs to Playlist1", avant "Format Success Response"

---

### 2. Configuration - Onglet Parameters

#### **Method**
```
POST
```

#### **URL**
**Mode** : Fixed (PAS Expression)

```
https://develop--blindtestflolep.netlify.app/.netlify/functions/notify-playlist-ready
```

#### **Send Body**
✅ Coché

#### **Body Content Type**
```
JSON
```

#### **Specify Body**
```
Using Fields Below
```

---

### 3. Body Parameters

Cliquez sur "Add Parameter" 4 fois pour ajouter 4 champs :

**Paramètre 1 :**
- Name : `sessionId`
- Type : `Expression`
- Value :
```
{{ $node["Batch Player Input Webhook"].json.playlistId.split('-')[0] }}
```

**Paramètre 2 :**
- Name : `playlistId`
- Type : `Expression`
- Value :
```
{{ $node["Batch Player Input Webhook"].json.playlistId }}
```

**Paramètre 3 :**
- Name : `totalSongs`
- Type : `Expression`
- Value :
```
{{ $node["Extract Track URIs"].json.totalFound }}
```

**Paramètre 4 :**
- Name : `secret`
- Type : `Fixed`
- Value : *(Copiez la valeur de `N8N_WEBHOOK_SECRET` depuis Netlify)*
```
VOTRE_SECRET_ICI
```

---

### 4. Headers

Cliquez sur "Add Header" :

- Name : `Content-Type`
- Value : `application/json`

---

### 5. Options

**Timeout** : `10000` (10 secondes)

---

### 6. Connexions

**Entrée** : Add Songs to Playlist1 → Notify Playlist Ready
**Sortie** : Notify Playlist Ready → Format Success Response

---

## ✅ Vérification

### Test manuel de la fonction Netlify

Ouvrez un terminal et testez :

```bash
curl -X POST https://develop--blindtestflolep.netlify.app/.netlify/functions/notify-playlist-ready \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "TEST123",
    "playlistId": "TEST123-1234567890",
    "totalSongs": 50,
    "secret": "VOTRE_SECRET"
  }'
```

**Réponse attendue** :
```json
{
  "success": true,
  "message": "Playlist generation notified successfully",
  "sessionId": "TEST123",
  "totalSongs": 50
}
```

Si vous voyez `{"error": "Unauthorized"}` → Le secret ne correspond pas
Si vous voyez `{"error": "Missing required parameters"}` → Paramètres manquants

---

## 🐛 Dépannage

### Le node n8n devient rouge

1. Vérifiez les logs du node
2. L'erreur la plus courante : `sessionId` undefined → Vérifiez l'expression

### Erreur "Unauthorized" (403)

→ Le secret dans le node n8n ne correspond PAS à `N8N_WEBHOOK_SECRET` dans Netlify

### Erreur "Site not found" (404)

→ L'URL est incorrecte ou la fonction n'est pas déployée sur `develop`

### Aucune erreur mais Firebase ne reçoit rien

1. Vérifiez les logs Netlify : Functions → notify-playlist-ready → Logs
2. L'appel arrive-t-il ? Si oui, quel message ?
3. Vérifiez les variables `FIREBASE_ADMIN_*` dans Netlify

---

## 📝 Notes importantes

- **NE PAS** utiliser `={{ }}` dans les expressions n8n v1.x+
- **TOUJOURS** utiliser `{{ }}` sans le signe `=`
- Le secret doit être **exactement identique** entre n8n et Netlify (attention espaces)
- L'URL doit pointer vers `develop` (pas `main`) pour les tests
