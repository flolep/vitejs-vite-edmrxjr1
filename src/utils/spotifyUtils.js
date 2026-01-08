/**
 * Vérifie si le token Spotify stocké est valide (existe et non expiré)
 * @returns {boolean} true si le token existe et n'est pas expiré
 */
export function isSpotifyTokenValid() {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) {
    console.log('🔐 [Spotify] Pas de token trouvé');
    return false;
  }

  const expiryTime = localStorage.getItem('spotify_token_expiry');
  if (!expiryTime) {
    console.log('⚠️ [Spotify] Token trouvé mais pas d\'expiration → considéré invalide');
    return false;
  }

  const now = Date.now();
  const expiry = parseInt(expiryTime, 10);

  if (now >= expiry) {
    console.log('⏱️ [Spotify] Token expiré');
    // Nettoyer les tokens expirés
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
    return false;
  }

  const remainingMinutes = Math.floor((expiry - now) / (1000 * 60));
  console.log(`✅ [Spotify] Token valide - expire dans ${remainingMinutes} minutes`);
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
