import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getValidSpotifyToken, getRefreshToken } from '../utils/spotifyUtils';
import { spotifyService } from '../spotifyService';
import { spotifyStorage } from '../utils/storage';

const SpotifyTokenContext = createContext(null);

export function SpotifyTokenProvider({ children }) {
  const [spotifyToken, setSpotifyToken] = useState(() => getValidSpotifyToken());
  const isRefreshingRef = useRef(false);
  const refreshIntervalRef = useRef(null);

  const refreshToken = useCallback(async () => {
    if (isRefreshingRef.current) return null;

    const refreshTokenValue = getRefreshToken();
    if (!refreshTokenValue) return null;

    isRefreshingRef.current = true;
    try {
      const tokenData = await spotifyService.refreshAccessToken(refreshTokenValue);

      if (tokenData.access_token) {
        spotifyStorage.setAccessToken(tokenData.access_token);
        const expiresIn = tokenData.expires_in || 3600;
        const expiryTime = Date.now() + (expiresIn * 1000);
        spotifyStorage.setTokenExpiry(expiryTime);

        if (tokenData.refresh_token) {
          spotifyStorage.setRefreshToken(tokenData.refresh_token);
        }

        setSpotifyToken(tokenData.access_token);
        console.log(`[SpotifyContext] Token rafraîchi, expire dans ${expiresIn}s`);
        return tokenData.access_token;
      }
      return null;
    } catch (err) {
      console.error('[SpotifyContext] Erreur refresh:', err);
      spotifyStorage.removeAccessToken();
      spotifyStorage.removeTokenExpiry();
      setSpotifyToken(null);
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  // Bootstrap : si pas de token valide mais refresh_token existe, refresh immédiat
  useEffect(() => {
    if (!spotifyToken && getRefreshToken()) {
      refreshToken();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Surveillance périodique : refresh 5 min avant expiration
  useEffect(() => {
    if (!spotifyToken) return;

    const checkExpiry = () => {
      const tokenExpiry = spotifyStorage.getTokenExpiry();
      if (!tokenExpiry) return;

      const timeUntilExpiry = parseInt(tokenExpiry, 10) - Date.now();
      if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
        refreshToken();
      }
    };

    checkExpiry();
    refreshIntervalRef.current = setInterval(checkExpiry, 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [spotifyToken, refreshToken]);

  return (
    <SpotifyTokenContext.Provider value={{ spotifyToken, setSpotifyToken, refreshToken }}>
      {children}
    </SpotifyTokenContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSpotifyToken = () => useContext(SpotifyTokenContext);
