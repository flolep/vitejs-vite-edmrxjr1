import React, { useState, useRef, useEffect } from 'react';
import { database, auth } from './firebase';
import { ref, onValue, remove, set } from 'firebase/database';
import { spotifyService } from './spotifyService';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';

// Import des composants
import Login from './components/Login';
import SpotifyConnection from './components/master/SpotifyConnection';
import PlaylistSelector from './components/master/PlaylistSelector';
import PlayerControls from './components/master/PlayerControls';
import ScoreDisplay from './components/master/ScoreDisplay';
import BuzzAlert from './components/master/BuzzAlert';
import GameSettings from './components/master/GameSettings';

/**
 * Calcule les points disponibles selon le nouveau système
 */
function calculatePoints(chrono, songDuration) {
  const maxPoints = 2500;
  let availablePoints = maxPoints;
  
  if (chrono <= 5) {
    availablePoints = 2500;
  } else if (chrono < 15) {
    const timeInPhase = chrono - 5;
    const phaseDuration = 10;
    availablePoints = 2000 - (timeInPhase / phaseDuration) * 1000;
  } else {
    const timeAfter15 = chrono - 15;
    const remainingDuration = Math.max(1, songDuration - 15);
    const decayRatio = Math.min(1, timeAfter15 / remainingDuration);
    availablePoints = 500 * (1 - decayRatio);
  }
  
  return Math.max(0, Math.round(availablePoints));
}

export default function Master() {
  // États d'authentification et session
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);

  // États des paramètres de cooldown
  const [cooldownThreshold, setCooldownThreshold] = useState(2); // Nombre de bonnes réponses d'affilée
  const [cooldownDuration, setCooldownDuration] = useState(5000); // Durée du freeze en ms
  const [showCooldownSettings, setShowCooldownSettings] = useState(false);

  // État du mode de jeu
  const [gameMode, setGameMode] = useState(null); // 'mp3' | 'spotify-import' | 'spotify-ai'
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [isCreatingAIPlaylist, setIsCreatingAIPlaylist] = useState(false);

  // États principaux
  const [playlist, setPlaylist] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [buzzedTeam, setBuzzedTeam] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [currentChrono, setCurrentChrono] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const [buzzedPlayerKey, setBuzzedPlayerKey] = useState(null);
  
  // États statistiques
  const [showStats, setShowStats] = useState(false);
  const [buzzStats, setBuzzStats] = useState([]);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  
  // États Spotify
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [spotifyPlayer, setSpotifyPlayer] = useState(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState(null);
  const [isSpotifyMode, setIsSpotifyMode] = useState(false);
  const [spotifyPosition, setSpotifyPosition] = useState(0);
  const [lastPlayedTrack, setLastPlayedTrack] = useState(null);
  
  const audioRef = useRef(null);
  const buzzerSoundRef = useRef(null);

  // Gestion de l'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Le code de session sera généré lors du clic sur "Nouvelle partie"
    });
    return () => unsubscribe();
  }, []);

  // Vérifier connexion Spotify au chargement
  useEffect(() => {
    const token = sessionStorage.getItem('spotify_access_token');
    if (token) {
      setSpotifyToken(token);
      loadSpotifyPlaylists(token);
    }
  }, []);

  // Créer le son de buzzer
  useEffect(() => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const playBuzzerSound = () => {
      const now = audioContext.currentTime;
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      osc1.type = 'sawtooth';
      
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.5, now + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      
      osc1.start(now);
      osc1.stop(now + 0.3);
    };
    
    buzzerSoundRef.current = { play: playBuzzerSound };
  }, []);

  // Synchroniser chrono avec Firebase
  useEffect(() => {
    if (!sessionId) return;
    const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
    const unsubscribe = onValue(chronoRef, (snapshot) => {
      const value = snapshot.val();
      if (value !== null) {
        setCurrentChrono(value);
      }
    });
    return () => unsubscribe();
  }, [sessionId]);

  // Mettre à jour le chrono toutes les 100ms quand la musique joue
  useEffect(() => {
    if (!sessionId) return;
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentChrono(prev => {
          const newChrono = parseFloat((prev + 0.1).toFixed(1));
          // Écrire dans Firebase
          const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
          set(chronoRef, newChrono);
          return newChrono;
        });
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, sessionId]);

