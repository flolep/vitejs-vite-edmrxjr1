import React, { useState, useEffect, useRef } from 'react';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';
import { QRCodeSVG } from 'qrcode.react';
import { QuizDisplay } from './components/tv/QuizDisplay';
import { calculatePoints } from './hooks/useScoring';

// Constantes de design
const COLORS = {
  gradientStart: '#e07a5f', // Coral/Salmon
  gradientEnd: '#1a1a2e',   // Dark
  accent: '#10b981',        // Teal/Green
  warning: '#f59e0b',       // Orange
  danger: '#ef4444',        // Red
  success: '#22c55e',       // Green
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  cardBg: 'rgba(0, 0, 0, 0.4)',
  cardBgLight: 'rgba(255, 255, 255, 0.1)',
};

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

  // 🎯 États Mode Quiz
  const [playMode, setPlayMode] = useState('team'); // 'team' | 'quiz'
  const [quizQuestion, setQuizQuestion] = useState(null); // { trackNumber, answers: [...], correctAnswer, revealed }
  const [quizAnswers, setQuizAnswers] = useState([]); // Réponses des joueurs pour la chanson actuelle
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [playerAnswers, setPlayerAnswers] = useState([]);
  const [quizLeaderboard, setQuizLeaderboard] = useState([]); // Classement général du quiz
  const [allPlayers, setAllPlayers] = useState([]); // Tous les joueurs connectés (pour mode Quiz)
  const [buzzOrder, setBuzzOrder] = useState([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [roundStatus, setRoundStatus] = useState('playing'); // 'playing' | 'finished'

  // 🔊 Ref pour le son de buzzer en mode Quiz
  const buzzerSoundRef = useRef(null);
  const previousAnswersCountRef = useRef(0);

  // 🔊 Créer le son de buzzer (même son qu'en mode Équipe)
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

  // Vérifier le code de session depuis l'URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    if (sessionParam) {
      setSessionId(sessionParam);
      verifySession(sessionParam);
    }
  }, []);


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

  // 🎯 Écouter le mode de jeu (team | quiz)
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const playModeRef = ref(database, `sessions/${sessionId}/playMode`);
    const unsubscribe = onValue(playModeRef, (snapshot) => {
      const mode = snapshot.val();
      if (mode) {
        setPlayMode(mode);
        console.log('🎮 Mode de jeu TV:', mode);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // 🎯 Écouter la question Quiz actuelle
  useEffect(() => {
    if (!sessionValid || !sessionId || playMode !== 'quiz') return;
    const quizRef = ref(database, `sessions/${sessionId}/quiz`);
    const unsubscribe = onValue(quizRef, (snapshot) => {
      const quizData = snapshot.val();
      setQuizQuestion(quizData);
      if (quizData) {
        setQuizRevealed(quizData.revealed || false);
        setCurrentQuestionNumber((quizData.trackNumber || 0) + 1);
        console.log('🎯 Question Quiz TV:', quizData);
      } else {
        setQuizRevealed(false);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId, playMode]);

  // 🎯 Écouter les réponses des joueurs pour la chanson actuelle
  useEffect(() => {
    if (!sessionValid || !sessionId || playMode !== 'quiz' || playingTrackNumber === null) return;

    // Réinitialiser le compteur de réponses quand on change de chanson
    previousAnswersCountRef.current = 0;

    const answersRef = ref(database, `sessions/${sessionId}/quiz_answers/${playingTrackNumber}`);
    const unsubscribe = onValue(answersRef, (snapshot) => {
      const answersData = snapshot.val();
      if (answersData) {
        const answersList = Object.entries(answersData).map(([playerId, answer]) => ({
          playerId,
          playerName: answer.playerName,
          playerPhoto: answer.playerPhoto,
          answer: answer.answer,
          time: answer.time,
          timestamp: answer.timestamp,
          isCorrect: answer.isCorrect
        }));
        // Trier par temps de réponse
        answersList.sort((a, b) => a.time - b.time);

        // 🔊 Jouer le son de buzzer si une nouvelle réponse est arrivée
        const newAnswersCount = answersList.length;
        if (newAnswersCount > previousAnswersCountRef.current && previousAnswersCountRef.current > 0) {
          if (buzzerSoundRef.current) {
            buzzerSoundRef.current.play();
            console.log('🔊 [QUIZ] Buzzer joué pour nouvelle réponse');
          }
        }
        previousAnswersCountRef.current = newAnswersCount;

        setQuizAnswers(answersList);
        setPlayerAnswers(answersList);
        setBuzzOrder(answersList);
      } else {
        setQuizAnswers([]);
        setPlayerAnswers([]);
        setBuzzOrder([]);
        previousAnswersCountRef.current = 0;
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId, playMode, playingTrackNumber]);

  // 🎯 Écouter le leaderboard général du quiz
  useEffect(() => {
    if (!sessionValid || !sessionId || playMode !== 'quiz') return;
    const leaderboardRef = ref(database, `sessions/${sessionId}/quiz_leaderboard`);
    const unsubscribe = onValue(leaderboardRef, (snapshot) => {
      const leaderboardData = snapshot.val();
      if (leaderboardData) {
        const leaderboardArray = Object.values(leaderboardData)
          .sort((a, b) => b.totalPoints - a.totalPoints);
        setQuizLeaderboard(leaderboardArray);
      } else {
        setQuizLeaderboard([]);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId, playMode]);

  // Écouter le nombre total de questions (taille playlist)
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const playlistRef = ref(database, `sessions/${sessionId}/playlist`);
    const unsubscribe = onValue(playlistRef, (snapshot) => {
      const playlistData = snapshot.val();
      if (playlistData && Array.isArray(playlistData)) {
        setTotalQuestions(playlistData.length);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Compter le nombre total de joueurs
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    let total = 0;

    const team1Ref = ref(database, `sessions/${sessionId}/players_session/team1`);
    const team2Ref = ref(database, `sessions/${sessionId}/players_session/team2`);

    onValue(team1Ref, (snapshot) => {
      const players = snapshot.val();
      const count1 = players ? Object.keys(players).length : 0;
      onValue(team2Ref, (snapshot2) => {
        const players2 = snapshot2.val();
        const count2 = players2 ? Object.keys(players2).length : 0;
        setTotalPlayers(count1 + count2);
      }, { onlyOnce: true });
    }, { onlyOnce: true });
  }, [sessionValid, sessionId, playersTeam1, playersTeam2]);

  // 🎯 Écouter tous les joueurs connectés (pour mode Quiz)
  useEffect(() => {
    if (!sessionValid || !sessionId || playMode !== 'quiz') return;
    const playersRef = ref(database, `sessions/${sessionId}/players_session/team1`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const playersData = snapshot.val();
      if (playersData) {
        const playersList = Object.entries(playersData).map(([key, player]) => ({
          id: player.id || key,
          name: player.name,
          photo: player.photo,
          firebaseKey: key
        }));
        setAllPlayers(playersList);
      } else {
        setAllPlayers([]);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId, playMode]);

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

  // Calculer les statistiques pour l'affichage
  const correctAnswers = playerAnswers.filter(p => p.isCorrect).length;
  const wrongAnswers = playerAnswers.filter(p => p.isCorrect === false).length;

  // Formater le temps restant en MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timeRemaining = Math.max(0, songDuration - chrono);

  // MAIN GAME SCREEN - Nouveau design unifié pour tous les modes
  return (
  <div style={{
    background: `linear-gradient(135deg, ${COLORS.gradientStart} 0%, ${COLORS.gradientEnd} 50%, ${COLORS.gradientEnd} 100%)`,
    minHeight: '100vh',
    color: 'white',
    padding: '1.5rem 2rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'flex',
    flexDirection: 'column'
  }}>

    {/* ===== HEADER ===== */}
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      {/* Badge Question */}
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '0.5rem 1rem',
        borderRadius: '2rem',
        fontSize: '0.9rem',
        fontWeight: '500',
        whiteSpace: 'nowrap'
      }}>
        Question {currentQuestionNumber} / {totalQuestions} · Mode Blind Test
      </div>

      {/* Titre et sous-titre */}
      <div style={{ flex: 1 }}>
        <h1 style={{
          fontSize: '1.8rem',
          fontWeight: 'bold',
          margin: 0,
          marginBottom: '0.25rem'
        }}>
          {currentSong?.revealed
            ? `Bonne reponse : ${currentSong.artist} - ${currentSong.title}`
            : isPlaying ? 'Ecoutez et buzzez !' : 'Preparez-vous...'
          }
        </h1>
        <p style={{
          fontSize: '0.95rem',
          opacity: 0.7,
          margin: 0
        }}>
          {currentSong?.revealed
            ? 'La chanson est terminee · Tous les joueurs ont buzze'
            : isPlaying
              ? 'La chanson est en cours...'
              : 'En attente du lancement'
          }
        </p>
      </div>
    </div>

    {/* ===== CHRONO & POINTS SECTION ===== */}
    <div style={{
      textAlign: 'center',
      marginBottom: '1.5rem'
    }}>
      <h2 style={{
        fontSize: '1rem',
        fontWeight: '600',
        marginBottom: '0.5rem',
        opacity: 0.9
      }}>
        Chrono & points
      </h2>
      <p style={{
        fontSize: '0.85rem',
        opacity: 0.6,
        marginBottom: '1rem'
      }}>
        Plus tu attends, moins tu gagnes
      </p>

      {/* Pills Temps et Points */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div style={{
          backgroundColor: COLORS.accent,
          padding: '0.5rem 1.5rem',
          borderRadius: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Temps restant</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatTime(timeRemaining)}</span>
        </div>
        <div style={{
          backgroundColor: COLORS.warning,
          padding: '0.5rem 1.5rem',
          borderRadius: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Points restants</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{availablePoints} pts</span>
        </div>
      </div>

      {/* Barre de progression gradient */}
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          opacity: 0.6,
          marginBottom: '0.25rem'
        }}>
          <span>Temps</span>
          <span>Points</span>
        </div>
        <div style={{
          height: '8px',
          borderRadius: '4px',
          background: 'linear-gradient(90deg, #22c55e 0%, #84cc16 25%, #eab308 50%, #f97316 75%, #ef4444 100%)',
          position: 'relative'
        }}>
          {/* Indicateur de position */}
          <div style={{
            position: 'absolute',
            left: `${progressPercent}%`,
            top: '-4px',
            width: '16px',
            height: '16px',
            backgroundColor: 'white',
            borderRadius: '50%',
            border: '3px solid #22c55e',
            transform: 'translateX(-50%)',
            transition: 'left 0.1s linear'
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          marginTop: '0.25rem'
        }}>
          <span style={{ color: '#22c55e' }}>Beaucoup de points</span>
          <span style={{ opacity: 0.5 }}>0 point</span>
        </div>
      </div>
    </div>

    {/* ===== MAIN CONTENT AREA ===== */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 380px',
      gap: '1.5rem',
      flex: 1
    }}>
      {/* ===== LEFT COLUMN: Instructions + Answer Cards ===== */}
      <div>
        {/* Instructions */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{
            fontSize: '1.8rem',
            fontWeight: 'bold',
            lineHeight: 1.3,
            marginBottom: '0.5rem'
          }}>
            Choisis une réponse.
          </h2>
        </div>

        {/* Answer Cards Grid - Affiche les 4 options de réponse */}
        {quizQuestion?.answers?.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            {quizQuestion.answers.map((answer, index) => {
              const isCorrect = answer.label === quizQuestion.correctAnswer && quizRevealed;
              const isWrong = answer.label !== quizQuestion.correctAnswer && quizRevealed;

              // Trouver les joueurs qui ont choisi cette réponse
              const playersWhoAnswered = playerAnswers.filter(p => p.answer === answer.label);

              // Récupérer les photos depuis allPlayers (comme dans QuizDisplay)
              const playersWithThisAnswer = playersWhoAnswered.map(playerAnswer => {
                const player = allPlayers.find(p => p.name === playerAnswer.playerName);
                return {
                  ...playerAnswer,
                  photo: player?.photo || playerAnswer.playerPhoto
                };
              });

              return (
                <div
                  key={index}
                  style={{
                    backgroundColor: isCorrect
                      ? 'rgba(34, 197, 94, 0.3)'
                      : COLORS.cardBg,
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    border: isCorrect
                      ? '2px solid #22c55e'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    minHeight: '140px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Letter Badge */}
                  <div style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    backgroundColor: isCorrect ? '#22c55e' : 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    marginBottom: '0.75rem'
                  }}>
                    {answer.label}
                  </div>

                  {/* Status Badge */}
                  {quizRevealed && (
                    <div style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: isCorrect ? '#22c55e' : '#ef4444',
                      color: 'white'
                    }}>
                      {isCorrect ? 'Bonne reponse' : 'Mauvaise'}
                    </div>
                  )}

                  {/* Artist & Title */}
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    marginBottom: '0.25rem'
                  }}>
                    {answer.text?.split(' - ')[0] || 'Artiste'}
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    opacity: 0.7,
                    flex: 1
                  }}>
                    {answer.text?.split(' - ')[1] || 'Titre'}
                  </div>

                  {/* Player Avatars who chose this answer */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                    minHeight: '28px'
                  }}>
                      {playersWithThisAnswer.map((player, pIndex) => (
                        <div
                          key={player.playerId || pIndex}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '1rem',
                            fontSize: '0.75rem'
                          }}
                        >
                          <img
                            src={player.photo || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Ccircle cx='10' cy='10' r='10' fill='%23666'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='10'%3E${player.playerName?.[0] || '?'}%3C/text%3E%3C/svg%3E`}
                            alt={player.playerName}
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: quizRevealed
                                ? (isCorrect ? '2px solid #22c55e' : '2px solid #ef4444')
                                : '2px solid transparent'
                            }}
                          />
                          <span style={{
                            maxWidth: '60px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {player.playerName}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Fallback for team mode - show current song info when no quiz question */}
        {!quizQuestion?.answers?.length && currentSong && (
          <div style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: '1.5rem',
            padding: '2rem',
            textAlign: 'center'
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
                Mystere...
              </div>
            )}
          </div>
        )}

        {/* Stats line */}
        <div style={{
          fontSize: '0.9rem',
          opacity: 0.7,
          marginTop: '0.5rem'
        }}>
          {totalPlayers > 0 && (
            <>
              {playerAnswers.length} joueur{playerAnswers.length !== 1 ? 's' : ''} ·
              {correctAnswers} bonne{correctAnswers !== 1 ? 's' : ''} reponse{correctAnswers !== 1 ? 's' : ''} ·
              {wrongAnswers} mauvaise{wrongAnswers !== 1 ? 's' : ''} reponse{wrongAnswers !== 1 ? 's' : ''}
            </>
          )}
        </div>
      </div>

      {/* ===== RIGHT COLUMN: Buzzer Order + Leaderboard ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Buzzer Order Panel */}
        <div style={{
          backgroundColor: COLORS.cardBg,
          borderRadius: '1rem',
          padding: '1.25rem',
          flex: 1
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '600',
              margin: 0
            }}>
              Ordre des buzzers
            </h3>
            <div style={{
              backgroundColor: COLORS.accent,
              padding: '0.25rem 0.75rem',
              borderRadius: '1rem',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}>
              En direct sur cette chanson
            </div>
          </div>

          <p style={{
            fontSize: '0.8rem',
            opacity: 0.6,
            marginBottom: '0.75rem'
          }}>
            Les joueurs apparaitront ici au fur et a mesure qu'ils buzzent.
          </p>

          {/* Progress indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: buzzOrder.length > 0 ? '#22c55e' : '#6b7280'
            }} />
            <span style={{ fontSize: '0.85rem' }}>
              {buzzOrder.length} / {totalPlayers || '?'} joueurs ont buzze
            </span>
            <div style={{
              flex: 1,
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: totalPlayers > 0 ? `${(buzzOrder.length / totalPlayers) * 100}%` : '0%',
                height: '100%',
                backgroundColor: '#22c55e',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Buzzer list */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {buzzOrder.map((player, index) => {
              // Récupérer la photo depuis allPlayers
              const playerInfo = allPlayers.find(p => p.name === player.playerName);
              const playerPhoto = playerInfo?.photo || player.playerPhoto;

              // Calculer le dégradé selon si le joueur a la bonne réponse
              const getBackgroundStyle = () => {
                if (player.isCorrect) {
                  // Dégradé du noir vers le vert pour les bonnes réponses
                  return {
                    background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.4) 0%, rgba(34, 197, 94, 0.4) 100%)'
                  };
                } else if (player.isCorrect === false) {
                  // Dégradé du noir vers le rouge pour les mauvaises réponses
                  return {
                    background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.4) 0%, rgba(239, 68, 68, 0.3) 100%)'
                  };
                }
                // En attente - fond neutre
                return {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                };
              };

              return (
                <div
                  key={player.playerId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem',
                    ...getBackgroundStyle(),
                    borderRadius: '0.5rem'
                  }}
                >
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    minWidth: '1.5rem'
                  }}>
                    {index + 1}
                  </span>
                  <img
                    src={playerPhoto || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23666'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='14'%3E${player.playerName?.[0] || '?'}%3C/text%3E%3C/svg%3E`}
                    alt={player.playerName}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: player.isCorrect
                        ? '2px solid #22c55e'
                        : player.isCorrect === false
                          ? '2px solid #ef4444'
                          : '2px solid transparent'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      color: player.isCorrect ? '#22c55e' : 'white'
                    }}>
                      {player.playerName}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                      Reponse {player.answer} · {player.isCorrect ? 'Bonne reponse' : player.isCorrect === false ? 'Mauvaise reponse' : 'En attente'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                      {player.time?.toFixed(1)}s
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: player.isCorrect ? '#22c55e' : '#6b7280'
                    }}>
                      {player.isCorrect ? '+120 pts' : '0 pt'}
                    </div>
                  </div>
                </div>
              );
            })}

            {buzzOrder.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                opacity: 0.5,
                fontSize: '0.9rem'
              }}>
                En attente des buzzers...
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard Panel */}
        <div style={{
          backgroundColor: COLORS.cardBg,
          borderRadius: '1rem',
          padding: '1.25rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '600',
              margin: 0
            }}>
              Classement des joueurs
            </h3>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '0.25rem 0.75rem',
              borderRadius: '1rem',
              fontSize: '0.75rem'
            }}>
              Classement permanent
            </div>
          </div>

          <p style={{
            fontSize: '0.75rem',
            opacity: 0.5,
            marginBottom: '0.75rem'
          }}>
            Score total general · Mis a jour a la fin de chaque chanson
          </p>

          {/* Leaderboard header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: '1rem',
            fontSize: '0.75rem',
            opacity: 0.5,
            marginBottom: '0.5rem',
            padding: '0 0.5rem'
          }}>
            <span>Joueur</span>
            <span>Total</span>
            <span>Cette chanson</span>
          </div>

          {/* Leaderboard entries */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxHeight: '180px',
            overflowY: 'auto'
          }}>
            {quizLeaderboard.slice(0, 5).map((player, index) => {
              const currentSongPoints = playerAnswers.find(p => p.playerId === player.playerId)?.isCorrect ? '+90 pts' : '+0 pt';

              // Récupérer la photo depuis allPlayers
              const playerInfo = allPlayers.find(p => p.name === player.playerName);
              const playerPhoto = playerInfo?.photo || player.playerPhoto;

              return (
                <div
                  key={player.playerId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: '1rem',
                    alignItems: 'center',
                    padding: '0.5rem',
                    backgroundColor: index < 3 ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                    borderRadius: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontWeight: '500',
                      minWidth: '1.5rem',
                      color: index === 0 ? '#fbbf24' : 'white'
                    }}>
                      {index + 1}
                    </span>
                    <img
                      src={playerPhoto || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='14' cy='14' r='14' fill='%23666'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='12'%3E${player.playerName?.[0] || '?'}%3C/text%3E%3C/svg%3E`}
                      alt={player.playerName}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                    <span style={{ fontSize: '0.9rem' }}>{player.playerName}</span>
                  </div>
                  <span style={{ fontWeight: '600' }}>{player.totalPoints} pts</span>
                  <span style={{
                    fontSize: '0.85rem',
                    color: currentSongPoints.includes('+0') ? '#6b7280' : '#22c55e'
                  }}>
                    {currentSongPoints}
                  </span>
                </div>
              );
            })}

            {quizLeaderboard.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                opacity: 0.5,
                fontSize: '0.85rem'
              }}>
                Aucun score pour le moment
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ===== FOOTER ===== */}
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '1.5rem',
      paddingTop: '1rem'
    }}>
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '0.75rem 1.5rem',
        borderRadius: '2rem',
        fontSize: '0.9rem'
      }}>
        {currentSong?.revealed
          ? 'Manche terminee · Appuyez pour passer a la question suivante'
          : isPlaying
            ? 'Manche en cours · Buzzez pour repondre'
            : 'En attente du lancement de la manche'
        }
      </div>
      <div style={{
        fontSize: '0.85rem',
        opacity: 0.5
      }}>
        Tous les joueurs voient cet ecran sur la TV partagee.
      </div>
    </div>


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