/**
 * Netlify Function : Proxy pour les appels n8n
 * Contourne les problèmes CORS en agissant comme intermédiaire
 * Sécurisé par un token d'authentification
 */

const N8N_BASE_URL = 'https://n8n.srv1038816.hstgr.cloud/webhook';
const N8N_AUTH_TOKEN = process.env.N8N_AUTH_TOKEN || 'your-secret-token-here';

exports.handler = async (event, context) => {
  // Headers CORS pour autoriser les requêtes depuis le frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Gérer les requêtes preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Seules les requêtes POST sont autorisées
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parser le body de la requête
    const body = JSON.parse(event.body);
    const { endpoint, payload } = body;

    // Valider l'endpoint
    const allowedEndpoints = [
      'create-playlist-simple',
      'create-playlist',
      'blindtest-player-input',
      'blindtest-quiz-mode',      // 🎯 Endpoint pour le mode Quiz
      'blindtest-batch-playlist'  // 🆕 Endpoint pour génération groupée
    ];
    if (!endpoint || !allowedEndpoints.includes(endpoint)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid endpoint' })
      };
    }

    // Construire l'URL n8n
    const n8nUrl = `${N8N_BASE_URL}/${endpoint}`;

    console.log(`📤 Proxying request to n8n: ${n8nUrl}`);

    // Appeler n8n avec authentification
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': N8N_AUTH_TOKEN  // Token de sécurité
      },
      body: JSON.stringify(payload || {})
    });

    const responseText = await response.text();
    let data;

    // Parser la réponse (gérer JSON et texte)
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { raw: responseText };
    }

    if (!response.ok) {
      console.error(`❌ n8n error: ${response.status}`, data);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `n8n returned ${response.status}`,
          details: data
        })
      };
    }

    console.log(`✅ n8n success:`, data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('❌ Error in n8n-proxy:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
