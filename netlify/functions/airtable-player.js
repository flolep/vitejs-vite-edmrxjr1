const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = 'Joueurs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Airtable non configuré' })
    };
  }

  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  };

  // GET /airtable-player?search=prénom → findPlayer
  if (event.httpMethod === 'GET') {
    const searchTerm = event.queryStringParameters?.search || '';
    if (!searchTerm) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Paramètre search manquant' }) };
    }

    const formula = encodeURIComponent(
      `OR(SEARCH(LOWER("${searchTerm}"), LOWER({Prénom})), SEARCH(LOWER("${searchTerm}"), LOWER({Alias})))`
    );

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${formula}&maxRecords=10`,
      { headers: airtableHeaders }
    );

    if (!response.ok) {
      const error = await response.text();
      return { statusCode: response.status, headers, body: JSON.stringify({ error }) };
    }

    const data = await response.json();
    const players = data.records.map(r => ({
      id: r.id,
      name: r.fields['Prénom'] || r.fields['Alias'] || '',
      alias: r.fields['Alias'] || null,
      photo: r.fields['Selfie']?.[0]?.url || null
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ found: players.length > 0, count: players.length, players })
    };
  }

  // POST /airtable-player → createPlayer
  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { name } = body;

    if (!name) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Champ name manquant' }) };
    }

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
      {
        method: 'POST',
        headers: airtableHeaders,
        body: JSON.stringify({
          fields: {
            'Prénom': name,
            'Actif ?': 'Oui'
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { statusCode: response.status, headers, body: JSON.stringify({ error }) };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        id: data.id,
        name: data.fields['Prénom'],
        photo: null
      })
    };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
