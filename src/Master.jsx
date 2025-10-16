import React, { useState, useRef, useEffect } from 'react';
import { database } from './firebase';
import { ref, onValue, remove, set } from 'firebase/database';
import { spotifyService } from './spotifyService';

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
  const [playlist, setPlaylist] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [buzzedTeam, setBuzzedTeam] = useState(null);
  const [buzzedPlayerName, setBuzzedPlayerName] = useState(null);
  const [buzzedPlayerPhoto, setBuzzedPlayerPhoto] = useState(null);
  const [buzzedPlayerId, setBuzzedPlayerId] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [currentChrono, setCurrentChrono] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  
  // NOUVEAU : Stats des buzz
  const [showStats, setShowStats] = useState(false);
  const [buzzStats, setBuzzStats] = useState([]);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  
  // Spotify
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [spotifyPlayer, setSpotifyPlayer] = useState(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState(null);
  const [isSpotifyMode, setIsSpotifyMode] = useState(false);
  const [spotifyPosition, setSpotifyPosition] = useState(0);
  const [lastPlayedTrack, setLastPlayedTrack] = useState(null);

  // Paramètres de cooldown
  const [cooldownEnabled, setCooldownEnabled] = useState(false);
  const [cooldownDuration, setCooldownDuration] = useState(5); // en secondes
  
  const audioRef = useRef(null);
  const buzzerSoundRef = useRef(null);

  // Vérifier si connecté à Spotify au chargement
  useEffect(() => {
    const token = sessionStorage.getItem('spotify_access_token');
    if (token) {
      setSpotifyToken(token);
      loadSpotifyPlaylists(token);
    }
  }, []);

 // Créer le son de buzzer au chargement (SON AMÉLIORÉ)
 useEffect(() => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  const playBuzzerSound = () => {
    const now = audioContext.currentTime;
    
    // Oscillateur principal (son du buzzer)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    
    // Son de buzzer de jeu TV : fréquence descendante rapide
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    osc1.type = 'sawtooth'; // Son plus agressif
    
    // Envelope : attaque rapide, decay court
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.5, now + 0.01); // Attaque rapide
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3); // Decay
    
    osc1.start(now);
    osc1.stop(now + 0.3);
    
    // Ajouter un second oscillateur pour plus de richesse
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    
    osc2.frequency.setValueAtTime(600, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    osc2.type = 'square';
    
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc2.start(now);
    osc2.stop(now + 0.3);
  };
  
  buzzerSoundRef.current = playBuzzerSound;
}, []);

  // Écouter le chrono depuis Firebase
  useEffect(() => {
    const chronoRef = ref(database, 'chrono');
    const unsubscribe = onValue(chronoRef, (snapshot) => {
      const chronoValue = snapshot.val() || 0;
      setCurrentChrono(chronoValue);
    });
    return () => unsubscribe();
  }, []);

  // Reset la position Spotify quand on change de morceau
  useEffect(() => {
    setSpotifyPosition(0);
    console.log('useEffect: Position reset à 0 pour morceau', currentTrack);
  }, [currentTrack]);

  // Écouter les buzz via Firebase
  useEffect(() => {
    const buzzRef = ref(database, 'buzz');
    
    const unsubscribe = onValue(buzzRef, (snapshot) => {
      const buzzData = snapshot.val();
      if (buzzData && isPlaying) {
        setBuzzedTeam(buzzData.team);
        setBuzzedPlayerName(buzzData.playerName || null);
        setBuzzedPlayerPhoto(buzzData.playerPhoto || null);
        setBuzzedPlayerId(buzzData.playerId || null);
        
        // NOUVEAU : Enregistrer le temps de buzz
        const buzzTime = currentChrono;
        const buzzTimesRef = ref(database, `buzz_times/${currentTrack}`);
        
        // Récupérer les buzz existants pour ce morceau
        onValue(buzzTimesRef, (timesSnapshot) => {
          const existingBuzzes = timesSnapshot.val() || [];
          
          // Ajouter le nouveau buzz
          const newBuzz = {
            team: buzzData.team,
            teamName: buzzData.teamName || (buzzData.team === 'team1' ? 'Équipe 1' : 'Équipe 2'),
            time: buzzTime,
            timestamp: Date.now(),
            trackNumber: currentTrack + 1
          };
          
          existingBuzzes.push(newBuzz);
          
          // Sauvegarder
          set(buzzTimesRef, existingBuzzes);
          
          console.log('Buzz enregistré:', newBuzz);
        }, { onlyOnce: true });
        
        // Pause selon le mode
        if (isSpotifyMode && spotifyToken) {
          spotifyService.pausePlayback(spotifyToken);
        } else if (audioRef.current) {
          audioRef.current.pause();
        }
        
        setIsPlaying(false);
        
        const playingRef = ref(database, 'isPlaying');
        set(playingRef, false);
        
        if (buzzerSoundRef.current) {
          buzzerSoundRef.current();
        }
        
        setDebugInfo(`🔔 ${buzzData.team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2'} a buzzé à ${buzzTime.toFixed(1)}s !`);
        
        // NE PAS SUPPRIMER LE BUZZ ICI - Il sera supprimé quand on donne des points, révèle, ou relance
        // remove(buzzRef); ← ENLEVÉ
      }
    });

    return () => unsubscribe();
  }, [isPlaying, isSpotifyMode, spotifyToken, currentChrono, currentTrack]);

  // Connexion Spotify
  const handleSpotifyLogin = () => {
    window.location.href = spotifyService.getAuthUrl();
  };

