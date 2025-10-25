import React, { useState, useEffect, useRef } from 'react';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';
import { QRCodeSVG } from 'qrcode.react';

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

const PlayerAvatar = ({ player, buzzedPlayerKey, buzzedPlayerName }) => {
  // ✅ CORRECTION : Comparer par firebaseKey au lieu du nom
  const isBuzzed = player.firebaseKey === buzzedPlayerKey;
  const isInCooldown = player.cooldownEnd && player.cooldownEnd > Date.now();
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  // ✅ SUPPRIMÉ : const [buzzedPlayerKey, setBuzzedPlayerKey] = useState(null);
  
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
  // États de session
  const [sessionId, setSessionId] = useState('');
  const [sessionValid, setSessionValid] = useState(false);
  const [error, setError] = useState('');

  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [playersTeam1, setPlayersTeam1] = useState([]);
  const [playersTeam2, setPlayersTeam2] = useState([]);
  const [buzzedPlayerName, setBuzzedPlayerName] = useState(null);
  const [buzzedPlayerPhoto, setBuzzedPlayerPhoto] = useState(null);
  const [buzzedPlayerKey, setBuzzedPlayerKey] = useState(null); // ✅ AJOUTÉ ICI (ligne 150)
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

  // État pour le QR Code
  const [showQRCode, setShowQRCode] = useState(false);

  // NOUVEAU : État pour le bonus personnel
  const [personalBonus, setPersonalBonus] = useState(null);
  // Référence pour tracker les popups déjà affichées (évite les re-déclenchements)
  const displayedBonusTracksRef = useRef(new Set());

  // Vérifier le code de session depuis l'URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    if (sessionParam) {
      setSessionId(sessionParam);
      verifySession(sessionParam);
    }
  }, []);

  // Réinitialiser le tracker des popups bonus à chaque nouvelle session
  useEffect(() => {
    if (sessionId) {
      displayedBonusTracksRef.current.clear();
      console.log(`🔄 Tracker de popup bonus réinitialisé pour la session ${sessionId}`);
    }
  }, [sessionId]);

  // Fonction pour vérifier si la session existe
  const verifySession = async (id) => {
    const sessionRef = ref(database, `sessions/${id}`);
    onValue(sessionRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val().active) {
        setSessionValid(true);
      } else {
        setSessionValid(false);
        setError('Code de session invalide ou expiré');
      }
    }, { onlyOnce: true });
  };

  // Fonction pour valider le code de session entré manuellement
  const handleJoinSession = () => {
    if (!sessionId || sessionId.trim().length !== 6) {
      setError('Le code doit contenir 6 caractères');
      return;
    }
    verifySession(sessionId.toUpperCase());
  };

  // Écouter le chrono depuis Firebase
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
    const unsubscribe = onValue(chronoRef, (snapshot) => {
      const chronoValue = snapshot.val();
      if (chronoValue !== null) {
        setChrono(chronoValue);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter la durée de la chanson
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
    const unsubscribe = onValue(durationRef, (snapshot) => {
      const duration = snapshot.val();
      if (duration) {
        setSongDuration(duration);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter les scores
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const scoresRef = ref(database, `sessions/${sessionId}/scores`);
    const unsubscribe = onValue(scoresRef, (snapshot) => {
      const scoresData = snapshot.val();
      if (scoresData) {
        setScores(scoresData);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter l'état de lecture (Play/Pause)
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
    const unsubscribe = onValue(playingRef, (snapshot) => {
      const playing = snapshot.val();
      setIsPlaying(playing || false);
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter le numéro de morceau actuel (pour détecter les changements)
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const trackNumberRef = ref(database, `sessions/${sessionId}/currentTrackNumber`);
    const unsubscribe = onValue(trackNumberRef, (snapshot) => {
      const trackNumber = snapshot.val();

      // Reset le chrono quand le morceau change
      if (trackNumber !== null && trackNumber !== playingTrackNumber) {
        setChrono(0);
      }

      setPlayingTrackNumber(trackNumber);
    });
    return () => unsubscribe();
  }, [playingTrackNumber, sessionValid, sessionId]);

  // Écouter les buzz
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    // ✅ SUPPRIMÉ : const [buzzedPlayerKey, setBuzzedPlayerKey] = useState(null);

    const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
    const unsubscribe = onValue(buzzRef, (snapshot) => {
      const buzzData = snapshot.val();
      if (buzzData) {
        setBuzzedTeam(buzzData.team);
        setBuzzedPlayerName(buzzData.playerName || null);
        setBuzzedPlayerPhoto(buzzData.playerPhoto || null);
        setBuzzedPlayerKey(buzzData.playerFirebaseKey || null); // ✅ Utilise le state du composant
      } else {
        setBuzzedTeam(null);
        setBuzzedPlayerName(null);
        setBuzzedPlayerPhoto(null);
        setBuzzedPlayerKey(null);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter le morceau actuel (pour affichage info)
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const songRef = ref(database, `sessions/${sessionId}/currentSong`);
    const unsubscribe = onValue(songRef, (snapshot) => {
      const songData = snapshot.val();
      if (songData) {
        setCurrentSong(songData);

        // Si une chanson est révélée, vérifier s'il y a un bonus personnel
        if (songData.revealed && songData.number) {
          const trackIndex = songData.number - 1;

          // ✅ Vérifier si on a déjà affiché la popup pour cette chanson
          if (displayedBonusTracksRef.current.has(trackIndex)) {
            console.log(`ℹ️ Popup bonus déjà affichée pour la chanson #${trackIndex}, skip`);
            return;
          }

          const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times/${trackIndex}`);
          onValue(buzzTimesRef, (buzzSnapshot) => {
            const buzzes = buzzSnapshot.val();
            if (buzzes && Array.isArray(buzzes) && buzzes.length > 0) {
              // Vérifier le dernier buzz (celui qui a été validé)
              const lastBuzz = buzzes[buzzes.length - 1];
              if (lastBuzz.hasPersonalBonus && lastBuzz.correct) {
                // ✅ Marquer cette chanson comme déjà affichée
                displayedBonusTracksRef.current.add(trackIndex);
                console.log(`🎯 Popup bonus affichée pour ${lastBuzz.playerName} - chanson #${trackIndex}`);

                setPersonalBonus({
                  playerName: lastBuzz.playerName,
                  basePoints: lastBuzz.basePoints,
                  bonusPoints: lastBuzz.bonusPoints,
                  totalPoints: lastBuzz.points
                });

                // Effacer le bonus après 5 secondes
                setTimeout(() => setPersonalBonus(null), 5000);
              } else {
                setPersonalBonus(null);
              }
            }
          }, { onlyOnce: true });
        }
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // NOUVEAU : Écouter la fin de partie
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const gameStatusRef = ref(database, `sessions/${sessionId}/game_status`);
    const unsubscribe = onValue(gameStatusRef, (snapshot) => {
      const status = snapshot.val();

      // Si la partie est terminée
      if (status && status.ended) {
        setGameEnded(true);
        setWinner(status.winner);

        // Charger le buzz le plus rapide
        const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times`);
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
  }, [gameEnded, sessionValid, sessionId]);

  // Le chrono est maintenant géré par Master, TV ne fait que lire
  // (Ce useEffect a été supprimé car il créait des conflits)

    // Écouter les joueurs de l'équipe 1
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const team1Ref = ref(database, `sessions/${sessionId}/players_session/team1`);
    const unsubscribe = onValue(team1Ref, (snapshot) => {
      const playersObj = snapshot.val();
      if (playersObj) {
        const playersArray = Object.entries(playersObj).map(([key, player]) => ({
        ...player,
        firebaseKey: key
      }));
        setPlayersTeam1(playersArray);
      } else {
        setPlayersTeam1([]);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter les joueurs de l'équipe 2
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const team2Ref = ref(database, `sessions/${sessionId}/players_session/team2`);
    const unsubscribe = onValue(team2Ref, (snapshot) => {
      const playersObj = snapshot.val();
      if (playersObj) {
        const playersArray = Object.entries(playersObj).map(([key, player]) => ({
        ...player,
        firebaseKey: key
      }));
        setPlayersTeam2(playersArray);
      } else {
        setPlayersTeam2([]);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter l'affichage du QR Code
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const qrCodeRef = ref(database, `sessions/${sessionId}/showQRCode`);
    const unsubscribe = onValue(qrCodeRef, (snapshot) => {
      const show = snapshot.val();
      setShowQRCode(show === true);
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

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

  // Écran de saisie du code de session
  if (!sessionValid) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        minHeight: '100vh',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>📺 ÉCRAN TV</h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem', opacity: 0.8 }}>
            Entrez le code de session
          </h2>

          <input
            type="text"
            placeholder="CODE"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value.toUpperCase())}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleJoinSession();
              }
            }}
            maxLength={6}
            autoFocus
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '2rem',
              fontWeight: 'bold',
              letterSpacing: '0.5rem',
              borderRadius: '0.75rem',
              border: 'none',
              marginBottom: '1rem',
              textAlign: 'center',
              textTransform: 'uppercase'
            }}
          />

          {error && (
            <div style={{
              color: '#ef4444',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              padding: '1rem',
              borderRadius: '0.5rem'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleJoinSession}
            disabled={!sessionId || sessionId.length !== 6}
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.25rem',
              backgroundColor: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              fontWeight: 'bold',
              opacity: (!sessionId || sessionId.length !== 6) ? 0.5 : 1
            }}
          >
            ✅ Rejoindre la partie
          </button>

          <p style={{
            marginTop: '2rem',
            fontSize: '0.9rem',
            opacity: 0.7
          }}>
            Demandez le code à l'animateur
          </p>
        </div>
      </div>
    );
  }

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
        animation: 'fadeInScale 1s ease-out',
        width: '100%',
        maxWidth: '1200px', // ✅ Largeur max pour tout centrer
        margin: '0 auto' // ✅ Centrage horizontal
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
          maxWidth: '800px',
          margin: '0 auto 4rem' // ✅ Centrer les scores
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
            margin: '0 auto', // ✅ Centrer le prix
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
            {/* ✅ AJOUT : Afficher le prénom du joueur */}
            <div style={{ 
              fontSize: '2rem', 
              marginBottom: '1rem',
              color: '#fbbf24',
              fontWeight: 'bold'
            }}>
              {fastestBuzz.playerName}
            </div>
            <div style={{
              fontSize: '5rem',
              fontWeight: 'bold',
              color: '#10b981',
              marginBottom: '1rem'
            }}>
              {fastestBuzz.time.toFixed(1)}s
            </div>
            {/* ✅ AJOUT : Afficher le titre de la chanson */}
            <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              🎵 {fastestBuzz.songTitle}
            </div>
            {fastestBuzz.songArtist && (
              <div style={{ fontSize: '1.3rem', opacity: 0.8, marginBottom: '1rem' }}>
                {fastestBuzz.songArtist}
              </div>
            )}
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
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
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
    padding: '2rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }}>
    
    {/* ===== TITRE CENTRÉ EN HAUT ===== */}
    <h1 style={{
      fontSize: '4rem',
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#fbbf24',
      textShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
      marginBottom: '3rem'
    }}>
      🎵 BLIND TEST 🎵
    </h1>

    {/* ===== SCORES ET JOUEURS - LAYOUT 2 COLONNES ===== */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '3rem',
      maxWidth: '1400px',
      margin: '0 auto',
      marginBottom: '3rem'
    }}>
      
      {/* ===== COLONNE GAUCHE : ÉQUIPE 1 ===== */}
      <div>
        {/* Score Équipe 1 */}
        <div style={{
          backgroundColor: '#dc2626',
          borderRadius: '1.5rem',
          padding: '2rem',
          textAlign: 'center',
          transform: buzzedTeam === 'team1' ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.3s',
          boxShadow: buzzedTeam === 'team1' ? '0 0 40px rgba(251, 191, 36, 0.8)' : 'none',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            🔴 ÉQUIPE 1
          </h2>
          <div style={{ fontSize: '5rem', fontWeight: 'bold', lineHeight: 1 }}>
            {scores.team1}
          </div>
        </div>

        {/* Joueurs Équipe 1 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {playersTeam1.map((player, idx) => (
            <PlayerAvatar 
              key={idx} 
              player={player} 
              buzzedPlayerKey={buzzedPlayerKey}
              buzzedPlayerName={buzzedPlayerName}
            />
          ))}
          
          {playersTeam1.length === 0 && (
            <div style={{ 
              opacity: 0.5, 
              fontSize: '1.2rem',
              padding: '2rem',
              textAlign: 'center'
            }}>
              En attente de joueurs...
            </div>
          )}
        </div>
      </div>

      {/* ===== COLONNE DROITE : ÉQUIPE 2 ===== */}
      <div>
        {/* Score Équipe 2 */}
        <div style={{
          backgroundColor: '#2563eb',
          borderRadius: '1.5rem',
          padding: '2rem',
          textAlign: 'center',
          transform: buzzedTeam === 'team2' ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.3s',
          boxShadow: buzzedTeam === 'team2' ? '0 0 40px rgba(251, 191, 36, 0.8)' : 'none',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            🔵 ÉQUIPE 2
          </h2>
          <div style={{ fontSize: '5rem', fontWeight: 'bold', lineHeight: 1 }}>
            {scores.team2}
          </div>
        </div>

        {/* Joueurs Équipe 2 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {playersTeam2.map((player, idx) => (
            <PlayerAvatar 
              key={idx} 
              player={player}
              buzzedPlayerKey={buzzedPlayerKey}
              buzzedPlayerName={buzzedPlayerName}
            />
          ))}
          
          {playersTeam2.length === 0 && (
            <div style={{ 
              opacity: 0.5, 
              fontSize: '1.2rem',
              padding: '2rem',
              textAlign: 'center'
            }}>
              En attente de joueurs...
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ===== CHRONO ET POINTS (en dessous, centré) ===== */}
    {(isPlaying || chrono > 0) && (
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '2rem',
        padding: '3rem',
        maxWidth: '1200px',
        margin: '0 auto 3rem'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '3rem' 
        }}>
          
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
            
            {/* Alertes paliers */}
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
      </div>
    )}

    {/* ===== BARRE DE PROGRESSION ===== */}
    {(isPlaying || chrono > 0) && (
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 3rem'
      }}>
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
        
        {/* Légende des paliers */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '1rem',
          fontSize: '0.9rem',
          opacity: 0.7
        }}>
          <div>🟢 0-5s : 2500 pts</div>
          <div>🟡 5-15s : 2000-1000 pts</div>
          <div>🔴 15s+ : 1000-0 pts</div>
        </div>
      </div>
    )}

    {/* ===== MORCEAU ACTUEL (en bas, centré) ===== */}
    {currentSong && (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '2rem',
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {currentSong.revealed ? (
          <>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {currentSong.title}
            </div>
            <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>
              {currentSong.artist}
            </div>
          </>
        ) : (
          <div style={{ fontSize: '2rem', opacity: 0.5 }}>
            🎵 Mystère...
          </div>
        )}
      </div>
    )}

    {/* ===== BONUS PERSONNEL (popup temporaire) ===== */}
    {personalBonus && (
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(251, 191, 36, 0.98)',
        borderRadius: '3rem',
        padding: '4rem',
        textAlign: 'center',
        border: '5px solid #fbbf24',
        boxShadow: '0 0 80px rgba(251, 191, 36, 0.9)',
        zIndex: 1000,
        animation: 'pulse 0.5s infinite',
        minWidth: '600px'
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: '1rem'
        }}>
          🎯
        </div>
        <div style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '1rem'
        }}>
          BONUS PERSONNEL !
        </div>
        <div style={{
          fontSize: '2rem',
          color: '#1f2937',
          marginBottom: '1.5rem'
        }}>
          {personalBonus.playerName} a trouvé sa propre chanson !
        </div>
        <div style={{
          fontSize: '2.5rem',
          color: '#1f2937',
          marginBottom: '0.5rem'
        }}>
          {personalBonus.basePoints} pts + <span style={{
            fontSize: '3.5rem',
            fontWeight: 'bold',
            color: '#16a34a'
          }}>500 pts</span>
        </div>
        <div style={{
          fontSize: '4rem',
          fontWeight: 'bold',
          color: '#16a34a',
          marginTop: '1rem'
        }}>
          = {personalBonus.totalPoints} pts
        </div>
      </div>
    )}

    {/* Modale QR Code */}
    {showQRCode && sessionId && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '2rem',
          padding: '4rem',
          textAlign: 'center',
          maxWidth: '600px'
        }}>
          <h2 style={{
            fontSize: '3rem',
            marginBottom: '2rem',
            color: '#1e1b4b',
            fontWeight: 'bold'
          }}>
            📱 Rejoindre la partie
          </h2>

          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '1rem',
            marginBottom: '2rem',
            display: 'inline-block'
          }}>
            <QRCodeSVG
              value={`${window.location.origin}/buzzer?session=${sessionId}`}
              size={300}
              level="H"
              includeMargin={true}
            />
          </div>

          <div style={{
            fontSize: '1.5rem',
            color: '#666',
            marginBottom: '1rem'
          }}>
            Scannez le QR code ou entrez le code :
          </div>

          <div style={{
            fontSize: '4rem',
            fontWeight: 'bold',
            color: '#7c3aed',
            letterSpacing: '0.5rem',
            fontFamily: 'monospace',
            backgroundColor: '#f3f4f6',
            padding: '1.5rem',
            borderRadius: '1rem',
            marginTop: '1rem'
          }}>
            {sessionId}
          </div>
        </div>
      </div>
    )}

    {/* Styles d'animation */}
    <style>{`
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
  </div>
);
}