// Écouter les buzz
useEffect(() => {
  const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
  const unsubscribe = onValue(buzzRef, (snapshot) => {
    const buzzData = snapshot.val();
    
    if (buzzData && isPlaying) {
      const { team } = buzzData;
      // ✅ FIX : Utiliser le chrono actuel au lieu d'attendre buzzData.time
      const buzzTime = currentChrono;

      setBuzzedTeam(team);
      setBuzzedPlayerKey(buzzData.playerFirebaseKey || null);
      
      if (buzzerSoundRef.current) {
        buzzerSoundRef.current.play();
      }
      
      if (isSpotifyMode && spotifyToken) {
        spotifyService.pausePlayback(spotifyToken);
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
      
      setIsPlaying(false);
      const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
      set(playingRef, false);

      // ✅ Enregistrer TOUS les buzz (gagnants et perdants)
      const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times/${currentTrack}`);
      const newBuzz = {
        team,
        teamName: team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2',
        time: buzzTime,
        playerName: buzzData.playerName || 'Anonyme',
        songTitle: playlist[currentTrack]?.title || 'Inconnu',
        songArtist: playlist[currentTrack]?.artist || 'Inconnu',
        trackNumber: currentTrack + 1,
        timestamp: Date.now(),
        correct: null, // Sera mis à jour à true ou false plus tard
        points: 0
      };

      onValue(buzzTimesRef, (snapshot) => {
        const existingBuzzes = snapshot.val() || [];
        set(buzzTimesRef, [...existingBuzzes, newBuzz]);
      }, { onlyOnce: true });

      setDebugInfo(`🔔 ${team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2'} a buzzé à ${buzzTime.toFixed(1)}s !`);
    }
  });

  return () => unsubscribe();
}, [isPlaying, isSpotifyMode, spotifyToken, currentChrono, currentTrack]);

  // === SPOTIFY ===
  const handleSpotifyLogin = () => {
    window.location.href = spotifyService.getAuthUrl();
  };

  const loadSpotifyPlaylists = async (token) => {
    try {
      const allPlaylists = await spotifyService.getUserPlaylists(token);

      // OPTION 1 : Afficher TOUTES les playlists (filtre désactivé)
      setSpotifyPlaylists(allPlaylists);
      setDebugInfo(`✅ ${allPlaylists.length} playlist(s) chargées`);

      // OPTION 2 : Filtrer uniquement celles avec #BT (décommentez pour activer)
      // const filteredPlaylists = allPlaylists.filter(playlist =>
      //   playlist.description && playlist.description.includes('#BT')
      // );
      // setSpotifyPlaylists(filteredPlaylists);
      // if (filteredPlaylists.length === 0) {
      //   setDebugInfo('⚠️ Aucune playlist avec le tag #BT trouvée');
      // } else {
      //   setDebugInfo(`✅ ${filteredPlaylists.length} playlist(s) avec tag #BT`);
      // }
    } catch (error) {
      console.error('Error loading playlists:', error);
      setDebugInfo('❌ Erreur chargement playlists');
    }
  };

  const handleSelectPlaylist = async (playlistId) => {
    try {
      setDebugInfo('⏳ Import en cours...');
      const tracks = await spotifyService.getPlaylistTracks(spotifyToken, playlistId);

      setPlaylist(tracks);
      setIsSpotifyMode(true);
      setShowPlaylistSelector(false);
      setDebugInfo(`✅ ${tracks.length} morceaux importés`);

      // Stocker l'ID de playlist dans Firebase
      if (sessionId) {
        const playlistIdRef = ref(database, `sessions/${sessionId}/playlistId`);
        await set(playlistIdRef, playlistId);
        console.log(`✅ Playlist ID ${playlistId} stocké dans Firebase`);
      }

      if (!spotifyPlayer) {
        const player = await spotifyService.initPlayer(
          spotifyToken,
          (deviceId) => setSpotifyDeviceId(deviceId),
          (state) => {
            if (state) {
              setSongDuration(state.duration / 1000);
              setSpotifyPosition(state.position);
            }
          }
        );
        setSpotifyPlayer(player);
      }

      const scoresRef = ref(database, `sessions/${sessionId}/scores`);
      set(scoresRef, { team1: 0, team2: 0 });
      const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
      set(chronoRef, 0);
      setScores({ team1: 0, team2: 0 });
      setCurrentChrono(0);

    } catch (error) {
      console.error('Error importing playlist:', error);
      setDebugInfo('❌ Erreur import playlist');
    }
  };

  // === MODE MP3 ===
  const handleManualAdd = () => {
    const newTrack = {
      title: 'En attente de fichier...',
      artist: '',
      audioUrl: null,
      imageUrl: null,
      revealed: false
    };

    if (playlist.length === 0 && sessionId) {
      const scoresRef = ref(database, `sessions/${sessionId}/scores`);
      set(scoresRef, { team1: 0, team2: 0 });
      const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
      set(chronoRef, 0);
      const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
      set(playingRef, false);
      setScores({ team1: 0, team2: 0 });
      setCurrentChrono(0);
    }

    setPlaylist([...playlist, newTrack]);
    setIsSpotifyMode(false);
  };

  const handleImageForTrack = (index, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const updatedPlaylist = [...playlist];
      updatedPlaylist[index].imageUrl = e.target.result;
      setPlaylist(updatedPlaylist);
      setDebugInfo(`✅ Image chargée`);
    };
    reader.onerror = () => setDebugInfo(`❌ Erreur lecture image`);
    reader.readAsDataURL(file);
  };

  const handleAudioForTrack = (index, file) => {
    setDebugInfo(`Chargement de ${file.name}...`);
    
    const fileName = file.name.replace(/\.(mp3|wav|ogg|m4a)$/i, '');
    let title = fileName;
    let artist = '';
    
    if (fileName.includes(' - ')) {
      const parts = fileName.split(' - ');
      artist = parts[0].trim();
      title = parts[1].trim();
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const updatedPlaylist = [...playlist];
      updatedPlaylist[index].audioUrl = e.target.result;
      updatedPlaylist[index].fileName = file.name;
      updatedPlaylist[index].title = title;
      updatedPlaylist[index].artist = artist;
      setPlaylist(updatedPlaylist);
      setDebugInfo(`✅ ${file.name} chargé`);
    };
    reader.onerror = () => setDebugInfo(`❌ Erreur lecture fichier`);
    reader.readAsDataURL(file);
  };

const togglePlay = async () => {
  if (!sessionId) {
    setDebugInfo('❌ Aucune session active');
    return;
  }

  if (!isPlaying) {
    // ✅ ACTIVER LES COOLDOWNS EN ATTENTE avant de démarrer la chanson
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
                cooldownEnd: Date.now() + cooldownDuration, // Le décompte commence MAINTENANT
                hasCooldownPending: false
              });
              console.log(`🔥 Cooldown de ${cooldownDuration / 1000}s activé pour ${playerData.name} au démarrage de la chanson`);
            }
          }
        }
      }
    };

    // IMPORTANT : Attendre l'activation des cooldowns AVANT de continuer
    await activatePendingCooldowns();

    // Réinitialiser l'état du buzz quand on démarre une nouvelle chanson
    setBuzzedTeam(null);
    const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
    remove(buzzRef);
  }
  
  if (isSpotifyMode) {
    if (!spotifyToken || !spotifyDeviceId) {
      setDebugInfo('❌ Player Spotify non initialisé');
      return;
    }

    try {
      if (isPlaying) {
        const stateResponse = await fetch('https://api.spotify.com/v1/me/player', {
          headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });
        
        if (stateResponse.ok) {
          const playerState = await stateResponse.json();
          setSpotifyPosition(playerState.progress_ms);
        }
        
        await spotifyService.pausePlayback(spotifyToken);
        setIsPlaying(false);
        setDebugInfo('⏸️ Pause');
        
        const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
        set(playingRef, false);
      } else {
        const isNewTrack = lastPlayedTrack !== currentTrack;
        const startPosition = isNewTrack ? 0 : spotifyPosition;
        
        await spotifyService.playTrack(
          spotifyToken,
          spotifyDeviceId,
          playlist[currentTrack].spotifyUri,
          startPosition
        );
        
        setIsPlaying(true);
        setLastPlayedTrack(currentTrack);
        setDebugInfo('▶️ Lecture');

        const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
        set(playingRef, true);

        const songRef = ref(database, `sessions/${sessionId}/currentSong`);
        set(songRef, {
          title: playlist[currentTrack].title,
          artist: playlist[currentTrack].artist,
          imageUrl: playlist[currentTrack].imageUrl,
          revealed: false,
          number: currentTrack + 1
        });

        // Écrire la durée de la chanson dans Firebase
        const duration = playlist[currentTrack].duration || 30;
        setSongDuration(duration);
        const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
        set(durationRef, duration);
      }
    } catch (error) {
      console.error('Erreur Spotify:', error);
      setDebugInfo('❌ Erreur Spotify');
    }
  } else {
    // Mode MP3
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setDebugInfo('⏸️ Pause');
      
      const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
      set(playingRef, false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      setDebugInfo('▶️ Lecture');
      
      const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
      set(playingRef, true);
      
      const songRef = ref(database, `sessions/${sessionId}/currentSong`);
      set(songRef, {
        title: playlist[currentTrack].title,
        artist: playlist[currentTrack].artist,
        imageUrl: playlist[currentTrack].imageUrl,
        revealed: false,
        number: currentTrack + 1
      });
    }
  }
};

  const nextTrack = () => {
    if (currentTrack < playlist.length - 1) {
      if (isSpotifyMode && spotifyToken) {
        spotifyService.pausePlayback(spotifyToken);
      } else if (audioRef.current) {
        audioRef.current.pause();
      }

      const newTrackIndex = currentTrack + 1;
      setCurrentTrack(newTrackIndex);
      setIsPlaying(false);
      setBuzzedTeam(null);

      if (!sessionId) return;

      const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
      remove(buzzRef);

      setSpotifyPosition(0);

      // Réinitialiser le chrono (local + Firebase)
      setCurrentChrono(0);
      const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
      set(chronoRef, 0);

      const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
      set(playingRef, false);

      const trackNumberRef = ref(database, `sessions/${sessionId}/currentTrackNumber`);
      set(trackNumberRef, newTrackIndex);

      const songRef = ref(database, `sessions/${sessionId}/currentSong`);
      set(songRef, {
        title: '',
        artist: '',
        imageUrl: null,
        revealed: false,
        number: newTrackIndex + 1
      });

      // Charger l'audio en mode MP3
      if (!isSpotifyMode && audioRef.current && playlist[newTrackIndex].audioUrl) {
        audioRef.current.src = playlist[newTrackIndex].audioUrl;
        audioRef.current.load();
      }
    }
  };

  const prevTrack = () => {
    if (currentTrack > 0) {
      if (isSpotifyMode && spotifyToken) {
        spotifyService.pausePlayback(spotifyToken);
      } else if (audioRef.current) {
        audioRef.current.pause();
      }

      const newTrackIndex = currentTrack - 1;
      setCurrentTrack(newTrackIndex);
      setIsPlaying(false);
      setBuzzedTeam(null);

      if (!sessionId) return;

      const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
      remove(buzzRef);

      setSpotifyPosition(0);

      // Réinitialiser le chrono (local + Firebase)
      setCurrentChrono(0);
      const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
      set(chronoRef, 0);

      const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
      set(playingRef, false);

      const trackNumberRef = ref(database, `sessions/${sessionId}/currentTrackNumber`);
      set(trackNumberRef, newTrackIndex);

      const songRef = ref(database, `sessions/${sessionId}/currentSong`);
      set(songRef, {
        title: '',
        artist: '',
        imageUrl: null,
        revealed: false,
        number: newTrackIndex + 1
      });

      // Charger l'audio en mode MP3
      if (!isSpotifyMode && audioRef.current && playlist[newTrackIndex].audioUrl) {
        audioRef.current.src = playlist[newTrackIndex].audioUrl;
        audioRef.current.load();
      }
    }
  };

