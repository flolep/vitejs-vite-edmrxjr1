import { ref, get, remove } from 'firebase/database';
import { database } from '../firebase';

/**
 * Utilitaire de nettoyage Firebase
 * Supprime les anciennes sessions et les données obsolètes
 */

/**
 * Supprime toutes les sessions inactives ou anciennes
 * @param {number} maxAgeHours - Âge maximum des sessions en heures (défaut: 24h)
 * @returns {Promise<{deleted: number, kept: number, errors: string[]}>}
 */
export async function cleanupOldSessions(maxAgeHours = 24) {
  console.log(`🧹 Nettoyage des sessions de plus de ${maxAgeHours}h...`);

  const sessionsRef = ref(database, 'sessions');
  const snapshot = await get(sessionsRef);

  if (!snapshot.exists()) {
    console.log('ℹ️ Aucune session trouvée');
    return { deleted: 0, kept: 0, errors: [] };
  }

  const sessions = snapshot.val();
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convertir en millisecondes

  let deleted = 0;
  let kept = 0;
  const errors = [];

  for (const [sessionId, sessionData] of Object.entries(sessions)) {
    try {
      // Vérifier si la session est active
      const isActive = sessionData.active === true;

      // Estimer l'âge de la session (via le timestamp du dernier buzz ou autre)
      let sessionAge = Infinity;

      // Chercher le timestamp le plus récent dans la session
      if (sessionData.buzz?.timestamp) {
        sessionAge = now - sessionData.buzz.timestamp;
      }

      if (sessionData.buzz_times) {
        const buzzTimes = Object.values(sessionData.buzz_times);
        if (buzzTimes.length > 0) {
          const lastBuzz = Math.max(...buzzTimes.map(b => b.timestamp || 0));
          if (lastBuzz > 0) {
            sessionAge = Math.min(sessionAge, now - lastBuzz);
          }
        }
      }

      if (sessionData.quiz_answers) {
        const allAnswers = Object.values(sessionData.quiz_answers).flatMap(track =>
          Object.values(track || {})
        );
        if (allAnswers.length > 0) {
          const lastAnswer = Math.max(...allAnswers.map(a => a.timestamp || 0));
          if (lastAnswer > 0) {
            sessionAge = Math.min(sessionAge, now - lastAnswer);
          }
        }
      }

      // Décision de suppression
      const shouldDelete = !isActive && sessionAge > maxAge;

      if (shouldDelete) {
        console.log(`🗑️ Suppression session: ${sessionId} (âge: ${Math.round(sessionAge / 1000 / 60)}min)`);
        const sessionRef = ref(database, `sessions/${sessionId}`);
        await remove(sessionRef);
        deleted++;
      } else {
        console.log(`✅ Conservation session: ${sessionId} (active: ${isActive}, âge: ${sessionAge === Infinity ? 'inconnue' : Math.round(sessionAge / 1000 / 60) + 'min'})`);
        kept++;
      }
    } catch (error) {
      console.error(`❌ Erreur lors du traitement de ${sessionId}:`, error);
      errors.push(`${sessionId}: ${error.message}`);
    }
  }

  console.log(`✅ Nettoyage terminé: ${deleted} supprimées, ${kept} conservées`);
  return { deleted, kept, errors };
}

/**
 * Nettoie les données obsolètes dans une session spécifique
 * @param {string} sessionId - ID de la session
 * @returns {Promise<{cleaned: string[], errors: string[]}>}
 */
export async function cleanupSessionData(sessionId) {
  console.log(`🧹 Nettoyage des données obsolètes dans session: ${sessionId}`);

  const sessionRef = ref(database, `sessions/${sessionId}`);
  const snapshot = await get(sessionRef);

  if (!snapshot.exists()) {
    console.log('❌ Session non trouvée');
    return { cleaned: [], errors: ['Session non trouvée'] };
  }

  const sessionData = snapshot.val();
  const cleaned = [];
  const errors = [];

  // Liste des chemins potentiellement obsolètes à vérifier
  const obsoletePaths = [
    // Anciennes structures qui ne sont plus utilisées
    'old_buzz_data',
    'deprecated_scores',
    'temp_data',
    // Données de quiz temporaires qui pourraient rester après un crash
    'quiz_next_song_request', // Nettoyer les requêtes en attente
  ];

  for (const path of obsoletePaths) {
    if (sessionData[path]) {
      try {
        const pathRef = ref(database, `sessions/${sessionId}/${path}`);
        await remove(pathRef);
        cleaned.push(path);
        console.log(`🗑️ Supprimé: ${path}`);
      } catch (error) {
        console.error(`❌ Erreur lors de la suppression de ${path}:`, error);
        errors.push(`${path}: ${error.message}`);
      }
    }
  }

  console.log(`✅ Nettoyage terminé: ${cleaned.length} éléments supprimés`);
  return { cleaned, errors };
}

/**
 * Supprime TOUTES les sessions (pour reset complet en développement)
 * ⚠️ ATTENTION: Utiliser uniquement en développement!
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteAllSessions() {
  console.warn('⚠️ ATTENTION: Suppression de TOUTES les sessions!');

  try {
    const sessionsRef = ref(database, 'sessions');
    await remove(sessionsRef);
    console.log('✅ Toutes les sessions ont été supprimées');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Affiche un rapport sur l'état des sessions
 * @returns {Promise<Object>}
 */
export async function getSessionsReport() {
  const sessionsRef = ref(database, 'sessions');
  const snapshot = await get(sessionsRef);

  if (!snapshot.exists()) {
    return {
      total: 0,
      active: 0,
      inactive: 0,
      teamMode: 0,
      quizMode: 0,
      details: []
    };
  }

  const sessions = snapshot.val();
  const now = Date.now();

  let active = 0;
  let inactive = 0;
  let teamMode = 0;
  let quizMode = 0;
  const details = [];

  for (const [sessionId, sessionData] of Object.entries(sessions)) {
    const isActive = sessionData.active === true;
    const mode = sessionData.playMode || 'team';

    // Calculer l'âge approximatif
    let lastActivity = 0;
    if (sessionData.buzz?.timestamp) lastActivity = Math.max(lastActivity, sessionData.buzz.timestamp);
    if (sessionData.buzz_times) {
      const buzzTimes = Object.values(sessionData.buzz_times);
      const lastBuzz = Math.max(...buzzTimes.map(b => b.timestamp || 0), 0);
      lastActivity = Math.max(lastActivity, lastBuzz);
    }

    const ageMinutes = lastActivity > 0 ? Math.round((now - lastActivity) / 1000 / 60) : null;

    if (isActive) active++;
    else inactive++;

    if (mode === 'team') teamMode++;
    else if (mode === 'quiz') quizMode++;

    details.push({
      sessionId,
      active: isActive,
      mode,
      lastActivityMinutes: ageMinutes,
      hasPlayers: !!(sessionData.players_session),
      hasQuizData: !!(sessionData.quiz_data),
      hasBuzzHistory: !!(sessionData.buzz_times)
    });
  }

  return {
    total: Object.keys(sessions).length,
    active,
    inactive,
    teamMode,
    quizMode,
    details
  };
}
