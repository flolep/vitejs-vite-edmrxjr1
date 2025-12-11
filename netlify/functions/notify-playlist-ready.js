const admin = require('firebase-admin');

// Initialize Firebase Admin (une seule fois)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

/**
 * Fonction appelée par n8n pour notifier que la playlist est prête
 * Écrit dans Firebase de manière sécurisée
 */
exports.handler = async (event) => {
  console.log('📥 Requête reçue de n8n');

  // Vérifier que c'est une requête POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { sessionId, playlistId, totalSongs, secret } = JSON.parse(event.body);

    console.log('📦 Données reçues:', { sessionId, playlistId, totalSongs, hasSecret: !!secret });

    // ✅ SÉCURITÉ : Vérifier le secret partagé
    if (!secret || secret !== process.env.N8N_WEBHOOK_SECRET) {
      console.error('❌ Secret invalide ou manquant');
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // ✅ VALIDATION : Vérifier les paramètres requis
    if (!sessionId || !playlistId || totalSongs === undefined) {
      console.error('❌ Paramètres manquants:', { sessionId, playlistId, totalSongs });
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required parameters',
          required: ['sessionId', 'playlistId', 'totalSongs', 'secret']
        })
      };
    }

    // ✅ Écriture sécurisée dans Firebase
    const db = admin.database();
    await db.ref(`sessions/${sessionId}/playlistGeneration`).set({
      status: 'completed',
      playlistId: playlistId,
      totalSongs: parseInt(totalSongs),
      completedAt: Date.now()
    });

    console.log(`✅ Playlist générée notifiée pour session ${sessionId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Playlist generation notified successfully',
        sessionId,
        totalSongs: parseInt(totalSongs)
      })
    };

  } catch (error) {
    console.error('❌ Erreur:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};
