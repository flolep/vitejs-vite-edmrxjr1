# Guide d'Export de Workflow n8n

## 📤 Comment exporter un workflow depuis n8n

### Méthode 1 : Export via l'interface

1. **Ouvrez votre instance n8n**
2. **Allez dans "Workflows"** dans le menu de gauche
3. **Cliquez sur le workflow** que vous voulez exporter
4. **Cliquez sur le menu "⋮"** (3 points) en haut à droite
5. **Sélectionnez "Download"** ou "Export"
6. Le fichier `.json` sera téléchargé

### Méthode 2 : Export via les paramètres du workflow

1. Ouvrez le workflow dans n8n
2. Cliquez sur **"..."** (menu) en haut à droite
3. Sélectionnez **"Import/Export"** → **"Export"**
4. Le fichier JSON sera téléchargé

### Méthode 3 : Copier le JSON

1. Ouvrez le workflow dans n8n
2. Cliquez sur **"..."** → **"Import/Export"** → **"Copy to Clipboard"**
3. Le JSON est copié dans votre presse-papier
4. Collez-le dans un nouveau fichier `.json`

## 📁 Où placer le fichier exporté

Une fois le workflow exporté, placez le fichier dans :

```
vitejs-vite-edmrxjr1/
  └── n8n-workflows/
      ├── create-playlist.json
      ├── create-playlist-simple.json
      └── fill-playlist-ai.json  ← ICI (ou le nom de votre choix)
```

## 🔍 Vérifier le contenu du fichier

Le fichier JSON devrait ressembler à :

```json
{
  "name": "Fill Playlist with AI",
  "nodes": [
    {
      "parameters": { ... },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      ...
    },
    ...
  ],
  "connections": { ... },
  "active": true
}
```

## ✅ Checklist avant export

- [ ] Le workflow fonctionne correctement dans n8n
- [ ] Les credentials sont bien configurés (mais ne seront PAS exportés)
- [ ] Le workflow est activé
- [ ] Vous avez testé le webhook

## 📝 Informations à me fournir

Après l'export, merci de me fournir :

1. **Le fichier JSON exporté**
2. **Le nom du workflow** (tel qu'affiché dans n8n)
3. **L'URL du webhook** (pour la documentation)
4. **Les paramètres d'entrée** attendus par le webhook
5. **Un exemple de réponse** du workflow

### Exemple d'informations

```
Nom: "Fill Spotify Playlist with AI"
Webhook: /fill-playlist-ai
Paramètres d'entrée:
{
  "theme": "Années 80",
  "numberOfTracks": 20,
  "playlistId": "37i9dQZF1DXcBWIGoYBM5M"
}
Réponse:
{
  "success": true,
  "tracksAdded": 20,
  "tracks": [ ... ]
}
```

## 🚀 Prochaines étapes

Une fois que vous m'aurez fourni le fichier JSON :

1. Je l'intégrerai dans le repo
2. Je créerai la documentation complète
3. Je mettrai à jour le README
4. Je créerai un service JavaScript pour l'appeler depuis l'app
5. Je documenterai l'intégration dans Master.jsx

## 💡 Astuce

Si le fichier est trop gros pour être copié/collé, vous pouvez :
- Le placer directement dans `n8n-workflows/` sur votre PC
- Faire un `git add` et `git commit`
- Me dire que c'est fait et je le verrai dans le repo