const revealAnswer = async () => {
  // ✅ Marquer le dernier buzz de ce track comme incorrect
  const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times/${currentTrack}`);
  onValue(buzzTimesRef, (snapshot) => {
    const existingBuzzes = snapshot.val() || [];
    if (existingBuzzes.length > 0) {
      // Mettre à jour le dernier buzz (celui qui vient d'être invalidé)
      const lastIndex = existingBuzzes.length - 1;
      existingBuzzes[lastIndex].correct = false;
      existingBuzzes[lastIndex].points = 0;
      set(buzzTimesRef, existingBuzzes);
    }
  }, { onlyOnce: true });

  // Reset le streak du joueur qui s'est trompé
  const buzzRef = ref(database, `sessions/${sessionId}/buzz`);

  onValue(buzzRef, async (snapshot) => {
    const buzzData = snapshot.val();
    if (buzzData && buzzData.playerFirebaseKey) { // ✅ Vérifier la clé
      const playerFirebaseKey = buzzData.playerFirebaseKey;
      const teamKey = buzzData.team === 'team1' ? 'team1' : 'team2';

      // ✅ Accès DIRECT avec la clé Firebase
      const playerRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}/${playerFirebaseKey}`);

      onValue(playerRef, async (playerSnapshot) => {
        const playerData = playerSnapshot.val();

        if (playerData) {
          await set(playerRef, {
            ...playerData,
            consecutiveCorrect: 0 // Reset le streak
          });
        }
      }, { onlyOnce: true });
    }
  }, { onlyOnce: true });

  const updatedPlaylist = [...playlist];
  updatedPlaylist[currentTrack].revealed = true;
  setPlaylist(updatedPlaylist);

  setBuzzedTeam(null);
  remove(buzzRef);

  // ARRÊTER la lecture et figer le chrono (personne n'a trouvé)
  const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
  set(playingRef, false);
  setIsPlaying(false);

  // Arrêter la musique
  if (isSpotifyMode && spotifyToken) {
    try {
      await spotifyService.pausePlayback(spotifyToken);
    } catch (error) {
      console.error('Erreur pause Spotify:', error);
    }
  } else if (audioRef.current) {
    audioRef.current.pause();
  }

  const songRef = ref(database, `sessions/${sessionId}/currentSong`);
  set(songRef, {
    title: updatedPlaylist[currentTrack].title,
    artist: updatedPlaylist[currentTrack].artist,
    imageUrl: updatedPlaylist[currentTrack].imageUrl,
    revealed: true,
    number: currentTrack + 1
  });

  setDebugInfo(`✅ Réponse révélée - Chrono figé à ${currentChrono.toFixed(1)}s`);
};

