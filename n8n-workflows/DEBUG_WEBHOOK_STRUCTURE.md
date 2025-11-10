# 🔍 DEBUG URGENT : Voir exactement ce que le webhook reçoit

## Problème

Le `playlistId` n'est pas accessible avec les syntaxes habituelles. Il faut **voir exactement la structure des données** que le webhook reçoit.

---

## 🛠️ ÉTAPE 1 : Ajouter un nœud de debug

**Dans n8n, ajoutez un nœud Code juste après "Batch Player Input Webhook" :**

1. Cliquez sur le petit `+` entre "Batch Player Input Webhook" et "Format Batch Data"
2. Cherchez "Code"
3. Ajoutez un nœud **Code**
4. Nommez-le "DEBUG - Structure Webhook"

**Code à mettre dans le nœud :**

```javascript
// DEBUG : Voir TOUTE la structure reçue
const inputData = $input.first();

console.log('═══════════════════════════════════════');
console.log('🔍 DEBUG WEBHOOK - STRUCTURE COMPLÈTE');
console.log('═══════════════════════════════════════');

console.log('\n📦 FULL INPUT:');
console.log(JSON.stringify(inputData, null, 2));

console.log('\n📦 inputData.json:');
console.log(JSON.stringify(inputData.json, null, 2));

console.log('\n📦 inputData.json.body:');
console.log(JSON.stringify(inputData.json.body, null, 2));

console.log('\n📦 Type de inputData.json.body:');
console.log(typeof inputData.json.body);
console.log(Array.isArray(inputData.json.body) ? '✅ C\'est un Array' : '❌ Ce n\'est PAS un Array');

// Si c'est un objet, lister les clés
if (inputData.json.body && typeof inputData.json.body === 'object') {
  console.log('\n📦 Clés de body:');
  console.log(Object.keys(inputData.json.body));
}

// Essayer différentes façons d'accéder au playlistId
console.log('\n🔑 TENTATIVES D\'ACCÈS AU PLAYLISTID:');
console.log('1. body.playlistId:', inputData.json.body?.playlistId);
console.log('2. body[0]:', inputData.json.body?.[0]);
console.log('3. playlistId direct:', inputData.json.playlistId);
console.log('4. body["playlistId"]:', inputData.json.body?.["playlistId"]);

// Essayer d'accéder aux players
console.log('\n👥 TENTATIVES D\'ACCÈS AUX PLAYERS:');
console.log('1. body.players:', inputData.json.body?.players);
console.log('2. body[1]:', inputData.json.body?.[1]);

console.log('\n═══════════════════════════════════════');
console.log('🔍 FIN DEBUG');
console.log('═══════════════════════════════════════');

// Passer les données au nœud suivant sans modification
return [inputData];
```

---

## 🧪 ÉTAPE 2 : Tester le workflow

1. **Sauvegardez le workflow**
2. **Exécutez le workflow** (depuis l'application ou avec un test)
3. **Ouvrez la console / logs de n8n**
4. **Regardez les logs du nœud "DEBUG - Structure Webhook"**

---

## 📋 ÉTAPE 3 : Me donner les résultats

**Copiez-collez ici ce que vous voyez dans les logs**, en particulier :

1. La section `📦 inputData.json.body:`
2. La section `📦 Clés de body:`
3. La section `🔑 TENTATIVES D'ACCÈS AU PLAYLISTID:`

Avec ça, je pourrai vous donner **la syntaxe exacte** pour accéder au `playlistId`.

---

## 💡 Hypothèses possibles

Selon ce que vous dites ("c'est le 1er enregistrement"), voici ce que je suspecte :

### Hypothèse 1 : body est un Array
```javascript
body = ["37i9dQZF1DXcBWIGoYBM5M", [{...}, {...}]]
// playlistId serait alors : body[0]
// players serait : body[1]
```

### Hypothèse 2 : Structure plate
```javascript
body = {
  "0": "37i9dQZF1DXcBWIGoYBM5M",
  "1": [{...}, {...}]
}
// playlistId serait : body["0"] ou body[0]
```

### Hypothèse 3 : query params
```javascript
// Le playlistId est dans les query params, pas le body
queryParams = { playlistId: "37i9dQZF1DXcBWIGoYBM5M" }
body = { players: [...] }
```

---

## 🚀 Alternative : Test cURL pour voir ce qui est envoyé

**Si vous avez accès au webhook URL, testez directement :**

```bash
curl -X POST https://VOTRE_N8N_URL/webhook/blindtest-batch-playlist \
  -H "Content-Type: application/json" \
  -d '{
    "playlistId": "TEST123",
    "players": [
      {"name": "Test", "age": 25, "genres": ["Pop"], "specialPhrase": "test"}
    ]
  }' -v
```

Et regardez les logs du nœud de debug.

---

## ⚠️ Important

**Ne supprimez pas ce nœud de debug** tant qu'on n'a pas trouvé la bonne syntaxe. Une fois qu'on aura la solution, on le retirera.

---

**Partagez-moi les logs et je vous donnerai la syntaxe exacte à utiliser !**
