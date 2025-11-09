import { useState, useEffect } from 'react';
import { spotifyService } from '../spotifyService';
import { ref, set, onValue } from 'firebase/database';
import { database } from '../firebase';

/**
 * Hook pour gérer le mode Spotify IA
 * Logique spécifique à la génération automatique de playlist par IA
 */
export function useSpotifyAIMode(spotifyToken, sessionId, gameMode) {
  const [playlistUpdates, setPlaylistUpdates] = useState([]);
  const [spotifyPlayer, setSpotifyPlayer] = useState(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState(null);
  const [songDuration, setSongDuration] = useState(0);

  // Initialiser le player Spotify
  const initSpotifyPlayer = async () => {
    if (!spotifyToken || spotifyPlayer) return;

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
    }
  };

  // Charger automatiquement la playlist en mode IA quand le token Spotify est disponible
  const loadPlaylistById = async (playlistId, setPlaylist) => {
    if (!spotifyToken || !playlistId) return;

    try {
      const tracks = await spotifyService.getPlaylistTracks(spotifyToken, playlistId);
      setPlaylist(tracks);

      // Initialiser le player si nécessaire
      await initSpotifyPlayer();

      return tracks;
    } catch (error) {
      console.error('Error loading playlist by ID:', error);
      throw error;
    }
  };

  // Écouter les mises à jour de la playlist et rafraîchir automatiquement
  useEffect(() => {
    if (!sessionId || !spotifyToken || gameMode !== 'spotify-ai') return;

    const updateRef = ref(database, `sessions/${sessionId}/lastPlaylistUpdate`);
    const playlistIdRef = ref(database, `sessions/${sessionId}/playlistId`);

    let lastTimestamp = null;
    let isFirstCallback = true;

    const unsubscribe = onValue(updateRef, (snapshot) => {
      const updateData = snapshot.val();

      // Le premier callback représente l'état initial
      if (isFirstCallback) {
        isFirstCallback = false;
        if (updateData?.timestamp) {
          lastTimestamp = updateData.timestamp;
          return;
        }
      }

      // Traiter les mises à jour
      if (updateData?.timestamp) {
        // Première contribution OU mise à jour suivante
        if (lastTimestamp === null || updateData.timestamp > lastTimestamp) {
          lastTimestamp = updateData.timestamp;

          // Ajouter au feed des mises à jour
          setPlaylistUpdates(prev => [{
            playerName: updateData.playerName,
            songsAdded: updateData.songsAdded,
            timestamp: updateData.timestamp,
            time: new Date(updateData.timestamp).toLocaleTimeString()
          }, ...prev].slice(0, 10)); // Garder les 10 dernières MAJ

          // Récupérer l'ID de playlist et recharger
          onValue(playlistIdRef, (playlistSnapshot) => {
            const playlistId = playlistSnapshot.val();
            if (playlistId) {
              // On va laisser le composant parent gérer le rechargement
              // pour éviter la duplication de logique
            }
          }, { onlyOnce: true });
        }
      }
    });

    return () => unsubscribe();
  }, [sessionId, spotifyToken, gameMode]);

  // Vérifier le bonus personnel pour un joueur
  const checkPersonalBonus = async (currentSongUri, buzzData) => {
    if (!currentSongUri || !buzzData?.playerId || !sessionId) {
      return { hasBonus: false, playerName: '' };
    }

    try {
      // Récupérer les chansons associées à ce joueur
      const playerSongsRef = ref(database, `sessions/${sessionId}/playerSongs/${buzzData.playerId}`);
      const snapshot = await new Promise((resolve) => {
        onValue(playerSongsRef, resolve, { onlyOnce: true });
      });
      const playerSongsData = snapshot.val();

      // Vérifier si l'URI de la chanson actuelle est dans les préférences du joueur
      if (playerSongsData?.uris?.includes(currentSongUri)) {
        return {
          hasBonus: true,
          playerName: buzzData.playerName || ''
        };
      }

      return { hasBonus: false, playerName: '' };
    } catch (error) {
      console.error('Erreur vérification bonus personnel:', error);
      return { hasBonus: false, playerName: '' };
    }
  };

  return {
    playlistUpdates,
    spotifyPlayer,
    spotifyDeviceId,
    songDuration,
    loadPlaylistById,
    checkPersonalBonus,
    initSpotifyPlayer
  };
}
