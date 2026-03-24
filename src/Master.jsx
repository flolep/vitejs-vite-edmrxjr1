import React, { useState, useRef, useEffect, useMemo } from 'react';
import { database, auth } from './firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { spotifyService } from './spotifyService';
import { n8nService } from './n8nService';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import { deactivatePreviousSession } from './utils/sessionCleanup';
import { getSessionCode } from './utils/sessionUtils';

// Import des hooks
import { useGameSession } from './hooks/useGameSession';
import { useBuzzer } from './hooks/useBuzzer';
import { usePlaylist } from './hooks/usePlaylist';
import { useScoring } from './hooks/useScoring';
import { useMP3Mode } from './modes/useMP3Mode';
import { useSpotifyAutoMode } from './modes/useSpotifyAutoMode';
import { useSpotifyAIMode } from './modes/useSpotifyAIMode';
import { useQuizMode } from './modes/useQuizMode';
import { useSpotifyToken } from './contexts/SpotifyTokenContext';
import { spotifyStorage, prefsStorage, sessionStorage_ } from './utils/storage';
import { createPlayerAdapter } from './services/playerAdapter';

// Import des composants
import Login from './components/Login';
import PlaylistSelector from './components/master/PlaylistSelector';
import BuzzAlert from './components/master/BuzzAlert';
import GameSettings from './components/master/GameSettings';
import GameEndScreen from './components/master/GameEndScreen';
import QuizControls from './components/master/QuizControls';
import QuizLeaderboard from './components/master/QuizLeaderboard';

/**
 * Composant Master refactorisé
 * Utilise les hooks pour une meilleure séparation des responsabilités
 */
