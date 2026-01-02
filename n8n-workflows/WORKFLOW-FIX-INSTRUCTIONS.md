# 🔧 Fix pour le workflow Wrong Answers

## Problème identifié

Le workflow `generate-wrong-answers-v1.0.json` ne retournait qu'**1 seul élément** avec wrongAnswers au lieu de **10 éléments** quand on envoyait un batch de 10 chansons.

**Cause** : Le node "Aggregate Wrong Answers" s'exécutait une fois PAR ITEM au lieu d'une fois POUR TOUS LES ITEMS.

## Solution appliquée

Le fichier JSON a été corrigé avec :
- Paramètre `"executeOnce": true` ajouté
- Code modifié pour utiliser `items` au lieu de `$input.all()`
- Return modifié en objet simple au lieu d'array

## 🚀 Comment réimporter le workflow dans n8n

### Étape 1 : Supprimer l'ancien workflow
1. Allez dans n8n
2. Ouvrez le workflow "Blindtest Game - Generate Wrong Answers v1.0"
3. Supprimez-le

### Étape 2 : Importer le nouveau workflow
1. Dans n8n, cliquez sur **"Import from File"**
2. Sélectionnez `generate-wrong-answers-v1.0.json`
3. Le workflow s'ouvre dans l'éditeur

### Étape 3 : ⚠️ IMPORTANT - Vérifier le node "Aggregate Wrong Answers"
1. Cliquez sur le node **"Aggregate Wrong Answers"**
2. Dans le panneau de droite, cherchez le paramètre **"Mode"** ou **"Run mode"**
3. **Assurez-vous** qu'il est configuré sur : **"Run Once for All Items"**

   ❌ Si c'est "Run Once for Each Item" → CHANGEZ-LE

   ✅ Doit être "Run Once for All Items"

### Étape 4 : Activer le workflow
1. Cliquez sur **"Save"** (en haut à droite)
2. Activez le workflow avec le toggle **"Active"**
3. Vérifiez que le webhook est actif

## 📊 Test du workflow

### Input de test (10 chansons)
```json
{
  "songs": [
    {"artist": "Daft Punk", "title": "Get Lucky", "uri": "spotify:track:xxx1"},
    {"artist": "The Weeknd", "title": "Blinding Lights", "uri": "spotify:track:xxx2"},
    {"artist": "Ed Sheeran", "title": "Shape of You", "uri": "spotify:track:xxx3"},
    {"artist": "Adele", "title": "Hello", "uri": "spotify:track:xxx4"},
    {"artist": "Coldplay", "title": "Viva La Vida", "uri": "spotify:track:xxx5"},
    {"artist": "Queen", "title": "Bohemian Rhapsody", "uri": "spotify:track:xxx6"},
    {"artist": "The Beatles", "title": "Hey Jude", "uri": "spotify:track:xxx7"},
    {"artist": "Michael Jackson", "title": "Billie Jean", "uri": "spotify:track:xxx8"},
    {"artist": "Nirvana", "title": "Smells Like Teen Spirit", "uri": "spotify:track:xxx9"},
    {"artist": "Radiohead", "title": "Creep", "uri": "spotify:track:xxx10"}
  ]
}
```

### Output attendu
```json
{
  "success": true,
  "totalSongs": 10,
  "wrongAnswers": {
    "0": {
      "artist": "Daft Punk",
      "title": "Get Lucky",
      "uri": "spotify:track:xxx1",
      "wrongAnswers": ["Artist A - Song A", "Artist B - Song B", "Artist C - Song C"]
    },
    "1": {
      "artist": "The Weeknd",
      "title": "Blinding Lights",
      "uri": "spotify:track:xxx2",
      "wrongAnswers": ["Artist D - Song D", "Artist E - Song E", "Artist F - Song F"]
    },
    ...
    "9": {
      "artist": "Radiohead",
      "title": "Creep",
      "uri": "spotify:track:xxx10",
      "wrongAnswers": ["Artist X - Song X", "Artist Y - Song Y", "Artist Z - Song Z"]
    }
  }
}
```

**✅ Vérifiez que `wrongAnswers` contient bien 10 clés (0 à 9) et non pas 1 seule !**

## 🐛 Si ça ne fonctionne toujours pas

1. **Vérifiez les logs n8n** dans le node "Aggregate Wrong Answers"
   - Devrait afficher : `📦 Received 10 items to aggregate`
   - Si affiche : `📦 Received 1 items to aggregate` → le mode n'est pas correct

2. **Recréez le node manuellement** :
   - Supprimez le node "Aggregate Wrong Answers"
   - Créez un nouveau node "Code"
   - Configurez-le en mode **"Run Once for All Items"**
   - Copiez le code depuis le JSON
   - Reconnectez les liens

3. **Vérifiez la version de n8n**
   - Le paramètre `"executeOnce"` existe depuis n8n v0.223.0
   - Si version plus ancienne, il faut mettre à jour n8n