const addPoint = async (team) => {
  const points = calculatePoints(currentChrono, songDuration);

  const newScores = { ...scores, [team]: scores[team] + points };
  setScores(newScores);

  const scoresRef = ref(database, `sessions/${sessionId}/scores`);
  set(scoresRef, newScores);

  // Référence au buzz actuel
  const buzzRef = ref(database, `sessions/${sessionId}/buzz`);

  // ✅ Marquer le dernier buzz de ce track comme correct et ajouter les points
  const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times/${currentTrack}`);
  onValue(buzzTimesRef, (snapshot) => {
    const existingBuzzes = snapshot.val() || [];
    if (existingBuzzes.length > 0) {
      // Mettre à jour le dernier buzz (celui qui vient d'être validé)
      const lastIndex = existingBuzzes.length - 1;
      existingBuzzes[lastIndex].correct = true;
      existingBuzzes[lastIndex].points = points;
      set(buzzTimesRef, existingBuzzes);
    }
  }, { onlyOnce: true });

  // ✅ Mettre à jour les stats du joueur en utilisant SA CLÉ FIREBASE
  
  onValue(buzzRef, async (snapshot) => {
    const buzzData = snapshot.val();
    if (buzzData && buzzData.playerFirebaseKey) { // ✅ Vérifier la clé
      const playerFirebaseKey = buzzData.playerFirebaseKey;
      const teamKey = team === 'team1' ? 'team1' : 'team2';
      
      // ✅ Accès DIRECT avec la clé Firebase
      const playerRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}/${playerFirebaseKey}`);
      
      onValue(playerRef, async (playerSnapshot) => {
        const playerData = playerSnapshot.val();
        
        if (playerData) {
          const consecutiveCorrect = (playerData.consecutiveCorrect || 0) + 1;
          const correctCount = (playerData.correctCount || 0) + 1;
          
          const updates = {
            consecutiveCorrect: consecutiveCorrect,
            correctCount: correctCount,
            buzzCount: (playerData.buzzCount || 0) + 1
          };

          // Si seuil de bonnes réponses consécutives atteint → COOLDOWN EN ATTENTE !
          if (consecutiveCorrect >= cooldownThreshold) {
            updates.hasCooldownPending = true; // Le cooldown sera activé au prochain play
            updates.consecutiveCorrect = 0;
            console.log(`🔥 ${playerData.name} aura un COOLDOWN à la prochaine chanson ! Total: ${correctCount} bonnes réponses`);
          } else {
            console.log(`✅ ${playerData.name} : ${correctCount} bonne(s) réponse(s)`);
          }

          await set(playerRef, { ...playerData, ...updates });
        }
      }, { onlyOnce: true });
    }
  }, { onlyOnce: true });
  
  setBuzzedTeam(null);
  remove(buzzRef);
  
  const updatedPlaylist = [...playlist];
  updatedPlaylist[currentTrack].revealed = true;
  setPlaylist(updatedPlaylist);
  
  const songRef = ref(database, `sessions/${sessionId}/currentSong`);
  set(songRef, {
    title: updatedPlaylist[currentTrack].title,
    artist: updatedPlaylist[currentTrack].artist,
    imageUrl: updatedPlaylist[currentTrack].imageUrl,
    revealed: true,
    number: currentTrack + 1
  });
  
  setDebugInfo(`✅ ${points} points pour ${team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2'}`);
};

  // === GESTION DE PARTIE ===
  const resetScores = () => {
    // Message différent selon si c'est la première partie ou non
    const confirmMessage = sessionId
      ? '⚠️ Créer une nouvelle partie ? Cela générera un nouveau code de session.'
      : '🎮 Créer une nouvelle partie ?';

    if (!confirm(confirmMessage)) return;

    // Afficher la modale de sélection de mode
    setShowModeSelector(true);
  };

  // Fonction pour créer une playlist avec l'IA via n8n
  const createAIPlaylist = async (newSessionId) => {
    try {
      setIsCreatingAIPlaylist(true);
      setDebugInfo('🤖 Génération de la playlist par l\'IA...');

      const response = await fetch('https://n8n.srv1038816.hstgr.cloud/webhook-test/create-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: newSessionId
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la création de la playlist IA');
      }

      const data = await response.json();
      const playlistId = data.playlistId;

      if (!playlistId) {
        throw new Error('Aucun playlistId retourné par le webhook');
      }

      // Stocker le playlistId dans Firebase
      const playlistIdRef = ref(database, `sessions/${newSessionId}/playlistId`);
      await set(playlistIdRef, playlistId);
      console.log(`✅ Playlist IA créée avec ID ${playlistId} stocké dans Firebase`);

      // Charger les tracks de la playlist créée
      const tracks = await spotifyService.getPlaylistTracks(spotifyToken, playlistId);
      setPlaylist(tracks);
      setIsSpotifyMode(true);
      setDebugInfo(`✅ Playlist IA créée : ${tracks.length} morceaux importés`);

      // Initialiser le player Spotify si nécessaire
      if (!spotifyPlayer) {
        const player = await spotifyService.initPlayer(
          spotifyToken,
          (deviceId) => setSpotifyDeviceId(deviceId),
          (state) => {
            if (state) {
              setSongDuration(state.duration / 1000);
              setSpotifyPosition(state.position);
            }
          }
        );
        setSpotifyPlayer(player);
      }

      setIsCreatingAIPlaylist(false);
    } catch (error) {
      console.error('❌ Erreur création playlist IA:', error);
      setDebugInfo('❌ Erreur lors de la création de la playlist IA');
      setIsCreatingAIPlaylist(false);
    }
  };

  // Créer une nouvelle partie avec le mode sélectionné
  const createNewGameWithMode = async (selectedMode) => {
    setGameMode(selectedMode);
    setShowModeSelector(false);

    // Marquer l'ancienne session comme inactive (si elle existe)
    if (sessionId) {
      const oldSessionRef = ref(database, `sessions/${sessionId}`);
      set(oldSessionRef, {
        active: false,
        endedAt: Date.now()
      });
    }

    // Générer un nouveau code de session
    const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionId(newSessionId);

    // Créer la nouvelle session dans Firebase
    set(ref(database, `sessions/${newSessionId}`), {
      createdBy: user.uid,
      createdAt: Date.now(),
      active: true,
      gameMode: selectedMode
    });

    // Réinitialiser tous les états
    const newScores = { team1: 0, team2: 0 };
    setScores(newScores);
    const scoresRef = ref(database, `sessions/${newSessionId}/scores`);
    set(scoresRef, newScores);

    setPlaylist([]);
    setCurrentTrack(0);
    setIsPlaying(false);

    const chronoRef = ref(database, `sessions/${newSessionId}/chrono`);
    set(chronoRef, 0);
    setCurrentChrono(0);

    const playingRef = ref(database, `sessions/${newSessionId}/isPlaying`);
    set(playingRef, false);

    const songRef = ref(database, `sessions/${newSessionId}/currentSong`);
    set(songRef, null);

    const gameStatusRef = ref(database, `sessions/${newSessionId}/game_status`);
    set(gameStatusRef, { ended: false });

    setShowQRCode(false);
    const qrCodeRef = ref(database, `sessions/${newSessionId}/showQRCode`);
    set(qrCodeRef, false);

    setDebugInfo(`🔄 Nouvelle partie créée ! Code: ${newSessionId}`);

    // Si mode IA, créer automatiquement la playlist
    if (selectedMode === 'spotify-ai') {
      await createAIPlaylist(newSessionId);
    }
  };

