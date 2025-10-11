import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';

export default function TV() {
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [buzzedTeam, setBuzzedTeam] = useState(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [chrono, setChrono] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingTrackNumber, setPlayingTrackNumber] = useState(null);
  const [songDuration, setSongDuration] = useState(0);

  // Écouter le chrono depuis Firebase
  useEffect(() => {
    const chronoRef = ref(database, 'chrono');
    const unsubscribe = onValue(chronoRef, (snapshot) => {
      const chronoValue = snapshot.val();
      if (chronoValue !== null) {
        setChrono(chronoValue);
      }
    });
    return () => unsubscribe();
  }, []);

  // Écouter la durée de la chanson
  useEffect(() => {
    const durationRef = ref(database, 'songDuration');
    const unsubscribe = onValue(durationRef, (snapshot) => {
      const duration = snapshot.val();
      if (duration) {
        setSongDuration(duration);
      }
    });
    return () => unsubscribe();
  }, []);

  // Écouter les scores
  useEffect(() => {
    const scoresRef = ref(database, 'scores');
    const unsubscribe = onValue(scoresRef, (snapshot) => {
      const scoresData = snapshot.val();
      if (scoresData) {
        setScores(scoresData);
      }
    });
    return () => unsubscribe();
  }, []);

  // Écouter l'état de lecture (Play/Pause)
  useEffect(() => {
    const playingRef = ref(database, 'isPlaying');
    const unsubscribe = onValue(playingRef, (snapshot) => {
      const playing = snapshot.val();
      setIsPlaying(playing || false);
    });
    return () => unsubscribe();
  }, []);

  // Écouter le numéro de morceau actuel (pour détecter les changements)
  useEffect(() => {
    const trackNumberRef = ref(database, 'currentTrackNumber');
    const unsubscribe = onValue(trackNumberRef, (snapshot) => {
      const trackNumber = snapshot.val();
      
      // Reset le chrono quand le morceau change
      if (trackNumber !== null && trackNumber !== playingTrackNumber) {
        setChrono(0);
      }
      
      setPlayingTrackNumber(trackNumber);
    });
    return () => unsubscribe();
  }, [playingTrackNumber]);

  // Écouter les buzz
  useEffect(() => {
    const buzzRef = ref(database, 'buzz');
    const unsubscribe = onValue(buzzRef, (snapshot) => {
      const buzzData = snapshot.val();
      if (buzzData) {
        setBuzzedTeam(buzzData.team);
      } else {
        setBuzzedTeam(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Écouter le morceau actuel (pour affichage info)
  useEffect(() => {
    const songRef = ref(database, 'currentSong');
    const unsubscribe = onValue(songRef, (snapshot) => {
      const songData = snapshot.val();
      if (songData) {
        setCurrentSong(songData);
      }
    });
    return () => unsubscribe();
  }, []);

  // Chronomètre - tourne quand la musique joue et synchronise sur Firebase
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setChrono(prev => {
          const newChrono = prev + 0.1;
          // Synchroniser sur Firebase
          const chronoRef = ref(database, 'chrono');
          set(chronoRef, newChrono);
          return newChrono;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const getPointsForTime = (time) => {
    if (time <= 10) return 3;
    return 1;
  };

  // Calculer les points dégressifs avec paliers
  const maxPoints = 2500;
  let availablePoints = maxPoints;
  let progressPercent = 0;
  
  if (songDuration > 0 && chrono > 0) {
    progressPercent = Math.min(100, (chrono / songDuration) * 100);
    
    // Décroissance linéaire de base
    availablePoints = maxPoints * (1 - progressPercent / 100);
    
    // Malus à des paliers spécifiques
    if (chrono >= 5) {
      availablePoints -= 500; // Malus à 5s
    }
    if (chrono >= 15) {
      availablePoints -= 500; // Malus à 15s
    }
    
    availablePoints = Math.max(0, Math.round(availablePoints));
  }

  const chronoColor = chrono <= 10 ? '#10b981' : '#f59e0b';
  
  // Couleur des points selon le nombre restant
  let pointsColor = '#10b981'; // vert
  if (availablePoints < 1500) pointsColor = '#f59e0b'; // orange
  if (availablePoints < 750) pointsColor = '#ef4444'; // rouge
  
  // Détection des zones de malus pour affichage visuel
  const isNearPenalty = (chrono >= 4.5 && chrono < 5.5) || (chrono >= 14.5 && chrono < 15.5);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      minHeight: '100vh',
      color: 'white',
      padding: '3rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header avec titre et scores */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: '2rem',
          marginBottom: '3rem'
        }}>
          
          {/* Score Équipe 1 */}
          <div style={{
            backgroundColor: '#dc2626',
            borderRadius: '1.5rem',
            padding: '2rem',
            textAlign: 'center',
            transform: buzzedTeam === 'team1' ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.3s',
            boxShadow: buzzedTeam === 'team1' ? '0 0 40px rgba(251, 191, 36, 0.8)' : 'none',
            outline: buzzedTeam === 'team1' ? '4px solid #fbbf24' : 'none'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔴 ÉQUIPE 1</h2>
            <div style={{ fontSize: '4rem', fontWeight: 'bold', lineHeight: 1 }}>
              {scores.team1}
            </div>
          </div>

          {/* Titre */}
          <h1 style={{
            fontSize: '4rem',
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#fbbf24',
            textShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
            whiteSpace: 'nowrap'
          }}>
            🎵 BLIND TEST 🎵
          </h1>

          {/* Score Équipe 2 */}
          <div style={{
            backgroundColor: '#2563eb',
            borderRadius: '1.5rem',
            padding: '2rem',
            textAlign: 'center',
            transform: buzzedTeam === 'team2' ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.3s',
            boxShadow: buzzedTeam === 'team2' ? '0 0 40px rgba(251, 191, 36, 0.8)' : 'none',
            outline: buzzedTeam === 'team2' ? '4px solid #fbbf24' : 'none'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔵 ÉQUIPE 2</h2>
            <div style={{ fontSize: '4rem', fontWeight: 'bold', lineHeight: 1 }}>
              {scores.team2}
            </div>
          </div>
        </div>

        {/* Chronomètre et Points - affiché quand la musique joue OU en pause après avoir joué */}
        {(isPlaying || chrono > 0) && (
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '2rem',
            padding: '3rem',
            marginBottom: '3rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
              
              {/* Chrono */}
              <div style={{ textAlign: 'center' }}>
                <h3 style={{
                  fontSize: '2rem',
                  marginBottom: '2rem',
                  color: '#fbbf24'
                }}>
                  ⏱️ {isPlaying ? 'TEMPS ÉCOULÉ' : 'TEMPS FIGÉ'}
                </h3>
                <div style={{
                  fontSize: '6rem',
                  fontWeight: 'bold',
                  color: '#60a5fa',
                  lineHeight: 1,
                  marginBottom: '1rem'
                }}>
                  {chrono.toFixed(1)}s
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  opacity: 0.7
                }}>
                  / {songDuration.toFixed(0)}s
                </div>
              </div>

              {/* Points disponibles */}
              <div style={{ textAlign: 'center' }}>
                <h3 style={{
                  fontSize: '2rem',
                  marginBottom: '2rem',
                  color: '#fbbf24'
                }}>
                  💰 POINTS DISPONIBLES
                </h3>
                <div style={{
                  fontSize: '6rem',
                  fontWeight: 'bold',
                  color: pointsColor,
                  lineHeight: 1,
                  marginBottom: '1rem',
                  textShadow: `0 0 30px ${pointsColor}`,
                  animation: isNearPenalty ? 'pulse 0.5s infinite' : 'none'
                }}>
                  {availablePoints}
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  opacity: 0.7
                }}>
                  / 2500 pts
                </div>
                {isNearPenalty && (
                  <div style={{
                    marginTop: '1rem',
                    fontSize: '1.5rem',
                    color: '#ef4444',
                    fontWeight: 'bold',
                    animation: 'pulse 0.5s infinite'
                  }}>
                    ⚠️ MALUS -500 PTS !
                  </div>
                )}
              </div>
            </div>

            {/* Barre de progression */}
            <div style={{ marginTop: '3rem' }}>
              <div style={{
                width: '100%',
                height: '40px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '20px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${pointsColor} 0%, ${pointsColor}88 100%)`,
                  transition: 'width 0.1s linear',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '1rem',
                  fontSize: '1.2rem',
                  fontWeight: 'bold'
                }}>
                  {progressPercent > 10 && `${progressPercent.toFixed(0)}%`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Morceau actuel */}
        {currentSong && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2rem',
            padding: '3rem',
            textAlign: 'center'
          }}>
            {currentSong.revealed ? (
              <>
                {currentSong.imageUrl && (
                  <div style={{ marginBottom: '2rem' }}>
                    <img 
                      src={currentSong.imageUrl} 
                      alt="Album cover" 
                      style={{
                        width: '300px',
                        height: '300px',
                        objectFit: 'cover',
                        borderRadius: '1rem',
                        margin: '0 auto',
                        display: 'block',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                      }}
                    />
                  </div>
                )}
                <div style={{
                  fontSize: '4rem',
                  fontWeight: 'bold',
                  marginBottom: '1rem',
                  color: '#10b981'
                }}>
                  ✓ {currentSong.title}
                </div>
                {currentSong.artist && (
                  <div style={{
                    fontSize: '3rem',
                    opacity: 0.8
                  }}>
                    {currentSong.artist}
                  </div>
                )}
              </>
            ) : (
              <div style={{
                fontSize: '3rem',
                color: '#9ca3af'
              }}>
                🎵 Morceau {currentSong.number || '?'}
              </div>
            )}
          </div>
        )}

        {/* Légende */}
        <div style={{
          marginTop: '3rem',
          textAlign: 'center',
          fontSize: '1.5rem',
          opacity: 0.7
        }}>
          💡 2500 points • Décroissance continue + Malus de 500 pts à 5s et 15s ! ⚠️
        </div>

      </div>
    </div>
  );
}