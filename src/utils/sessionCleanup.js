import { ref, set, remove, update } from 'firebase/database';
import { database } from '../firebase';

/**
 * Utilitaire pour nettoyer les données de session
 * Assure qu'une nouvelle partie démarre avec un état propre
 */

/**
 * Désactive une session précédente dans Firebase
 * @param {string} sessionId - ID de la session à désactiver
 */
export async function deactivatePreviousSession(sessionId) {
  if (!sessionId) return;

  try {
    console.log(`🧹 Désactivation de la session ${sessionId}...`);

    const updates = {};
    updates[`sessions/${sessionId}/active`] = false;
    updates[`sessions/${sessionId}/endedAt`] = Date.now();

    await update(ref(database), updates);
    console.log(`✅ Session ${sessionId} désactivée`);
  } catch (error) {
    console.error('Erreur lors de la désactivation de la session:', error);
  }
}

/**
 * Nettoie les données temporaires d'une session
 * Conserve l'historique (buzz_times) mais nettoie les données actives
 * @param {string} sessionId - ID de la session à nettoyer
 */
export async function cleanupSessionData(sessionId) {
  if (!sessionId) return;

  try {
    console.log(`🧹 Nettoyage des données de la session ${sessionId}...`);

    // Nettoyer les données temporaires (joueurs actifs, buzz en cours, etc.)
    const cleanupRefs = [
      `sessions/${sessionId}/buzz`,              // Buzz en cours
      `sessions/${sessionId}/currentSong`,       // Chanson actuelle
      `sessions/${sessionId}/quiz`,              // État du quiz actuel
      `sessions/${sessionId}/showQRCode`         // QR code affiché
    ];

    for (const path of cleanupRefs) {
      await remove(ref(database, path));
    }

    console.log(`✅ Données temporaires de ${sessionId} nettoyées`);
  } catch (error) {
    console.error('Erreur lors du nettoyage des données:', error);
  }
}

/**
 * Nettoie complètement une session (désactivation + nettoyage données)
 * @param {string} sessionId - ID de la session à nettoyer complètement
 * @param {boolean} keepHistory - Garder l'historique des buzz (défaut: true)
 */
export async function fullSessionCleanup(sessionId, keepHistory = true) {
  if (!sessionId) return;

  console.log(`🧹 Nettoyage complet de la session ${sessionId}...`);

  // Désactiver la session
  await deactivatePreviousSession(sessionId);

  // Nettoyer les données temporaires
  await cleanupSessionData(sessionId);

  // Optionnel : nettoyer l'historique complet
  if (!keepHistory) {
    try {
      await remove(ref(database, `sessions/${sessionId}/buzz_times`));
      await remove(ref(database, `sessions/${sessionId}/quiz_answers`));
      await remove(ref(database, `sessions/${sessionId}/quiz_leaderboard`));
      console.log(`✅ Historique de ${sessionId} supprimé`);
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'historique:', error);
    }
  }

  console.log(`✅ Nettoyage complet de ${sessionId} terminé`);
}

/**
 * Nettoie le localStorage des données de session temporaires
 */
export function cleanupLocalStorage() {
  console.log('🧹 Nettoyage du localStorage...');

  // Ne pas supprimer lastSessionId (utile pour "Continuer")
  // Mais nettoyer les autres données temporaires si nécessaire

  const keysToClean = [
    'wizardInProgress'
    // Ajouter d'autres clés temporaires si nécessaire
  ];

  keysToClean.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`✅ Clé ${key} supprimée du localStorage`);
    }
  });
}

/**
 * Prépare une nouvelle session en nettoyant l'ancienne si elle existe
 * @param {string} previousSessionId - ID de la session précédente (optionnel)
 * @param {boolean} fullClean - Faire un nettoyage complet (défaut: false)
 */
export async function prepareNewSession(previousSessionId, fullClean = false) {
  console.log('🧹 Préparation pour une nouvelle session...');

  // Nettoyer le localStorage
  cleanupLocalStorage();

  // Si une session précédente existe, la nettoyer
  if (previousSessionId) {
    if (fullClean) {
      await fullSessionCleanup(previousSessionId, true);
    } else {
      await deactivatePreviousSession(previousSessionId);
    }
  }

  console.log('✅ Prêt pour une nouvelle session');
}
