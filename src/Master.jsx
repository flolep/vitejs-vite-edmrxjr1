import React, { useState, useRef, useEffect, useMemo } from 'react';
import { database, auth } from './firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';
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
import { useSpotifyTokenRefresh } from './hooks/useSpotifyTokenRefresh';
import { createPlayerAdapter } from './services/playerAdapter';

// Import des composants
import Login from './components/Login';
import PlaylistSelector from './components/master/PlaylistSelector';
import PlayerControls from './components/master/PlayerControls';
import ScoreDisplay from './components/master/ScoreDisplay';
import BuzzAlert from './components/master/BuzzAlert';
import GameSettings from './components/master/GameSettings';
import QuizControls from './components/master/QuizControls';
import QuizLeaderboard from './components/master/QuizLeaderboard';
import FirebaseCleanup from './components/master/FirebaseCleanup';

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
  initialSpotifyToken = null
}) {
  // États d'authentification et session
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [musicSource, setMusicSource] = useState(initialMusicSource); // 'mp3' | 'spotify-auto' | 'spotify-ai'
  const [playMode, setPlayMode] = useState(initialPlayMode); // 'team' | 'quiz'
  const [gameMode, setGameMode] = useState(initialGameMode); // Combinaison

  // États UI
  const [showQRCode, setShowQRCode] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [showCooldownSettings, setShowCooldownSettings] = useState(false);
  const [showFirebaseCleanup, setShowFirebaseCleanup] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // États de cooldown
  const [cooldownThreshold, setCooldownThreshold] = useState(2);
  const [cooldownDuration, setCooldownDuration] = useState(5000);

  // États statistiques
  const [buzzStats, setBuzzStats] = useState([]);

  // États Spotify
  const [isPlayerInitializing, setIsPlayerInitializing] = useState(false);

  // États préférences joueurs (mode Spotify IA)
  const [playersPreferences, setPlayersPreferences] = useState([]);
  const [isGeneratingPlaylist, setIsGeneratingPlaylist] = useState(false);
  const [playlistPollAttempt, setPlaylistPollAttempt] = useState(0);
  const [isGeneratingQuizQuestions, setIsGeneratingQuizQuestions] = useState(false);
  const [quizQuestionsReady, setQuizQuestionsReady] = useState(false);
  const [allQuizPlayers, setAllQuizPlayers] = useState([]); // Joueurs connectés en mode Quiz
  const [testMode, setTestMode] = useState(() => localStorage.getItem('quizTestMode') === 'true');

  // Déterminer le token initial
  const getInitialToken = () => {
    if (initialSpotifyToken) return initialSpotifyToken;
    return sessionStorage.getItem('spotify_access_token');
  };

  // Hook de rafraîchissement automatique du token Spotify
  const { token: spotifyToken, isRefreshing: tokenRefreshing, error: tokenError } = useSpotifyTokenRefresh(
    getInitialToken(),
    (newToken) => {
      console.log('🔄 Token Spotify rafraîchi automatiquement dans Master');
    }
  );

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

  const spotifyAutoMode = useSpotifyAutoMode(spotifyToken, sessionId);

  const spotifyAIMode = useSpotifyAIMode(spotifyToken, sessionId, musicSource);

  const quizMode = useQuizMode(sessionId, currentTrack, playlist, currentChronoRef);

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
    clearBuzz
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
      localStorage.setItem('lastSessionId', sessionId);
    }
  }, [sessionId]);

  // Charger les données de la session
  // ⚠️ UNIQUEMENT pour le flux ANCIEN (MasterWizard)
  // Le nouveau flux (MasterFlowContainer) passe déjà tout via les props
  useEffect(() => {
    if (!user || !initialSessionId) return;

    // ✅ Si initialPlaylist est fourni, on utilise le NOUVEAU flux (MasterFlowContainer)
    // → Skip ce hook car toutes les données sont déjà dans les props
    if (initialPlaylist && initialPlaylist.length > 0) {
      console.log('✅ [MASTER] Nouveau flux détecté (MasterFlowContainer) - Skip chargement Firebase');
      return;
    }

    // ❌ Ancien flux (MasterWizard) : charger depuis Firebase
    console.log('⚠️ [MASTER] Ancien flux détecté (MasterWizard) - Chargement depuis Firebase');
    const sessionRef = ref(database, `sessions/${initialSessionId}`);
    onValue(sessionRef, (snapshot) => {
      const sessionData = snapshot.val();
      if (sessionData && sessionData.active !== false) {
        // Charger les modes
        setMusicSource(sessionData.musicSource || sessionData.gameMode?.split('-')[0] || 'mp3');
        setPlayMode(sessionData.playMode || sessionData.gameMode?.split('-')[1] || 'team');

        // Charger la playlist si Spotify
        if (sessionData.playlistId && spotifyToken) {
          if (sessionData.musicSource === 'spotify-ai') {
            spotifyAIMode.loadPlaylistById(sessionData.playlistId, setPlaylist);
          } else if (sessionData.musicSource === 'spotify-auto') {
            console.log('🔄 [MASTER] Rechargement playlist Spotify Auto:', sessionData.playlistId);
            if (spotifyService && typeof spotifyService.getPlaylistTracks === 'function') {
              spotifyService.getPlaylistTracks(spotifyToken, sessionData.playlistId)
                .then(tracks => {
                  if (Array.isArray(tracks)) {
                    setPlaylist(tracks);
                    console.log('✅ [MASTER] Playlist Spotify Auto rechargée:', tracks.length);
                  } else {
                    console.error('❌ [MASTER] Format playlist invalide:', tracks);
                  }
                })
                .catch(err => console.error('❌ [MASTER] Erreur rechargement playlist Auto:', err));
            } else {
              console.error('❌ [MASTER] spotifyService non disponible');
            }
          }
        }
      }
    }, { onlyOnce: true });
  }, [initialSessionId, user, spotifyToken]);

  // Synchroniser la playlist du mode Spotify IA avec la playlist globale
  // ⚠️ UNIQUEMENT pour le flux ANCIEN (MasterWizard)
  // Le nouveau flux (MasterFlowContainer) passe déjà la playlist complète via initialPlaylist
  useEffect(() => {
    // ✅ Si initialPlaylist est fourni, on utilise le NOUVEAU flux (MasterFlowContainer)
    // → Skip ce hook car la playlist est déjà fournie
    if (initialPlaylist && initialPlaylist.length > 0) {
      return;
    }

    // ❌ Ancien flux (MasterWizard) : synchroniser depuis spotifyAIMode
    if (musicSource === 'spotify-ai' &&
        spotifyAIMode.playlist &&
        spotifyAIMode.playlist.length > 0 &&
        playlist.length === 0) {
      console.log('🔄 [MASTER] Synchronisation de la playlist Spotify IA:', spotifyAIMode.playlist.length, 'chansons');
      setPlaylist(spotifyAIMode.playlist);
    }
  }, [musicSource, spotifyAIMode.playlist, playlist.length]);

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

  // Vérifier si les questions Quiz sont déjà générées au chargement
  useEffect(() => {
    if (!sessionId || playMode !== 'quiz') return;

    const checkQuizData = async () => {
      const quizDataRef = ref(database, `sessions/${sessionId}/quiz_data/0`);
      const snapshot = await new Promise((resolve) => {
        onValue(quizDataRef, resolve, { onlyOnce: true });
      });

      if (snapshot.val()) {
        console.log('✅ Questions Quiz déjà présentes dans Firebase');
        setQuizQuestionsReady(true);
      } else {
        console.log('ℹ️ Pas de questions Quiz trouvées, elles doivent être générées');
        setQuizQuestionsReady(false);
      }
    };

    checkQuizData();
  }, [sessionId, playMode]);

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
        // Mettre à jour currentSong avec revealed: true
        updateCurrentSong({
          title: playlist[currentTrack - 1].title,
          artist: playlist[currentTrack - 1].artist,
          imageUrl: playlist[currentTrack - 1].imageUrl,
          revealed: true,
          number: currentTrack // ✅ Pas besoin de + 1 car commence déjà à 1
        });
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
          // Supprimer la demande immédiatement
          await remove(nextSongRequestRef);

          // Passer à la chanson suivante en utilisant la ref (toujours à jour)
          if (nextTrackRef.current) {
            nextTrackRef.current();
          }

          // Attendre que l'état se propage
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Démarrer automatiquement la lecture de la nouvelle chanson
          if (togglePlayRef.current) {
            await togglePlayRef.current();
          }

          console.log('✅ Chanson suivante lancée automatiquement');
        } catch (error) {
          console.error('❌ Erreur lors du passage à la chanson suivante:', error);
        } finally {
          // Reset le flag après un délai pour éviter les double-clics
          setTimeout(() => {
            isProcessing = false;
          }, 500);
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
      if (musicSource === 'spotify-ai') {
        spotifyAIMode.initSpotifyPlayer();
      } else if (musicSource === 'spotify-auto') {
        spotifyAutoMode.initSpotifyPlayer();
      }
    }
  }, [musicSource, spotifyToken]);

  // === ACTIONS ===

  // Écouter le statut de la playlist dans Firebase pour déclencher la suite automatiquement
  useEffect(() => {
    if (!initialPlaylistId || testMode) return;

    const playlistRef = ref(database, `playlists/${initialPlaylistId}`);
    const unsubscribe = onValue(playlistRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && data.status === 'playlist_ready') {
        console.log('🎉 Playlist prête détectée via Firebase !', data);

        // Si nous sommes en mode Quiz et que les questions ne sont pas encore prêtes
        // ET que nous ne sommes pas déjà en train de les générer
        if (playMode === 'quiz' && !quizQuestionsReady && !isGeneratingQuizQuestions) {
          console.log('🚀 Déclenchement automatique de la génération des questions Quiz...');

          // Recharger d'abord la playlist pour être sûr d'avoir les dernières données
          let tracks = [];
          if (spotifyAIMode.loadPlaylistById) {
            tracks = await spotifyAIMode.loadPlaylistById(initialPlaylistId, setPlaylist);
          }

          // Puis générer les questions
          // On passe tracks explicitement pour éviter les problèmes de state asynchrone
          handleGenerateQuizQuestions(tracks);
        }
      }
    });

    return () => unsubscribe();
  }, [initialPlaylistId, playMode, quizQuestionsReady, isGeneratingQuizQuestions, testMode, spotifyAIMode]);

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
            imageUrl: 'https://via.placeholder.com/300?text=Test+Mode', // Image placeholder pour le mode test
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

  /**
   * 🎲 Génère les questions Quiz (wrongAnswers) manuellement
   * Bouton affiché uniquement en mode Quiz après que la playlist est prête
   */
  const handleGenerateQuizQuestions = async () => {
    if (!playlist || playlist.length === 0) {
      setDebugInfo('❌ La playlist est vide. Générez d\'abord la playlist.');
      return;
    }

    if (quizQuestionsReady) {
      setDebugInfo('✅ Les questions sont déjà prêtes !');
      return;
    }

    try {
      setIsGeneratingQuizQuestions(true);

      console.log('🎲 Génération des wrongAnswers pour', playlist.length, 'chansons');

      const songsForWrongAnswers = playlist
        .map((track, index) => ({
          artist: track.artist,
          title: track.title,
          uri: track.spotifyUri || track.uri // Support both field names
        }))
        .filter((song, index) => {
          if (!song.uri) {
            console.warn(`⚠️ Chanson ${index} ignorée: pas d'URI`, song);
            return false;
          }
          return true;
        });

      // 🔄 Découper en batches de 10 chansons pour éviter le timeout Netlify (10-26s max)
      const BATCH_SIZE = 10;
      const batches = [];
      for (let i = 0; i < songsForWrongAnswers.length; i += BATCH_SIZE) {
        batches.push(songsForWrongAnswers.slice(i, i + BATCH_SIZE));
      }

      console.log(`📦 ${batches.length} batches de ${BATCH_SIZE} chansons max`);

      const allWrongAnswers = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchNum = batchIndex + 1;

        setDebugInfo(`🎲 Génération batch ${batchNum}/${batches.length} (${batch.length} chansons)...`);
        console.log(`🔄 Batch ${batchNum}/${batches.length}: ${batch.length} chansons`);

        try {
          const wrongAnswersResponse = await n8nService.generateWrongAnswers(batch);

          // Ajouter les wrongAnswers de ce batch
          for (let i = 0; i < batch.length; i++) {
            if (!batch[i].uri) {
              console.warn(`⚠️ Chanson sans URI ignorée:`, batch[i]);
              continue;
            }
            const wrongAnswersData = wrongAnswersResponse.wrongAnswers[i];
            allWrongAnswers.push({
              uri: batch[i].uri,
              title: batch[i].title,
              artist: batch[i].artist,
              wrongAnswers: wrongAnswersData ? wrongAnswersData.wrongAnswers : [
                `Fallback 1 - Song ${allWrongAnswers.length + 1}A`,
                `Fallback 2 - Song ${allWrongAnswers.length + 1}B`,
                `Fallback 3 - Song ${allWrongAnswers.length + 1}C`
              ]
            });
          }

          console.log(`✅ Batch ${batchNum}/${batches.length} terminé`);
        } catch (error) {
          console.error(`❌ Erreur batch ${batchNum}:`, error);
          // Ajouter des fallbacks pour ce batch en cas d'erreur
          for (let i = 0; i < batch.length; i++) {
            if (!batch[i].uri) {
              console.warn(`⚠️ Chanson sans URI ignorée (fallback):`, batch[i]);
              continue;
            }
            allWrongAnswers.push({
              uri: batch[i].uri,
              title: batch[i].title,
              artist: batch[i].artist,
              wrongAnswers: [
                `Fallback 1 - Song ${allWrongAnswers.length + 1}A`,
                `Fallback 2 - Song ${allWrongAnswers.length + 1}B`,
                `Fallback 3 - Song ${allWrongAnswers.length + 1}C`
              ]
            });
          }
        }
      }

      // 🧹 Réinitialiser le classement avant de stocker les nouvelles données
      console.log('🧹 Réinitialisation du classement...');
      setDebugInfo('🧹 Réinitialisation du classement...');
      await quizMode.resetLeaderboard();

      console.log('🎯 Stockage des données Quiz dans Firebase...');
      setDebugInfo('💾 Stockage dans Firebase...');
      await quizMode.storeQuizData(allWrongAnswers);
      console.log('✅ Données Quiz stockées avec succès !');

      setQuizQuestionsReady(true);
      setDebugInfo('✅ Questions Quiz générées avec succès !');
    } catch (error) {
      console.error('❌ Erreur génération questions Quiz:', error);
      setDebugInfo(`❌ Erreur: ${error.message}`);
    } finally {
      setIsGeneratingQuizQuestions(false);
    }
  };

  const togglePlay = async () => {
    if (!sessionId) {
      setDebugInfo('❌ Aucune session');
      return;
    }

    // Vérification spécifique pour Spotify
    if ((musicSource === 'spotify-auto' || musicSource === 'spotify-ai') && !spotifyToken) {
      setDebugInfo('⚠️ Spotify non connecté - Veuillez vous reconnecter à Spotify pour lire cette playlist');
      console.error('❌ Token Spotify manquant');
      updateIsPlaying(false);
      return;
    }

    // Si en mode Spotify et player/deviceId manquant, tenter réinitialisation
    if ((musicSource === 'spotify-auto' || musicSource === 'spotify-ai') && !playerAdapter) {
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
        } else if (musicSource === 'spotify-ai') {
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

    // Arrêter la lecture
    updateIsPlaying(false);
    if (playerAdapter) {
      await playerAdapter.pause();
    }

    // ✅ currentTrack commence à 1, donc accès tableau avec currentTrack - 1
    updateCurrentSong({
      title: playlist[currentTrack - 1].title,
      artist: playlist[currentTrack - 1].artist,
      imageUrl: playlist[currentTrack - 1].imageUrl,
      revealed: true,
      number: currentTrack // ✅ Pas besoin de + 1 car commence déjà à 1
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

  /**
   * Toggle le mode Test (stubs au lieu de vrais appels n8n/OpenAI)
   */
  const toggleTestMode = () => {
    const newValue = !testMode;
    setTestMode(newValue);
    localStorage.setItem('quizTestMode', newValue.toString());
    console.log(`🎭 Mode Test ${newValue ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    setDebugInfo(`🎭 Mode Test ${newValue ? 'activé' : 'désactivé'} - ${newValue ? 'Pas d\'appels OpenAI' : 'Vrais appels n8n'}`);
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
    setDebugInfo('🎉 Partie terminée ! Session désactivée.');
  };

  const handleLogout = async () => {
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

  // === RENDU ===

  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  // ✅ currentTrack commence à 1, donc accès tableau avec currentTrack - 1
  const currentSong = playlist[currentTrack - 1];
  const availablePoints = calculatePoints();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      {/* HEADER */}
      <header style={{
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 'bold',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🎵 BLIND TEST {playMode === 'quiz' && '- MODE QUIZ'}
        </h1>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Statut Spotify */}
          {spotifyToken && (
            <div style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid #10b981',
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ color: '#10b981' }}>●</span>
              Spotify connecté
            </div>
          )}

          {/* Mode Test Toggle (uniquement en mode Quiz) */}
          {playMode === 'quiz' && (
            <button
              onClick={toggleTestMode}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: testMode
                  ? 'rgba(251, 191, 36, 0.3)'
                  : 'rgba(107, 114, 128, 0.2)',
                border: testMode
                  ? '1px solid #fbbf24'
                  : '1px solid #6b7280',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
              title={testMode
                ? 'Mode Test activé - Stubs au lieu d\'OpenAI'
                : 'Mode Production - Vrais appels OpenAI'}
            >
              <span>{testMode ? '🎭' : '🔌'}</span>
              <span>{testMode ? 'Mode Test' : 'Mode Prod'}</span>
            </button>
          )}

          {/* Boutons d'actions */}
          {sessionId && (
            <button
              onClick={() => setShowSessionModal(true)}
              className="btn"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(124, 58, 237, 0.3)',
                border: '1px solid #7c3aed',
                fontSize: '0.85rem',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              📱 Session
            </button>
          )}

          <button onClick={loadBuzzStats} style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'rgba(124, 58, 237, 0.3)',
            border: '1px solid #7c3aed',
            fontSize: '0.85rem',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer'
          }}>
            📊 Statistiques
          </button>

          <button onClick={() => setShowEndGameConfirm(true)} style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'rgba(251, 191, 36, 0.3)',
            border: '1px solid #fbbf24',
            fontSize: '0.85rem',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer'
          }}>
            🏁 Terminer
          </button>

          <button onClick={() => setShowCooldownSettings(true)} style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'rgba(59, 130, 246, 0.3)',
            border: '1px solid #3b82f6',
            fontSize: '0.85rem',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer'
          }}>
            ⚙️ Réglages
          </button>

          <button onClick={() => setShowFirebaseCleanup(true)} style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'rgba(139, 92, 246, 0.3)',
            border: '1px solid #8b5cf6',
            fontSize: '0.85rem',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer'
          }}>
            🧹 Nettoyage
          </button>

          <button onClick={handleLogout} style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer'
          }}>
            🚪 Déconnexion
          </button>
        </div>
      </header>

      {/* Message d'erreur Player Spotify */}
      {(musicSource === 'spotify-auto' || musicSource === 'spotify-ai') && !playerAdapter && !isPlayerInitializing && (
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
                else if (musicSource === 'spotify-ai') await spotifyAIMode.initSpotifyPlayer();
              } catch (e) {
                console.error(e);
              } finally {
                setTimeout(() => setIsPlayerInitializing(false), 2000);
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

      {/* MAIN LAYOUT */}
      <div style={{
        display: 'flex',
        height: 'calc(100vh - 73px)',
        overflow: 'hidden'
      }}>
        {/* SIDEBAR */}
        <aside style={{
          width: '320px',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          overflowY: 'auto',
          padding: '1.5rem'
        }}>
          {/* Boutons selon le mode */}
          {musicSource === 'mp3' && (
            <button
              onClick={mp3Mode.handleManualAdd}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'rgba(124, 58, 237, 0.3)',
                border: '1px solid #7c3aed',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
            >
              📁 Charger MP3
            </button>
          )}

          {musicSource === 'spotify-auto' && (
            <button
              onClick={() => spotifyAutoMode.setShowPlaylistSelector(true)}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'rgba(16, 185, 129, 0.3)',
                border: '1px solid #10b981',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
            >
              🎵 Charger Playlist
            </button>
          )}

          {/* ⚠️ Masquer la section génération playlist/questions dans le NOUVEAU flux (MasterFlowContainer)
              Car tout est déjà généré automatiquement dans les 3 étapes du flow */}
          {musicSource === 'spotify-ai' && playersPreferences.length > 0 && !(initialPlaylist && initialPlaylist.length > 0) && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '0.5rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                👥 Préférences des joueurs ({playersPreferences.length})
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                {playersPreferences.map((pref, index) => (
                  <div key={pref.id} style={{
                    fontSize: '0.8rem',
                    padding: '0.5rem',
                    marginBottom: '0.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '0.375rem'
                  }}>
                    <div style={{ fontWeight: '500', color: '#ec4899', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {pref.photo && (
                        <img
                          src={pref.photo}
                          alt={pref.name}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #ec4899'
                          }}
                        />
                      )}
                      <span>{pref.name}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                      {pref.age} ans • {pref.genres.join(', ')}
                    </div>
                    {pref.specialPhrase && (
                      <div style={{ fontSize: '0.7rem', opacity: 0.6, fontStyle: 'italic', marginTop: '0.25rem' }}>
                        "{pref.specialPhrase}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleGeneratePlaylistWithAllPreferences}
                disabled={isGeneratingPlaylist}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: isGeneratingPlaylist ? 'rgba(156, 163, 175, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                  border: isGeneratingPlaylist ? '1px solid #9ca3af' : '1px solid #10b981',
                  borderRadius: '0.5rem',
                  color: 'white',
                  cursor: isGeneratingPlaylist ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                {isGeneratingPlaylist
                  ? `⏳ Génération en cours... ${playlistPollAttempt > 0 ? `(vérification ${playlistPollAttempt}/10)` : ''}`
                  : '🎵 Générer la playlist'
                }
              </button>

              {/* Bouton Générer les questions Quiz (uniquement en mode Quiz) */}
              {playMode === 'quiz' && !isGeneratingPlaylist && playlist.length > 0 && (
                <button
                  onClick={handleGenerateQuizQuestions}
                  disabled={isGeneratingQuizQuestions || quizQuestionsReady}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    marginTop: '0.75rem',
                    backgroundColor: quizQuestionsReady
                      ? 'rgba(16, 185, 129, 0.3)'
                      : isGeneratingQuizQuestions
                        ? 'rgba(156, 163, 175, 0.3)'
                        : 'rgba(251, 191, 36, 0.3)',
                    border: quizQuestionsReady
                      ? '1px solid #10b981'
                      : isGeneratingQuizQuestions
                        ? '1px solid #9ca3af'
                        : '1px solid #fbbf24',
                    borderRadius: '0.5rem',
                    color: 'white',
                    cursor: (isGeneratingQuizQuestions || quizQuestionsReady) ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {quizQuestionsReady
                    ? '✅ Questions prêtes !'
                    : isGeneratingQuizQuestions
                      ? '🎲 Génération des questions...'
                      : '🎲 Générer les questions Quiz'
                  }
                </button>
              )}
            </div>
          )}

          {musicSource === 'spotify-ai' && spotifyAIMode.playlistUpdates.length > 0 && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '0.5rem',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                📊 Mises à jour
              </div>
              {spotifyAIMode.playlistUpdates.map((update, index) => (
                <div key={index} style={{ fontSize: '0.8rem', padding: '0.4rem 0' }}>
                  <div style={{ fontWeight: '500', color: '#ec4899' }}>
                    {update.playerName}
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                    +{update.songsAdded} chanson{update.songsAdded > 1 ? 's' : ''} • {update.time}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Playlist */}
          {playlist.length > 0 && (
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '0.75rem',
              padding: '1.25rem'
            }}>
              <h3 style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                📚 Playlist ({playlist.length})
              </h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {playlist.map((track, index) => {
                  const trackNumber = index + 1; // ✅ Convertir index (0-based) en trackNumber (1-based)
                  return (
                  <div
                    key={index}
                    onClick={() => jumpToTrack(trackNumber)}
                    style={{
                      padding: '0.6rem',
                      marginBottom: '0.4rem',
                      backgroundColor: trackNumber === currentTrack ? 'rgba(124, 58, 237, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '0.5rem',
                      opacity: track.revealed ? 0.4 : 1,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, opacity 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (trackNumber !== currentTrack) {
                        e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.2)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (trackNumber !== currentTrack) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    <div style={{ fontWeight: '500' }}>
                      {trackNumber}. {track.revealed && '✅ '}{track.title}
                    </div>
                    {track.artist && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        {track.artist}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* ZONE PRINCIPALE */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '2rem'
        }}>
          {playlist.length > 0 ? (
            <>
              {/* Scores (Mode Équipe uniquement) */}
              {playMode === 'team' && <ScoreDisplay scores={scores} />}

              {/* Classement (Mode Quiz) */}
              {playMode === 'quiz' && (
                <QuizLeaderboard leaderboard={quizMode.leaderboard} />
              )}

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
                  onReveal={quizMode.revealQuizAnswer}
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

              {/* Player Controls */}
              <PlayerControls
                currentTrack={currentTrack}
                playlistLength={playlist.length}
                isPlaying={isPlaying}
                currentSong={currentSong}
                currentTrackData={playlist[currentTrack - 1]}
                currentChrono={currentChrono}
                availablePoints={availablePoints}
                songDuration={songDuration}
                isSpotifyMode={musicSource !== 'mp3'}
                onPrev={prevTrack}
                onTogglePlay={togglePlay}
                onNext={nextTrack}
                onReveal={revealAnswer}
              />

              {debugInfo && (
                <div style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                  marginTop: '1rem'
                }}>
                  {debugInfo}
                </div>
              )}
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                  👋 Bienvenue !
                </h2>
                <p style={{ fontSize: '1.1rem', opacity: 0.8 }}>
                  Chargez une playlist pour commencer
                </p>
              </div>
            </div>
          )}
        </main>
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

      {/* Modale Session/QR Code */}
      {showSessionModal && (
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
          onClick={() => setShowSessionModal(false)}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              📱 Session de jeu
            </h2>

            {/* Code de session */}
            <div style={{
              backgroundColor: 'rgba(124, 58, 237, 0.2)',
              border: '1px solid rgba(124, 58, 237, 0.5)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '0.875rem',
                opacity: 0.8,
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Code de session
              </div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 'bold',
                letterSpacing: '0.3rem',
                fontFamily: 'monospace',
                color: '#fbbf24',
                textShadow: '0 0 10px rgba(251, 191, 36, 0.3)'
              }}>
                {getSessionCode(sessionId)}
              </div>
            </div>

            {/* QR Code */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '0.75rem'
            }}>
              <QRCodeSVG
                value={`${window.location.origin}/buzzer?session=${sessionId}`}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Boutons d'actions */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getSessionCode(sessionId));
                  setDebugInfo('✅ Code copié !');
                }}
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(124, 58, 237, 0.3)',
                  border: '1px solid #7c3aed',
                  fontSize: '0.9rem',
                  borderRadius: '0.5rem',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                📋 Copier le code
              </button>
              <button
                onClick={() => window.open('/tv', '_blank')}
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.3)',
                  border: '1px solid #10b981',
                  fontSize: '0.9rem',
                  borderRadius: '0.5rem',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                📺 Ouvrir TV
              </button>
              <button
                onClick={toggleQRCodeOnTV}
                style={{
                  padding: '0.75rem',
                  backgroundColor: showQRCode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                  border: showQRCode ? '1px solid #ef4444' : '1px solid #10b981',
                  fontSize: '0.9rem',
                  borderRadius: '0.5rem',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                {showQRCode ? '🔴 Masquer QR Code sur TV' : '📱 Afficher QR Code sur TV'}
              </button>
              <button
                onClick={() => setShowSessionModal(false)}
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(156, 163, 175, 0.3)',
                  border: '1px solid #9ca3af',
                  fontSize: '0.9rem',
                  borderRadius: '0.5rem',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

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
              backgroundColor: '#1f2937',
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

      {/* Modal Nettoyage Firebase */}
      {showFirebaseCleanup && (
        <FirebaseCleanup
          sessionId={sessionId}
          onClose={() => setShowFirebaseCleanup(false)}
        />
      )}

      {/* Audio caché pour MP3 */}
      {musicSource === 'mp3' && (
        <audio ref={mp3Mode.audioRef} style={{ display: 'none' }} />
      )}
    </div>
  );
}
