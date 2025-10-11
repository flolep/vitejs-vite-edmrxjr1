import React, { useState, useRef, useEffect } from 'react';
import { database } from './firebase';
import { ref, onValue, remove, set } from 'firebase/database';

export default function Master() {
  const [playlist, setPlaylist] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [buzzedTeam, setBuzzedTeam] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [currentChrono, setCurrentChrono] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const audioRef = useRef(null);
  const buzzerSoundRef = useRef(null);

  // Écouter le chrono depuis Firebase
  useEffect(() => {
    const chronoRef = ref(database, 'chrono');
    const unsubscribe = onValue(chronoRef, (snapshot) => {
      const chronoValue = snapshot.val() || 0;
      setCurrentChrono(chronoValue);
    });
    return () => unsubscribe();
  }, []);

  // Créer le son de buzzer au chargement
  useEffect(() => {
    // Créer un son de buzzer avec Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const playBuzzerSound = () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Fréquence du buzzer
      oscillator.type = 'square';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    };
    
    buzzerSoundRef.current = playBuzzerSound;
  }, []);

  // Écouter les buzz via Firebase
  useEffect(() => {
    const buzzRef = ref(database, 'buzz');
    
    const unsubscribe = onValue(buzzRef, (snapshot) => {
      const buzzData = snapshot.val();
      if (buzzData && isPlaying) {
        setBuzzedTeam(buzzData.team);
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        
        // Arrêter le chrono sur la TV
        const playingRef = ref(database, 'isPlaying');
        set(playingRef, false);
        
        // Jouer le son de buzzer
        if (buzzerSoundRef.current) {
          buzzerSoundRef.current();
        }
        
        setDebugInfo(`🔔 ${buzzData.team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2'} a buzzé !`);
        remove(buzzRef);
      }
    });

    return () => unsubscribe();
  }, [isPlaying]);

  const handleManualAdd = () => {
    const newTrack = {
      title: 'En attente de fichier...',
      artist: '',
      audioUrl: null,
      imageUrl: null,
      revealed: false
    };
    
    // Si c'est le premier morceau, réinitialiser tout
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

  const togglePlay = () => {
    const track = playlist[currentTrack];
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
      
      // Arrêter le chrono sur la TV
      const playingRef = ref(database, 'isPlaying');
      set(playingRef, false);
    } else {
      setDebugInfo('▶️ Tentative de lecture...');
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setDebugInfo('✓ Lecture en cours');
          
          // Démarrer le chrono sur la TV
          const playingRef = ref(database, 'isPlaying');
          set(playingRef, true);
          
          // Indiquer le numéro de morceau en cours de lecture
          const trackNumberRef = ref(database, 'playingTrackNumber');
          set(trackNumberRef, currentTrack);
        })
        .catch(error => {
          setDebugInfo('❌ Erreur: ' + error.message);
          console.error('Erreur play:', error);
        });
    }
    setBuzzedTeam(null);
  };

  const nextTrack = () => {
    if (currentTrack < playlist.length - 1) {
      if (audioRef.current) audioRef.current.pause();
      const newTrackIndex = currentTrack + 1;
      setCurrentTrack(newTrackIndex);
      setIsPlaying(false);
      setBuzzedTeam(null);
      
      // Reset le chrono pour la nouvelle chanson
      const chronoRef = ref(database, 'chrono');
      set(chronoRef, 0);
      
      const playingRef = ref(database, 'isPlaying');
      set(playingRef, false);
      
      // Indiquer qu'on a changé de morceau (force le reset sur TV)
      const trackNumberRef = ref(database, 'currentTrackNumber');
      set(trackNumberRef, newTrackIndex);
      
      // Mettre à jour la TV avec le nouveau morceau (non révélé)
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
      if (audioRef.current) audioRef.current.pause();
      const newTrackIndex = currentTrack - 1;
      setCurrentTrack(newTrackIndex);
      setIsPlaying(false);
      setBuzzedTeam(null);
      
      // Reset le chrono pour la nouvelle chanson
      const chronoRef = ref(database, 'chrono');
      set(chronoRef, 0);
      
      const playingRef = ref(database, 'isPlaying');
      set(playingRef, false);
      
      // Indiquer qu'on a changé de morceau (force le reset sur TV)
      const trackNumberRef = ref(database, 'currentTrackNumber');
      set(trackNumberRef, newTrackIndex);
    }
  };

  const revealAnswer = () => {
    const updatedPlaylist = [...playlist];
    updatedPlaylist[currentTrack].revealed = true;
    setPlaylist(updatedPlaylist);
    
    // Synchroniser sur Firebase pour la TV
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
    // Calculer les points selon la formule dégressive
    const maxPoints = 250;
    let points = maxPoints;
    
    if (songDuration > 0) {
      const progressRatio = currentChrono / songDuration;
      points = Math.max(0, Math.round(maxPoints * (1 - progressRatio)));
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
  
  // Calculer les points disponibles en temps réel
  const maxPoints = 250;
  let availablePoints = maxPoints;
  if (songDuration > 0 && currentChrono > 0) {
    const progressRatio = currentChrono / songDuration;
    availablePoints = Math.max(0, Math.round(maxPoints * (1 - progressRatio)));
  }

  return (
    <div className="bg-gradient">
      <div className="container">
        <h1 className="title">🎵 BLIND TEST 🎵</h1>

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
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Créer la playlist</h3>
            <button onClick={handleManualAdd} className="btn btn-purple">
              + Ajouter un morceau
            </button>
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

              <audio 
                ref={audioRef}
                src={currentSong?.audioUrl || ''}
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={(e) => {
                  const duration = e.target.duration;
                  setSongDuration(duration);
                  // Synchroniser la durée sur Firebase pour la TV
                  const durationRef = ref(database, 'songDuration');
                  set(durationRef, duration);
                }}
              />

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
                  disabled={!currentSong?.audioUrl}
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
            </div>

            <div className="player-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.5rem' }}>Playlist ({playlist.length})</h3>
                <button onClick={handleManualAdd} className="btn btn-purple">
                  + Ajouter
                </button>
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
                        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ color: track.audioUrl ? '#10b981' : '#ef4444' }}>
                            {track.audioUrl ? '✓ Audio' : '⚠️ Pas d\'audio'}
                          </span>
                          <span style={{ color: track.imageUrl ? '#10b981' : '#ef4444' }}>
                            {track.imageUrl ? '✓ Image' : '⚠️ Pas d\'image'}
                          </span>
                        </div>
                      </div>
                      
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