export default function Master({
  initialSessionId = null,
  initialMusicSource = null,
  initialPlayMode = null,
  initialGameMode = null,
  initialPlaylist = [],
  initialPlaylistId = null,
  onEndGame = null
}) {
  // États d'authentification et session
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(initialSessionId);

  // Initialisation robuste de musicSource (fallback sur gameMode si nécessaire)
  const [musicSource] = useState(() => {
    if (initialMusicSource) return initialMusicSource;
    if (initialGameMode) {
      if (initialGameMode.startsWith('spotify-auto')) return 'spotify-auto';
      if (initialGameMode.startsWith('spotify-ai')) return 'spotify-ai';
      if (initialGameMode.startsWith('mp3')) return 'mp3';
    }
    return null;
  });

  const [playMode] = useState(initialPlayMode); // 'team' | 'quiz'
  // États UI
  const [showQRCode, setShowQRCode] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [showCooldownSettings, setShowCooldownSettings] = useState(false);
  const [anonymousMode, setAnonymousMode] = useState(playMode === 'quiz');
  const [showDropdown, setShowDropdown] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // États de cooldown
  const [cooldownThreshold, setCooldownThreshold] = useState(2);
  const [cooldownDuration, setCooldownDuration] = useState(5000);

  // États statistiques
  const [buzzStats, setBuzzStats] = useState([]);

  // États Spotify
  const [isPlayerInitializing, setIsPlayerInitializing] = useState(false);

  // État d'attente du token Spotify lors d'une reprise
  const [waitingForSpotifyToken, setWaitingForSpotifyToken] = useState(false);

  // États préférences joueurs (mode Spotify IA)
  const [playersPreferences, setPlayersPreferences] = useState([]);
  const [isGeneratingPlaylist, setIsGeneratingPlaylist] = useState(false);
  const [playlistPollAttempt, setPlaylistPollAttempt] = useState(0);
  const [allQuizPlayers, setAllQuizPlayers] = useState([]); // Joueurs connectés en mode Quiz
  const [testMode] = useState(() => prefsStorage.getTestMode());

  // Token Spotify centralisé via contexte (géré par SpotifyTokenProvider)
  const { spotifyToken } = useSpotifyToken();

  // Hooks communs (logique partagée)
  const {
    scores,
    currentChrono,
    isPlaying,
    currentTrack,
    songDuration,
    currentChronoRef,
    setSongDuration,
    updateScores,
    updateIsPlaying,
    updateCurrentTrack,
    resetChrono,
    updateCurrentSong
  } = useGameSession(sessionId);

  const {
    playlist,
    setPlaylist,
    addTrack,
    updateTrack,
    revealTrack,
    canNavigateNext,
    canNavigatePrev
  } = usePlaylist(initialPlaylist);

  // Hooks spécifiques par mode
  const mp3Mode = useMP3Mode(playlist, setPlaylist, sessionId);

  const spotifyAutoMode = useSpotifyAutoMode(spotifyToken, sessionId, musicSource === 'spotify-auto');

  const spotifyAIMode = useSpotifyAIMode(spotifyToken, sessionId, musicSource, musicSource === 'spotify-ai');

  const quizMode = useQuizMode(sessionId, currentTrack, playlist);

  // Créer le player adapter avec useMemo pour garantir la synchronisation
  // IMPORTANT: Doit être défini AVANT useBuzzer qui l'utilise comme dépendance
  const playerAdapter = useMemo(() => {
    try {
      console.log('🎧 [Master] Tentative création PlayerAdapter pour:', musicSource);

      if (musicSource === 'mp3') {
        if (!mp3Mode || !mp3Mode.audioRef) {
          console.warn('⚠️ [Master] mp3Mode ou audioRef manquant');
          return null;
        }
        return createPlayerAdapter('mp3', { audioRef: mp3Mode.audioRef });
      }

      if (musicSource === 'spotify-auto') {
        if (!spotifyToken) {
          console.log('⏳ [Master] Attente token Spotify');
          return null;
        }
        if (!spotifyAutoMode || !spotifyAutoMode.spotifyDeviceId) {
           console.log('⏳ [Master] Attente deviceId Spotify Auto');
           return null;
        }
        console.log('🎧 [Master] Création PlayerAdapter Spotify Auto', { deviceId: spotifyAutoMode.spotifyDeviceId });
        return createPlayerAdapter('spotify-auto', {
          token: spotifyToken,
          deviceId: spotifyAutoMode.spotifyDeviceId,
          player: spotifyAutoMode.spotifyPlayer
        });
      }

      if (musicSource === 'spotify-ai') {
        if (!spotifyToken) {
          console.log('⏳ [Master] Attente token Spotify');
          return null;
        }
        if (!spotifyAIMode || !spotifyAIMode.spotifyDeviceId) {
           console.log('⏳ [Master] Attente deviceId Spotify IA');
           return null;
        }
        console.log('🎧 [Master] Création PlayerAdapter Spotify IA', { deviceId: spotifyAIMode.spotifyDeviceId });
        return createPlayerAdapter('spotify-ai', {
          token: spotifyToken,
          deviceId: spotifyAIMode.spotifyDeviceId,
          player: spotifyAIMode.spotifyPlayer
        });
      }

      if (musicSource === 'tresor') {
        if (!spotifyToken) {
          console.log('⏳ [Master] Attente token Spotify (tresor)');
          return null;
        }
        if (!spotifyAIMode || !spotifyAIMode.spotifyDeviceId) {
          console.log('⏳ [Master] Attente deviceId Spotify (tresor)');
          return null;
        }
        console.log('🎧 [Master] Création PlayerAdapter Trésor', { deviceId: spotifyAIMode.spotifyDeviceId });
        return createPlayerAdapter('spotify-ai', {
          token: spotifyToken,
          deviceId: spotifyAIMode.spotifyDeviceId,
          player: spotifyAIMode.spotifyPlayer
        });
      }

      return null;
    } catch (error) {
      console.error("❌ Erreur création player adapter:", error);
      return null;
    }
  }, [musicSource, spotifyToken, spotifyAutoMode.spotifyDeviceId, spotifyAutoMode.spotifyPlayer, spotifyAIMode.spotifyDeviceId, spotifyAIMode.spotifyPlayer, mp3Mode.audioRef]);

  const {
    buzzedTeam,
    buzzedPlayerKey,
    buzzedPlayerName,
    buzzedPlayerPhoto,
    setBuzzedTeam,
    clearBuzz,
    unlockAudioContext
  } = useBuzzer(sessionId, isPlaying, currentTrack, playlist, currentChronoRef, updateIsPlaying, playerAdapter);

  const {
    calculatePoints,
    addPointsToTeam,
    markBuzzAsWrong,
    updatePlayerStats
  } = useScoring(sessionId, currentTrack, currentChrono, songDuration, {
    threshold: cooldownThreshold,
    duration: cooldownDuration
  });

  // Gestion de l'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Sauvegarder le sessionId dans localStorage
  useEffect(() => {
    if (sessionId) {
      sessionStorage_.setLastSessionId(sessionId);
    }
  }, [sessionId]);

  // Ref pour empêcher le double chargement de la playlist lors de la reprise
  const hasLoadedPlaylistRef = useRef(false);

  // Charger la playlist lors d'une reprise de session (Resume)
  // La playlist vient soit des props (initialPlaylist), soit on la recharge depuis Spotify (initialPlaylistId)
  useEffect(() => {
    if (!user || !initialSessionId) return;

    // Playlist déjà fournie par MasterFlowContainer
    if (initialPlaylist && initialPlaylist.length > 0) return;

    // Reprise sans playlist — recharger depuis Spotify via playlistId
    if (!initialPlaylistId) return;

    if (!spotifyToken) {
      setWaitingForSpotifyToken(true);
      return;
    }

    if (hasLoadedPlaylistRef.current) return;
    hasLoadedPlaylistRef.current = true;
    setWaitingForSpotifyToken(false);

    console.log('📥 [MASTER] Rechargement playlist depuis Spotify...', { musicSource, initialPlaylistId });

    if (musicSource === 'spotify-ai') {
      spotifyAIMode.loadPlaylistById(initialPlaylistId, setPlaylist)
        .then(tracks => console.log('✅ [MASTER] Playlist Spotify AI rechargée:', tracks?.length))
        .catch(err => {
          console.error('❌ [MASTER] Erreur rechargement playlist AI:', err);
          hasLoadedPlaylistRef.current = false;
        });
    } else {
      spotifyService.getPlaylistTracks(spotifyToken, initialPlaylistId)
        .then(tracks => {
          if (Array.isArray(tracks)) {
            setPlaylist(tracks);
            console.log('✅ [MASTER] Playlist rechargée:', tracks.length);
          } else {
            hasLoadedPlaylistRef.current = false;
          }
        })
        .catch(err => {
          console.error('❌ [MASTER] Erreur rechargement:', err);
          hasLoadedPlaylistRef.current = false;
        });
    }
  }, [initialSessionId, user, spotifyToken]);

  // ✅ Initialiser songDuration dans Firebase pour le NOUVEAU flux (MasterFlowContainer)
  // Quand initialPlaylist est fourni, écrire la durée de la première chanson
  useEffect(() => {
    if (!sessionId || !initialPlaylist || initialPlaylist.length === 0) return;
    if (playlist.length === 0) return; // Attendre que la playlist soit chargée

    // Écrire la durée de la première chanson dans Firebase
    const firstDuration = playlist[0]?.duration || 30;
    const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
    set(durationRef, firstDuration);
    console.log(`✅ [MASTER] Durée initiale écrite dans Firebase: ${firstDuration}s`);
  }, [sessionId, initialPlaylist, playlist.length]);

  // Synchroniser l'état showQRCode avec Firebase
  useEffect(() => {
    if (!sessionId) return;

    const qrCodeRef = ref(database, `sessions/${sessionId}/showQRCode`);
    const unsubscribe = onValue(qrCodeRef, (snapshot) => {
      const show = snapshot.val();
      setShowQRCode(show === true);
    });

    return () => unsubscribe();
  }, [sessionId]);

  // Écouter les préférences des joueurs en mode Spotify IA
  useEffect(() => {
    if (!sessionId || musicSource !== 'spotify-ai') return;

    const preferencesRef = ref(database, `sessions/${sessionId}/players_preferences`);
    const unsubscribe = onValue(preferencesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Filtrer uniquement les joueurs qui sont prêts (ready: true)
        const preferencesList = Object.entries(data)
          .filter(([_, prefs]) => prefs.ready === true)
          .map(([id, prefs]) => ({
            id,
            ...prefs
          }));
        setPlayersPreferences(preferencesList);
        console.log('📋 Préférences des joueurs prêts:', preferencesList.length, 'joueur(s)');
        console.log('📋 Détail des joueurs:', preferencesList.map(p => p.name).join(', '));
      } else {
        setPlayersPreferences([]);
      }
    });

    return () => unsubscribe();
  }, [sessionId, musicSource]);

  // Écouter tous les joueurs connectés (pour mode Quiz - auto-reveal)
  useEffect(() => {
    if (!sessionId || playMode !== 'quiz') return;

    const playersRef = ref(database, `sessions/${sessionId}/players_session/team1`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const playersData = snapshot.val();
      if (playersData) {
        const playersList = Object.entries(playersData)
          .filter(([_, player]) => player.connected) // Seulement les joueurs connectés
          .map(([key, player]) => ({
            id: player.id || key,
            name: player.name,
            photo: player.photo
          }));
        setAllQuizPlayers(playersList);
        console.log(`👥 ${playersList.length} joueur(s) connecté(s) en Quiz`);
      } else {
        setAllQuizPlayers([]);
      }
    });

    return () => unsubscribe();
  }, [sessionId, playMode]);

  // Écouter la révélation des réponses en mode Quiz
  useEffect(() => {
    if (!sessionId || playMode !== 'quiz') return;

    const quizRef = ref(database, `sessions/${sessionId}/quiz`);
    const unsubscribe = onValue(quizRef, (snapshot) => {
      const quizData = snapshot.val();
      // ✅ currentTrack commence à 1, donc accès tableau avec currentTrack - 1
      if (quizData && quizData.revealed && currentTrack !== null && playlist[currentTrack - 1]) {
        const track = playlist[currentTrack - 1];
        // Mettre à jour currentSong avec revealed: true + metadata
        updateCurrentSong({
          title: track.title,
          artist: track.artist,
          imageUrl: track.imageUrl,
          annee: track.annee || null,
          revealed: true,
          number: currentTrack
        });
        // Marquer la piste comme révélée dans le tableau playlist
        // (nécessaire pour que le useEffect auto-end détecte la dernière chanson)
        revealTrack(currentTrack);
      }
    });

    return () => unsubscribe();
  }, [sessionId, playMode, currentTrack, playlist, updateCurrentSong]);

  // Ref pour stocker les fonctions de navigation et lecture (éviter les closures obsolètes)
  const nextTrackRef = useRef(null);
  const togglePlayRef = useRef(null);

  // Mettre à jour les refs à chaque render
  useEffect(() => {
    nextTrackRef.current = nextTrack;
    togglePlayRef.current = togglePlay;
  });

  // Écouter la demande de passage à la chanson suivante par le joueur le plus rapide
  useEffect(() => {
    if (!sessionId || playMode !== 'quiz') return;

    const nextSongRequestRef = ref(database, `sessions/${sessionId}/quiz_next_song_request`);
    let isProcessing = false; // Flag pour éviter les doubles traitements

    const unsubscribe = onValue(nextSongRequestRef, async (snapshot) => {
      const requestData = snapshot.val();
      if (requestData && requestData.timestamp && !isProcessing) {
        isProcessing = true;
        console.log(`➡️ Demande de passage à la chanson suivante par ${requestData.playerName}`);

        try {
          // Supprimer la demande immédiatement (non-bloquant)
          remove(nextSongRequestRef);

          // Passer à la chanson suivante
          if (nextTrackRef.current) {
            nextTrackRef.current();
          }

          // Démarrer la lecture immédiatement (pas de timeout d'attente)
          if (togglePlayRef.current) {
            await togglePlayRef.current();
          }

          console.log('✅ Chanson suivante lancée automatiquement');
        } catch (error) {
          console.error('❌ Erreur lors du passage à la chanson suivante:', error);
        } finally {
          // Reset le flag après un court délai anti-double-clic
          setTimeout(() => {
            isProcessing = false;
          }, 300);
        }
      }
    });

    return () => unsubscribe();
  }, [sessionId, playMode]);

  // Synchroniser showQRCode avec Firebase
  useEffect(() => {
    if (!sessionId) return;

    const qrCodeRef = ref(database, `sessions/${sessionId}/showQRCode`);
    const unsubscribe = onValue(qrCodeRef, (snapshot) => {
      const show = snapshot.val();
      setShowQRCode(show === true);
    });

    return () => unsubscribe();
  }, [sessionId]);

  // Initialisation forcée du player Spotify dès que possible
  useEffect(() => {
    if (spotifyToken) {
      if (musicSource === 'spotify-ai' || musicSource === 'tresor') {
        spotifyAIMode.initSpotifyPlayer();
      } else if (musicSource === 'spotify-auto') {
        spotifyAutoMode.initSpotifyPlayer();
      }
    }
  }, [musicSource, spotifyToken]);

  // === ACTIONS ===

  const handleGeneratePlaylistWithAllPreferences = async () => {
    if (!initialPlaylistId || playersPreferences.length === 0) {
      setDebugInfo('❌ Aucun joueur prêt ou playlist manquante');
      return;
    }

    setIsGeneratingPlaylist(true);
    setDebugInfo('🎵 Génération de la playlist avec toutes les préférences...');

    // Formater les préférences pour n8n
    const players = playersPreferences.map(pref => ({
      name: pref.name,
      age: pref.age,
      genres: pref.genres,
      specialPhrase: pref.specialPhrase || ''
    }));

    console.log('📤 Appel n8n avec', players.length, 'joueur(s)');
    console.log('📤 Détail des joueurs envoyés à n8n:', JSON.stringify(players, null, 2));

    // ⚡ Lancer la génération en arrière-plan sans attendre la réponse
    // Cela évite les timeouts de Netlify Functions (10-26 secondes max)

    // 🎯 Génération de la playlist (Batch) - Même workflow pour Équipe et Quiz
    const generatePlaylistPromise = n8nService.generatePlaylistWithAllPreferences({
      playlistId: initialPlaylistId,
      players: players
    });

    // 🎭 Mode Test : Utiliser directement les chansons stub sans polling Spotify
    if (testMode) {
      console.log('🎭 [TEST MODE] Utilisation directe des chansons stub (skip polling Spotify)');

      generatePlaylistPromise
        .then(result => {
          console.log('✅ Playlist stub générée:', result);
          console.log(`   🎵 ${result.totalSongs} chansons stub pour ${result.totalPlayers || players.length} joueurs`);

          // Convertir les chansons stub au format attendu par setPlaylist
          const stubTracks = result.songs.map((song, index) => ({
            spotifyUri: song.uri,
            title: song.title,
            artist: song.artist,
            imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23312e81'/%3E%3Ctext x='150' y='140' text-anchor='middle' fill='%23fbbf24' font-size='80'%3E%F0%9F%8E%B5%3C/text%3E%3Ctext x='150' y='200' text-anchor='middle' fill='white' font-size='24' font-family='sans-serif'%3ETest Mode%3C/text%3E%3C/svg%3E",
            duration: 180, // 3 minutes en secondes (utilisé pour le calcul des points)
            durationMs: 180000, // 3 minutes en millisecondes (pour compatibilité)
            previewUrl: null
          }));

          setPlaylist(stubTracks);
          setDebugInfo(`✅ [TEST MODE] Playlist stub créée avec ${stubTracks.length} chansons !`);
          setIsGeneratingPlaylist(false);
          setPlaylistPollAttempt(0);

          if (playMode === 'quiz') {
            console.log('   ℹ️ Utilisez le bouton "Générer les questions" pour créer les wrongAnswers');
          }
        })
        .catch(error => {
          console.error('❌ Erreur génération playlist stub:', error);
          setDebugInfo('❌ Erreur lors de la génération de la playlist stub');
          setIsGeneratingPlaylist(false);
          setPlaylistPollAttempt(0);
        });

      return; // Skip le polling Spotify
    }

    // Mode Production : Polling Spotify normal (gardé comme fallback si Firebase ne répond pas)
    generatePlaylistPromise
      .then(result => {
        console.log('✅ Playlist générée (en arrière-plan):', result);
        console.log(`   🎵 ${result.totalSongs} chansons ajoutées pour ${result.totalPlayers || players.length} joueurs`);
        if (playMode === 'quiz') {
          console.log('   ℹ️ La génération des questions suivra automatiquement une fois la playlist prête');
        }
      })
      .catch(error => {
        // Ne pas afficher d'erreur à l'utilisateur car la playlist est déjà créée
        // et continue à se remplir même après le timeout
        console.warn('⚠️ Timeout ou erreur n8n (normal si génération longue):', error.message);
        console.log('   ℹ️ La playlist continue à se générer en arrière-plan sur n8n');
      });

    // Afficher immédiatement le succès
    setDebugInfo(`✅ Génération lancée pour ${players.length} joueur(s) ! La playlist se remplit en arrière-plan...`);
    setPlaylistPollAttempt(0);
    // On garde isGeneratingPlaylist à true pendant le polling

    // ⏰ Polling automatique pour recharger la playlist (Fallback)
    // S'arrête automatiquement quand des chansons sont détectées
    let pollAttempts = 0;
    const maxPollAttempts = 10; // 10 tentatives = 2min30
    const pollInterval = 15000; // 15 secondes

    const pollPlaylist = setInterval(async () => {
      pollAttempts++;
      setPlaylistPollAttempt(pollAttempts);
      console.log(`🔄 Tentative ${pollAttempts}/${maxPollAttempts} de rechargement de la playlist...`);

      // 🔥 IMPORTANT : Vérifier d'abord si on a atteint le max AVANT de faire quoi que ce soit
      if (pollAttempts > maxPollAttempts) {
        console.log('⏱️ Arrêt du polling : nombre max de tentatives dépassé');
        setDebugInfo('⏱️ Génération terminée ou timeout. Rafraîchissez manuellement si la playlist est vide.');
        setIsGeneratingPlaylist(false);
        setPlaylistPollAttempt(0);
        clearInterval(pollPlaylist);
        return;
      }

      try {
        const tracks = await spotifyAIMode.loadPlaylistById(initialPlaylistId, setPlaylist);

        if (tracks && tracks.length > 0) {
          console.log(`✅ Playlist rechargée avec succès : ${tracks.length} chansons détectées`);
          setDebugInfo(`✅ Playlist mise à jour : ${tracks.length} chansons disponibles !`);

          setIsGeneratingPlaylist(false);
          setPlaylistPollAttempt(0);
          clearInterval(pollPlaylist);
        } else if (pollAttempts >= maxPollAttempts) {
          console.log('⏱️ Arrêt du polling : nombre max de tentatives atteint');
          setDebugInfo('⏱️ Génération terminée ou timeout. Rafraîchissez manuellement si la playlist est vide.');
          setIsGeneratingPlaylist(false);
          setPlaylistPollAttempt(0);
          clearInterval(pollPlaylist);
        } else {
          console.log(`⏳ Playlist encore vide, nouvelle tentative dans ${pollInterval / 1000}s...`);
        }
      } catch (error) {
        console.error('❌ Erreur lors du rechargement:', error);
        if (pollAttempts >= maxPollAttempts) {
          console.log('⏱️ Arrêt du polling après erreur : nombre max de tentatives atteint');
          setDebugInfo('⏱️ Erreur lors du rechargement. Rafraîchissez manuellement.');
          setIsGeneratingPlaylist(false);
          setPlaylistPollAttempt(0);
          clearInterval(pollPlaylist);
        }
      }
    }, pollInterval);
  };

  const togglePlay = async () => {
    if (!sessionId) {
      setDebugInfo('❌ Aucune session');
      return;
    }

    // Vérification spécifique pour Spotify
    if ((musicSource === 'spotify-auto' || musicSource === 'spotify-ai' || musicSource === 'tresor') && !spotifyToken) {
      setDebugInfo('⚠️ Spotify non connecté - Veuillez vous reconnecter à Spotify pour lire cette playlist');
      console.error('❌ Token Spotify manquant');
      updateIsPlaying(false);
      return;
    }

    // Si en mode Spotify et player/deviceId manquant, tenter réinitialisation
    if ((musicSource === 'spotify-auto' || musicSource === 'spotify-ai' || musicSource === 'tresor') && !playerAdapter) {
      if (isPlayerInitializing) {
        setDebugInfo('⏳ Initialisation du player en cours...');
        return;
      }

      console.log('⚠️ Player non initialisé, tentative de réinitialisation...');
      setDebugInfo('⏳ Initialisation du player Spotify en cours... Veuillez patienter et réessayer.');

      try {
        // Réinitialiser le player selon le mode
        if (musicSource === 'spotify-auto') {
          await spotifyAutoMode.initSpotifyPlayer();
        } else if (musicSource === 'spotify-ai' || musicSource === 'tresor') {
          await spotifyAIMode.initSpotifyPlayer();
        }

        // On ne bloque pas l'UI, on informe juste l'utilisateur
        updateIsPlaying(false);
        return;
      } catch (error) {
        console.error('❌ Erreur initialisation player:', error);
        setDebugInfo('❌ Erreur initialisation Spotify. Rafraîchissez la page.');
        updateIsPlaying(false);
      }
      return;
    }

    if (!playerAdapter) {
      setDebugInfo('❌ Player non initialisé. Veuillez patienter...');
      return;
    }

    try {
      if (!isPlaying) {
        // Débloquer l'audio du buzzer sur interaction utilisateur
        unlockAudioContext();

        // Activer les cooldowns en attente
        await activatePendingCooldowns();

        // Réinitialiser le buzz
        setBuzzedTeam(null);
        clearBuzz();

        // Play
        // ✅ currentTrack commence à 1, donc accès tableau avec currentTrack - 1
        await playerAdapter.play(playlist[currentTrack - 1], currentTrack);
        updateIsPlaying(true);

        // Écrire la durée de la chanson dans Firebase (important pour le calcul des points)
        const duration = playlist[currentTrack - 1]?.duration || 30;
        const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
        set(durationRef, duration);

        // En mode Quiz, générer les réponses
        if (playMode === 'quiz') {
          quizMode.generateQuizAnswers(currentTrack);
        }

        // Mettre à jour la chanson courante
        updateCurrentSong({
          title: playlist[currentTrack - 1].title,
          artist: playlist[currentTrack - 1].artist,
          imageUrl: playlist[currentTrack - 1].imageUrl,
          revealed: false,
          number: currentTrack // ✅ Pas besoin de + 1 car commence déjà à 1
        });

        setDebugInfo('▶️ Lecture');
      } else {
        // Pause
        await playerAdapter.pause();
        updateIsPlaying(false);
        setDebugInfo('⏸️ Pause');
      }
    } catch (error) {
      console.error('Erreur lecture:', error);
      setDebugInfo(`❌ Erreur: ${error.message}`);
      // Réinitialiser isPlaying en cas d'erreur
      updateIsPlaying(false);
    }
  };

  const activatePendingCooldowns = async () => {
    const teams = ['team1', 'team2'];

    for (const teamKey of teams) {
      const playersRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}`);
      const snapshot = await new Promise((resolve) => {
        onValue(playersRef, resolve, { onlyOnce: true });
      });

      const players = snapshot.val();
      if (players) {
        for (const [playerKey, playerData] of Object.entries(players)) {
          if (playerData.hasCooldownPending) {
            const playerRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}/${playerKey}`);
            await set(playerRef, {
              ...playerData,
              cooldownEnd: Date.now() + cooldownDuration,
              hasCooldownPending: false
            });
          }
        }
      }
    }
  };

  const nextTrack = () => {
    if (!canNavigateNext(currentTrack)) return;

    if (playerAdapter) {
      playerAdapter.pause().catch(console.error);
    }

    const newTrackIndex = currentTrack + 1;
    updateCurrentTrack(newTrackIndex);
    updateIsPlaying(false);
    setBuzzedTeam(null);
    clearBuzz();
    resetChrono();

    // Écrire la durée de la chanson dans Firebase
    // ✅ newTrackIndex commence à 1, donc accès tableau avec - 1
    const duration = playlist[newTrackIndex - 1]?.duration || 30;
    const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
    set(durationRef, duration);

    if (playMode === 'quiz') {
      quizMode.resetQuiz();
    }

    updateCurrentSong({
      title: '',
      artist: '',
      imageUrl: null,
      revealed: false,
      number: newTrackIndex // ✅ Pas besoin de + 1 car commence déjà à 1
    });

    // Charger l'audio en mode MP3
    if (musicSource === 'mp3' && playerAdapter) {
      playerAdapter.loadTrack(playlist[newTrackIndex - 1]); // ✅ Accès avec - 1
    }
  };

  const prevTrack = () => {
    if (!canNavigatePrev(currentTrack)) return;

    if (playerAdapter) {
      playerAdapter.pause().catch(console.error);
    }

    const newTrackIndex = currentTrack - 1;
    updateCurrentTrack(newTrackIndex);
    updateIsPlaying(false);
    setBuzzedTeam(null);
    clearBuzz();
    resetChrono();

    // Écrire la durée de la chanson dans Firebase
    // ✅ newTrackIndex commence à 1, donc accès tableau avec - 1
    const duration = playlist[newTrackIndex - 1]?.duration || 30;
    const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
    set(durationRef, duration);

    if (playMode === 'quiz') {
      quizMode.resetQuiz();
    }

    updateCurrentSong({
      title: '',
      artist: '',
      imageUrl: null,
      revealed: false,
      number: newTrackIndex // ✅ Pas besoin de + 1 car commence déjà à 1
    });

    // Charger l'audio en mode MP3
    if (musicSource === 'mp3' && playerAdapter) {
      playerAdapter.loadTrack(playlist[newTrackIndex - 1]); // ✅ Accès avec - 1
    }
  };

  const jumpToTrack = (trackNumber) => {
    // ✅ trackNumber commence à 1 maintenant
    if (trackNumber < 1 || trackNumber > playlist.length) return;
    if (trackNumber === currentTrack) return;

    if (playerAdapter) {
      playerAdapter.pause().catch(console.error);
    }

    updateCurrentTrack(trackNumber);
    updateIsPlaying(false);
    setBuzzedTeam(null);
    clearBuzz();
    resetChrono();

    // Écrire la durée de la chanson dans Firebase
    // ✅ Accès au tableau avec trackNumber - 1
    const duration = playlist[trackNumber - 1]?.duration || 30;
    const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
    set(durationRef, duration);

    if (playMode === 'quiz') {
      quizMode.resetQuiz();
    }

    updateCurrentSong({
      title: '',
      artist: '',
      imageUrl: null,
      revealed: false,
      number: trackNumber // ✅ Pas besoin de + 1 car commence déjà à 1
    });

    // Charger l'audio en mode MP3
    if (musicSource === 'mp3' && playerAdapter) {
      playerAdapter.loadTrack(playlist[trackNumber - 1]); // ✅ Accès avec - 1
    }
  };

  const revealAnswer = async () => {
    // Arrêter la lecture (commun aux deux modes)
    updateIsPlaying(false);
    if (playerAdapter) {
      await playerAdapter.pause();
    }

    // Mode Quiz : utiliser la logique spécifique
    if (playMode === 'quiz') {
      quizMode.revealQuizAnswer();
      setDebugInfo('✅ Réponse révélée (Quiz)');
      return;
    }

    // Mode Team (Logique existante)
    // Marquer le buzz comme incorrect
    await markBuzzAsWrong();

    // Reset le streak du joueur
    const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
    onValue(buzzRef, async (snapshot) => {
      const buzzData = snapshot.val();
      if (buzzData?.playerFirebaseKey) {
        await updatePlayerStats(
          buzzData.team,
          buzzData.playerFirebaseKey,
          false,
          { threshold: cooldownThreshold, duration: cooldownDuration }
        );
      }
    }, { onlyOnce: true });

    // Révéler la réponse
    revealTrack(currentTrack);
    setBuzzedTeam(null);
    clearBuzz();

    // ✅ currentTrack commence à 1, donc accès tableau avec currentTrack - 1
    const revealedTrack = playlist[currentTrack - 1];
    updateCurrentSong({
      title: revealedTrack.title,
      artist: revealedTrack.artist,
      imageUrl: revealedTrack.imageUrl,
      annee: revealedTrack.annee || null,
      revealed: true,
      number: currentTrack
    });

    setDebugInfo(`✅ Réponse révélée - Chrono figé à ${currentChrono.toFixed(1)}s`);
  };

  const addPoint = async (team) => {
    // Récupérer les données du buzz pour avoir le playerFirebaseKey
    const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
    const buzzSnapshot = await new Promise((resolve) => {
      onValue(buzzRef, resolve, { onlyOnce: true });
    });
    const buzzData = buzzSnapshot.val();

    // Ajouter les points (sans bonus personnel)
    const result = await addPointsToTeam(team, scores, playlist, buzzData || { team });

    updateScores(result.newScores);

    // Révéler la réponse
    revealTrack(currentTrack);
    setBuzzedTeam(null);
    clearBuzz();

    // ✅ currentTrack commence à 1, donc accès tableau avec currentTrack - 1
    updateCurrentSong({
      title: playlist[currentTrack - 1].title,
      artist: playlist[currentTrack - 1].artist,
      imageUrl: playlist[currentTrack - 1].imageUrl,
      revealed: true,
      number: currentTrack // ✅ Pas besoin de + 1 car commence déjà à 1
    });

    const teamName = team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2';
    setDebugInfo(`✅ ${result.points} points pour ${teamName}`);
  };

  const loadBuzzStats = (shouldShow = true) => {
    if (shouldShow === false) {
      setShowStats(false);
      return;
    }

    const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times`);
    onValue(buzzTimesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allBuzzes = [];
        Object.keys(data).forEach(trackIndex => {
          data[trackIndex].forEach(buzz => {
            allBuzzes.push(buzz);
          });
        });

        allBuzzes.sort((a, b) => a.time - b.time);
        setBuzzStats(allBuzzes);
        setShowStats(true);
      }
    }, { onlyOnce: true });
  };

  const endGame = async () => {
    // Marquer la partie comme terminée
    const gameStatusRef = ref(database, `sessions/${sessionId}/game_status`);
    await set(gameStatusRef, {
      ended: true,
      winner: scores.team1 > scores.team2 ? 'team1' : scores.team2 > scores.team1 ? 'team2' : 'draw',
      final_scores: scores,
      timestamp: Date.now()
    });

    // Désactiver la session (mais conserver les données)
    await deactivatePreviousSession(sessionId);

    setShowEndGameConfirm(false);
    setGameEnded(true);
  };

  const handleLogout = async () => {
    // Nettoyer les tokens Spotify
    spotifyStorage.clearAll();

    await signOut(auth);
    setSessionId(null);
  };

  const toggleQRCodeOnTV = async () => {
    if (!sessionId) return;

    const qrCodeRef = ref(database, `sessions/${sessionId}/showQRCode`);

    // Lire la valeur actuelle depuis Firebase pour être sûr
    onValue(qrCodeRef, async (snapshot) => {
      const currentValue = snapshot.val();
      const newValue = !currentValue;

      console.log('📱 Toggle QR Code sur TV:', { currentValue, newValue });

      // Écrire la nouvelle valeur
      await set(qrCodeRef, newValue);
    }, { onlyOnce: true });
  };

  // Fin automatique quand la dernière chanson est révélée
  // IMPORTANT: Ce useEffect doit être AVANT les early returns pour respecter les Rules of Hooks
  const currentSong = playlist[currentTrack - 1];
  useEffect(() => {
    if (
      currentSong?.revealed &&
      playlist.length > 0 &&
      currentTrack === playlist.length &&
      !gameEnded
    ) {
      console.log('🏁 Dernière chanson révélée — fin de partie automatique');
      endGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.revealed, currentTrack, playlist.length, gameEnded]);

  // === RENDU ===

  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  // Si on a un ID de playlist mais pas encore de tracks, on affiche un chargement
  const isLoadingPlaylist = (initialPlaylistId && playlist.length === 0) ||
                            (sessionId && musicSource !== 'mp3' && musicSource !== 'tresor' && playlist.length === 0 && (musicSource === 'spotify-ai' ? playersPreferences.length > 0 : true));

  const availablePoints = calculatePoints();

  // Player Spotify prêt ?
  const isSpotifyMode = musicSource === 'spotify-ai' || musicSource === 'spotify-auto' || musicSource === 'tresor';
  const spotifyDeviceReady = (musicSource === 'spotify-ai' || musicSource === 'tresor')
    ? !!spotifyAIMode.spotifyDeviceId
    : !!spotifyAutoMode.spotifyDeviceId;
  const isPlayerReady = !isSpotifyMode || spotifyDeviceReady;

  if (gameEnded) {
    return (
      <GameEndScreen
        scores={scores}
        playMode={playMode}
        leaderboard={quizMode.leaderboard}
        playlistLength={playlist.length}
        tracksPlayed={currentTrack}
        onNewGame={() => onEndGame?.()}
      />
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #0b1220 0%, #0f2444 50%, #0b1220 100%)',
      color: 'white'
    }}>
      {/* Test mode banner */}
      {testMode && (
        <div style={{
          background: 'rgba(251,191,36,0.12)',
          borderBottom: '1px solid rgba(251,191,36,0.25)',
          padding: '0.5rem 2rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: '#fbbf24'
        }}>
          ⚠️ Mode Test actif — aucun appel Spotify / n8n / OpenAI
        </div>
      )}

      {/* HEADER */}
      <header style={{
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '0.75rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        {/* Zone left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            onClick={() => setShowSessionModal(prev => !prev)}
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '2rem',
              padding: '0.4rem 1rem',
              cursor: 'pointer',
              fontFamily: 'monospace',
              color: '#fbbf24',
              fontSize: '0.9rem'
            }}
          >
            Session {getSessionCode(sessionId)}
          </div>
          {spotifyToken && (
            <span style={{ color: '#22c55e', fontSize: '0.8rem', opacity: 0.7 }}>
              ● Spotify
            </span>
          )}
        </div>

        {/* Zone center */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '0.75rem',
          padding: '0.3rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          <button onClick={prevTrack} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.25rem', cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>⏮</button>
          <button onClick={togglePlay} disabled={!isPlayerReady} title={!isPlayerReady ? 'Initialisation Spotify en cours...' : ''} style={{ background: isPlaying ? 'rgba(239,68,68,0.35)' : 'rgba(59,130,246,0.35)', border: 'none', color: 'white', fontSize: '1.25rem', cursor: isPlayerReady ? 'pointer' : 'not-allowed', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', opacity: isPlayerReady ? 1 : 0.5 }}>{isPlaying ? '⏸' : '▶'}</button>
          <button onClick={nextTrack} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.25rem', cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>⏭</button>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.15)', margin: '0 0.25rem' }} />
          <button
            onClick={revealAnswer}
            disabled={!currentSong || currentSong.revealed}
            style={{
              background: currentSong?.revealed ? 'rgba(34,197,94,0.2)' : 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '0.9rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              cursor: !currentSong || currentSong.revealed ? 'default' : 'pointer',
              opacity: !currentSong || currentSong.revealed ? 0.5 : 1
            }}
          >
            👁 Révéler
          </button>
        </div>

        {/* Zone right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {playMode === 'quiz' && (
            <button
              onClick={() => setAnonymousMode(prev => !prev)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: anonymousMode
                  ? 'rgba(239,68,68,0.25)'
                  : 'rgba(251,191,36,0.15)',
                border: anonymousMode
                  ? '1px solid rgba(239,68,68,0.4)'
                  : '1px solid rgba(251,191,36,0.3)',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
              title={anonymousMode
                ? 'Mode anonyme activé — les réponses sont masquées'
                : 'Activer le mode anonyme pour jouer sans tricher'}
            >
              <span>{anonymousMode ? '🙈' : '👁️'}</span>
              <span>{anonymousMode ? 'Anonyme ON' : 'Anonyme OFF'}</span>
            </button>
          )}

          {/* More dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDropdown(prev => !prev)}
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem',
                color: 'white',
                fontSize: '1.25rem',
                cursor: 'pointer'
              }}
            >
              ⋯
            </button>
            {showDropdown && (
              <>
                <div
                  onClick={() => setShowDropdown(false)}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 199 }}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: '#0d1f38',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '0.75rem',
                  padding: '0.5rem',
                  minWidth: '220px',
                  zIndex: 200,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }}>
                  <button
                    onClick={() => { loadBuzzStats(); setShowDropdown(false); }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', background: 'transparent', border: 'none', color: 'white', fontSize: '0.85rem', cursor: 'pointer', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    📊 Statistiques de buzz
                  </button>
                  <button
                    onClick={() => { setShowCooldownSettings(true); setShowDropdown(false); }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', background: 'transparent', border: 'none', color: 'white', fontSize: '0.85rem', cursor: 'pointer', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    ⚙️ Réglages cooldown
                  </button>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.25rem 0' }} />
                  <button
                    onClick={() => { setShowEndGameConfirm(true); setShowDropdown(false); }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', background: 'transparent', border: 'none', color: '#fbbf24', fontSize: '0.85rem', cursor: 'pointer', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    🏁 Terminer la partie
                  </button>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.25rem 0' }} />
                  <button
                    onClick={() => { handleLogout(); setShowDropdown(false); }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.85rem', cursor: 'pointer', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    🔴 Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Session Panel (slide-under) */}
      {showSessionModal && (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '1.5rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2rem',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)'
        }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '0.5rem' }}>
            <QRCodeSVG
              value={`${window.location.origin}/buzzer?session=${sessionId}`}
              size={120}
              level="H"
              includeMargin={false}
            />
          </div>
          <div style={{ fontFamily: 'monospace', color: '#fbbf24', fontSize: '2rem', fontWeight: 'bold', letterSpacing: '0.3rem' }}>
            {getSessionCode(sessionId)}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(getSessionCode(sessionId));
                setDebugInfo('✅ Code copié !');
              }}
              style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', color: 'white', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              📋 Copier
            </button>
            <button
              onClick={() => window.open('/tv', '_blank')}
              style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', color: 'white', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              📺 Ouvrir TV
            </button>
            <button
              onClick={toggleQRCodeOnTV}
              style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', color: 'white', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {showQRCode ? '🔴 QR sur TV' : '📱 QR sur TV'}
            </button>
          </div>
        </div>
      )}

      {/* Message d'erreur Player Spotify */}
      {(musicSource === 'spotify-auto' || musicSource === 'spotify-ai' || musicSource === 'tresor') && !playerAdapter && !isPlayerInitializing && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.9)',
          color: 'white',
          padding: '0.75rem',
          textAlign: 'center',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 99
        }}>
          ⚠️ Le lecteur Spotify n'est pas connecté.
          <button
            onClick={async () => {
              setIsPlayerInitializing(true);
              try {
                if (musicSource === 'spotify-auto') await spotifyAutoMode.initSpotifyPlayer();
                else if (musicSource === 'spotify-ai' || musicSource === 'tresor') await spotifyAIMode.initSpotifyPlayer();
              } catch (e) {
                console.error('❌ Erreur lors de la reconnexion manuelle:', e);
                // On garde l'état initializing false pour réafficher le message d'erreur
              } finally {
                // On attend un peu plus longtemps pour laisser le temps au playerAdapter de se mettre à jour
                // Si la connexion réussit, playerAdapter sera recréé et ce bloc disparaitra
                // Si elle échoue, le message réapparaitra
                setTimeout(() => setIsPlayerInitializing(false), 5000);
              }
            }}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: 'white',
              color: '#ef4444',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reconnecter
          </button>
        </div>
      )}

      {/* ZONE PRINCIPALE 3 COLONNES */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr 240px',
        gap: '12px',
        padding: '12px',
        height: 'calc(100vh - 60px)',
        overflow: 'hidden'
      }}>

        {/* COLONNE GAUCHE — Scores */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {playMode === 'team' && (
            <>
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Équipe 1</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444' }}>{scores.team1}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Équipe 2</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{scores.team2}</div>
              </div>
            </>
          )}
          {playMode === 'quiz' && (
            <QuizLeaderboard leaderboard={quizMode.leaderboard} />
          )}
        </div>

        {/* COLONNE CENTRE — Chanson + Contrôles contextuels */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isLoadingPlaylist ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ opacity: 0.8 }}>{waitingForSpotifyToken ? 'Reconnexion Spotify en cours...' : 'Chargement de la playlist...'}</div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : playlist.length > 0 ? (
            <>
              {/* Carte chanson */}
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '60px', height: '60px', background: 'rgba(68,117,168,0.3)', borderRadius: '0.5rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', border: '1px solid rgba(68,117,168,0.4)', overflow: 'hidden' }}>
                  {(playMode === 'quiz' && anonymousMode && !currentSong?.revealed) ? '?' : (
                    playlist[currentTrack - 1]?.imageUrl
                      ? <img src={playlist[currentTrack - 1].imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '🎵'
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '11px', opacity: 0.45, marginBottom: '2px' }}>Piste {currentTrack} / {playlist.length}</div>
                  <div style={{ fontSize: '17px', fontWeight: 600 }}>
                    {(playMode === 'quiz' && anonymousMode && !currentSong?.revealed) ? '???' : (currentSong?.title || playlist[currentTrack - 1]?.title || '...')}
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '2px' }}>
                    {(playMode === 'quiz' && anonymousMode && !currentSong?.revealed) ? '???' : (currentSong?.artist || playlist[currentTrack - 1]?.artist || '...')}
                  </div>
                </div>
              </div>

              {/* Chrono + Points */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.5rem', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Chrono</div>
                  <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'monospace' }}>{Math.floor(currentChrono)}s</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.5rem', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Points dispo</div>
                  <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'monospace', color: '#fbbf24' }}>{availablePoints}</div>
                </div>
              </div>

              {/* Buzz Alert (Mode Équipe) */}
              {playMode === 'team' && buzzedTeam && (
                <BuzzAlert
                  buzzedTeam={buzzedTeam}
                  buzzedPlayerKey={buzzedPlayerKey}
                  buzzedPlayerName={buzzedPlayerName}
                  buzzedPlayerPhoto={buzzedPlayerPhoto}
                  currentChrono={currentChrono}
                  availablePoints={availablePoints}
                  onCorrect={() => addPoint(buzzedTeam)}
                  onWrong={revealAnswer}
                />
              )}

              {/* Quiz Controls (Mode Quiz) */}
              {playMode === 'quiz' && (
                <QuizControls
                  quizAnswers={quizMode.quizAnswers}
                  correctAnswerIndex={quizMode.correctAnswerIndex}
                  playerAnswers={quizMode.playerAnswers}
                  allPlayers={allQuizPlayers}
                  isPlaying={isPlaying}
                  currentTrack={currentTrack}
                  anonymousMode={anonymousMode}
                  onReveal={async () => {
                    if (playerAdapter) {
                      await playerAdapter.pause();
                      updateIsPlaying(false);
                    }
                    quizMode.revealQuizAnswer();
                    setDebugInfo('✅ Réponse révélée (Quiz)');
                  }}
                  onPause={async () => {
                    if (playerAdapter) {
                      await playerAdapter.pause();
                      updateIsPlaying(false);
                      setDebugInfo('⏸️ Pause automatique (tous ont répondu)');
                    }
                  }}
                  isRevealed={currentSong?.revealed}
                />
              )}

              {/* Indicateur Spotify */}
              {isSpotifyMode && !isPlayerReady && (
                <div style={{ fontSize: '0.85rem', opacity: 0.7, textAlign: 'center', padding: '0.5rem' }}>
                  ⏳ Connexion Spotify en cours...
                </div>
              )}

              {debugInfo && (
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                  {debugInfo}
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div>
                <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>👋 Bienvenue !</h2>
                <p style={{ fontSize: '1.1rem', opacity: 0.8 }}>Chargez une playlist pour commencer</p>
              </div>
            </div>
          )}
        </div>

        {/* COLONNE DROITE — Playlist */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {playlist.length > 0 && playlist.map((track, index) => {
            const trackNumber = index + 1;
            return (
              <div
                key={index}
                onClick={() => jumpToTrack(trackNumber)}
                style={{
                  padding: '6px 8px',
                  backgroundColor: trackNumber === currentTrack ? 'rgba(251,191,36,0.07)' : 'rgba(255,255,255,0.03)',
                  border: trackNumber === currentTrack ? '1px solid rgba(251,191,36,0.35)' : '1px solid transparent',
                  borderRadius: '0.4rem',
                  opacity: track.revealed ? 0.3 : 1,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => { if (trackNumber !== currentTrack) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { if (trackNumber !== currentTrack) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
              >
                <div style={{ fontSize: '12px', fontWeight: 500 }}>
                  {trackNumber}. {track.revealed && '✅ '}
                  {playMode === 'quiz' && anonymousMode && !track.revealed ? '🎵 ...' : track.title}
                </div>
                {track.artist && (
                  <div style={{ fontSize: '11px', opacity: 0.5 }}>
                    {playMode === 'quiz' && anonymousMode && !track.revealed ? '???' : track.artist}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Modales */}
      {musicSource === 'spotify-auto' && (
        <PlaylistSelector
          show={spotifyAutoMode.showPlaylistSelector}
          playlists={spotifyAutoMode.spotifyPlaylists}
          onClose={() => spotifyAutoMode.setShowPlaylistSelector(false)}
          onSelect={(id) => spotifyAutoMode.handleSelectPlaylist(id, setPlaylist, () => updateScores({ team1: 0, team2: 0 }))}
        />
      )}

      <GameSettings
        playlist={playlist}
        scores={scores}
        showStats={showStats}
        buzzStats={buzzStats}
        showEndGameConfirm={showEndGameConfirm}
        onResetGame={() => {}}
        onShowStats={loadBuzzStats}
        onEndGame={() => setShowEndGameConfirm(true)}
        onConfirmEndGame={endGame}
        onCancelEndGame={() => setShowEndGameConfirm(false)}
      />

      {/* Session modal removed — replaced by slide-under panel after header */}

      {/* Modale Réglages Cooldown */}
      {showCooldownSettings && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
          onClick={() => setShowCooldownSettings(false)}
        >
          <div
            style={{
              backgroundColor: '#0d1f38',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              ⚙️ Réglages du Cooldown
            </h2>

            {/* Paramètres */}
            <div style={{ marginBottom: '2rem' }}>
              {/* Seuil de bonnes réponses */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  marginBottom: '0.5rem',
                  opacity: 0.9
                }}>
                  🎯 Nombre de bonnes réponses d'affilée
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={cooldownThreshold}
                  onChange={(e) => setCooldownThreshold(parseInt(e.target.value) || 1)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '0.5rem',
                    color: 'white',
                    fontSize: '1rem'
                  }}
                />
                <div style={{
                  fontSize: '0.75rem',
                  opacity: 0.6,
                  marginTop: '0.25rem'
                }}>
                  Après combien de bonnes réponses consécutives le joueur est freezé
                </div>
              </div>

              {/* Durée du cooldown */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  marginBottom: '0.5rem',
                  opacity: 0.9
                }}>
                  ⏱️ Durée du freeze (secondes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={cooldownDuration / 1000}
                  onChange={(e) => setCooldownDuration((parseInt(e.target.value) || 1) * 1000)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '0.5rem',
                    color: 'white',
                    fontSize: '1rem'
                  }}
                />
                <div style={{
                  fontSize: '0.75rem',
                  opacity: 0.6,
                  marginTop: '0.25rem'
                }}>
                  Durée pendant laquelle le joueur ne peut pas buzzer
                </div>
              </div>
            </div>

            {/* Aperçu */}
            <div style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                📋 Aperçu
              </div>
              <div style={{ fontSize: '0.95rem' }}>
                Après <strong>{cooldownThreshold}</strong> bonne{cooldownThreshold > 1 ? 's' : ''} réponse{cooldownThreshold > 1 ? 's' : ''} d'affilée,
                le joueur sera freezé pendant <strong>{cooldownDuration / 1000}s</strong>
              </div>
            </div>

            {/* Boutons */}
            <div style={{
              display: 'flex',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => setShowCooldownSettings(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: 'rgba(156, 163, 175, 0.3)',
                  border: '1px solid #9ca3af',
                  fontSize: '0.9rem',
                  borderRadius: '0.5rem',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowCooldownSettings(false);
                  setDebugInfo(`✅ Réglages sauvegardés : ${cooldownThreshold} réponses → ${cooldownDuration / 1000}s`);
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                  border: '1px solid #3b82f6',
                  fontSize: '0.9rem',
                  borderRadius: '0.5rem',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio caché pour MP3 */}
      {musicSource === 'mp3' && (
        <audio ref={mp3Mode.audioRef} style={{ display: 'none' }} />
      )}
    </div>
  );
}
