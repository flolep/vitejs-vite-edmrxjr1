const admin = require('firebase-admin');

// Variable pour tracker l'état d'initialisation
let initError = null;

// Initialiser Firebase Admin une seule fois
if (!admin.apps.length) {
  try {
    // Vérifier que les variables d'environnement sont présentes
    if (!process.env.VITE_FIREBASE_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      throw new Error('Variables d\'environnement Firebase Admin manquantes');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      }),
      databaseURL: process.env.VITE_FIREBASE_DATABASE_URL
    });
    console.log('✅ Firebase Admin initialisé');
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase Admin:', error);
    initError = error;
  }
}

// Fonction pour obtenir la base de données
function getDatabase() {
  if (initError) {
    throw new Error(`Firebase Admin non initialisé: ${initError.message}`);
  }
  return admin.database();
}

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

  // Vérifier que Firebase Admin est initialisé
  if (initError) {
    console.error('❌ Firebase Admin non disponible:', initError.message);
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'Service non disponible',
        details: 'Configuration Firebase Admin manquante. Vérifiez les variables d\'environnement: FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_DATABASE_URL'
      })
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
    const db = getDatabase();
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
