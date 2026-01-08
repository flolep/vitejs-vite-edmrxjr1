import { useEffect, useRef, useState } from 'react';
import { spotifyService } from '../spotifyService';

/**
 * Hook pour rafraîchir automatiquement le token Spotify
 *
 * @param {string} initialToken - Token Spotify initial
 * @param {Function} onTokenRefreshed - Callback appelé quand le token est rafraîchi
 * @returns {Object} - { token, isRefreshing, error }
 */
export function useSpotifyTokenRefresh(initialToken, onTokenRefreshed) {
  const [token, setToken] = useState(initialToken);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const refreshIntervalRef = useRef(null);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    // Mettre à jour le token si l'initial change
    if (initialToken && initialToken !== token) {
      setToken(initialToken);
    }
  }, [initialToken]);

  /**
   * Rafraîchit le token Spotify
   */
  const refreshToken = async () => {
    // Éviter les refresh multiples simultanés
    if (isRefreshingRef.current) {
      console.log('🔄 Refresh déjà en cours, skip');
      return;
    }

    const refreshTokenValue = localStorage.getItem('spotify_refresh_token');

    if (!refreshTokenValue) {
      console.error('❌ Pas de refresh_token disponible');
      setError('Refresh token manquant');
      return;
    }

    try {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      setError(null);

      console.log('🔄 Rafraîchissement du token Spotify...');
      const tokenData = await spotifyService.refreshAccessToken(refreshTokenValue);

      if (tokenData.access_token) {
        // Mettre à jour le localStorage
        localStorage.setItem('spotify_access_token', tokenData.access_token);

        // Calculer la nouvelle expiration
        const expiresIn = tokenData.expires_in || 3600;
        const expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem('spotify_token_expiry', expiryTime.toString());

        // Si un nouveau refresh_token est fourni, le stocker aussi
        if (tokenData.refresh_token) {
          localStorage.setItem('spotify_refresh_token', tokenData.refresh_token);
        }

        // Mettre à jour le state
        setToken(tokenData.access_token);

        // Appeler le callback
        if (onTokenRefreshed) {
          onTokenRefreshed(tokenData.access_token);
        }

        console.log('✅ Token rafraîchi avec succès');
        console.log(`✅ Nouveau token expire dans ${expiresIn} secondes`);
      } else {
        throw new Error('Pas de access_token dans la réponse');
      }
    } catch (err) {
      console.error('❌ Erreur lors du refresh du token:', err);
      setError(err.message);

      // Si le refresh échoue, nettoyer les tokens
      localStorage.removeItem('spotify_access_token');
      localStorage.removeItem('spotify_refresh_token');
      localStorage.removeItem('spotify_token_expiry');
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  };

  /**
   * Vérifie si le token doit être rafraîchi
   * Rafraîchit 5 minutes avant l'expiration
   */
  const checkAndRefreshToken = () => {
    const tokenExpiry = localStorage.getItem('spotify_token_expiry');

    if (!tokenExpiry) {
      console.log('⚠️ Pas d\'expiration de token trouvée');
      return;
    }

    const now = Date.now();
    const expiry = parseInt(tokenExpiry);
    const timeUntilExpiry = expiry - now;
    const minutesUntilExpiry = Math.floor(timeUntilExpiry / 1000 / 60);

    console.log(`⏱️ Token expire dans ${minutesUntilExpiry} minutes`);

    // Rafraîchir 5 minutes avant l'expiration
    if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
      console.log('🔄 Token expire bientôt, rafraîchissement...');
      refreshToken();
    }
  };

  useEffect(() => {
    if (!token) return;

    // Vérifier immédiatement si le token doit être rafraîchi
    checkAndRefreshToken();

    // Vérifier toutes les minutes
    refreshIntervalRef.current = setInterval(() => {
      checkAndRefreshToken();
    }, 60 * 1000); // 1 minute

    console.log('✅ Surveillance du token Spotify activée (vérification toutes les minutes)');

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        console.log('🛑 Surveillance du token Spotify arrêtée');
      }
    };
  }, [token]);

  return {
    token,
    isRefreshing,
    error,
    refreshToken: refreshToken // Exposer la fonction pour refresh manuel si besoin
  };
}
