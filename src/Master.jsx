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
  const audioRef = useRef(null);

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
      revealed: false
    };
    setPlaylist([...playlist, newTrack]);
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
    } else {
      setDebugInfo('▶️ Tentative de lecture...');
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setDebugInfo('✓ Lecture en cours');
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
      setCurrentTrack(currentTrack + 1);
      setIsPlaying(false);
      setBuzzedTeam(null);
    }
  };

  const prevTrack = () => {
    if (currentTrack > 0) {
      if (audioRef.current) audioRef.current.pause();
      setCurrentTrack(currentTrack - 1);
      setIsPlaying(false);
      setBuzzedTeam(null);
    }
  };

  const revealAnswer = () => {
    const updatedPlaylist = [...playlist];
    updatedPlaylist[currentTrack].revealed = true;
    setPlaylist(updatedPlaylist);
  };

  const addPoint = (team) => {
    const newScores = { ...scores, [team]: scores[team] + 1 };
    setScores(newScores);
    setBuzzedTeam(null);
    
    const scoresRef = ref(database, 'scores');
    set(scoresRef, newScores);
  };

  const resetScores = () => {
    const newScores = { team1: 0, team2: 0 };
    setScores(newScores);
    
    const scoresRef = ref(database, 'scores');
    set(scoresRef, newScores);
  };

  const currentSong = playlist[currentTrack];

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
                + 1 Point
              </button>
            )}
          </div>
          
          <div className={`score-card blue ${buzzedTeam === 'team2' ? 'buzzed' : ''}`}>
            <h2>ÉQUIPE 2</h2>
            <div className="score-number">{scores.team2}</div>
            {buzzedTeam === 'team2' && (
              <button onClick={() => addPoint('team2')} className="btn btn-green">
                + 1 Point
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
                  
                  {!currentSong.audioUrl && (
                    <div className="mb-4">
                      <label className="file-label">
                        📁 Charger le MP3
                        <input 
                          type="file" 
                          accept="audio/*"
                          onChange={(e) => e.target.files[0] && handleAudioForTrack(currentTrack, e.target.files[0])}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}

              <audio 
                ref={audioRef}
                src={currentSong?.audioUrl || ''}
                onEnded={() => setIsPlaying(false)}
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
                    <div style={{ fontWeight: 'bold' }}>
                      {index + 1}. {track.revealed ? track.title : '???'}
                    </div>
                    {track.revealed && track.artist && (
                      <div style={{ fontSize: '0.875rem', opacity: 0.7, marginTop: '0.25rem' }}>
                        {track.artist}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: track.audioUrl ? '#10b981' : '#ef4444' }}>
                      {track.audioUrl ? '✓ Audio chargé' : '⚠️ Pas d\'audio'}
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