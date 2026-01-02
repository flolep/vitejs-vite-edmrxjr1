#!/usr/bin/env node

/**
 * Script pour vérifier les variables d'environnement Docker sur Hostinger
 * Usage: node scripts/check-hostinger-docker-env.js
 */

const https = require('https');

// Configuration
const HOSTINGER_API_KEY = process.env.HOSTINGER_API_KEY;
const CONTAINER_NAME = process.env.DOCKER_CONTAINER_NAME || 'n8n';

if (!HOSTINGER_API_KEY) {
  console.error('❌ HOSTINGER_API_KEY manquante');
  console.error('Ajoutez-la dans .env : HOSTINGER_API_KEY=votre_cle');
  process.exit(1);
}

/**
 * Appel API Hostinger
 */
function callHostingerAPI(endpoint, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.hostinger.com',
      port: 443,
      path: `/v1${endpoint}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${HOSTINGER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (err) {
          reject(new Error(`Parse Error: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * Récupère les conteneurs Docker
 */
async function getDockerContainers() {
  try {
    const response = await callHostingerAPI('/docker/containers');
    return response.data || [];
  } catch (error) {
    throw new Error(`Erreur lors de la récupération des conteneurs: ${error.message}`);
  }
}

/**
 * Récupère les détails d'un conteneur spécifique
 */
async function getContainerDetails(containerId) {
  try {
    const response = await callHostingerAPI(`/docker/containers/${containerId}`);
    return response.data || {};
  } catch (error) {
    throw new Error(`Erreur lors de la récupération des détails: ${error.message}`);
  }
}

/**
 * Affiche les variables d'environnement
 */
function displayEnvVars(envVars, containerName) {
  console.log(`\n🐳 Conteneur: ${containerName}`);
  console.log('━'.repeat(60));

  if (!envVars || envVars.length === 0) {
    console.log('⚠️  Aucune variable d'environnement trouvée');
    return;
  }

  envVars.forEach(env => {
    // Format peut être "KEY=VALUE" ou objet {name, value}
    if (typeof env === 'string') {
      const [key, ...valueParts] = env.split('=');
      const value = valueParts.join('=');

      // Masquer les valeurs sensibles
      const displayValue = key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD')
        ? '***' + value.slice(-4)
        : value;

      // Highlight N8N_WEBHOOK_SECRET
      const icon = key === 'N8N_WEBHOOK_SECRET' ? '✅' : '  ';
      console.log(`${icon} ${key} = ${displayValue}`);
    } else if (env.name) {
      const displayValue = env.name.includes('SECRET') || env.name.includes('KEY')
        ? '***' + (env.value || '').slice(-4)
        : env.value;

      const icon = env.name === 'N8N_WEBHOOK_SECRET' ? '✅' : '  ';
      console.log(`${icon} ${env.name} = ${displayValue}`);
    }
  });

  console.log('━'.repeat(60));
}

/**
 * Main
 */
async function main() {
  console.log('🔍 Vérification des variables Docker sur Hostinger...\n');

  try {
    // Récupérer tous les conteneurs
    console.log('📦 Récupération des conteneurs Docker...');
    const containers = await getDockerContainers();

    if (containers.length === 0) {
      console.log('⚠️  Aucun conteneur trouvé');
      return;
    }

    console.log(`✅ ${containers.length} conteneur(s) trouvé(s)\n`);

    // Trouver le conteneur n8n
    const n8nContainer = containers.find(c =>
      c.name === CONTAINER_NAME ||
      c.name.includes(CONTAINER_NAME) ||
      (c.names && c.names.some(n => n.includes(CONTAINER_NAME)))
    );

    if (!n8nContainer) {
      console.log(`⚠️  Conteneur "${CONTAINER_NAME}" non trouvé`);
      console.log('\nConteneurs disponibles:');
      containers.forEach(c => console.log(`  - ${c.name || c.Names?.[0] || c.id}`));
      return;
    }

    // Récupérer les détails du conteneur
    const containerId = n8nContainer.id || n8nContainer.Id;
    console.log(`🔎 Récupération des détails du conteneur ${CONTAINER_NAME}...`);

    const details = await getContainerDetails(containerId);

    // Afficher les variables d'environnement
    const envVars = details.Env || details.Config?.Env || [];
    displayEnvVars(envVars, CONTAINER_NAME);

    // Vérifier si N8N_WEBHOOK_SECRET existe
    const hasWebhookSecret = envVars.some(env => {
      if (typeof env === 'string') {
        return env.startsWith('N8N_WEBHOOK_SECRET=');
      }
      return env.name === 'N8N_WEBHOOK_SECRET';
    });

    if (hasWebhookSecret) {
      console.log('\n✅ N8N_WEBHOOK_SECRET est configurée');
    } else {
      console.log('\n❌ N8N_WEBHOOK_SECRET n\'est PAS configurée');
      console.log('💡 Ajoutez-la dans l\'interface Hostinger et redémarrez le conteneur');
    }

  } catch (error) {
    console.error(`\n❌ Erreur: ${error.message}`);
    console.error('\n💡 Vérifiez:');
    console.error('  - Votre clé API Hostinger est valide');
    console.error('  - Vous avez les permissions sur les conteneurs Docker');
    console.error('  - L\'API Hostinger est accessible');
    process.exit(1);
  }
}

main();
