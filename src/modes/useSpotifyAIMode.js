import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { spotifyService } from '../spotifyService';
import { ref, set, onValue } from 'firebase/database';
import { database } from '../firebase';
import { loadStubPlaylist, generateStubPlaylist, persistStubPlaylist } from '../utils/quizStubs';

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
  const initializingRef = useRef(false);

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
  const initSpotifyPlayer = useCallback(async () => {
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
  }, [spotifyToken, spotifyPlayer]);

  // Charger la playlist — bypass Spotify en mode test, relit depuis Firebase
  const loadPlaylistById = useCallback(async (playlistId, setPlaylist) => {
    // En mode test, lire la playlist stub depuis Firebase au lieu d'appeler Spotify
    const isTestMode = localStorage.getItem('quizTestMode') === 'true';

    if (isTestMode && sessionId) {
      console.log('[TEST MODE] loadPlaylistById: bypass Spotify, lecture depuis Firebase...');
      try {
        // 1. Essayer de relire depuis Firebase (session déjà jouée)
        const stubTracks = await loadStubPlaylist(sessionId);
        if (stubTracks && stubTracks.length > 0) {
          setPlaylist(stubTracks);
          console.log(`[TEST MODE] Playlist stub relue depuis Firebase: ${stubTracks.length} chansons`);
          return stubTracks;
        }

        // 2. Fallback : générer une nouvelle playlist stub et la persister
        console.log('[TEST MODE] Aucune stub en Firebase, génération...');
        const result = await generateStubPlaylist({ playlistId, players: [] });
        const generatedTracks = result.songs.map(song => ({
          spotifyUri: song.uri,
          title: song.title,
          artist: song.artist,
          imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23312e81'/%3E%3Ctext x='150' y='140' text-anchor='middle' fill='%23fbbf24' font-size='80'%3E%F0%9F%8E%B5%3C/text%3E%3Ctext x='150' y='200' text-anchor='middle' fill='white' font-size='24' font-family='sans-serif'%3ETest Mode%3C/text%3E%3C/svg%3E",
          duration: 180,
          durationMs: 180000,
          previewUrl: null
        }));

        // Persister pour les reprises futures
        await persistStubPlaylist(sessionId, generatedTracks);
        setPlaylist(generatedTracks);
        console.log(`[TEST MODE] Playlist stub générée et persistée: ${generatedTracks.length} chansons`);
        return generatedTracks;
      } catch (error) {
        console.error('[TEST MODE] Erreur stub playlist:', error);
        return [];
      }
    }

    // Mode production : appel Spotify réel
    if (!spotifyToken || !playlistId) {
      console.warn('[AIMode] loadPlaylistById: token ou playlistId manquant');
      return [];
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
      return [];
    }
  }, [spotifyToken, sessionId, initSpotifyPlayer]);

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
  const checkPersonalBonus = useCallback(async (currentSongUri, buzzData) => {
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
  }, [sessionId]);

  return useMemo(() => ({
    playlistUpdates,
    spotifyPlayer,
    spotifyDeviceId,
    songDuration,
    playlist,
    loadPlaylistById,
    checkPersonalBonus,
    initSpotifyPlayer
  }), [playlistUpdates, spotifyPlayer, spotifyDeviceId, songDuration, playlist, loadPlaylistById, checkPersonalBonus, initSpotifyPlayer]);
}
