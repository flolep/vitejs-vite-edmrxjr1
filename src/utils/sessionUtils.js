/**
 * Normalise un sessionId pour l'affichage
 *
 * Si c'est un ancien format long (session_xxxxx_yyy), extrait un code court
 * Si c'est déjà un code court (6 caractères), le retourne tel quel
 *
 * @param {string} sessionId - Le sessionId à normaliser
 * @returns {string} - Le code court (6 caractères en majuscules)
 */
export function normalizeSessionId(sessionId) {
  if (!sessionId) return '';

  // Si c'est déjà un code court (6 caractères alphanumériques)
  if (/^[A-Z0-9]{6}$/.test(sessionId)) {
    return sessionId;
  }

  // Si c'est un ancien format long (session_timestamp_random)
  if (sessionId.startsWith('session_')) {
    // Extraire les derniers caractères pour créer un code court
    const parts = sessionId.split('_');
    if (parts.length >= 3) {
      // Prendre les 6 premiers caractères de la partie aléatoire et les mettre en majuscules
      const randomPart = parts[parts.length - 1];
      return randomPart.substring(0, 6).toUpperCase();
    }
  }

  // Fallback : prendre les 6 premiers caractères alphanumériques
  const cleaned = sessionId.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.substring(0, 6).toUpperCase();
}

/**
 * Obtient le code de session court pour l'affichage
 * Alias de normalizeSessionId pour plus de clarté
 */
export function getSessionCode(sessionId) {
  return normalizeSessionId(sessionId);
}
