/**
 * Netlify Function : Proxy sécurisé pour l'API Le Trésor
 * Expose le catalogue de chansons sans révéler la clé API côté client
 */

const TRESOR_URL = process.env.TRESOR_URL;
const TRESOR_API_KEY = process.env.TRESOR_API_KEY;

const ALLOWED_ROUTES = ['POST /playlist', 'GET /playlist', 'GET /song/:id'];

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Seules les requêtes POST depuis le frontend
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  if (!TRESOR_URL || !TRESOR_API_KEY) {
    console.error('❌ Missing TRESOR_URL or TRESOR_API_KEY env vars');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server misconfiguration' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { route, method, payload, params } = body;

    if (!route) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing route' })
      };
    }

    // Construire la requête vers Le Trésor
    let url;
    let fetchOptions = {
      headers: {
        'X-API-Key': TRESOR_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    if (route === 'POST /playlist') {
      url = `${TRESOR_URL}/playlist`;
      fetchOptions.method = 'POST';
      fetchOptions.body = JSON.stringify(payload || {});

    } else if (route === 'GET /playlist') {
      const query = new URLSearchParams();
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            query.append(key, value);
          }
        }
      }
      const qs = query.toString();
      url = `${TRESOR_URL}/playlist${qs ? `?${qs}` : ''}`;
      fetchOptions.method = 'GET';

    } else if (route === 'GET /song/:id') {
      const id = params?.id;
      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing song id' })
        };
      }
      url = `${TRESOR_URL}/song/${id}`;
      fetchOptions.method = 'GET';

    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid route: ${route}`, allowed: ALLOWED_ROUTES })
      };
    }

    // Pas de body pour les requêtes GET
    if (fetchOptions.method === 'GET') {
      delete fetchOptions.body;
    }

    console.log(`📤 Tresor proxy: ${route} → ${fetchOptions.method} ${url}`);

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();

    console.log(`📥 Tresor response: ${response.status} (${responseText.length} chars)`);

    // Parser la réponse
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    // Retransmettre le code et le body (y compris erreurs 4xx/5xx)
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('❌ Error in tresor-proxy:', error);
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
