import { useState, useEffect } from 'react';
import { spotifyService } from '../spotifyService';
import { ref, set, onValue } from 'firebase/database';
import { database } from '../firebase';

/**
 * Hook pour gérer le mode Spotify IA
 * Logique spécifique à la génération automatique de playlist par IA
 */
export function useSpotifyAIMode(spotifyToken, sessionId, musicSource) {
  const [playlistUpdates, setPlaylistUpdates] = useState([]);
  const [spotifyPlayer, setSpotifyPlayer] = useState(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState(null);
  const [songDuration, setSongDuration] = useState(0);
  const [playlist, setPlaylist] = useState([]);

  // Nettoyage du player à la destruction
  useEffect(() => {
    return () => {
      if (spotifyPlayer) {
        console.log('🔌 [AIMode] Déconnexion du player Spotify');
        spotifyPlayer.disconnect();
      }
    };
  }, [spotifyPlayer]);

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
    if (!spotifyToken || !playlistId) {
      console.warn('⚠️ loadPlaylistById: token ou playlistId manquant');
      return []; // Retourner un tableau vide au lieu de undefined
    }

    try {
      const tracks = await spotifyService.getPlaylistTracks(spotifyToken, playlistId);
      setPlaylist(tracks);

      // Écrire la durée de la première chanson dans Firebase
      if (sessionId && tracks && tracks.length > 0) {
        const firstDuration = tracks[0]?.duration || 30;
        const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
        await set(durationRef, firstDuration);
      }

      // Initialiser le player si nécessaire
      await initSpotifyPlayer();

      return tracks;
    } catch (error) {
      console.error('Error loading playlist by ID:', error);
      return []; // Retourner un tableau vide au lieu de lancer une erreur
    }
  };

  // Écouter les mises à jour de la playlist et rafraîchir automatiquement
  useEffect(() => {
    if (!sessionId || !spotifyToken || musicSource !== 'spotify-ai') return;

    console.log('🎧 [SPOTIFY-AI] Écoute des mises à jour activée pour la session', sessionId);

    const updateRef = ref(database, `sessions/${sessionId}/lastPlaylistUpdate`);
    const playlistIdRef = ref(database, `sessions/${sessionId}/playlistId`);

    let lastTimestamp = null;
    let isFirstCallback = true;

    const unsubscribe = onValue(updateRef, async (snapshot) => {
      const updateData = snapshot.val();

      console.log('🔔 [SPOTIFY-AI] Événement reçu de Firebase:', updateData);

      // Le premier callback représente l'état initial
      if (isFirstCallback) {
        isFirstCallback = false;
        if (updateData?.timestamp) {
          lastTimestamp = updateData.timestamp;
          console.log('⏭️ [SPOTIFY-AI] Premier callback ignoré (état initial)');
          return;
        }
      }

      // Traiter les mises à jour
      if (updateData?.timestamp) {
        // Première contribution OU mise à jour suivante
        if (lastTimestamp === null || updateData.timestamp > lastTimestamp) {
          lastTimestamp = updateData.timestamp;

          console.log('🆕 [SPOTIFY-AI] Nouvelle mise à jour détectée:', updateData.playerName, '+', updateData.songsAdded, 'chansons');

          // Ajouter au feed des mises à jour
          setPlaylistUpdates(prev => [{
            playerName: updateData.playerName,
            songsAdded: updateData.songsAdded,
            timestamp: updateData.timestamp,
            time: new Date(updateData.timestamp).toLocaleTimeString()
          }, ...prev].slice(0, 10)); // Garder les 10 dernières MAJ

          // Récupérer l'ID de playlist et recharger automatiquement
          const playlistSnapshot = await new Promise((resolve) => {
            onValue(playlistIdRef, resolve, { onlyOnce: true });
          });

          const playlistId = playlistSnapshot.val();
          if (playlistId) {
            console.log('🔄 [SPOTIFY-AI] Rechargement de la playlist:', playlistId);
            try {
              const tracks = await spotifyService.getPlaylistTracks(spotifyToken, playlistId);
              console.log('✅ [SPOTIFY-AI] Playlist rechargée:', tracks.length, 'chansons');
              setPlaylist(tracks);
            } catch (error) {
              console.error('❌ [SPOTIFY-AI] Erreur rechargement playlist:', error);
            }
          }
        }
      }
    });

    return () => {
      console.log('🔇 [SPOTIFY-AI] Arrêt de l\'écoute des mises à jour');
      unsubscribe();
    };
  }, [sessionId, spotifyToken, musicSource]);

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
    playlist,
    loadPlaylistById,
    checkPersonalBonus,
    initSpotifyPlayer
  };
}
