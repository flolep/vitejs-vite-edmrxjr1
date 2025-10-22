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

  const importSpotifyPlaylist = async (playlistId) => {
    try {
      setDebugInfo('⏳ Import en cours...');
      const tracks = await spotifyService.getPlaylistTracks(spotifyToken, playlistId);
      
      setPlaylist(tracks);
      setIsSpotifyMode(true);
      setShowPlaylistSelector(false);
      setDebugInfo(`✅ ${tracks.length} morceaux importés`);
      
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
    
    if (playlist.length === 0) {
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
                cooldownEnd: Date.now() + 5000, // Le décompte commence MAINTENANT
                hasCooldownPending: false
              });
              console.log(`🔥 Cooldown de 5s activé pour ${playerData.name} au démarrage de la chanson`);
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

          // Si 2 bonnes réponses consécutives → COOLDOWN EN ATTENTE !
          if (consecutiveCorrect >= 2) {
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
      active: true
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

  const confirmEndGame = () => {
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
    <div className="bg-gradient">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 className="title">🎵 BLIND TEST 🎵</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {sessionId && (
              <button
                onClick={toggleQRCodeOnTV}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: showQRCode ? '#ef4444' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}
              >
                {showQRCode ? '🔴 Masquer QR Code (TV)' : '📺 Afficher QR Code sur TV'}
              </button>
            )}
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}
            >
              🚪 Déconnexion
            </button>
          </div>
        </div>

        {/* Code de session - visible uniquement après création d'une partie */}
        {sessionId && (
          <div style={{
            backgroundColor: 'rgba(124, 58, 237, 0.2)',
            border: '3px solid #7c3aed',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            <h3 style={{
              fontSize: '1.2rem',
              marginBottom: '1rem',
              color: '#c4b5fd'
            }}>
              📺 Code de session pour l'écran TV
            </h3>
            <div style={{
              fontSize: '3rem',
              fontWeight: 'bold',
              letterSpacing: '0.5rem',
              fontFamily: 'monospace',
              color: '#fbbf24',
              marginBottom: '1rem',
              textShadow: '0 0 10px rgba(251, 191, 36, 0.5)'
            }}>
              {sessionId}
            </div>
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sessionId);
                  setDebugInfo('✅ Code copié !');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}
              >
                📋 Copier le code
              </button>
              <button
                onClick={() => {
                  window.open('/tv', '_blank');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}
              >
                📺 Ouvrir TV dans un nouvel onglet
              </button>
            </div>
            <p style={{
              marginTop: '1rem',
              fontSize: '0.9rem',
              opacity: 0.8
            }}>
              Utilisez ce code pour connecter l'écran TV sur un autre appareil
            </p>
          </div>
        )}

        {/* Connexion Spotify */}
        <SpotifyConnection
          spotifyToken={spotifyToken}
          onConnect={handleSpotifyLogin}
          onShowPlaylists={() => setShowPlaylistSelector(true)}
          onAddManual={handleManualAdd}
        />

        {/* Sélecteur de playlist */}
        <PlaylistSelector
          show={showPlaylistSelector}
          playlists={spotifyPlaylists}
          onSelect={importSpotifyPlaylist}
          onClose={() => setShowPlaylistSelector(false)}
        />

        {/* Scores */}
        <ScoreDisplay scores={scores} buzzedTeam={buzzedTeam} />

        {/* Modal de buzz */}
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

        {/* Paramètres */}
        <GameSettings
          playlist={playlist}
          scores={scores}
          showStats={showStats}
          buzzStats={buzzStats}
          showEndGameConfirm={showEndGameConfirm}
          onResetGame={resetScores}
          onShowStats={loadBuzzStats}
          onEndGame={handleEndGame}
          onConfirmEndGame={confirmEndGame}
          onCancelEndGame={() => setShowEndGameConfirm(false)}
        />

        {/* Lecteur */}
        {playlist.length === 0 ? (
          <div className="player-box text-center">
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              Aucune playlist chargée
            </h3>
            <p>Connectez-vous à Spotify ou ajoutez des morceaux</p>
          </div>
        ) : (
          <>
            <div className="player-box">
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
                Morceau {currentTrack + 1} / {playlist.length}
              </h3>
              
              {currentSong && (
                <>
                  {currentSong.revealed ? (
                    <div className="revealed mb-4">
                      <div style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
                        {currentSong.title}
                      </div>
                      {currentSong.artist && (
                        <div style={{ opacity: 0.8, marginTop: '0.5rem' }}>
                          {currentSong.artist}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-mystery mb-4">🎵 Mystère...</div>
                  )}

                  {currentSong.imageUrl && (
                    <div className="mb-4">
                      <img 
                        src={currentSong.imageUrl} 
                        alt="Album cover" 
                        style={{ 
                          width: '150px', 
                          height: '150px', 
                          objectFit: 'cover', 
                          borderRadius: '0.5rem',
                          margin: '0 auto',
                          display: 'block'
                        }} 
                      />
                    </div>
                  )}
                </>
              )}

              {!isSpotifyMode && (
                <audio 
                  ref={audioRef}
                  src={currentSong?.audioUrl || ''}
                  onEnded={() => setIsPlaying(false)}
                  onLoadedMetadata={(e) => {
                    const duration = e.target.duration;
                    setSongDuration(duration);
                    const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
                    set(durationRef, duration);
                  }}
                />
              )}

              {debugInfo && (
                <div className="debug-info mb-4">{debugInfo}</div>
              )}

              <PlayerControls
                isPlaying={isPlaying}
                currentTrack={currentTrack}
                playlistLength={playlist.length}
                currentSong={currentSong}
                isSpotifyMode={isSpotifyMode}
                onPlay={togglePlay}
                onPrev={prevTrack}
                onNext={nextTrack}
                onReveal={revealAnswer}
              />
            </div>

            {/* Playlist */}
            <div className="player-box">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '1rem' 
              }}>
                <h3 style={{ fontSize: '1.5rem' }}>
                  Playlist ({playlist.length})
                </h3>
                {!isSpotifyMode && (
                  <button onClick={handleManualAdd} className="btn btn-purple">
                    + Ajouter
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {playlist.map((track, index) => (
                  <div
                    key={index}
                    onClick={() => loadTrack(index)}
                    className={`playlist-item ${index === currentTrack ? 'current' : ''}`}
                    style={{
                      padding: '0.75rem',
                      cursor: track.revealed ? 'not-allowed' : 'pointer',
                      opacity: track.revealed ? 0.5 : 1,
                      transition: 'all 0.2s',
                      backgroundColor: index === currentTrack
                        ? 'rgba(124, 58, 237, 0.2)'
                        : track.revealed
                        ? 'rgba(0, 0, 0, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: index === currentTrack ? '2px solid #7c3aed' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '0.5rem'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem'
                    }}>
                      <div style={{ flex: 1 }}>
                        {/* Numéro et statut */}
                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                          {index + 1}. {track.revealed ? (
                            <span style={{ color: '#10b981' }}>
                              ✅ {track.title} {track.artist && `- ${track.artist}`}
                            </span>
                          ) : (
                            <span style={{ opacity: 0.9 }}>
                              {track.title} {track.artist && `- ${track.artist}`}
                            </span>
                          )}
                        </div>

                        {/* Indicateurs de fichiers (mode MP3 uniquement) */}
                        {!isSpotifyMode && (
                          <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            fontSize: '0.75rem',
                            marginTop: '0.25rem'
                          }}>
                            <span style={{
                              color: track.audioUrl ? '#10b981' : '#ef4444'
                            }}>
                              {track.audioUrl ? '✓ Audio' : '⚠️ Audio'}
                            </span>
                            <span style={{
                              color: track.imageUrl ? '#10b981' : '#ef4444'
                            }}>
                              {track.imageUrl ? '✓ Image' : '⚠️ Image'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Boutons d'upload (mode MP3 uniquement) */}
                      {!isSpotifyMode && !track.revealed && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '0.5rem'
                          }}
                          onClick={(e) => e.stopPropagation()} // Empêcher le clic de charger la chanson
                        >
                          {!track.audioUrl && (
                            <label
                              className="file-label"
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.4rem 0.8rem'
                              }}
                            >
                              📁 MP3
                              <input
                                type="file"
                                accept="audio/*"
                                onChange={(e) => e.target.files[0] && handleAudioForTrack(index, e.target.files[0])}
                              />
                            </label>
                          )}
                          {!track.imageUrl && (
                            <label
                              className="file-label"
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.4rem 0.8rem',
                                backgroundColor: '#7c3aed'
                              }}
                            >
                              🖼️ Image
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => e.target.files[0] && handleImageForTrack(index, e.target.files[0])}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}