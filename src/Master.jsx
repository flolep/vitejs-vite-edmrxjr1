import React, { useState, useRef, useEffect } from 'react';
import { database, auth } from './firebase';
import { ref, onValue, remove, set, update } from 'firebase/database';
import { spotifyService } from './spotifyService';
import { n8nService } from './n8nService';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';

// Import des composants
import Login from './components/Login';
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

export default function Master({ initialSessionId = null }) {
  // États d'authentification et session
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [gameMode, setGameMode] = useState(null); // null | 'mp3' | 'spotify-auto' | 'spotify-ai'

  // États des paramètres de cooldown
  const [cooldownThreshold, setCooldownThreshold] = useState(2); // Nombre de bonnes réponses d'affilée
  const [cooldownDuration, setCooldownDuration] = useState(5000); // Durée du freeze en ms
  const [showCooldownSettings, setShowCooldownSettings] = useState(false);

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
  const [playlistUpdates, setPlaylistUpdates] = useState([]); // Feed des MAJ pour mode IA
  
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

  // Sauvegarder le sessionId dans localStorage quand il change
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('lastSessionId', sessionId);
      console.log(`✅ Session ${sessionId} sauvegardée dans localStorage`);
    }
  }, [sessionId]);

  // Charger les données de la session si on reprend une session existante
  // OU créer automatiquement une nouvelle session si c'est une nouvelle partie
  useEffect(() => {
    if (!user) return;

    if (initialSessionId) {
      // Reprendre une session existante
      const sessionRef = ref(database, `sessions/${initialSessionId}`);
      onValue(sessionRef, (snapshot) => {
        const sessionData = snapshot.val();
        if (sessionData && sessionData.active !== false) {
          console.log(`✅ Session ${initialSessionId} récupérée depuis Firebase`);
          // Charger les scores
          if (sessionData.scores) {
            setScores(sessionData.scores);
          }
          // Charger l'état de lecture
          if (sessionData.isPlaying !== undefined) {
            setIsPlaying(sessionData.isPlaying);
          }
          // Charger le chrono
          if (sessionData.chrono !== undefined) {
            setCurrentChrono(sessionData.chrono);
          }
          // Charger le numéro de piste actuel
          if (sessionData.currentTrackNumber !== undefined) {
            setCurrentTrack(sessionData.currentTrackNumber);
          }
          // Charger l'ID de playlist Spotify
          if (sessionData.playlistId) {
            const token = sessionStorage.getItem('spotify_access_token');
            if (token) {
              loadSpotifyPlaylistById(sessionData.playlistId, token);
            }
          }
        } else {
          console.warn(`⚠️ Session ${initialSessionId} n'existe plus ou est inactive`);
          setDebugInfo(`⚠️ La session ${initialSessionId} n'existe plus`);
        }
      }, { onlyOnce: true });
    } else if (!sessionId) {
      // Créer automatiquement une nouvelle session si aucune n'existe
      const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
      setSessionId(newSessionId);

      // Créer la nouvelle session dans Firebase
      set(ref(database, `sessions/${newSessionId}`), {
        active: true,
        createdAt: Date.now(),
        scores: { team1: 0, team2: 0 },
        chrono: 0,
        isPlaying: false,
        showQRCode: false
      });

      setDebugInfo(`🎮 Nouvelle partie créée ! Code: ${newSessionId}`);
      console.log(`✅ Nouvelle session ${newSessionId} créée automatiquement`);
    }
  }, [initialSessionId, user, sessionId]);

  // Vérifier connexion Spotify au chargement
  useEffect(() => {
    const token = sessionStorage.getItem('spotify_access_token');
    if (token) {
      setSpotifyToken(token);
      loadSpotifyPlaylists(token);
    }
  }, []);

  // Charger automatiquement la playlist en mode IA quand le token Spotify est disponible
  useEffect(() => {
    if (!sessionId || gameMode !== 'spotify-ai' || !spotifyToken || playlist.length > 0) return;

    const playlistIdRef = ref(database, `sessions/${sessionId}/playlistId`);
    onValue(playlistIdRef, (snapshot) => {
      const playlistId = snapshot.val();
      if (playlistId) {
        console.log(`🤖 Chargement auto de la playlist IA: ${playlistId}`);
        loadSpotifyPlaylistById(playlistId, spotifyToken);
      }
    }, { onlyOnce: true });
  }, [sessionId, gameMode, spotifyToken]);

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

  // Écouter les mises à jour de la playlist et rafraîchir automatiquement
  useEffect(() => {
    if (!sessionId || !spotifyToken) return;

    const updateRef = ref(database, `sessions/${sessionId}/lastPlaylistUpdate`);
    const playlistIdRef = ref(database, `sessions/${sessionId}/playlistId`);

    let lastTimestamp = null;

    const unsubscribe = onValue(updateRef, (snapshot) => {
      const updateData = snapshot.val();
      if (updateData && updateData.timestamp) {
        // Éviter de recharger au premier chargement
        if (lastTimestamp === null) {
          lastTimestamp = updateData.timestamp;
          return;
        }

        // Si le timestamp a changé, recharger la playlist
        if (updateData.timestamp > lastTimestamp) {
          console.log(`🔄 Mise à jour détectée par ${updateData.playerName}, rechargement de la playlist...`);
          lastTimestamp = updateData.timestamp;

          // Ajouter au feed des mises à jour (pour le mode IA)
          if (gameMode === 'spotify-ai') {
            setPlaylistUpdates(prev => [{
              playerName: updateData.playerName,
              songsAdded: updateData.songsAdded,
              timestamp: updateData.timestamp,
              time: new Date(updateData.timestamp).toLocaleTimeString()
            }, ...prev].slice(0, 10)); // Garder les 10 dernières MAJ
          }

          // Récupérer l'ID de playlist et recharger
          onValue(playlistIdRef, (playlistSnapshot) => {
            const playlistId = playlistSnapshot.val();
            if (playlistId) {
              loadSpotifyPlaylistById(playlistId, spotifyToken);
              setDebugInfo(`🔄 Playlist mise à jour par ${updateData.playerName} (+${updateData.songsAdded} chansons)`);
            }
          }, { onlyOnce: true });
        }
      }
    });

    return () => unsubscribe();
  }, [sessionId, spotifyToken, gameMode]);

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

  const loadSpotifyPlaylistById = async (playlistId, token) => {
    try {
      setDebugInfo('⏳ Chargement de la playlist...');
      const tracks = await spotifyService.getPlaylistTracks(token, playlistId);

      setPlaylist(tracks);
      setIsSpotifyMode(true);
      setDebugInfo(`✅ ${tracks.length} morceaux chargés depuis la session`);

      if (!spotifyPlayer) {
        const player = await spotifyService.initPlayer(
          token,
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
    } catch (error) {
      console.error('Error loading playlist by ID:', error);
      setDebugInfo('❌ Erreur chargement playlist');
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
  let points = calculatePoints(currentChrono, songDuration);
  let hasPersonalBonus = false;
  let bonusPlayerName = '';

  // Référence au buzz actuel
  const buzzRef = ref(database, `sessions/${sessionId}/buzz`);

  // Vérifier si la chanson correspond aux préférences du joueur (bonus personnel)
  const currentSongUri = playlist[currentTrack]?.uri; // URI Spotify de la chanson actuelle

  if (currentSongUri) {
    try {
      // Récupérer les données du joueur qui a buzzé
      const buzzSnapshot = await new Promise((resolve) => {
        onValue(buzzRef, resolve, { onlyOnce: true });
      });
      const buzzData = buzzSnapshot.val();

      if (buzzData && buzzData.playerId) {
        // Récupérer les chansons associées à ce joueur
        const playerSongsRef = ref(database, `sessions/${sessionId}/playerSongs/${buzzData.playerId}`);
        const playerSongsSnapshot = await new Promise((resolve) => {
          onValue(playerSongsRef, resolve, { onlyOnce: true });
        });
        const playerSongsData = playerSongsSnapshot.val();

        // Vérifier si l'URI de la chanson actuelle est dans les préférences du joueur
        if (playerSongsData && playerSongsData.uris && playerSongsData.uris.includes(currentSongUri)) {
          hasPersonalBonus = true;
          bonusPlayerName = buzzData.playerName || '';
          points += 500; // Bonus de 500 points
          console.log(`🎯 BONUS PERSONNEL pour ${bonusPlayerName} ! Chanson issue de ses préférences (+500 pts)`);
        }
      }
    } catch (error) {
      console.error('Erreur vérification bonus personnel:', error);
    }
  }

  const newScores = { ...scores, [team]: scores[team] + points };
  setScores(newScores);

  const scoresRef = ref(database, `sessions/${sessionId}/scores`);
  set(scoresRef, newScores);

  // ✅ Marquer le dernier buzz de ce track comme correct et ajouter les points
  const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times/${currentTrack}`);
  onValue(buzzTimesRef, (snapshot) => {
    const existingBuzzes = snapshot.val() || [];
    if (existingBuzzes.length > 0) {
      // Mettre à jour le dernier buzz (celui qui vient d'être validé)
      const lastIndex = existingBuzzes.length - 1;
      existingBuzzes[lastIndex].correct = true;
      existingBuzzes[lastIndex].points = points;
      existingBuzzes[lastIndex].hasPersonalBonus = hasPersonalBonus; // Ajouter info du bonus
      if (hasPersonalBonus) {
        existingBuzzes[lastIndex].basePoints = points - 500; // Points de base (sans bonus)
        existingBuzzes[lastIndex].bonusPoints = 500; // Bonus séparé
      }
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
  
  const teamName = team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2';
  const bonusText = hasPersonalBonus ? ` (dont 🎯 BONUS PERSONNEL +500 pour ${bonusPlayerName})` : '';
  setDebugInfo(`✅ ${points} points pour ${teamName}${bonusText}`);
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

    // Afficher la modale de sélection de mode
    setShowModeSelection(true);
  };

  // Créer une nouvelle session avec le mode sélectionné
  const createNewSession = async (mode) => {
    // Générer un nouveau code de session
    const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionId(newSessionId);
    setGameMode(mode);

    // Créer la nouvelle session dans Firebase avec une seule opération atomique
    const updates = {};
    updates[`sessions/${newSessionId}/createdBy`] = user.uid;
    updates[`sessions/${newSessionId}/createdAt`] = Date.now();
    updates[`sessions/${newSessionId}/active`] = true;
    updates[`sessions/${newSessionId}/gameMode`] = mode;
    updates[`sessions/${newSessionId}/scores`] = { team1: 0, team2: 0 };
    updates[`sessions/${newSessionId}/chrono`] = 0;
    updates[`sessions/${newSessionId}/isPlaying`] = false;
    updates[`sessions/${newSessionId}/currentSong`] = null;
    updates[`sessions/${newSessionId}/game_status`] = { ended: false };
    updates[`sessions/${newSessionId}/showQRCode`] = false;

    await update(ref(database), updates);

    // Réinitialiser tous les états locaux
    const newScores = { team1: 0, team2: 0 };
    setScores(newScores);
    setPlaylist([]);
    setCurrentTrack(0);
    setIsPlaying(false);
    setCurrentChrono(0);
    setShowQRCode(false);
    setShowModeSelection(false);

    const modeNames = {
      'mp3': 'Mode MP3',
      'spotify-auto': 'Mode Spotify Autonome',
      'spotify-ai': 'Mode Spotify IA'
    };

    setDebugInfo(`🔄 Nouvelle partie créée ! Code: ${newSessionId} - ${modeNames[mode]}`);

    // Si mode Spotify IA, créer la playlist vide via n8n
    if (mode === 'spotify-ai') {
      setDebugInfo(`🤖 Création de la playlist IA via n8n...`);
      try {
        const result = await n8nService.createSpotifyPlaylistSimple(
          `BlindTest-${newSessionId}`,
          `Playlist générée automatiquement pour la session ${newSessionId}`
        );

        if (result.success && result.playlistId) {
          // Stocker l'ID de la playlist dans Firebase
          const playlistIdRef = ref(database, `sessions/${newSessionId}/playlistId`);
          await set(playlistIdRef, result.playlistId);

          console.log(`✅ Playlist Spotify IA créée: ${result.playlistId}`);
          setDebugInfo(`🤖 Playlist IA créée ! En attente des contributions des joueurs...`);

          // Initialiser le mode Spotify
          setIsSpotifyMode(true);
        } else {
          throw new Error('Playlist ID non reçu');
        }
      } catch (error) {
        console.error('❌ Erreur création playlist IA:', error);
        setDebugInfo(`❌ Erreur création playlist IA: ${error.message}`);
      }
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
          {/* Section Bouton selon le mode */}
          {gameMode && (
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.25rem'
            }}>
              {gameMode === 'mp3' && (
                <button
                  onClick={handleManualAdd}
                  className="btn"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(124, 58, 237, 0.3)',
                    border: '1px solid #7c3aed',
                    fontSize: '0.9rem',
                    borderRadius: '0.5rem',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📁 Charger MP3
                </button>
              )}

              {gameMode === 'spotify-auto' && (
                <button
                  onClick={() => {
                    if (!spotifyToken) {
                      handleSpotifyLogin();
                    } else {
                      setShowPlaylistSelector(true);
                    }
                  }}
                  className="btn"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(16, 185, 129, 0.3)',
                    border: '1px solid #10b981',
                    fontSize: '0.9rem',
                    borderRadius: '0.5rem',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🎵 {spotifyToken ? 'Charger Playlist' : 'Se connecter à Spotify'}
                </button>
              )}

              {gameMode === 'spotify-ai' && (
                <div>
                  <button
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(236, 72, 153, 0.2)',
                      border: '1px solid rgba(236, 72, 153, 0.5)',
                      fontSize: '0.9rem',
                      borderRadius: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.5)',
                      cursor: 'not-allowed',
                      transition: 'all 0.2s'
                    }}
                  >
                    🤖 Chargement Auto
                  </button>
                  <p style={{
                    textAlign: 'center',
                    marginTop: '0.75rem',
                    opacity: 0.7,
                    fontSize: '0.85rem',
                    marginBottom: playlistUpdates.length > 0 ? '1rem' : 0
                  }}>
                    La playlist se remplit automatiquement avec les préférences des joueurs
                  </p>

                  {/* Feed des mises à jour */}
                  {playlistUpdates.length > 0 && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '0.5rem',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        opacity: 0.8,
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        📊 Mises à jour
                      </div>
                      {playlistUpdates.map((update, index) => (
                        <div
                          key={index}
                          style={{
                            fontSize: '0.8rem',
                            padding: '0.4rem 0',
                            borderBottom: index < playlistUpdates.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                            opacity: 0.9
                          }}
                        >
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

                  {playlistUpdates.length === 0 && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '0.5rem',
                      textAlign: 'center',
                      fontSize: '0.8rem',
                      opacity: 0.6
                    }}>
                      En attente des contributions des joueurs...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!gameMode && (
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              textAlign: 'center',
              opacity: 0.7
            }}>
              <p style={{ fontSize: '0.9rem', margin: 0 }}>
                Cliquez sur "🔄 Nouvelle partie" pour choisir un mode de jeu
              </p>
            </div>
          )}

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

      {/* Modale Sélection de Mode */}
      {showModeSelection && (
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
          onClick={() => setShowModeSelection(false)}
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
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', textAlign: 'center' }}>
              🎮 Choisissez le mode de jeu
            </h2>
            <p style={{
              textAlign: 'center',
              opacity: 0.8,
              marginBottom: '2rem',
              fontSize: '0.95rem'
            }}>
              Sélectionnez comment vous souhaitez créer votre playlist
            </p>

            {/* Options de mode */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              {/* Mode MP3 */}
              <div
                onClick={() => createNewSession('mp3')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(124, 58, 237, 0.2)',
                  border: '2px solid rgba(124, 58, 237, 0.5)',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.3)';
                  e.currentTarget.style.borderColor = '#7c3aed';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.5)';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Mode MP3
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Chargez vos propres fichiers MP3 manuellement
                </div>
              </div>

              {/* Mode Spotify Autonome */}
              <div
                onClick={() => createNewSession('spotify-auto')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  border: '2px solid rgba(16, 185, 129, 0.5)',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
                  e.currentTarget.style.borderColor = '#10b981';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎵</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Mode Spotify - Autonome
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Importez une de vos playlists Spotify existantes
                </div>
              </div>

              {/* Mode Spotify IA */}
              <div
                onClick={() => createNewSession('spotify-ai')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(236, 72, 153, 0.2)',
                  border: '2px solid rgba(236, 72, 153, 0.5)',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(236, 72, 153, 0.3)';
                  e.currentTarget.style.borderColor = '#ec4899';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(236, 72, 153, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.5)';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤖</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Mode Spotify - IA
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Playlist générée automatiquement par IA selon les préférences des joueurs
                </div>
              </div>
            </div>

            {/* Bouton Annuler */}
            <button
              onClick={() => setShowModeSelection(false)}
              className="btn"
              style={{
                width: '100%',
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
