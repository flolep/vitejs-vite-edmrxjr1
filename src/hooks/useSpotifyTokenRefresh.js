import { useEffect, useRef, useState } from 'react';
import { spotifyService } from '../spotifyService';

/**
 * Hook pour rafraîchir automatiquement le token Spotify
 *
 * Peut bootstrapper depuis un token null : si initialToken est null mais qu'un
 * refresh_token existe dans localStorage, tente immédiatement un refresh.
 *
 * @param {string|null} initialToken - Token Spotify initial (peut être null)
 * @param {Function} onTokenRefreshed - Callback appelé quand le token est rafraîchi
 * @returns {Object} - { token, isRefreshing, error, refreshToken }
 */
export function useSpotifyTokenRefresh(initialToken, onTokenRefreshed) {
  const [token, setToken] = useState(initialToken);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const refreshIntervalRef = useRef(null);
  const isRefreshingRef = useRef(false);
  const hasBootstrappedRef = useRef(false);

  // Mettre à jour le token si l'initial change (ex: passé depuis un parent)
  useEffect(() => {
    if (initialToken && initialToken !== token) {
      setToken(initialToken);
    }
  }, [initialToken, token]);

  /**
   * Rafraîchit le token Spotify via le refresh_token
   */
  const refreshToken = async () => {
    if (isRefreshingRef.current) {
      console.log('[SpotifyRefresh] Refresh déjà en cours, skip');
      return null;
    }

    const refreshTokenValue = localStorage.getItem('spotify_refresh_token');

    if (!refreshTokenValue) {
      console.error('[SpotifyRefresh] Pas de refresh_token disponible');
      setError('Refresh token manquant');
      return null;
    }

    try {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      setError(null);

      console.log('[SpotifyRefresh] Rafraîchissement du token...');
      const tokenData = await spotifyService.refreshAccessToken(refreshTokenValue);

      if (tokenData.access_token) {
        // Mettre à jour localStorage
        localStorage.setItem('spotify_access_token', tokenData.access_token);
        const expiresIn = tokenData.expires_in || 3600;
        const expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem('spotify_token_expiry', expiryTime.toString());

        // Si un nouveau refresh_token est fourni, le stocker
        if (tokenData.refresh_token) {
          localStorage.setItem('spotify_refresh_token', tokenData.refresh_token);
        }

        // Mettre à jour le state
        setToken(tokenData.access_token);

        // Callback
        if (onTokenRefreshed) {
          onTokenRefreshed(tokenData.access_token);
        }

        console.log(`[SpotifyRefresh] Token rafraîchi, expire dans ${expiresIn}s`);
        return tokenData.access_token;
      } else {
        throw new Error('Pas de access_token dans la réponse');
      }
    } catch (err) {
      console.error('[SpotifyRefresh] Erreur refresh:', err);
      setError(err.message);
      // En cas d'échec, nettoyer access_token mais PAS le refresh_token
      // (le refresh_token peut encore être valide pour un retry)
      localStorage.removeItem('spotify_access_token');
      localStorage.removeItem('spotify_token_expiry');
      return null;
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  };

  /**
   * Vérifie si le token doit être rafraîchi (5 min avant expiration)
   */
  const checkAndRefreshToken = () => {
    const tokenExpiry = localStorage.getItem('spotify_token_expiry');

    if (!tokenExpiry) return;

    const now = Date.now();
    const expiry = parseInt(tokenExpiry, 10);
    const timeUntilExpiry = expiry - now;

    // Rafraîchir 5 minutes avant l'expiration
    if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
      console.log('[SpotifyRefresh] Token expire bientôt, refresh...');
      refreshToken();
    }
  };

  // Bootstrap : si le token initial est null mais qu'un refresh_token existe, tenter un refresh immédiat
  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    if (!initialToken) {
      const hasRefresh = !!localStorage.getItem('spotify_refresh_token');
      if (hasRefresh) {
        console.log('[SpotifyRefresh] Pas de token initial mais refresh_token disponible, bootstrap...');
        refreshToken();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surveillance périodique : vérifier toutes les minutes si le token doit être rafraîchi
  useEffect(() => {
    if (!token) return;

    // Vérifier immédiatement
    checkAndRefreshToken();

    // Vérifier toutes les minutes
    refreshIntervalRef.current = setInterval(checkAndRefreshToken, 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return {
    token,
    isRefreshing,
    error,
    refreshToken
  };
}
