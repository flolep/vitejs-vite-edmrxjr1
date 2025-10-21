import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';

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

const PlayerAvatar = ({ player, buzzedPlayerName }) => {
  const isBuzzed = player.name === buzzedPlayerName;
  const isInCooldown = player.cooldownEnd && player.cooldownEnd > Date.now();
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  useEffect(() => {
    if (!isInCooldown) {
      setCooldownRemaining(0);
      return;
    }
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, (player.cooldownEnd - Date.now()) / 1000);
      setCooldownRemaining(remaining);
    }, 100);
    
    return () => clearInterval(interval);
  }, [player.cooldownEnd, isInCooldown]);
  
  const getBorderStyle = () => {
    if (isBuzzed) {
      return {
        border: '6px solid #fbbf24',
        boxShadow: '0 0 30px rgba(251, 191, 36, 0.8)'
      };
    }
    if (isInCooldown) {
      return {
        border: '4px solid #ef4444',
        boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)'
      };
    }
    return {
      border: '2px solid rgba(255, 255, 255, 0.3)',
      boxShadow: 'none'
    };
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      margin: '0 0.5rem',
      position: 'relative'
    }}>
      <img 
        src={player.photo || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Ccircle cx="40" cy="40" r="40" fill="%23666"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="30"%3E' + (player.name?.[0] || '?') + '%3C/text%3E%3C/svg%3E'}
        alt={player.name}
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          objectFit: 'cover',
          ...getBorderStyle(),
          transition: 'all 0.3s ease',
          filter: isInCooldown ? 'grayscale(50%)' : 'none'
        }}
      />
      
      {isBuzzed && (
        <div style={{
          position: 'absolute',
          top: '-10px',
          right: '-10px',
          fontSize: '2rem'
        }}>
          ⚡
        </div>
      )}
      
      {/* ✅ Affichage du cooldown */}
      {isInCooldown && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: '#ef4444',
          textShadow: '0 0 10px black',
          backgroundColor: 'rgba(0,0,0,0.7)',
          borderRadius: '50%',
          width: '70px',
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {cooldownRemaining.toFixed(1)}
        </div>
      )}
      
      <div style={{
        marginTop: '0.5rem',
        fontSize: '0.9rem',
        fontWeight: isBuzzed ? 'bold' : 'normal',
        color: isInCooldown ? '#ef4444' : isBuzzed ? '#fbbf24' : 'white',
        textAlign: 'center',
        maxWidth: '90px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {player.name}
        {isInCooldown && ' 🔥'}
      </div>
    </div>
  );
};

