import React, { useState, useRef, useEffect } from 'react';
import { database } from './firebase';
import { ref, onValue, remove, set } from 'firebase/database';
import { spotifyService } from './spotifyService';

export default function Master() {
  const [playlist, setPlaylist] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [buzzedTeam, setBuzzedTeam] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [currentChrono, setCurrentChrono] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  
  // Spotify
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [spotifyPlayer, setSpotifyPlayer] = useState(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState(null);
  const [isSpotifyMode, setIsSpotifyMode] = useState(false);
  const [spotifyPosition, setSpotifyPosition] = useState(0);
  
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

  // Créer le son de buzzer au chargement
  useEffect(() => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const playBuzzerSound = () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'square';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
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

  // Écouter les buzz via Firebase
  useEffect(() => {
    const buzzRef = ref(database, 'buzz');
    
    const unsubscribe = onValue(buzzRef, (snapshot) => {
      const buzzData = snapshot.val();
      if (buzzData && isPlaying) {
        setBuzzedTeam(buzzData.team);
        
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
        
        setDebugInfo(`🔔 ${buzzData.team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2'} a buzzé !`);
        remove(buzzRef);
      }
    });

    return () => unsubscribe();
  }, [isPlaying, isSpotifyMode, spotifyToken]);

  // Connexion Spotify
  const handleSpotifyLogin = () => {
    window.location.href = spotifyService.getAuthUrl();
  };

  // Charger les playlists Spotify
  const loadSpotifyPlaylists = async (token) => {
    try {
      const playlists = await spotifyService.getUserPlaylists(token);
      setSpotifyPlaylists(playlists);
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
      setDebugInfo(`✓ ${tracks.length} morceaux importés de Spotify`);
      
      // Initialiser le player Spotify
      if (!spotifyPlayer) {
        const player = await spotifyService.initPlayer(
          spotifyToken,
          (deviceId) => setSpotifyDeviceId(deviceId),
          (state) => {
            if (state) {
              setSongDuration(state.duration / 1000);
              // Sauvegarder la position actuelle en millisecondes
              const positionMs = state.position;
              setSpotifyPosition(positionMs);
              console.log('Position Spotify:', positionMs, 'ms');
            }
          }
        );
        setSpotifyPlayer(player);
      }
      
      // Reset scores et chrono
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
      setDebugInfo(`✓ Image chargée`);
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
      setDebugInfo(`✓ ${file.name} chargé (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    };
    reader.onerror = () => {
      setDebugInfo(`❌ Erreur lecture fichier ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const togglePlay = async () => {
    const track = playlist[currentTrack];
    
    if (isSpotifyMode) {
      // Mode Spotify
      if (!spotifyToken || !spotifyDeviceId) {
        setDebugInfo('❌ Player Spotify non initialisé');
        return;
      }

      try {
        if (isPlaying) {
          // Récupérer la position actuelle AVANT de pauser
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
          // Reprendre à la position sauvegardée (en millisecondes)
          // Si c'est une nouvelle chanson (position = 0), démarrer du début
          const startPosition = spotifyPosition || 0;
          console.log('Reprise lecture à:', startPosition, 'ms');
          await spotifyService.playTrack(spotifyToken, spotifyDeviceId, track.spotifyUri, startPosition);
          setIsPlaying(true);
          setDebugInfo(`✓ Lecture Spotify en cours (${(startPosition/1000).toFixed(1)}s)`);
          
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
      // Mode MP3
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
            setDebugInfo('✓ Lecture en cours');
            
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
    setBuzzedTeam(null);
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
      
      // IMPORTANT: Reset position pour la nouvelle chanson
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
      setBuzzedTeam(null);
      
      // IMPORTANT: Reset position pour la nouvelle chanson
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
    
    const songRef = ref(database, 'currentSong');
    set(songRef, {
      title: updatedPlaylist[currentTrack].title,
      artist: updatedPlaylist[currentTrack].artist,
      imageUrl: updatedPlaylist[currentTrack].imageUrl,
      revealed: true,
      number: currentTrack + 1
    });
  };

  const addPoint = async (team) => {
    const maxPoints = 2500;
    let points = maxPoints;
    
    if (songDuration > 0) {
      const progressRatio = currentChrono / songDuration;
      points = maxPoints * (1 - progressRatio);
      
      if (currentChrono >= 5) points -= 500;
      if (currentChrono >= 15) points -= 500;
      
      points = Math.max(0, Math.round(points));
    }
    
    const newScores = { ...scores, [team]: scores[team] + points };
    setScores(newScores);
    setBuzzedTeam(null);
    
    const scoresRef = ref(database, 'scores');
    set(scoresRef, newScores);
    
    setDebugInfo(`✓ ${points} points pour ${team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2'} (${currentChrono.toFixed(1)}s / ${songDuration.toFixed(0)}s)`);
  };

  const resetScores = () => {
    const newScores = { team1: 0, team2: 0 };
    setScores(newScores);
    
    const scoresRef = ref(database, 'scores');
    set(scoresRef, newScores);
  };

  const currentSong = playlist[currentTrack];
  
  const maxPoints = 2500;
  let availablePoints = maxPoints;
  if (songDuration > 0 && currentChrono > 0) {
    const progressRatio = currentChrono / songDuration;
    availablePoints = maxPoints * (1 - progressRatio);
    
    if (currentChrono >= 5) availablePoints -= 500;
    if (currentChrono >= 15) availablePoints -= 500;
    
    availablePoints = Math.max(0, Math.round(availablePoints));
  }

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
              <span>✓ Connecté à Spotify</span>
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
          Reset Scores
        </button>

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
                    <div className="text-mystery mb-4">🎵 Mystère et boules de gomme...</div>
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
                        <div style={{ fontWeight: 'bold' }}>
                          {index + 1}. {track.revealed ? track.title : track.title === 'En attente de fichier...' ? track.title : '???'}
                        </div>
                        {track.revealed && track.artist && (
                          <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.25rem' }}>
                            {track.artist}
                          </div>
                        )}
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