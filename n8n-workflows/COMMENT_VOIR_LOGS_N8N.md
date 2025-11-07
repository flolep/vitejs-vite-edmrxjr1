# 🔍 Où trouver les logs de n8n

## Méthode 1 : Dans l'interface web de n8n (LA PLUS SIMPLE) ✅

### Étape par étape :

1. **Ouvrez n8n dans votre navigateur** (ex: http://localhost:5678)

2. **Ouvrez votre workflow** "Blindtest Game - BATCH AI Playlist Generator"

3. **Cliquez sur "Execute Workflow"** ou laissez un webhook réel arriver

4. **Attendez que l'exécution se termine** (quelques secondes)

5. **Cliquez sur chaque nœud pour voir les résultats** :
   - Cliquez sur le nœud **"Extract Track URIs"**
   - Dans le panneau qui s'ouvre à droite, vous verrez plusieurs onglets

6. **Cherchez l'onglet ou la section "Logs" / "Output"** :
   - Parfois c'est dans un onglet "Code Output"
   - Parfois il faut cliquer sur "Show Execution Data"
   - Les `console.log()` s'affichent généralement dans la sortie

7. **Copiez tout le texte avec les emojis** (🔍, ✅, ❌, 📦, etc.)

---

## Méthode 2 : Dans la console du serveur n8n

### Si vous avez lancé n8n en ligne de commande :

1. **Ouvrez le terminal où n8n est lancé**

2. **Les logs s'affichent en temps réel** quand le workflow s'exécute

3. **Cherchez les lignes avec** :
   ```
   🔍 Tentative de récupération du playlistId...
   ```

4. **Copiez toute la section entre les barres** :
   ```
   ═══════════════════════════════════════
   ...
   ═══════════════════════════════════════
   ```

### Si n8n tourne en arrière-plan :

```bash
# Voir les logs en temps réel
n8n logs

# Ou si lancé avec Docker
docker logs -f n8n

# Ou si lancé avec pm2
pm2 logs n8n
```

---

## Méthode 3 : Fichiers de logs (si configurés)

Si n8n est configuré pour écrire dans des fichiers :

```bash
# Chercher les fichiers de logs
find ~/.n8n -name "*.log"

# Ou dans le dossier d'installation
cat /var/log/n8n/n8n.log

# Afficher les dernières lignes
tail -f ~/.n8n/logs/n8n.log
```

---

## 🎯 Ce que vous cherchez exactement

Vous devez trouver cette section dans les logs :

```
═══════════════════════════════════════
📦 Processing 50 items from Spotify
✅ Found: Song Name by Artist Name
...
📊 Total tracks found: 50
🔗 Track URIs string length: 2156

🔍 Tentative de récupération du playlistId...
Méthode 1 - webhookData1: {...}
✅ Méthode 1 réussie: body.playlistId = XXXXX

🆔 PlaylistId final récupéré: XXXXX
═══════════════════════════════════════
```

**Copiez toute cette section** (surtout la partie après "🔍 Tentative de récupération du playlistId...")

---

## 📸 Capture d'écran alternative

Si vous ne trouvez pas les logs textuels :

1. **Faites une capture d'écran** de la fenêtre de n8n
2. **Montrez-moi le résultat** du nœud "Extract Track URIs"
3. **Incluez les données d'entrée ET de sortie**

---

## ⚠️ Si aucun log n'apparaît

### Option A : Activer le mode verbose

Relancez n8n avec :
```bash
N8N_LOG_LEVEL=debug n8n start
```

### Option B : Utiliser un nœud différent

Au lieu de `console.log()`, on peut afficher directement dans le output :

**Je vous prépare un code alternatif qui met tout dans le JSON de sortie au lieu des logs.**

Voulez-vous que je crée cette version ?

---

## 🎯 Résumé : Comment procéder

1. ✅ **Méthode recommandée** : Interface web n8n → Exécuter workflow → Cliquer sur "Extract Track URIs" → Voir les logs/output
2. 📋 **Alternative** : Console/terminal où n8n est lancé
3. 📸 **Dernière option** : Capture d'écran de l'exécution

**Partagez-moi ce que vous trouvez et on identifiera le problème !**
