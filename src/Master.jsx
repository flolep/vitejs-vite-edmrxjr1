import React, { useState, useRef, useEffect } from 'react';
import { database, auth } from './firebase';
import { ref, onValue, set, update } from 'firebase/database';
import { spotifyService } from './spotifyService';
import { n8nService } from './n8nService';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import { deactivatePreviousSession } from './utils/sessionCleanup';

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
  const [debugInfo, setDebugInfo] = useState('');

  // États de cooldown
  const [cooldownThreshold, setCooldownThreshold] = useState(2);
  const [cooldownDuration, setCooldownDuration] = useState(5000);

  // États statistiques
  const [buzzStats, setBuzzStats] = useState([]);

  // États Spotify
  const [playerAdapter, setPlayerAdapter] = useState(null);

  // États préférences joueurs (mode Spotify IA)
  const [playersPreferences, setPlayersPreferences] = useState([]);
  const [isGeneratingPlaylist, setIsGeneratingPlaylist] = useState(false);
  const [playlistPollAttempt, setPlaylistPollAttempt] = useState(0);

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

  // Hooks spécifiques par mode
  const mp3Mode = useMP3Mode(playlist, setPlaylist, sessionId);

  const spotifyAutoMode = useSpotifyAutoMode(spotifyToken, sessionId);

  const spotifyAIMode = useSpotifyAIMode(spotifyToken, sessionId, musicSource);

  const quizMode = useQuizMode(sessionId, currentTrack, playlist, currentChronoRef);

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
  useEffect(() => {
    if (!user || !initialSessionId) return;

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
          }
        }
      }
    }, { onlyOnce: true });
  }, [initialSessionId, user, spotifyToken]);

  // Synchroniser la playlist du mode Spotify IA avec la playlist globale
  useEffect(() => {
    if (musicSource === 'spotify-ai' && spotifyAIMode.playlist && spotifyAIMode.playlist.length > 0) {
      console.log('🔄 [MASTER] Synchronisation de la playlist Spotify IA:', spotifyAIMode.playlist.length, 'chansons');
      setPlaylist(spotifyAIMode.playlist);
    }
  }, [musicSource, spotifyAIMode.playlist]);

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

  // Créer le player adapter selon le mode
  useEffect(() => {
    if (musicSource === 'mp3') {
      const adapter = createPlayerAdapter('mp3', { audioRef: mp3Mode.audioRef });
      setPlayerAdapter(adapter);
    } else if (musicSource === 'spotify-auto' && spotifyAutoMode.spotifyDeviceId) {
      const adapter = createPlayerAdapter('spotify-auto', {
        token: spotifyToken,
        deviceId: spotifyAutoMode.spotifyDeviceId,
        player: spotifyAutoMode.spotifyPlayer
      });
      setPlayerAdapter(adapter);
    } else if (musicSource === 'spotify-ai' && spotifyAIMode.spotifyDeviceId) {
      const adapter = createPlayerAdapter('spotify-ai', {
        token: spotifyToken,
        deviceId: spotifyAIMode.spotifyDeviceId,
        player: spotifyAIMode.spotifyPlayer
      });
      setPlayerAdapter(adapter);
    }
  }, [musicSource, spotifyToken, spotifyAutoMode.spotifyDeviceId, spotifyAIMode.spotifyDeviceId]);

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
    n8nService.generatePlaylistWithAllPreferences({
      playlistId: initialPlaylistId,
      players: players
    })
      .then(result => {
        console.log('✅ Playlist générée (en arrière-plan):', result);
        console.log(`   🎵 ${result.totalSongs} chansons ajoutées pour ${result.totalPlayers} joueurs`);
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

    // ⏰ Polling automatique pour recharger la playlist
    // S'arrête automatiquement quand des chansons sont détectées
    let pollAttempts = 0;
    const maxPollAttempts = 10; // 10 tentatives = 2min30
    const pollInterval = 15000; // 15 secondes

    const pollPlaylist = setInterval(async () => {
      pollAttempts++;
      setPlaylistPollAttempt(pollAttempts);
      console.log(`🔄 Tentative ${pollAttempts}/${maxPollAttempts} de rechargement de la playlist...`);

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
          setDebugInfo('⏱️ Génération en cours... Rafraîchissez manuellement si besoin');
          setIsGeneratingPlaylist(false);
          setPlaylistPollAttempt(0);
          clearInterval(pollPlaylist);
        }
      } catch (error) {
        console.error('❌ Erreur lors du rechargement:', error);
        if (pollAttempts >= maxPollAttempts) {
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
    if ((musicSource === 'spotify-auto' || musicSource === 'spotify-ai') && !spotifyToken) {
      setDebugInfo('⚠️ Spotify non connecté - Veuillez vous reconnecter à Spotify pour lire cette playlist');
      console.error('❌ Token Spotify manquant');
      updateIsPlaying(false);
      return;
    }

    // Si en mode Spotify et player/deviceId manquant, tenter réinitialisation
    if ((musicSource === 'spotify-auto' || musicSource === 'spotify-ai') && !playerAdapter) {
      console.log('⚠️ Player non initialisé, tentative de réinitialisation...');
      setDebugInfo('⏳ Initialisation du player Spotify...');

      try {
        // Réinitialiser le player selon le mode
        if (musicSource === 'spotify-auto') {
          await spotifyAutoMode.initSpotifyPlayer();
        } else if (musicSource === 'spotify-ai') {
          await spotifyAIMode.initSpotifyPlayer();
        }

        // Attendre que le playerAdapter soit créé (max 5 secondes)
        const startTime = Date.now();
        while (!playerAdapter && (Date.now() - startTime) < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!playerAdapter) {
          setDebugInfo('❌ Impossible d\'initialiser le player Spotify. Rafraîchissez la page et reconnectez-vous.');
          updateIsPlaying(false);
          return;
        }

        setDebugInfo('✅ Player Spotify initialisé');
      } catch (error) {
        console.error('❌ Erreur initialisation player:', error);
        setDebugInfo('❌ Erreur initialisation Spotify. Rafraîchissez la page et reconnectez-vous.');
        updateIsPlaying(false);
        return;
      }
    }

    if (!playerAdapter) {
      setDebugInfo('❌ Player non initialisé');
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
        await playerAdapter.play(playlist[currentTrack], currentTrack);
        updateIsPlaying(true);

        // En mode Quiz, générer les réponses
        if (playMode === 'quiz') {
          quizMode.generateQuizAnswers(playlist[currentTrack], playlist);
        }

        // Mettre à jour la chanson courante
        updateCurrentSong({
          title: playlist[currentTrack].title,
          artist: playlist[currentTrack].artist,
          imageUrl: playlist[currentTrack].imageUrl,
          revealed: false,
          number: currentTrack + 1
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
    const duration = playlist[newTrackIndex]?.duration || 30;
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
      number: newTrackIndex + 1
    });

    // Charger l'audio en mode MP3
    if (musicSource === 'mp3' && playerAdapter) {
      playerAdapter.loadTrack(playlist[newTrackIndex]);
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
    const duration = playlist[newTrackIndex]?.duration || 30;
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
      number: newTrackIndex + 1
    });

    // Charger l'audio en mode MP3
    if (musicSource === 'mp3' && playerAdapter) {
      playerAdapter.loadTrack(playlist[newTrackIndex]);
    }
  };

  const jumpToTrack = (trackIndex) => {
    if (trackIndex < 0 || trackIndex >= playlist.length) return;
    if (trackIndex === currentTrack) return;

    if (playerAdapter) {
      playerAdapter.pause().catch(console.error);
    }

    updateCurrentTrack(trackIndex);
    updateIsPlaying(false);
    setBuzzedTeam(null);
    clearBuzz();
    resetChrono();

    // Écrire la durée de la chanson dans Firebase
    const duration = playlist[trackIndex]?.duration || 30;
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
      number: trackIndex + 1
    });

    // Charger l'audio en mode MP3
    if (musicSource === 'mp3' && playerAdapter) {
      playerAdapter.loadTrack(playlist[trackIndex]);
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

    updateCurrentSong({
      title: playlist[currentTrack].title,
      artist: playlist[currentTrack].artist,
      imageUrl: playlist[currentTrack].imageUrl,
      revealed: true,
      number: currentTrack + 1
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

    updateCurrentSong({
      title: playlist[currentTrack].title,
      artist: playlist[currentTrack].artist,
      imageUrl: playlist[currentTrack].imageUrl,
      revealed: true,
      number: currentTrack + 1
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
    setDebugInfo('🎉 Partie terminée ! Session désactivée.');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setSessionId(null);
  };

  const toggleQRCodeOnTV = () => {
    const qrCodeRef = ref(database, `sessions/${sessionId}/showQRCode`);
    set(qrCodeRef, !showQRCode);
    setShowQRCode(!showQRCode);
  };

  // === RENDU ===

  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  const currentSong = playlist[currentTrack];
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

          {musicSource === 'spotify-ai' && playersPreferences.length > 0 && (
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
                {playlist.map((track, index) => (
                  <div
                    key={index}
                    onClick={() => jumpToTrack(index)}
                    style={{
                      padding: '0.6rem',
                      marginBottom: '0.4rem',
                      backgroundColor: index === currentTrack ? 'rgba(124, 58, 237, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '0.5rem',
                      opacity: track.revealed ? 0.4 : 1,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, opacity 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (index !== currentTrack) {
                        e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.2)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (index !== currentTrack) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    <div style={{ fontWeight: '500' }}>
                      {index + 1}. {track.revealed && '✅ '}{track.title}
                    </div>
                    {track.artist && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        {track.artist}
                      </div>
                    )}
                  </div>
                ))}
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
                  onReveal={quizMode.revealQuizAnswer}
                  isRevealed={currentSong?.revealed}
                />
              )}

              {/* Player Controls */}
              <PlayerControls
                currentTrack={currentTrack}
                playlistLength={playlist.length}
                isPlaying={isPlaying}
                currentSong={currentSong}
                currentTrackData={playlist[currentTrack]}
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
                {sessionId}
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
                  navigator.clipboard.writeText(sessionId);
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

      {/* Audio caché pour MP3 */}
      {musicSource === 'mp3' && (
        <audio ref={mp3Mode.audioRef} style={{ display: 'none' }} />
      )}
    </div>
  );
}
