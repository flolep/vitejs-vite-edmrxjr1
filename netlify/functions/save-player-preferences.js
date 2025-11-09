const admin = require('firebase-admin');

// Initialiser Firebase Admin une seule fois
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    console.log('✅ Firebase Admin initialisé');
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase Admin:', error);
  }
}

const db = admin.database();

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only POST allowed
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { sessionId, playerId, preferences } = JSON.parse(event.body);

    // Validation
    if (!sessionId || !playerId || !preferences) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'sessionId, playerId et preferences requis' })
      };
    }

    // Valider les préférences
    const { name, age, genres, specialPhrase, photo } = preferences;

    if (!name || typeof name !== 'string' || name.length > 50) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Nom invalide (max 50 caractères)' })
      };
    }

    if (!age || typeof age !== 'number' || age < 1 || age > 120) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Âge invalide (1-120)' })
      };
    }

    if (!Array.isArray(genres) || genres.length === 0 || genres.length > 10) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Genres invalides (1-10)' })
      };
    }

    if (specialPhrase && typeof specialPhrase !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Phrase spéciale invalide' })
      };
    }

    // Vérifier que la session est active
    const sessionRef = db.ref(`sessions/${sessionId}`);
    const sessionSnapshot = await sessionRef.once('value');
    const sessionData = sessionSnapshot.val();

    if (!sessionData || sessionData.active !== true) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Session invalide ou inactive' })
      };
    }

    // Sauvegarder les préférences
    const preferencesRef = db.ref(`sessions/${sessionId}/players_preferences/${playerId}`);
    await preferencesRef.set({
      id: playerId,
      name,
      photo: photo || null,
      age,
      genres,
      specialPhrase: specialPhrase || '',
      timestamp: Date.now(),
      ready: true
    });

    console.log(`✅ Préférences sauvegardées: ${name} (${sessionId})`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Préférences sauvegardées'
      })
    };

  } catch (error) {
    console.error('❌ Erreur:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Erreur serveur',
        details: error.message
      })
    };
  }
};
