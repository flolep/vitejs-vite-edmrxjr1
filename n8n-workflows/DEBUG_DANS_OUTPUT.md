# 🎯 VERSION ALTERNATIVE : Debug directement dans le JSON de sortie

Si vous ne trouvez pas les logs, voici une version qui affiche **tout dans le résultat JSON** visible directement dans n8n.

---

## 📝 Code pour "Extract Track URIs" (VERSION DEBUG OUTPUT)

**Remplacez tout le code du nœud "Extract Track URIs" par celui-ci :**

```javascript
// Aggregate all Spotify track URIs
const allItems = $input.all();
const trackUris = [];
const foundSongs = [];

for (const item of allItems) {
  const track = item.json;

  if (track && track.uri && track.id && track.name) {
    trackUris.push(track.uri);
    foundSongs.push({
      name: track.name,
      artist: track.artists?.[0]?.name || 'Unknown',
      uri: track.uri,
      id: track.id
    });
  }
}

if (trackUris.length === 0) {
  throw new Error(`No valid tracks found`);
}

const trackUrisString = trackUris.join(',');

// ═══════════════════════════════════════
// DEBUG : Tester toutes les méthodes d'accès au playlistId
// ═══════════════════════════════════════

const debugInfo = {
  methode1: { success: false, data: null, playlistId: null, error: null },
  methode2: { success: false, data: null, playlistId: null, error: null },
  methode3: { success: false, data: null, playlistId: null, error: null }
};

let playlistId = null;

// Méthode 1 : Via $('Node').first()
try {
  const webhookData1 = $('Batch Player Input Webhook').first();
  debugInfo.methode1.data = JSON.stringify(webhookData1);

  if (webhookData1?.json?.body?.playlistId) {
    playlistId = webhookData1.json.body.playlistId;
    debugInfo.methode1.success = true;
    debugInfo.methode1.playlistId = playlistId;
  } else if (webhookData1?.json?.playlistId) {
    playlistId = webhookData1.json.playlistId;
    debugInfo.methode1.success = true;
    debugInfo.methode1.playlistId = playlistId;
  }
} catch (e) {
  debugInfo.methode1.error = e.message;
}

// Méthode 2 : Via $item()
if (!playlistId) {
  try {
    const webhookData2 = $item(0, 0);
    debugInfo.methode2.data = JSON.stringify(webhookData2);

    if (webhookData2?.json?.body?.playlistId) {
      playlistId = webhookData2.json.body.playlistId;
      debugInfo.methode2.success = true;
      debugInfo.methode2.playlistId = playlistId;
    } else if (webhookData2?.json?.playlistId) {
      playlistId = webhookData2.json.playlistId;
      debugInfo.methode2.success = true;
      debugInfo.methode2.playlistId = playlistId;
    }
  } catch (e) {
    debugInfo.methode2.error = e.message;
  }
}

// Méthode 3 : Via $node
if (!playlistId) {
  try {
    const webhookData3 = $node["Batch Player Input Webhook"];
    debugInfo.methode3.data = JSON.stringify(webhookData3);

    if (webhookData3?.json?.body?.playlistId) {
      playlistId = webhookData3.json.body.playlistId;
      debugInfo.methode3.success = true;
      debugInfo.methode3.playlistId = playlistId;
    } else if (webhookData3?.json?.playlistId) {
      playlistId = webhookData3.json.playlistId;
      debugInfo.methode3.success = true;
      debugInfo.methode3.playlistId = playlistId;
    }
  } catch (e) {
    debugInfo.methode3.error = e.message;
  }
}

// Retourner tout, y compris le debug
return [{
  json: {
    // Données normales
    trackUris: trackUris,
    trackUrisString: trackUrisString,
    trackIds: trackUris.map(uri => uri.split(':')[2]),
    foundSongs: foundSongs,
    totalFound: trackUris.length,
    playlistId: playlistId,

    // ✨ DEBUG INFO - visible directement dans l'output
    DEBUG: {
      playlistIdFinal: playlistId,
      playlistIdIsNull: playlistId === null,
      methode1: debugInfo.methode1,
      methode2: debugInfo.methode2,
      methode3: debugInfo.methode3
    }
  }
}];
```

---

## 🔍 Comment voir le résultat

1. **Exécutez le workflow**

2. **Cliquez sur le nœud "Extract Track URIs"**

3. **Dans le panneau de droite, regardez le JSON de sortie**

4. **Cherchez la section "DEBUG"** qui contient :
   ```json
   {
     "DEBUG": {
       "playlistIdFinal": "...",
       "playlistIdIsNull": false,
       "methode1": {
         "success": true,
         "playlistId": "54Tfvba3cbYIFvqnTC1YE0",
         "data": "...",
         "error": null
       },
       "methode2": { ... },
       "methode3": { ... }
     }
   }
   ```

5. **Copiez-collez ici toute la section "DEBUG"**

---

## 📸 Ou faites une capture d'écran

Si c'est plus simple, faites juste une capture d'écran de la fenêtre n8n montrant le résultat du nœud "Extract Track URIs" avec la section DEBUG visible.

---

## ✅ Avantages de cette méthode

- ✅ Pas besoin de chercher les logs
- ✅ Tout est visible directement dans l'interface n8n
- ✅ On peut copier-coller facilement le JSON
- ✅ Fonctionne même si les console.log() ne s'affichent pas

---

**Utilisez cette version si vous ne trouvez pas les logs console !**
