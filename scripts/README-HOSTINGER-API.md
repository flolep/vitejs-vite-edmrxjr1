# Vérification des variables Docker Hostinger

Ce script permet de vérifier les variables d'environnement de votre conteneur Docker n8n sur Hostinger.

## 1. Obtenir votre clé API Hostinger

### Via l'interface Hostinger:
1. Connectez-vous à **Hostinger hPanel**
2. Allez dans **VPS** ou **Hosting**
3. Cliquez sur **API** dans le menu latéral
4. Créez une nouvelle clé API
5. Copiez la clé (format: `hpanel_xxxxxxxxx`)

### Permissions requises:
- Docker containers: Read

## 2. Configuration locale

Créez un fichier `.env.local` à la racine du projet:

```bash
# Clé API Hostinger
HOSTINGER_API_KEY=hpanel_votre_cle_ici

# Nom du conteneur Docker (optionnel, par défaut: n8n)
DOCKER_CONTAINER_NAME=n8n
```

**Important:** `.env.local` est dans `.gitignore`, vos clés ne seront jamais commitées.

## 3. Utilisation

```bash
# Vérifier les variables d'environnement du conteneur n8n
node scripts/check-hostinger-docker-env.js
```

## 4. Exemple de sortie

```
🔍 Vérification des variables Docker sur Hostinger...

📦 Récupération des conteneurs Docker...
✅ 3 conteneur(s) trouvé(s)

🔎 Récupération des détails du conteneur n8n...

🐳 Conteneur: n8n
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   N8N_PORT = 5678
   ssl_email = contact@example.com
✅ N8N_WEBHOOK_SECRET = ***xyz9
   PATH = /usr/local/bin:/usr/bin:/bin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ N8N_WEBHOOK_SECRET est configurée
```

## 5. Résolution des problèmes

### Erreur: HOSTINGER_API_KEY manquante
→ Créez le fichier `.env.local` avec votre clé API

### Erreur: API Error 401
→ Votre clé API est invalide ou expirée

### Erreur: Conteneur "n8n" non trouvé
→ Le nom du conteneur est différent. Le script affichera les conteneurs disponibles.

### N8N_WEBHOOK_SECRET n'apparaît pas
→ La variable n'est pas configurée OU le conteneur n'a pas été redémarré après l'ajout

## 6. Note importante

L'API Hostinger peut avoir des limitations selon votre plan d'hébergement. Si l'API ne fonctionne pas, utilisez SSH:

```bash
ssh user@votre-serveur.hostinger.com
docker exec -it n8n env | grep N8N_WEBHOOK_SECRET
```