export default function TV() {
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [playersTeam1, setPlayersTeam1] = useState([]);
  const [playersTeam2, setPlayersTeam2] = useState([]);
  const [buzzedPlayerName, setBuzzedPlayerName] = useState(null);
  const [buzzedPlayerPhoto, setBuzzedPlayerPhoto] = useState(null);
  const [buzzedTeam, setBuzzedTeam] = useState(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [chrono, setChrono] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingTrackNumber, setPlayingTrackNumber] = useState(null);
  const [songDuration, setSongDuration] = useState(0);
  
  // NOUVEAU : État de fin de partie
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState(null);
  const [fastestBuzz, setFastestBuzz] = useState(null);

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
        setBuzzedPlayerName(buzzData.playerName || null);
        setBuzzedPlayerPhoto(buzzData.playerPhoto || null);
      } else {
        setBuzzedTeam(null);
        setBuzzedPlayerName(null);
        setBuzzedPlayerPhoto(null);
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
  
  // NOUVEAU : Écouter la fin de partie
  useEffect(() => {
    const gameStatusRef = ref(database, 'game_status');
    const unsubscribe = onValue(gameStatusRef, (snapshot) => {
      const status = snapshot.val();
      
      // Si la partie est terminée
      if (status && status.ended) {
        setGameEnded(true);
        setWinner(status.winner);
        
        // Charger le buzz le plus rapide
        const buzzTimesRef = ref(database, 'buzz_times');
        onValue(buzzTimesRef, (buzzSnapshot) => {
          const data = buzzSnapshot.val();
          if (data) {
            const allBuzzes = [];
            Object.keys(data).forEach(trackIndex => {
              data[trackIndex].forEach(buzz => {
                allBuzzes.push(buzz);
              });
            });
            
            // Trouver le plus rapide
            if (allBuzzes.length > 0) {
              allBuzzes.sort((a, b) => a.time - b.time);
              setFastestBuzz(allBuzzes[0]);
            }
          }
        }, { onlyOnce: true });
      }
      // Si reset complet (ended = false)
      else if (status && !status.ended && gameEnded) {
        // Recharger la page pour revenir à l'état initial
        window.location.reload();
      }
    });
    return () => unsubscribe();
  }, [gameEnded]);

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

    // Écouter les joueurs de l'équipe 1
  useEffect(() => {
    const team1Ref = ref(database, 'players_session/team1');
    const unsubscribe = onValue(team1Ref, (snapshot) => {
      const playersObj = snapshot.val();
      if (playersObj) {
        const playersArray = Object.values(playersObj);
        setPlayersTeam1(playersArray);
      } else {
        setPlayersTeam1([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Écouter les joueurs de l'équipe 2
  useEffect(() => {
    const team2Ref = ref(database, 'players_session/team2');
    const unsubscribe = onValue(team2Ref, (snapshot) => {
      const playersObj = snapshot.val();
      if (playersObj) {
        const playersArray = Object.values(playersObj);
        setPlayersTeam2(playersArray);
      } else {
        setPlayersTeam2([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Calculer les points disponibles avec le nouveau système
  const availablePoints = calculatePoints(chrono, songDuration);
  
  // Calculer le pourcentage de progression
  let progressPercent = 0;
  if (songDuration > 0 && chrono > 0) {
    progressPercent = Math.min(100, (chrono / songDuration) * 100);
  }
  
  // Couleur des points selon le montant
  let pointsColor = '#10b981'; // vert
  if (availablePoints < 1500) pointsColor = '#f59e0b'; // orange
  if (availablePoints < 750) pointsColor = '#ef4444'; // rouge
  
  // Détection des zones critiques (paliers)
  const isAt5s = chrono >= 4.5 && chrono < 5.5;
  const isAt15s = chrono >= 14.5 && chrono < 15.5;
  const isNearCritical = isAt5s || isAt15s;

  // NOUVEAU : Écran de victoire
  if (gameEnded) {
    const winnerTeam = winner === 'team1' ? 1 : winner === 'team2' ? 2 : null;
    const winnerColor = winner === 'team1' ? '#dc2626' : winner === 'team2' ? '#2563eb' : '#6b7280';
    
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        minHeight: '100vh',
        color: 'white',
        padding: '3rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Animation de victoire */}
        <div style={{
          textAlign: 'center',
          animation: 'fadeInScale 1s ease-out'
        }}>
          <h1 style={{
            fontSize: '5rem',
            marginBottom: '2rem',
            color: '#fbbf24',
            animation: 'pulse 2s infinite'
          }}>
            🎉 PARTIE TERMINÉE ! 🎉
          </h1>
          
          {winner === 'draw' ? (
            <h2 style={{ fontSize: '3rem', marginBottom: '3rem' }}>
              🤝 ÉGALITÉ !
            </h2>
          ) : (
            <>
              <h2 style={{
                fontSize: '6rem',
                marginBottom: '2rem',
                color: winnerColor,
                textShadow: `0 0 40px ${winnerColor}`,
                animation: 'bounce 1s infinite'
              }}>
                {winner === 'team1' ? '🔴' : '🔵'} ÉQUIPE {winnerTeam} GAGNE !
              </h2>
              
              <div style={{
                fontSize: '4rem',
                fontWeight: 'bold',
                marginBottom: '3rem',
                animation: 'pulse 1.5s infinite'
              }}>
                {winner === 'team1' ? scores.team1 : scores.team2} points
              </div>
            </>
          )}
          
          {/* Scores finaux */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            marginBottom: '4rem',
            maxWidth: '800px'
          }}>
            <div style={{
              backgroundColor: winner === 'team1' ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.1)',
              borderRadius: '1rem',
              padding: '2rem',
              border: winner === 'team1' ? '4px solid #fbbf24' : 'none'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔴 ÉQUIPE 1</div>
              <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>{scores.team1}</div>
            </div>
            
            <div style={{
              backgroundColor: winner === 'team2' ? 'rgba(37, 99, 235, 0.3)' : 'rgba(37, 99, 235, 0.1)',
              borderRadius: '1rem',
              padding: '2rem',
              border: winner === 'team2' ? '4px solid #fbbf24' : 'none'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔵 ÉQUIPE 2</div>
              <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>{scores.team2}</div>
            </div>
          </div>
          
          {/* Prix de la rapidité */}
          {fastestBuzz && (
            <div style={{
              backgroundColor: 'rgba(251, 191, 36, 0.2)',
              borderRadius: '2rem',
              padding: '3rem',
              border: '3px solid #fbbf24',
              maxWidth: '800px',
              animation: 'fadeInUp 1.5s ease-out'
            }}>
              <h3 style={{
                fontSize: '3rem',
                marginBottom: '2rem',
                color: '#fbbf24'
              }}>
                ⚡ PRIX DE LA RAPIDITÉ ⚡
              </h3>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                {fastestBuzz.teamName}
              </div>
              <div style={{
                fontSize: '5rem',
                fontWeight: 'bold',
                color: '#10b981',
                marginBottom: '1rem'
              }}>
                {fastestBuzz.time.toFixed(1)}s
              </div>
              <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>
                Morceau #{fastestBuzz.trackNumber}
              </div>
            </div>
          )}
        </div>
        
        {/* Styles d'animation */}
        <style>{`
          @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
          }
        `}</style>
      </div>
    );
  }

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

          {/* Avatars Équipe 1 */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginTop: '1rem'
          }}>
            {playersTeam1.map((player, idx) => (
              <PlayerAvatar 
                key={idx} 
                player={player} 
                buzzedPlayerName={buzzedPlayerName}
              />
            ))}
            
            {playersTeam1.length === 0 && (
              <div style={{ 
                opacity: 0.5, 
                fontSize: '1rem',
                padding: '1rem'
              }}>
                En attente de joueurs...
              </div>
            )}
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

        {/* Avatars Équipe 2 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          {playersTeam2.map((player, idx) => (
            <PlayerAvatar 
              key={idx} 
              player={player} 
              buzzedPlayerName={buzzedPlayerName}
            />
          ))}
          
          {playersTeam2.length === 0 && (
            <div style={{ 
              opacity: 0.5, 
              fontSize: '1rem',
              padding: '1rem'
            }}>
              En attente de joueurs...
            </div>
          )}
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
                  animation: isNearCritical ? 'pulse 0.5s infinite' : 'none'
                }}>
                  {availablePoints}
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  opacity: 0.7
                }}>
                  / 2500 pts
                </div>
                
                {/* Alertes aux paliers critiques */}
                {isAt5s && (
                  <div style={{
                    marginTop: '1rem',
                    fontSize: '1.5rem',
                    color: '#fbbf24',
                    fontWeight: 'bold',
                    animation: 'pulse 0.5s infinite'
                  }}>
                    ⚠️ Palier à 5s !
                  </div>
                )}
                
                {isAt15s && (
                  <div style={{
                    marginTop: '1rem',
                    fontSize: '1.5rem',
                    color: '#ef4444',
                    fontWeight: 'bold',
                    animation: 'pulse 0.5s infinite'
                  }}>
                    ⚠️ Palier à 15s !
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
          💡 0-5s : 2500 pts • 5-15s : décroissance • 15s+ : décroissance rapide
        </div>

      </div>
    </div>
  );
}