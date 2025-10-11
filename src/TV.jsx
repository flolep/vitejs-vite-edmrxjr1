import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';

export default function TV() {
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [buzzedTeam, setBuzzedTeam] = useState(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [chrono, setChrono] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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
      
      // Reset le chrono quand on lance la musique
      if (playing) {
        setChrono(0);
      }
    });
    return () => unsubscribe();
  }, []);

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

  // Écouter le morceau actuel
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

  // Chronomètre - tourne quand la musique joue
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setChrono(prev => {
          const newChrono = prev + 0.1;
          // Synchroniser le chrono sur Firebase pour que Master puisse le lire
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

  const chronoColor = chrono <= 10 ? '#10b981' : '#f59e0b';
  const points = getPointsForTime(chrono);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      minHeight: '100vh',
      color: 'white',
      padding: '3rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Titre */}
        <h1 style={{
          fontSize: '4rem',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '3rem',
          color: '#fbbf24',
          textShadow: '0 0 20px rgba(251, 191, 36, 0.5)'
        }}>
          🎵 BLIND TEST 🎵
        </h1>

        {/* Scores */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          marginBottom: '3rem'
        }}>
          <div style={{
            backgroundColor: '#dc2626',
            borderRadius: '2rem',
            padding: '3rem',
            textAlign: 'center',
            transform: buzzedTeam === 'team1' ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.3s',
            boxShadow: buzzedTeam === 'team1' ? '0 0 40px rgba(251, 191, 36, 0.8)' : 'none',
            outline: buzzedTeam === 'team1' ? '4px solid #fbbf24' : 'none'
          }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔴 ÉQUIPE 1</h2>
            <div style={{ fontSize: '8rem', fontWeight: 'bold', lineHeight: 1 }}>
              {scores.team1}
            </div>
          </div>

          <div style={{
            backgroundColor: '#2563eb',
            borderRadius: '2rem',
            padding: '3rem',
            textAlign: 'center',
            transform: buzzedTeam === 'team2' ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.3s',
            boxShadow: buzzedTeam === 'team2' ? '0 0 40px rgba(251, 191, 36, 0.8)' : 'none',
            outline: buzzedTeam === 'team2' ? '4px solid #fbbf24' : 'none'
          }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔵 ÉQUIPE 2</h2>
            <div style={{ fontSize: '8rem', fontWeight: 'bold', lineHeight: 1 }}>
              {scores.team2}
            </div>
          </div>
        </div>

        {/* Chronomètre - affiché quand la musique joue */}
        {isPlaying && (
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '2rem',
            padding: '3rem',
            textAlign: 'center',
            marginBottom: '3rem'
          }}>
            <h3 style={{
              fontSize: '2rem',
              marginBottom: '2rem',
              color: '#fbbf24'
            }}>
              ⏱️ TEMPS ÉCOULÉ
            </h3>
            <div style={{
              fontSize: '8rem',
              fontWeight: 'bold',
              color: chronoColor,
              lineHeight: 1,
              marginBottom: '1rem',
              textShadow: `0 0 30px ${chronoColor}`
            }}>
              {chrono.toFixed(1)}s
            </div>
            <div style={{
              fontSize: '3rem',
              color: chronoColor,
              fontWeight: 'bold'
            }}>
              {chrono <= 10 ? '🔥 3 POINTS SI BUZZ' : '⭐ 1 POINT SI BUZZ'}
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
          ⚡ Moins de 10s = 3 points • ⭐ Plus de 10s = 1 point
        </div>

      </div>
    </div>
  );
}