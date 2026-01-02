import { useState, useEffect, useMemo, useRef } from 'react';
import { spotifyService } from '../spotifyService';
import { ref, set } from 'firebase/database';
import { database } from '../firebase';

/**
 * Hook pour gérer le mode Spotify Autonome
 * Logique spécifique à l'import de playlists Spotify existantes
 */
export function useSpotifyAutoMode(spotifyToken, sessionId) {
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [spotifyPlayer, setSpotifyPlayer] = useState(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState(null);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [songDuration, setSongDuration] = useState(0);
  const initializingRef = useRef(false);

  // Charger les playlists de l'utilisateur
  useEffect(() => {
    if (!spotifyToken) return;

    const loadPlaylists = async () => {
      try {
        const allPlaylists = await spotifyService.getUserPlaylists(spotifyToken);
        setSpotifyPlaylists(allPlaylists);
      } catch (error) {
        console.error('Error loading playlists:', error);
      }
    };

    loadPlaylists();
  }, [spotifyToken]);

  // Initialiser le player Spotify
  const initSpotifyPlayer = async () => {
    if (!spotifyToken || spotifyPlayer || initializingRef.current) return;

    initializingRef.current = true;
    try {
      const player = await spotifyService.initPlayer(
        spotifyToken,
        (deviceId) => setSpotifyDeviceId(deviceId),
        (state) => {
          if (state) {
            setSongDuration(state.duration / 1000);
          }
        }
      );
      setSpotifyPlayer(player);
    } catch (error) {
      console.error('Error initializing Spotify player:', error);
      initializingRef.current = false;
    }
  };

  // Nettoyer le player lors du démontage
  useEffect(() => {
    return () => {
      if (spotifyPlayer) {
        console.log('🧹 [SPOTIFY-AUTO] Déconnexion du player Spotify lors du démontage');
        spotifyPlayer.disconnect();
      }
    };
  }, [spotifyPlayer]);

  const handleSelectPlaylist = async (playlistId, setPlaylist, resetScores) => {
    try {
      const tracks = await spotifyService.getPlaylistTracks(spotifyToken, playlistId);

      setPlaylist(tracks);
      setShowPlaylistSelector(false);

      // Stocker l'ID de playlist et la durée de la première chanson dans Firebase
      if (sessionId) {
        const playlistIdRef = ref(database, `sessions/${sessionId}/playlistId`);
        await set(playlistIdRef, playlistId);

        // Écrire la durée de la première chanson
        if (tracks && tracks.length > 0) {
          const firstDuration = tracks[0]?.duration || 30;
          const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
          await set(durationRef, firstDuration);
        }
      }

      // Initialiser le player si nécessaire
      await initSpotifyPlayer();

      // Réinitialiser les scores
      if (resetScores) {
        resetScores();
      }

      return tracks;
    } catch (error) {
      console.error('Error importing playlist:', error);
      throw error;
    }
  };

  return useMemo(() => ({
    spotifyPlaylists,
    spotifyPlayer,
    spotifyDeviceId,
    showPlaylistSelector,
    songDuration,
    setShowPlaylistSelector,
    handleSelectPlaylist,
    initSpotifyPlayer
  }), [spotifyPlaylists, spotifyPlayer, spotifyDeviceId, showPlaylistSelector, songDuration]);
}