// Charger les playlists Spotify (MODIFIÉ pour filtrer tag #BT)
const loadSpotifyPlaylists = async (token) => {
  try {
    const allPlaylists = await spotifyService.getUserPlaylists(token);
    
    // FILTRER uniquement les playlists avec #BT dans la description
    const filteredPlaylists = allPlaylists.filter(playlist => 
      playlist.description && playlist.description.includes('#BT')
    );
    
    setSpotifyPlaylists(filteredPlaylists);
    
    // Message de debug pour informer l'utilisateur
    if (filteredPlaylists.length === 0) {
      setDebugInfo('⚠️ Aucune playlist avec le tag #BT trouvée dans la description');
    } else {
      setDebugInfo(`✅ ${filteredPlaylists.length} playlist(s) avec tag #BT trouvée(s)`);
    }
  } catch (error) {
    console.error('Error loading playlists:', error);
    setDebugInfo('❌ Erreur chargement playlists');
  }
};
  // Importer une playlist Spotify
  const importSpotifyPlaylist = async (playlistId) => {
    try {
      setDebugInfo('⏳ Import en cours...');
      const tracks = await spotifyService.getPlaylistTracks(spotifyToken, playlistId);
      
      setPlaylist(tracks);
      setIsSpotifyMode(true);
      setShowPlaylistSelector(false);
      setDebugInfo(`✅ ${tracks.length} morceaux importés de Spotify`);
      
      if (!spotifyPlayer) {
        const player = await spotifyService.initPlayer(
          spotifyToken,
          (deviceId) => setSpotifyDeviceId(deviceId),
          (state) => {
            if (state) {
              setSongDuration(state.duration / 1000);
              const positionMs = state.position;
              setSpotifyPosition(positionMs);
              console.log('Position Spotify:', positionMs, 'ms');
            }
          }
        );
        setSpotifyPlayer(player);
      }
      
      const scoresRef = ref(database, 'scores');
      set(scoresRef, { team1: 0, team2: 0 });
      const chronoRef = ref(database, 'chrono');
      set(chronoRef, 0);
      setScores({ team1: 0, team2: 0 });
      setCurrentChrono(0);
      
    } catch (error) {
      console.error('Error importing playlist:', error);
      setDebugInfo('❌ Erreur import playlist');
    }
  };

  // Ajouter morceau manuel (mode MP3)
  const handleManualAdd = () => {
    const newTrack = {
      title: 'En attente de fichier...',
      artist: '',
      audioUrl: null,
      imageUrl: null,
      revealed: false
    };
    
    if (playlist.length === 0) {
      const scoresRef = ref(database, 'scores');
      set(scoresRef, { team1: 0, team2: 0 });
      const chronoRef = ref(database, 'chrono');
      set(chronoRef, 0);
      const playingRef = ref(database, 'isPlaying');
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
    reader.onerror = () => {
      setDebugInfo(`❌ Erreur lecture image`);
    };
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
      setDebugInfo(`✅ ${file.name} chargé (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    };
    reader.onerror = () => {
      setDebugInfo(`❌ Erreur lecture fichier ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const togglePlay = async () => {
    const track = playlist[currentTrack];
    
    // Si on relance la lecture, effacer le buzz visuel
    if (!isPlaying) {
      setBuzzedTeam(null);
      setBuzzedPlayerName(null);
      setBuzzedPlayerPhoto(null);
      setBuzzedPlayerId(null);
      const buzzRef = ref(database, 'buzz');
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
            const currentPosition = playerState.progress_ms;
            setSpotifyPosition(currentPosition);
            console.log('Position sauvegardée:', currentPosition, 'ms');
          }
          
          await spotifyService.pausePlayback(spotifyToken);
          setIsPlaying(false);
          setDebugInfo('⏸️ Pause');
          
          const playingRef = ref(database, 'isPlaying');
          set(playingRef, false);
        } else {
          const isNewTrack = lastPlayedTrack !== currentTrack;
          const startPosition = isNewTrack ? 0 : (spotifyPosition || 0);
          
          console.log('Morceau actuel:', currentTrack, 'Dernier joué:', lastPlayedTrack, 'Nouvelle chanson?', isNewTrack);
          console.log('Reprise lecture à :', startPosition, 'ms');
          
          await spotifyService.playTrack(spotifyToken, spotifyDeviceId, track.spotifyUri, startPosition);
          setIsPlaying(true);
          setLastPlayedTrack(currentTrack);
          setDebugInfo(`✅ Lecture Spotify en cours (${(startPosition/1000).toFixed(1)}s)`);
          
          const playingRef = ref(database, 'isPlaying');
          set(playingRef, true);
          
          const trackNumberRef = ref(database, 'playingTrackNumber');
          set(trackNumberRef, currentTrack);
          
          setSongDuration(track.duration);
          const durationRef = ref(database, 'songDuration');
          set(durationRef, track.duration);
        }
      } catch (error) {
        setDebugInfo('❌ Erreur Spotify: ' + error.message);
        console.error(error);
      }
    } else {
      if (!track?.audioUrl) {
        setDebugInfo('❌ Pas d\'URL audio');
        return;
      }

      if (!audioRef.current) {
        setDebugInfo('❌ Référence audio manquante');
        return;
      }

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        setDebugInfo('⏸️ Pause');
        
        const playingRef = ref(database, 'isPlaying');
        set(playingRef, false);
      } else {
        setDebugInfo('▶️ Tentative de lecture...');
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            setDebugInfo('✅ Lecture en cours');
            
            const playingRef = ref(database, 'isPlaying');
            set(playingRef, true);
            
            const trackNumberRef = ref(database, 'playingTrackNumber');
            set(trackNumberRef, currentTrack);
          })
          .catch(error => {
            setDebugInfo('❌ Erreur: ' + error.message);
            console.error('Erreur play:', error);
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
      
      // Effacer le buzz visuel
      setBuzzedTeam(null);
      setBuzzedPlayerName(null);
      setBuzzedPlayerPhoto(null);
      setBuzzedPlayerId(null);
      const buzzRef = ref(database, 'buzz');
      remove(buzzRef);
      
      setSpotifyPosition(0);
      console.log('Position reset à 0 pour nouvelle chanson');
      
      const chronoRef = ref(database, 'chrono');
      set(chronoRef, 0);
      
      const playingRef = ref(database, 'isPlaying');
      set(playingRef, false);
      
      const trackNumberRef = ref(database, 'currentTrackNumber');
      set(trackNumberRef, newTrackIndex);
      
      const songRef = ref(database, 'currentSong');
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
      
      // Effacer le buzz visuel
      setBuzzedTeam(null);
      setBuzzedPlayerName(null);
      setBuzzedPlayerPhoto(null);
      setBuzzedPlayerId(null);
      const buzzRef = ref(database, 'buzz');
      remove(buzzRef);
      
      setSpotifyPosition(0);
      console.log('Position reset à 0 pour nouvelle chanson');
      
      const chronoRef = ref(database, 'chrono');
      set(chronoRef, 0);
      
      const playingRef = ref(database, 'isPlaying');
      set(playingRef, false);
      
      const trackNumberRef = ref(database, 'currentTrackNumber');
      set(trackNumberRef, newTrackIndex);
    }
  };

  const revealAnswer = () => {
    const updatedPlaylist = [...playlist];
    updatedPlaylist[currentTrack].revealed = true;
    setPlaylist(updatedPlaylist);
    
    // Effacer le buzz visuel
    setBuzzedTeam(null);
    setBuzzedPlayerName(null);
    setBuzzedPlayerPhoto(null);
    setBuzzedPlayerId(null);
    const buzzRef = ref(database, 'buzz');
    remove(buzzRef);
    
    // Arrêter la musique
    if (isSpotifyMode && spotifyToken) {
      spotifyService.pausePlayback(spotifyToken);
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    
    setIsPlaying(false);
    
    // Mettre à jour Firebase
    const playingRef = ref(database, 'isPlaying');
    set(playingRef, false);
    
    const songRef = ref(database, 'currentSong');
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
    // Utiliser le nouveau système de calcul
    const points = calculatePoints(currentChrono, songDuration);
    
    const newScores = { ...scores, [team]: scores[team] + points };
    setScores(newScores);
    
    // NOUVEAU : Activer cooldown si activé
    if (cooldownEnabled && buzzedPlayerId) {
      const cooldownRef = ref(database, `cooldowns/${buzzedPlayerId}`);
      await set(cooldownRef, {
        endTime: Date.now() + (cooldownDuration * 1000),
        duration: cooldownDuration * 1000,
        playerName: buzzedPlayerName
      });
      console.log(`🔒 Cooldown activé pour ${buzzedPlayerName} pendant ${cooldownDuration}s`);
    }

    // Effacer le buzz visuel
    setBuzzedTeam(null);
    setBuzzedPlayerName(null);
    setBuzzedPlayerPhoto(null);
    setBuzzedPlayerId(null);
    const buzzRef = ref(database, 'buzz');
    remove(buzzRef);
    
    const scoresRef = ref(database, 'scores');
    set(scoresRef, newScores);
    
    // Révéler automatiquement la réponse
    const updatedPlaylist = [...playlist];
    updatedPlaylist[currentTrack].revealed = true;
    setPlaylist(updatedPlaylist);
    
    // Mettre à jour Firebase pour afficher la réponse sur TV
    const songRef = ref(database, 'currentSong');
    set(songRef, {
      title: updatedPlaylist[currentTrack].title,
      artist: updatedPlaylist[currentTrack].artist,
      imageUrl: updatedPlaylist[currentTrack].imageUrl,
      revealed: true,
      number: currentTrack + 1
    });
    
    setDebugInfo(`✅ ${points} points pour ${team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2'} • Réponse révélée`);
  };

  const resetScores = () => {
    if (!confirm('⚠️ Cela va réinitialiser TOUTE la partie (scores, playlist, statistiques). Confirmer ?')) {
      return;
    }
    
    // Reset scores
    const newScores = { team1: 0, team2: 0 };
    setScores(newScores);
    const scoresRef = ref(database, 'scores');
    set(scoresRef, newScores);
    
    // Vider la playlist
    setPlaylist([]);
    setCurrentTrack(0);
    setIsPlaying(false);
    
    // Reset chrono
    const chronoRef = ref(database, 'chrono');
    set(chronoRef, 0);
    setCurrentChrono(0);
    
    // Reset état de jeu
    const playingRef = ref(database, 'isPlaying');
    set(playingRef, false);
    
    const songRef = ref(database, 'currentSong');
    set(songRef, null);
    
    // Reset état de fin de partie
    const gameStatusRef = ref(database, 'game_status');
    set(gameStatusRef, { ended: false });
    
    // Reset statistiques de buzz
    const buzzTimesRef = ref(database, 'buzz_times');
    set(buzzTimesRef, null);

    // NOUVEAU : Effacer les joueurs
    const team1Ref = ref(database, 'players_session/team1');
    const team2Ref = ref(database, 'players_session/team2');
    set(team1Ref, null);
    set(team2Ref, null);
    
    setDebugInfo('🔄 Partie réinitialisée ! Rechargez une playlist pour recommencer.');
  };
  
  // NOUVEAU : Charger les statistiques des buzz
  const loadBuzzStats = () => {
    const buzzTimesRef = ref(database, 'buzz_times');
    onValue(buzzTimesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Aplatir toutes les données
        const allBuzzes = [];
        Object.keys(data).forEach(trackIndex => {
          data[trackIndex].forEach(buzz => {
            allBuzzes.push(buzz);
          });
        });
        
        // Trier par temps (plus rapide en premier)
        allBuzzes.sort((a, b) => a.time - b.time);
        
        setBuzzStats(allBuzzes);
        setShowStats(true);
      }
    }, { onlyOnce: true });
  };
  
  // NOUVEAU : Terminer la partie
  const handleEndGame = () => {
    setShowEndGameConfirm(true);
  };
  
  const confirmEndGame = () => {
    // Déclencher l'animation de victoire sur TV
    const gameStatusRef = ref(database, 'game_status');
    set(gameStatusRef, {
      ended: true,
      winner: scores.team1 > scores.team2 ? 'team1' : scores.team2 > scores.team1 ? 'team2' : 'draw',
      final_scores: scores,
      timestamp: Date.now()
    });
    
    setShowEndGameConfirm(false);
    setDebugInfo('🎉 Partie terminée ! Animation de victoire lancée sur TV');
  };

  const currentSong = playlist[currentTrack];
  
  // Calculer les points disponibles pour l'affichage
  const availablePoints = calculatePoints(currentChrono, songDuration);

  return (
    <div className="bg-gradient">
      <div className="container">
        <h1 className="title">🎵 BLIND TEST 🎵</h1>

        {/* Connexion Spotify */}
        {!spotifyToken ? (
          <div className="player-box text-center mb-4">
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Connectez-vous à Spotify</h3>
            <button onClick={handleSpotifyLogin} className="btn btn-green">
              🎵 Se connecter avec Spotify
            </button>
            <p style={{ marginTop: '1rem', opacity: 0.7 }}>ou</p>
            <button onClick={handleManualAdd} className="btn btn-purple" style={{ marginTop: '0.5rem' }}>
              📁 Mode MP3 manuel
            </button>
          </div>
        ) : (
          <div className="player-box mb-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ Connecté à Spotify</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setShowPlaylistSelector(true)} className="btn btn-green">
                  🎵 Importer playlist Spotify
                </button>
                <button onClick={handleManualAdd} className="btn btn-purple">
                  📁 Ajouter morceau MP3
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sélecteur de playlist Spotify */}
        {showPlaylistSelector && (
          <div className="player-box mb-4">
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Choisissez une playlist</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {spotifyPlaylists.map(pl => (
                <div 
                  key={pl.id}
                  onClick={() => importSpotifyPlaylist(pl.id)}
                  className="playlist-item"
                  style={{ cursor: 'pointer', marginBottom: '0.5rem' }}
                >
                  <strong>{pl.name}</strong> - {pl.tracks.total} morceaux
                </div>
              ))}
            </div>
            <button onClick={() => setShowPlaylistSelector(false)} className="btn btn-gray" style={{ marginTop: '1rem' }}>
              Annuler
            </button>
          </div>
        )}

        {/* Scores */}
        <div className="scores-grid">
          <div className={`score-card red ${buzzedTeam === 'team1' ? 'buzzed' : ''}`}>
            <h2>ÉQUIPE 1</h2>
            <div className="score-number">{scores.team1}</div>
            {buzzedTeam === 'team1' && (
              <button onClick={() => addPoint('team1')} className="btn btn-green">
                + {availablePoints} Points
              </button>
            )}
          </div>
          
          <div className={`score-card blue ${buzzedTeam === 'team2' ? 'buzzed' : ''}`}>
            <h2>ÉQUIPE 2</h2>
            <div className="score-number">{scores.team2}</div>
            {buzzedTeam === 'team2' && (
              <button onClick={() => addPoint('team2')} className="btn btn-green">
                + {availablePoints} Points
              </button>
            )}
          </div>
        </div>

        <button onClick={resetScores} className="btn btn-gray mb-4">
          🔄 Nouvelle Partie (Reset complet)
        </button>
        
        {/* NOUVEAU : Bouton Statistiques */}
        <button onClick={loadBuzzStats} className="btn btn-purple mb-4" style={{ marginLeft: '1rem' }}>
          📊 Voir les Statistiques
        </button>
        
        {/* NOUVEAU : Bouton Terminer la partie */}
        <button onClick={handleEndGame} className="btn btn-yellow mb-4" style={{ marginLeft: '1rem' }}>
          🏁 Terminer la Partie
        </button>

        {/* Paramètres de Cooldown */}
        <div className="player-box mb-4">
          <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            ⚙️ Cooldown (Handicap)
          </h3>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <input 
              type="checkbox" 
              checked={cooldownEnabled}
              onChange={(e) => setCooldownEnabled(e.target.checked)}
              style={{ width: '20px', height: '20px' }}
            />
            <span>Activer le cooldown après bonne réponse</span>
          </label>
          
          {cooldownEnabled && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Durée : <strong>{cooldownDuration}s</strong>
              </label>
              <input 
                type="range" 
                min="3" 
                max="15" 
                value={cooldownDuration}
                onChange={(e) => setCooldownDuration(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.6 }}>
                <span>3s</span>
                <span>15s</span>
              </div>
            </div>
          )}
        </div>

        {/* NOUVEAU : Confirmation fin de partie */}
        {showEndGameConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div className="player-box" style={{ maxWidth: '500px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>
                🏁 Terminer la partie ?
              </h2>
              <p style={{ fontSize: '1.25rem', marginBottom: '2rem', opacity: 0.8 }}>
                Cela affichera l'animation de victoire sur l'écran TV.
              </p>
              <div style={{ fontSize: '3rem', marginBottom: '2rem' }}>
                <div>ÉQUIPE 1: {scores.team1} pts</div>
                <div>ÉQUIPE 2: {scores.team2} pts</div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button onClick={() => setShowEndGameConfirm(false)} className="btn btn-gray">
                  Annuler
                </button>
                <button onClick={confirmEndGame} className="btn btn-green">
                  ✅ Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NOUVEAU : Modal Statistiques */}
        {showStats && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div className="player-box" style={{ 
              maxWidth: '600px', 
              maxHeight: '80vh', 
              overflowY: 'auto',
              position: 'relative'
            }}>
              <button 
                onClick={() => setShowStats(false)} 
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  color: 'white',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
              
              <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>
                📊 Statistiques des Buzz
              </h2>
              
              {buzzStats.length === 0 ? (
                <p style={{ textAlign: 'center', opacity: 0.7 }}>
                  Aucun buzz enregistré
                </p>
              ) : (
                <>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#fbbf24' }}>
                    🏆 Classement par rapidité
                  </h3>
                  <div className="space-y">
                    {buzzStats.map((buzz, index) => (
                      <div 
                        key={index}
                        style={{
                          backgroundColor: index === 0 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.05)',
                          padding: '1rem',
                          borderRadius: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: index === 0 ? '2px solid #fbbf24' : 'none'
                        }}
                      >
                        <div>
                          <span style={{ 
                            fontSize: '1.5rem', 
                            marginRight: '1rem',
                            opacity: index === 0 ? 1 : 0.6
                          }}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                          </span>
                          <strong>{buzz.teamName}</strong>
                          <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                            (Morceau #{buzz.trackNumber})
                          </span>
                        </div>
                        <div style={{ 
                          fontSize: '1.5rem', 
                          fontWeight: 'bold',
                          color: buzz.time <= 5 ? '#10b981' : buzz.time <= 15 ? '#f59e0b' : '#ef4444'
                        }}>
                          {buzz.time.toFixed(1)}s
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {playlist.length === 0 ? (
          <div className="player-box text-center">
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Aucune playlist chargée</h3>
            <p>Connectez-vous à Spotify ou ajoutez des morceaux manuellement</p>
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
                      <div style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>{currentSong.title}</div>
                      {currentSong.artist && (
                        <div style={{ opacity: 0.8, marginTop: '0.5rem' }}>{currentSong.artist}</div>
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
                    const durationRef = ref(database, 'songDuration');
                    set(durationRef, duration);
                  }}
                />
              )}

              {debugInfo && (
                <div className="debug-info mb-4">{debugInfo}</div>
              )}

              <div className="controls mb-4">
                <button
                  onClick={prevTrack}
                  disabled={currentTrack === 0}
                  className="btn btn-gray btn-round"
                >
                  ⏮️
                </button>

                <button
                  onClick={togglePlay}
                  disabled={!isSpotifyMode && !currentSong?.audioUrl}
                  className="btn btn-green btn-round btn-play"
                >
                  {isPlaying ? '⏸️' : '▶️'}
                </button>
                
                <button
                  onClick={nextTrack}
                  disabled={currentTrack >= playlist.length - 1}
                  className="btn btn-gray btn-round"
                >
                  ⏭️
                </button>

                <button
                  onClick={revealAnswer}
                  disabled={!currentSong || currentSong.revealed}
                  className="btn btn-yellow"
                >
                  Révéler
                </button>
              </div>
              
              <div style={{ fontSize: '0.875rem', opacity: 0.7, textAlign: 'center' }}>
                {isSpotifyMode ? '🎵 Mode Spotify' : '📁 Mode MP3'}
              </div>
            </div>

            {/* Playlist */}
            <div className="player-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.5rem' }}>Playlist ({playlist.length})</h3>
                {!isSpotifyMode && (
                  <button onClick={handleManualAdd} className="btn btn-purple">
                    + Ajouter
                  </button>
                )}
              </div>
              
              <div className="space-y">
                {playlist.map((track, index) => (
                  <div 
                    key={index}
                    className={`playlist-item ${index === currentTrack ? 'current' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        {/* Numéro et statut */}
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                          {index + 1}. {track.revealed ? '✅' : '❓'}
                        </div>
                        
                        {/* TOUJOURS VISIBLE pour l'animateur */}
                        <div style={{ 
                          fontSize: '1.125rem', 
                          fontWeight: 'bold',
                          color: '#fbbf24',
                          marginBottom: '0.25rem'
                        }}>
                          🎵 {track.title}
                        </div>
                        
                        {track.artist && (
                          <div style={{ 
                            fontSize: '0.875rem', 
                            opacity: 0.8,
                            marginBottom: '0.5rem'
                          }}>
                            👤 {track.artist}
                          </div>
                        )}
                        
                        {/* Infos technique (mode MP3) */}
                        {!isSpotifyMode && (
                          <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ color: track.audioUrl ? '#10b981' : '#ef4444' }}>
                              {track.audioUrl ? '✓ Audio' : '⚠️ Pas d\'audio'}
                            </span>
                            <span style={{ color: track.imageUrl ? '#10b981' : '#ef4444' }}>
                              {track.imageUrl ? '✓ Image' : '⚠️ Pas d\'image'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {!isSpotifyMode && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {!track.audioUrl && (
                            <label className="file-label" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
                              📁 MP3
                              <input 
                                type="file" 
                                accept="audio/*"
                                onChange={(e) => e.target.files[0] && handleAudioForTrack(index, e.target.files[0])}
                              />
                            </label>
                          )}
                          {!track.imageUrl && (
                            <label className="file-label" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', backgroundColor: '#7c3aed' }}>
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