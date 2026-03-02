/**
 * Vérifie si le token Spotify stocké est valide (existe et non expiré)
 * IMPORTANT: Ne supprime JAMAIS le refresh_token — seul l'access_token expiré est nettoyé
 * @returns {boolean} true si le token existe et n'est pas expiré
 */
export function isSpotifyTokenValid() {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) {
    console.log('[Spotify] Pas de access_token trouvé');
    return false;
  }

  const expiryTime = localStorage.getItem('spotify_token_expiry');
  if (!expiryTime) {
    console.log('[Spotify] Token trouvé mais pas d\'expiration — considéré invalide');
    return false;
  }

  const now = Date.now();
  const expiry = parseInt(expiryTime, 10);

  if (now >= expiry) {
    console.log('[Spotify] Access token expiré, nettoyage (refresh_token conservé)');
    // Ne nettoyer QUE l'access_token et son expiry — JAMAIS le refresh_token
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expiry');
    return false;
  }

  const remainingMinutes = Math.floor((expiry - now) / (1000 * 60));
  console.log(`[Spotify] Token valide — expire dans ${remainingMinutes} minutes`);
  return true;
}

/**
 * Récupère le token Spotify s'il est valide
 * @returns {string|null} Le token ou null s'il n'est pas valide
 */
export function getValidSpotifyToken() {
  if (isSpotifyTokenValid()) {
    return localStorage.getItem('spotify_access_token');
  }
  return null;
}

/**
 * Vérifie si un refresh_token existe dans localStorage
 * @returns {boolean} true si un refresh_token est disponible pour tenter un renouvellement
 */
export function hasRefreshToken() {
  return !!localStorage.getItem('spotify_refresh_token');
}

/**
 * Récupère le refresh_token depuis localStorage
 * @returns {string|null} Le refresh_token ou null
 */
export function getRefreshToken() {
  return localStorage.getItem('spotify_refresh_token');
}