const loadBuzzStats = (shouldShow = true) => {
  if (shouldShow === false) {
    // Fermer la modale
    setShowStats(false);
    return;
  }
  
  // Ouvrir la modale et charger les données
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

  const handleEndGame = () => {
    setShowEndGameConfirm(true);
  };

  const endGame = () => {
    const gameStatusRef = ref(database, `sessions/${sessionId}/game_status`);
    set(gameStatusRef, {
      ended: true,
      winner: scores.team1 > scores.team2 ? 'team1' : scores.team2 > scores.team1 ? 'team2' : 'draw',
      final_scores: scores,
      timestamp: Date.now()
    });

    setShowEndGameConfirm(false);
    setDebugInfo('🎉 Partie terminée !');
  };

  const currentSong = playlist[currentTrack];
  const availablePoints = calculatePoints(currentChrono, songDuration);

  // Gestion de la déconnexion
  const handleLogout = async () => {
    await signOut(auth);
    setSessionId(null);
  };

  // Charger une chanson depuis la playlist
  const loadTrack = (index) => {
    // Ne pas charger si la chanson a déjà été révélée
    if (playlist[index].revealed) return;

    // Arrêter la musique en cours
    if (isSpotifyMode && spotifyToken) {
      spotifyService.pausePlayback(spotifyToken);
    } else if (audioRef.current) {
      audioRef.current.pause();
    }

    setCurrentTrack(index);
    setIsPlaying(false);
    setBuzzedTeam(null);

    const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
    remove(buzzRef);

    setSpotifyPosition(0);
    setCurrentChrono(0);
    const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
    set(chronoRef, 0);

    const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
    set(playingRef, false);

    const trackNumberRef = ref(database, `sessions/${sessionId}/currentTrackNumber`);
    set(trackNumberRef, index);

    const songRef = ref(database, `sessions/${sessionId}/currentSong`);
    set(songRef, {
      title: '',
      artist: '',
      imageUrl: null,
      revealed: false,
      number: index + 1
    });

    // Charger l'audio en mode MP3
    if (!isSpotifyMode && audioRef.current && playlist[index].audioUrl) {
      audioRef.current.src = playlist[index].audioUrl;
      audioRef.current.load();
    }

    setDebugInfo(`🎵 Chanson #${index + 1} chargée`);
  };

  // Afficher/masquer le QR Code sur TV
  const toggleQRCodeOnTV = () => {
    const qrCodeRef = ref(database, `sessions/${sessionId}/showQRCode`);
    set(qrCodeRef, !showQRCode);
    setShowQRCode(!showQRCode);
  };

  // Si l'utilisateur n'est pas connecté, afficher le Login
  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

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
          🎵 BLIND TEST
        </h1>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Statut Spotify */}
          {spotifyToken ? (
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
          ) : null}

          {/* Bouton Session/QR Code */}
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
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(124, 58, 237, 0.4)'}
              onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(124, 58, 237, 0.3)'}
            >
              📱 Session
            </button>
          )}

          {/* Boutons d'actions */}
          <button
            onClick={resetScores}
            className="btn"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(156, 163, 175, 0.3)',
              border: '1px solid #9ca3af',
              fontSize: '0.85rem',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(156, 163, 175, 0.4)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(156, 163, 175, 0.3)'}
          >
            🔄 Nouvelle partie
          </button>
          <button
            onClick={() => loadBuzzStats(true)}
            disabled={playlist.length === 0}
            className="btn"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(124, 58, 237, 0.3)',
              border: '1px solid #7c3aed',
              fontSize: '0.85rem',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: playlist.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: playlist.length === 0 ? 0.5 : 1
            }}
            onMouseOver={(e) => {
              if (playlist.length > 0) e.target.style.backgroundColor = 'rgba(124, 58, 237, 0.4)';
            }}
            onMouseOut={(e) => {
              if (playlist.length > 0) e.target.style.backgroundColor = 'rgba(124, 58, 237, 0.3)';
            }}
          >
            📊 Statistiques
          </button>
          <button
            onClick={() => setShowEndGameConfirm(true)}
            disabled={playlist.length === 0}
            className="btn"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(251, 191, 36, 0.3)',
              border: '1px solid #fbbf24',
              fontSize: '0.85rem',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: playlist.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: playlist.length === 0 ? 0.5 : 1
            }}
            onMouseOver={(e) => {
              if (playlist.length > 0) e.target.style.backgroundColor = 'rgba(251, 191, 36, 0.4)';
            }}
            onMouseOut={(e) => {
              if (playlist.length > 0) e.target.style.backgroundColor = 'rgba(251, 191, 36, 0.3)';
            }}
          >
            🏁 Terminer la partie
          </button>

          <button
            onClick={() => setShowCooldownSettings(true)}
            className="btn"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(59, 130, 246, 0.3)',
              border: '1px solid #3b82f6',
              fontSize: '0.85rem',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.4)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.3)'}
          >
            ⚙️ Réglages
          </button>

          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
          >
            🚪 Déconnexion
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div style={{
        display: 'flex',
        height: 'calc(100vh - 73px)', // 73px = header height
        overflow: 'hidden'
      }}>
        {/* SIDEBAR */}
        <aside style={{
          width: '320px',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {/* Section Connexion Spotify */}
          <SpotifyConnection
            spotifyToken={spotifyToken}
            onConnect={handleSpotifyLogin}
            onShowPlaylists={() => setShowPlaylistSelector(true)}
            onAddManual={handleManualAdd}
            onCreateAIPlaylist={() => createAIPlaylist(sessionId)}
            gameMode={gameMode}
            isCreatingAI={isCreatingAIPlaylist}
            isSpotifyMode={isSpotifyMode}
          />

          {/* Section Playlist */}
          {playlist.length > 0 && (
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  opacity: 0.8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: 0
                }}>
                  📚 Playlist ({playlist.length})
                </h3>
                {!isSpotifyMode && (
                  <button
                    onClick={handleManualAdd}
                    style={{
                      padding: '0.4rem 0.8rem',
                      backgroundColor: 'rgba(124, 58, 237, 0.3)',
                      border: '1px solid #7c3aed',
                      borderRadius: '0.5rem',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    + Ajouter
                  </button>
                )}
              </div>

              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}>
                {playlist.map((track, index) => (
                  <div
                    key={index}
                    onClick={() => loadTrack(index)}
                    style={{
                      padding: '0.6rem',
                      cursor: track.revealed ? 'not-allowed' : 'pointer',
                      opacity: track.revealed ? 0.4 : 1,
                      backgroundColor: index === currentTrack
                        ? 'rgba(124, 58, 237, 0.4)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: index === currentTrack ? '1px solid #7c3aed' : '1px solid transparent',
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s',
                      fontSize: '0.85rem'
                    }}
                    onMouseOver={(e) => {
                      if (!track.revealed) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (index !== currentTrack && !track.revealed) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }
                    }}
                  >
                    <div style={{ fontWeight: '500' }}>
                      {index + 1}. {track.revealed && '✅ '}
                      {track.title}
                    </div>
                    {track.artist && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.2rem' }}>
                        {track.artist}
                      </div>
                    )}
                    {!isSpotifyMode && (
                      <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        fontSize: '0.7rem',
                        marginTop: '0.3rem'
                      }}>
                        <span style={{ color: track.audioUrl ? '#10b981' : '#ef4444' }}>
                          {track.audioUrl ? '✓' : '⚠️'} Audio
                        </span>
                        <span style={{ color: track.imageUrl ? '#10b981' : '#ef4444' }}>
                          {track.imageUrl ? '✓' : '⚠️'} Image
                        </span>
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
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {playlist.length > 0 ? (
            <>
              {/* Scores */}
              <ScoreDisplay scores={scores} />

              {/* Buzz Alert */}
              {buzzedTeam && (
                <BuzzAlert
                  buzzedTeam={buzzedTeam}
                  buzzedPlayerKey={buzzedPlayerKey}
                  currentChrono={currentChrono}
                  availablePoints={availablePoints}
                  onCorrect={() => addPoint(buzzedTeam)}
                  onWrong={revealAnswer}
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
                isSpotifyMode={isSpotifyMode}
                onPrev={prevTrack}
                onTogglePlay={togglePlay}
                onNext={nextTrack}
                onReveal={revealAnswer}
              />

              {/* Debug info */}
              {debugInfo && (
                <div style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                  fontSize: '0.9rem'
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
                  {!sessionId
                    ? 'Cliquez sur "🔄 Nouvelle partie" pour commencer'
                    : 'Connectez-vous à Spotify ou ajoutez des morceaux manuellement'}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modales */}
      <PlaylistSelector
        show={showPlaylistSelector}
        playlists={spotifyPlaylists}
        onClose={() => setShowPlaylistSelector(false)}
        onSelect={handleSelectPlaylist}
      />

      <GameSettings
        playlist={playlist}
        scores={scores}
        showStats={showStats}
        buzzStats={buzzStats}
        showEndGameConfirm={showEndGameConfirm}
        onResetGame={resetScores}
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
                className="btn"
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
                className="btn"
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
                className="btn"
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
                className="btn"
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

      {/* Modale Sélection Mode de Jeu */}
      {showModeSelector && (
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
          onClick={() => setShowModeSelector(false)}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem', textAlign: 'center' }}>
              🎮 Choisissez le mode de jeu
            </h2>
            <p style={{ fontSize: '0.9rem', opacity: 0.7, textAlign: 'center', marginBottom: '2rem' }}>
              Sélectionnez comment vous souhaitez créer votre playlist
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Mode MP3 */}
              <button
                onClick={() => createNewGameWithMode('mp3')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(124, 58, 237, 0.3)',
                  border: '2px solid rgba(124, 58, 237, 0.5)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.5)';
                  e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.8)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.5)';
                }}
              >
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  📁 Mode MP3
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Ajoutez manuellement vos fichiers MP3
                </div>
              </button>

              {/* Mode Spotify Import */}
              <button
                onClick={() => createNewGameWithMode('spotify-import')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(34, 197, 94, 0.3)',
                  border: '2px solid rgba(34, 197, 94, 0.5)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.5)';
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.8)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)';
                }}
              >
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  🎵 Import Spotify
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Importez une de vos playlists Spotify existantes
                </div>
              </button>

              {/* Mode Spotify IA */}
              <button
                onClick={() => createNewGameWithMode('spotify-ai')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                  border: '2px solid rgba(59, 130, 246, 0.5)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.5)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.8)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }}
              >
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  🤖 Génération IA
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Laissez l'IA créer une playlist personnalisée pour vos joueurs
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowModeSelector(false)}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem',
                width: '100%',
                backgroundColor: 'rgba(107, 114, 128, 0.3)',
                border: '1px solid rgba(107, 114, 128, 0.5)',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>
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
                className="btn"
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
                className="btn"
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

      {/* Audio caché */}
      <audio ref={audioRef} style={{ display: 'none' }} />
      <audio ref={buzzerSoundRef} src="/buzzer.mp3" preload="auto" style={{ display: 'none' }} />
    </div>
  );
}
