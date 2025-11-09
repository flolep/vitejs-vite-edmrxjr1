# 🔧 CODE COMPLET ET TESTÉ pour "Extract Track URIs"

## Payload reçu par le webhook (confirmé)

```json
{
  "playlistId": "54Tfvba3cbYIFvqnTC1YE0",
  "players": [
    {
      "name": "John",
      "age": 25,
      "genres": ["Pop", "Rock", "Jazz"],
      "specialPhrase": "J'aime danser"
    },
    {
      "name": "Marie",
      "age": 30,
      "genres": ["R&B", "Soul", "Funk"],
      "specialPhrase": "Groove is life"
    }
  ]
}
```

---

## ⚡ CODE COMPLET pour le nœud "Extract Track URIs"

**Remplacez TOUT le code du nœud "Extract Track URIs" par celui-ci :**

```javascript
// Aggregate all Spotify track URIs
const allItems = $input.all();
const trackUris = [];
const foundSongs = [];

console.log('═══════════════════════════════════════');
console.log('📦 Processing', allItems.length, 'items from Spotify');

for (const item of allItems) {
  const track = item.json;

  // The Spotify node returns the track object directly
  if (track && track.uri && track.id && track.name) {
    trackUris.push(track.uri);
    foundSongs.push({
      name: track.name,
      artist: track.artists?.[0]?.name || 'Unknown',
      uri: track.uri,
      id: track.id
    });

    console.log('✅ Found:', track.name, 'by', track.artists?.[0]?.name);
  }
}

console.log('📊 Total tracks found:', trackUris.length);

if (trackUris.length === 0) {
  throw new Error(`No valid tracks found`);
}

// Create comma-separated string of URIs for Spotify node
const trackUrisString = trackUris.join(',');

console.log('🔗 Track URIs string length:', trackUrisString.length);

// ✅ RÉCUPÉRATION DU PLAYLISTID DEPUIS LE WEBHOOK
console.log('\n🔍 Tentative de récupération du playlistId...');

// Essayer plusieurs méthodes
let playlistId = null;

try {
  // Méthode 1 : Via $('Node').first()
  const webhookData1 = $('Batch Player Input Webhook').first();
  console.log('Méthode 1 - webhookData1:', JSON.stringify(webhookData1, null, 2));

  if (webhookData1?.json?.body?.playlistId) {
    playlistId = webhookData1.json.body.playlistId;
    console.log('✅ Méthode 1 réussie: body.playlistId =', playlistId);
  } else if (webhookData1?.json?.playlistId) {
    playlistId = webhookData1.json.playlistId;
    console.log('✅ Méthode 1 réussie: playlistId direct =', playlistId);
  }
} catch (e) {
  console.log('❌ Méthode 1 échouée:', e.message);
}

// Méthode 2 : Via $item()
if (!playlistId) {
  try {
    const webhookData2 = $item(0, 0);
    console.log('Méthode 2 - webhookData2:', JSON.stringify(webhookData2, null, 2));

    if (webhookData2?.json?.body?.playlistId) {
      playlistId = webhookData2.json.body.playlistId;
      console.log('✅ Méthode 2 réussie: body.playlistId =', playlistId);
    } else if (webhookData2?.json?.playlistId) {
      playlistId = webhookData2.json.playlistId;
      console.log('✅ Méthode 2 réussie: playlistId direct =', playlistId);
    }
  } catch (e) {
    console.log('❌ Méthode 2 échouée:', e.message);
  }
}

// Méthode 3 : Via $node
if (!playlistId) {
  try {
    const webhookData3 = $node["Batch Player Input Webhook"];
    console.log('Méthode 3 - webhookData3:', JSON.stringify(webhookData3, null, 2));

    if (webhookData3?.json?.body?.playlistId) {
      playlistId = webhookData3.json.body.playlistId;
      console.log('✅ Méthode 3 réussie: body.playlistId =', playlistId);
    } else if (webhookData3?.json?.playlistId) {
      playlistId = webhookData3.json.playlistId;
      console.log('✅ Méthode 3 réussie: playlistId direct =', playlistId);
    }
  } catch (e) {
    console.log('❌ Méthode 3 échouée:', e.message);
  }
}

console.log('\n🆔 PlaylistId final récupéré:', playlistId);

if (!playlistId) {
  console.log('⚠️ ATTENTION : playlistId est null ou undefined !');
  console.log('Les logs ci-dessus montrent quelle structure est disponible.');
}

console.log('═══════════════════════════════════════\n');

return [{
  json: {
    trackUris: trackUris,
    trackUrisString: trackUrisString,
    trackIds: trackUris.map(uri => uri.split(':')[2]),
    foundSongs: foundSongs,
    totalFound: trackUris.length,
    playlistId: playlistId
  }
}];
```

---

## 🧪 Tester et voir les logs

1. **Remplacez le code du nœud "Extract Track URIs"** avec le code ci-dessus
2. **Sauvegardez**
3. **Exécutez le workflow**
4. **Regardez les logs** dans n8n

Vous verrez exactement :
- Quelle méthode fonctionne (Méthode 1, 2 ou 3)
- La structure exacte des données disponibles
- Le playlistId récupéré

---

## 📋 Résultat attendu

Si tout fonctionne, vous verrez dans les logs :

```
═══════════════════════════════════════
📦 Processing 50 items from Spotify
✅ Found: Song Name by Artist Name
...
📊 Total tracks found: 50
🔗 Track URIs string length: 2156

🔍 Tentative de récupération du playlistId...
Méthode 1 - webhookData1: {...}
✅ Méthode 1 réussie: body.playlistId = 54Tfvba3cbYIFvqnTC1YE0

🆔 PlaylistId final récupéré: 54Tfvba3cbYIFvqnTC1YE0
═══════════════════════════════════════
```

---

## 🎯 Une fois que ça marche

**Dans le nœud "Add Songs to Playlist", utilisez simplement :**

**Playlist ID :**
```
={{ $json.playlistId }}
```

**Tracks :**
```
={{ $json.trackUrisString }}
```

---

## 📨 Partagez-moi les logs

**Copiez-collez ici ce que vous voyez dans la section :**
```
🔍 Tentative de récupération du playlistId...
```

Et je vous dirai quelle méthode utiliser définitivement (et je nettoierai le code pour enlever le debug).
