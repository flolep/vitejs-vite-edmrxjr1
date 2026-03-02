import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, set, onValue, get, serverTimestamp } from 'firebase/database';
import { airtableService } from './airtableService';
import { useBuzzerLocalStorage } from './hooks/buzzer/useBuzzerLocalStorage';
import { useBuzzerCamera } from './hooks/buzzer/useBuzzerCamera';
import { useBuzzerSession } from './hooks/buzzer/useBuzzerSession';
import { calculatePoints } from './hooks/useScoring';
import { NameScreen } from './components/buzzer/screens/NameScreen';
import { SelectScreen } from './components/buzzer/screens/SelectScreen';
import { PhotoScreen } from './components/buzzer/screens/PhotoScreen';
import { PreferencesScreen } from './components/buzzer/screens/PreferencesScreen';
import { QuizInterface } from './components/buzzer/QuizInterface';

// 🔍 Logs de diagnostic de l'environnement
console.log('🔍 [BuzzerQuiz] Diagnostic environnement:', {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
  isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent),
  isPrivateMode: 'storage' in navigator && navigator.storage ? 'normal' : 'peut-être privé',
  databaseURL: database.app.options.databaseURL,
  hasIndexedDB: 'indexedDB' in window,
  hasLocalStorage: 'localStorage' in window
});

/**
 * Enregistre le joueur dans Firebase players_session/team1
 * (Mode Quiz : tous les joueurs sont dans team1)
 */
async function registerPlayerInFirebase(sessionId, player, photoData = null) {
  if (!sessionId || !player) {
    console.error('❌ Impossible d\'enregistrer le joueur : session ou player manquant');
    return null;
  }

  const teamKey = 'team1'; // Mode Quiz : tous les joueurs dans team1
  const playersRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}`);

  try {
    // Vérifier si un joueur avec le même nom existe déjà
    const snapshot = await new Promise((resolve) => {
      onValue(playersRef, resolve, { onlyOnce: true });
    });

    const existingPlayers = snapshot.val() || {};
    let existingPlayerKey = null;

    // Chercher si ce joueur existe déjà (même nom)
    for (const [key, existingPlayer] of Object.entries(existingPlayers)) {
      if (existingPlayer.name === player.name) {
        existingPlayerKey = key;
        console.log(`🔍 Joueur "${player.name}" déjà présent avec la clé:`, key);
        break;
      }
    }

    // Utiliser la clé existante ou créer une nouvelle
    const playerKey = existingPlayerKey || `player_${Date.now()}`;
    const playerRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}/${playerKey}`);

    const playerData = {
      id: player.id || `temp_${player.name}`,
      name: player.name,
      photo: player.photo || photoData || null,
      connected: true, // ✅ IMPORTANT : permet au Master de voir ce joueur dans allQuizPlayers
      points: 0,
      buzzes: 0,
      consecutiveCorrect: 0,
      joinedAt: existingPlayerKey ? existingPlayers[existingPlayerKey].joinedAt : Date.now()
    };

    await set(playerRef, playerData);
    console.log('✅ Joueur enregistré dans players_session/team1, clé:', playerKey);

    return playerKey;
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement du joueur:', error);
    return null;
  }
}

/**
 * Mode Quiz avec QCM
 * Flux : session → name → select → photo → preferences → quiz
 */
export default function BuzzerQuiz({ sessionIdFromRouter = null }) {
  // Hooks personnalisés
  const { sessionId, sessionValid, isLoading, isPlaying, gameStarted } = useBuzzerSession(sessionIdFromRouter);
  const localStorage = useBuzzerLocalStorage();
  const camera = useBuzzerCamera();

  // États du flux
  const [step, setStep] = useState('loading_auto_join'); // Nouveau state initial pour attendre la vérification
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // États joueur
  const [playerName, setPlayerName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerFirebaseKey, setPlayerFirebaseKey] = useState(null);

  // États préférences
  const [playerAge, setPlayerAge] = useState('');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [specialPhrase, setSpecialPhrase] = useState('');

  // États Quiz
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [playerAnswerData, setPlayerAnswerData] = useState(null); // Données de réponse du joueur (incluant points)
  const [showStats, setShowStats] = useState(false);
  const [personalStats, setPersonalStats] = useState({
    totalAnswers: 0,
    correctAnswers: 0,
    totalPoints: 0,
    recognizedSongs: []
  });

  // Mini-classement temps réel (toujours visible)
  const [liveRank, setLiveRank] = useState(null); // { rank, totalPlayers, totalPoints, correctAnswers }

  // État Debug Panel (uniquement visible en mode Test)
  const [showDebug, setShowDebug] = useState(false);
  const isTestMode = window.localStorage.getItem('quizTestMode') === 'true';

  // ========== AUTO-REJOIN LOGIC ==========

  useEffect(() => {
    // Ne rien faire tant que la session n'est pas validée ou si on a déjà passé l'étape de chargement
    if (!sessionValid || !sessionId) {
      if (sessionValid === false && !isLoading) {
        // Session invalide confirmée
        setStep('name');
      }
      return;
    }

    // Si on est déjà dans une étape autre que le chargement initial, ne rien faire
    if (step !== 'loading_auto_join' && step !== 'name') return;

    const checkAutoRejoin = async () => {
      console.log('🔄 [Auto-Rejoin] Vérification du LocalStorage...');
      const savedData = localStorage.load();

      if (savedData && savedData.playerFirebaseKey) {
        console.log('🔍 [Auto-Rejoin] Données trouvées, vérification Firebase...', savedData);

        try {
          // Vérifier que le joueur existe toujours dans la session actuelle
          // En mode Quiz, tous les joueurs sont dans 'team1'
          const playerPath = `sessions/${sessionId}/players_session/team1/${savedData.playerFirebaseKey}`;
          const playerRef = ref(database, playerPath);
          const snapshot = await get(playerRef);

          if (snapshot.exists()) {
            console.log('✅ [Auto-Rejoin] Joueur confirmé dans Firebase ! Restauration...');

            // Restaurer les états
            setPlayerName(savedData.playerName || '');
            if (savedData.selectedPlayer) setSelectedPlayer(savedData.selectedPlayer);
            setPlayerFirebaseKey(savedData.playerFirebaseKey);

            // Restaurer préférences si dispos
            if (savedData.playerAge) setPlayerAge(savedData.playerAge);
            if (savedData.selectedGenres) setSelectedGenres(savedData.selectedGenres);
            if (savedData.specialPhrase) setSpecialPhrase(savedData.specialPhrase);

            // Aller directement au jeu
            setStep('quiz');
          } else {
            console.warn('⚠️ [Auto-Rejoin] Joueur non trouvé dans Firebase (supprimé ?). Nettoyage LocalStorage.');
            localStorage.clear();
            setStep('name');
          }
        } catch (err) {
          console.error('❌ [Auto-Rejoin] Erreur vérification Firebase:', err);
          // En cas d'erreur, par sécurité on demande de se reconnecter
          setStep('name');
        }
      } else {
        console.log('ℹ️ [Auto-Rejoin] Aucune donnée valide trouvée.');
        setStep('name');
      }
    };

    checkAutoRejoin();
  }, [sessionId, sessionValid]); // Exécuter quand la session devient valide

  const handleQuitGame = () => {
    if (confirm('Voulez-vous vraiment quitter la partie et changer de joueur ?')) {
      localStorage.clear();
      setPlayerName('');
      setSelectedPlayer(null);
      setPlayerFirebaseKey(null);
      setStep('name');
    }
  };

  // Écouter la question Quiz depuis Firebase
  useEffect(() => {
    if (!sessionValid || !sessionId || step !== 'quiz') return;

    const quizRef = ref(database, `sessions/${sessionId}/quiz`);
    const unsubscribe = onValue(quizRef, (snapshot) => {
      const quizData = snapshot.val();
      if (quizData) {
        setQuizQuestion(quizData);
        console.log('🎯 Question Quiz:', quizData);
      } else {
        setQuizQuestion(null);
      }
    });

    return () => unsubscribe();
  }, [sessionValid, sessionId, step]);

  // Réinitialiser quand nouvelle question
  useEffect(() => {
    if (quizQuestion && !quizQuestion.revealed) {
      setHasAnswered(false);
      setSelectedAnswer(null);
      setPlayerAnswerData(null);
    }
  }, [quizQuestion?.trackNumber, quizQuestion?.revealed]);

  // Écouter les données de réponse du joueur (incluant points calculés)
  useEffect(() => {
    if (!sessionValid || !sessionId || !quizQuestion || !selectedPlayer) return;

    const playerId = selectedPlayer?.id || `temp_${playerName}`;
    const answerRef = ref(database, `sessions/${sessionId}/quiz_answers/${quizQuestion.trackNumber}/${playerId}`);

    const unsubscribe = onValue(answerRef, (snapshot) => {
      const answerData = snapshot.val();
      if (answerData) {
        setPlayerAnswerData(answerData);
        console.log('📥 Données réponse du joueur:', answerData);
      }
    });

    return () => unsubscribe();
  }, [sessionValid, sessionId, quizQuestion?.trackNumber, selectedPlayer, playerName]);

  // Écouter le classement en temps réel pour le mini-classement
  useEffect(() => {
    if (!sessionValid || !sessionId || step !== 'quiz' || !selectedPlayer) return;

    const leaderboardRef = ref(database, `sessions/${sessionId}/quiz_leaderboard`);
    const unsubscribe = onValue(leaderboardRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setLiveRank(null);
        return;
      }

      const playerId = selectedPlayer?.id || `temp_${playerName}`;
      const sorted = Object.values(data).sort((a, b) => b.totalPoints - a.totalPoints);
      const myIndex = sorted.findIndex(p => p.playerId === playerId);

      if (myIndex >= 0) {
        setLiveRank({
          rank: myIndex + 1,
          totalPlayers: sorted.length,
          totalPoints: sorted[myIndex].totalPoints || 0,
          correctAnswers: sorted[myIndex].correctAnswers || 0
        });
      } else {
        setLiveRank({ rank: sorted.length + 1, totalPlayers: sorted.length, totalPoints: 0, correctAnswers: 0 });
      }
    });

    return () => unsubscribe();
  }, [sessionValid, sessionId, step, selectedPlayer, playerName]);

  // ========== HANDLERS - NAME SCREEN ==========

  const handleSearchPlayer = async () => {
    if (!playerName.trim()) {
      setError('Veuillez saisir un prénom');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const result = await airtableService.findPlayer(playerName);

      if (result.found && result.count > 0) {
        setSearchResults(result.players);
        setStep('select');
      } else {
        // Pas de joueur trouvé, passer à la photo
        setStep('photo');
        camera.startCamera();
      }
    } catch (err) {
      console.error('Erreur recherche:', err);
      setError('Erreur lors de la recherche. Continuons sans photo.');
      setStep('photo');
      camera.startCamera();
    } finally {
      setIsSearching(false);
    }
  };

  // ========== HANDLERS - SELECT SCREEN ==========

  const handleSelectPlayer = async (player) => {
    setSelectedPlayer(player);
    localStorage.save({ selectedPlayer: player, playerName: player.name });

    // Enregistrer le joueur dans Firebase players_session/team1
    const firebaseKey = await registerPlayerInFirebase(sessionId, player);
    if (firebaseKey) {
      setPlayerFirebaseKey(firebaseKey);
      localStorage.save({ playerFirebaseKey: firebaseKey });
    }

    // Mode Quiz : aller directement aux préférences ou au quiz
    // Si la partie a déjà commencé, skip les préférences
    console.log('🎮 [Quiz] gameStarted:', gameStarted);
    if (gameStarted) {
      console.log('⚡ Partie déjà commencée → skip préférences, aller directement au quiz');
      setStep('quiz');
    } else {
      console.log('🎵 Partie pas encore commencée → demander les préférences');
      setStep('preferences');
    }
  };

  const handleCreateNewPlayer = () => {
    setSearchResults([]);
    setStep('photo');
    camera.startCamera();
  };

  // ========== HANDLERS - PHOTO SCREEN ==========

  const handleSkipPhoto = async () => {
    camera.stopCamera();

    // Créer un joueur sans photo
    const playerWithoutPhoto = {
      name: playerName,
      photo: null
    };

    setSelectedPlayer(playerWithoutPhoto);
    localStorage.save({ selectedPlayer: playerWithoutPhoto, playerName });

    // Enregistrer le joueur dans Firebase players_session/team1
    const firebaseKey = await registerPlayerInFirebase(sessionId, playerWithoutPhoto);
    if (firebaseKey) {
      setPlayerFirebaseKey(firebaseKey);
      localStorage.save({ playerFirebaseKey: firebaseKey });
    }

    // Si la partie a déjà commencé, skip les préférences
    console.log('🎮 [Quiz] gameStarted:', gameStarted);
    if (gameStarted) {
      console.log('⚡ Partie déjà commencée → skip préférences, aller directement au quiz');
      setStep('quiz');
    } else {
      console.log('🎵 Partie pas encore commencée → demander les préférences');
      setStep('preferences');
    }
  };

  const handleConfirmSelfie = async () => {
    setIsSearching(true);

    try {
      const playerData = {
        name: playerName,
        photo: camera.photoData,
        firstSeen: new Date().toISOString()
      };

      const result = await airtableService.createPlayer(playerData);

      const newPlayer = {
        id: result.id,
        name: playerName,
        photo: camera.photoData
      };

      setSelectedPlayer(newPlayer);
      localStorage.save({ selectedPlayer: newPlayer, playerName, photoData: camera.photoData });

      // Enregistrer le joueur dans Firebase players_session/team1
      const firebaseKey = await registerPlayerInFirebase(sessionId, newPlayer, camera.photoData);
      if (firebaseKey) {
        setPlayerFirebaseKey(firebaseKey);
        localStorage.save({ playerFirebaseKey: firebaseKey });
      }

      // Si la partie a déjà commencé, skip les préférences
      if (gameStarted) {
        console.log('⚡ Partie déjà commencée → skip préférences, aller directement au quiz');
        setStep('quiz');
      } else {
        console.log('🎵 Partie pas encore commencée → demander les préférences');
        setStep('preferences');
      }
    } catch (err) {
      console.error('Erreur création joueur:', err);
      setError('Erreur lors de la sauvegarde. Continuons quand même !');

      // Fallback
      setTimeout(async () => {
        const fallbackPlayer = { name: playerName };
        setSelectedPlayer(fallbackPlayer);
        localStorage.save({ selectedPlayer: fallbackPlayer, playerName, photoData: camera.photoData });

        // Enregistrer le joueur fallback dans Firebase
        const firebaseKey = await registerPlayerInFirebase(sessionId, fallbackPlayer, camera.photoData);
        if (firebaseKey) {
          setPlayerFirebaseKey(firebaseKey);
          localStorage.save({ playerFirebaseKey: firebaseKey });
        }

        // Si la partie a déjà commencé, skip les préférences
        if (gameStarted) {
          console.log('⚡ Partie déjà commencée → skip préférences, aller directement au quiz');
          setStep('quiz');
        } else {
          console.log('🎵 Partie pas encore commencée → demander les préférences');
          setStep('preferences');
        }
      }, 2000);
    } finally {
      setIsSearching(false);
    }
  };

  // ========== HANDLERS - PREFERENCES SCREEN ==========

  const handleToggleGenre = (genre) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else if (selectedGenres.length < 3) {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleSubmitPreferences = async () => {
    if (!playerAge || selectedGenres.length === 0) {
      setError('Veuillez remplir au moins l\'âge et choisir des genres');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const playerId = selectedPlayer?.id || `temp_${playerName}`;

      const preferencesData = {
        name: selectedPlayer?.name || playerName,
        photo: selectedPlayer?.photo || camera.photoData || null,
        age: parseInt(playerAge),
        genres: selectedGenres,
        specialPhrase: specialPhrase || ''
      };

      const response = await fetch('/.netlify/functions/save-player-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          playerId,
          preferences: preferencesData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur serveur');
      }

      localStorage.save({ playerAge, selectedGenres, specialPhrase });

      console.log('✅ Préférences enregistrées');
      setStep('quiz');
    } catch (err) {
      console.error('❌ Erreur préférences:', err);
      setError(`❌ Erreur: ${err.message || 'Impossible de sauvegarder'}`);
    } finally {
      setIsSearching(false);
    }
  };

  // ========== HANDLERS - QUIZ SCREEN ==========

  const handleQuizAnswer = async (answer) => {
    console.log('🎯 [handleQuizAnswer] Appelé avec:', {
      answer,
      sessionId,
      hasSessionId: !!sessionId,
      trackNumber: quizQuestion?.trackNumber,
      hasAnswered,
      selectedPlayer,
      playerName,
      playerFirebaseKey
    });

    if (!sessionId) {
      console.error('❌ [handleQuizAnswer] SessionId manquant !');
      alert('Erreur : Pas de session ID. Rechargez la page.');
      return;
    }

    if (!quizQuestion) {
      console.error('❌ [handleQuizAnswer] Pas de question Quiz !');
      return;
    }

    if (hasAnswered) {
      console.warn('⚠️ [handleQuizAnswer] Vous avez déjà répondu');
      return;
    }

    // Marquer comme répondu localement IMMÉDIATEMENT
    setSelectedAnswer(answer);
    setHasAnswered(true);

    try {
      // Lire le temps de réponse depuis le chrono Firebase
      const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
      const chronoSnapshot = await get(chronoRef);
      const chrono = chronoSnapshot.val() || 0;

      // Envoyer la réponse à Firebase
      const playerId = selectedPlayer?.id || `temp_${playerName}`;
      const answerPath = `sessions/${sessionId}/quiz_answers/${quizQuestion.trackNumber}/${playerId}`;
      const answerRef = ref(database, answerPath);

      const answerData = {
        playerName: selectedPlayer?.name || playerName,
        answer: answer, // 'A', 'B', 'C', 'D'
        time: chrono,
        timestamp: serverTimestamp(), // ✅ Timestamp serveur Firebase pour précision absolue
        isCorrect: null // Sera calculé après révélation
      };

      console.log('📤 [handleQuizAnswer] Envoi réponse Quiz à Firebase:', {
        path: answerPath,
        fullPath: `sessions/${sessionId}/quiz_answers/${quizQuestion.trackNumber}/${playerId}`,
        playerId,
        playerName: answerData.playerName,
        trackNumber: quizQuestion.trackNumber,
        answer: answerData.answer,
        time: chrono,
        data: answerData
      });

      await set(answerRef, answerData);

      console.log('✅ [handleQuizAnswer] Réponse Quiz envoyée avec succès à Firebase !');
      console.log('👀 [handleQuizAnswer] La TV devrait maintenant voir cette réponse dans quiz_answers');

      // Vibration feedback
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (error) {
      console.error('❌ [handleQuizAnswer] Erreur lors de l\'envoi:', {
        errorMessage: error.message,
        errorCode: error.code,
        errorStack: error.stack,
        errorName: error.name,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });

      // Message d'erreur plus détaillé
      let userMessage = 'Erreur lors de l\'envoi de la réponse';

      if (error.code === 'PERMISSION_DENIED') {
        userMessage = '🚫 Permission Firebase refusée.\n\n' +
          'Les règles de sécurité doivent être déployées.\n' +
          'Demandez au créateur de déployer les nouvelles règles via Firebase Console.';
        console.error('💡 Solution: Déployer database.rules.json via Firebase Console > Realtime Database > Rules');
      } else if (error.message && error.message.includes('IndexedDB')) {
        userMessage = '⚠️ Safari bloque le stockage local.\n\n' +
          'Désactivez le mode navigation privée et réessayez.';
      } else if (error.message && error.message.includes('network')) {
        userMessage = '📡 Erreur réseau.\n\nVérifiez votre connexion Internet.';
      } else {
        userMessage = `Erreur: ${error.code || error.message}`;
      }

      alert(userMessage);

      // Remettre l'état pour permettre un nouvel essai
      setHasAnswered(false);
      setSelectedAnswer(null);
    }
  };

  const handleNextSong = () => {
    if (!sessionId) {
      console.error('❌ Pas de sessionId pour passer à la chanson suivante');
      return;
    }

    console.log('➡️ Passage à la chanson suivante demandé par le joueur le plus rapide');

    const nextSongRequestRef = ref(database, `sessions/${sessionId}/quiz_next_song_request`);
    set(nextSongRequestRef, {
      timestamp: serverTimestamp(), // ✅ Timestamp serveur Firebase pour précision absolue
      playerId: selectedPlayer?.id || `temp_${playerName}`,
      playerName: selectedPlayer?.name || playerName
    }).then(() => {
      console.log('✅ Demande de passage à la chanson suivante envoyée');
    }).catch(error => {
      console.error('❌ Erreur lors de l\'envoi de la demande:', error);
    });
  };

  const loadPersonalStats = () => {
    if (!sessionId || !selectedPlayer) return;

    const leaderboardRef = ref(database, `sessions/${sessionId}/quiz_leaderboard`);
    onValue(leaderboardRef, (leaderboardSnapshot) => {
      const leaderboardData = leaderboardSnapshot.val();

      if (leaderboardData) {
        const playerId = selectedPlayer?.id || `temp_${playerName}`;
        const playerData = leaderboardData[playerId];

        if (playerData) {
          const allAnswersRef = ref(database, `sessions/${sessionId}/quiz_answers`);
          onValue(allAnswersRef, (answersSnapshot) => {
            const allAnswersData = answersSnapshot.val();
            const recognizedSongs = [];

            if (allAnswersData) {
              Object.keys(allAnswersData).forEach(trackNumber => {
                const trackAnswers = allAnswersData[trackNumber];
                const playerAnswer = trackAnswers[playerId];

                if (playerAnswer && playerAnswer.isCorrect) {
                  recognizedSongs.push({
                    title: playerAnswer.songTitle || 'Inconnu',
                    artist: playerAnswer.songArtist || 'Inconnu',
                    time: playerAnswer.time,
                    points: playerAnswer.points || 0,
                    trackNumber: parseInt(trackNumber) + 1
                  });
                }
              });
            }

            setPersonalStats({
              totalAnswers: playerData.totalAnswers || 0,
              correctAnswers: playerData.correctAnswers || 0,
              totalPoints: playerData.totalPoints || 0,
              recognizedSongs: recognizedSongs
            });

            setShowStats(true);
          }, { onlyOnce: true });
        } else {
          setPersonalStats({
            totalAnswers: 0,
            correctAnswers: 0,
            totalPoints: 0,
            recognizedSongs: []
          });
          setShowStats(true);
        }
      }
    }, { onlyOnce: true });
  };

  // ========== RENDU DES ÉCRANS ==========

  // 🐛 Bouton Debug (visible uniquement en mode Test)
  const debugButton = isTestMode && (
    <button
      onClick={() => setShowDebug(!showDebug)}
      style={{
        position: 'fixed',
        top: '1rem',
        left: '1rem',
        backgroundColor: showDebug ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0, 0, 0, 0.3)',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '50%',
        width: '50px',
        height: '50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '1.5rem',
        zIndex: 10000
      }}
      title="Debug Panel"
    >
      🐛
    </button>
  );

  // 🐛 Panneau de debug (affiché seulement si showDebug est true)
  const debugPanel = showDebug && (
    <div style={{
      position: 'fixed',
      top: '80px',
      left: '1rem',
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      borderRadius: '1rem',
      padding: '1rem',
      maxWidth: '350px',
      maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto',
      zIndex: 9999,
      fontSize: '0.75rem',
      color: '#fff'
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.3)', paddingBottom: '0.5rem' }}>
        🐛 Debug Panel (Quiz Mode)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div>
          <strong>Session:</strong> {sessionId || 'N/A'}
        </div>
        <div>
          <strong>Step:</strong> {step}
        </div>
        <div>
          <strong>Player Name:</strong> {playerName || 'N/A'}
        </div>
        <div>
          <strong>Selected Player ID:</strong> {selectedPlayer?.id || 'N/A'}
        </div>
        <div>
          <strong>Firebase Key:</strong> {playerFirebaseKey || 'N/A'}
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
          <strong>Quiz State:</strong>
        </div>
        <div style={{ paddingLeft: '0.5rem' }}>
          <div>• Track Number: {quizQuestion?.trackNumber || 'N/A'}</div>
          <div>• Revealed: {quizQuestion?.revealed ? '✅' : '❌'}</div>
          <div>• Has Answered: {hasAnswered ? '✅' : '❌'}</div>
          <div>• Selected Answer: {selectedAnswer || 'N/A'}</div>
          <div>• Is Playing: {isPlaying ? '✅' : '❌'}</div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
          <strong>Firebase Paths:</strong>
        </div>
        <div style={{ paddingLeft: '0.5rem', wordBreak: 'break-all', fontSize: '0.7rem' }}>
          <div>• Player: sessions/{sessionId}/players_session/team1/{playerFirebaseKey || '???'}</div>
          <div>• Answer: sessions/{sessionId}/quiz_answers/{quizQuestion?.trackNumber || '???'}/{selectedPlayer?.id || `temp_${playerName}` || '???'}</div>
        </div>
      </div>
    </div>
  );

  // Écran de chargement pendant la vérification de la session
  if (isLoading || step === 'loading_auto_join') {
    return (
      <div className="bg-gradient flex-center">
        {debugButton}
        {debugPanel}
        <div className="text-center">
          <h2 className="title">Chargement...</h2>
          <div style={{ fontSize: '3rem', marginTop: '1rem' }}>⏳</div>
          {step === 'loading_auto_join' && <p style={{marginTop: '1rem', opacity: 0.8}}>Vérification de votre session...</p>}
        </div>
      </div>
    );
  }

  // Session invalide après vérification
  if (!sessionValid) {
    return (
      <div className="bg-gradient flex-center">
        {debugButton}
        {debugPanel}
        <div className="text-center">
          <h2 className="title">⚠️ Session invalide</h2>
          <p>Scannez le QR Code pour rejoindre la partie.</p>
        </div>
      </div>
    );
  }

  if (step === 'name') {
    return (
      <>
        {debugButton}
        {debugPanel}
        <NameScreen
          playerName={playerName}
          onPlayerNameChange={setPlayerName}
          onSubmit={handleSearchPlayer}
          isSearching={isSearching}
          error={error}
        />
      </>
    );
  }

  if (step === 'select') {
    return (
      <>
        {debugButton}
        {debugPanel}
        <SelectScreen
          searchResults={searchResults}
          onSelectPlayer={handleSelectPlayer}
          onCreateNew={handleCreateNewPlayer}
        />
      </>
    );
  }

  if (step === 'photo') {
    return (
      <>
        {debugButton}
        {debugPanel}
        <PhotoScreen
          videoRef={camera.videoRef}
          canvasRef={camera.canvasRef}
          photoData={camera.photoData}
          onTakePhoto={camera.takeSelfie}
          onRetake={camera.retakeSelfie}
          onConfirm={handleConfirmSelfie}
          onSkip={handleSkipPhoto}
          isConfirming={isSearching}
          error={camera.error}
        />
      </>
    );
  }

  if (step === 'preferences') {
    return (
      <>
        {debugButton}
        {debugPanel}
        <PreferencesScreen
          playerAge={playerAge}
          onPlayerAgeChange={setPlayerAge}
          selectedGenres={selectedGenres}
          onToggleGenre={handleToggleGenre}
          specialPhrase={specialPhrase}
          onSpecialPhraseChange={setSpecialPhrase}
          onSubmit={handleSubmitPreferences}
          isSubmitting={isSearching}
          error={error}
        />
      </>
    );
  }

  if (step === 'quiz') {
    return (
      <>
        {debugButton}
        {debugPanel}
        <QuizInterface
          selectedPlayer={selectedPlayer}
          playerName={playerName}
          quizQuestion={quizQuestion}
          selectedAnswer={selectedAnswer}
          hasAnswered={hasAnswered}
          isPlaying={isPlaying}
          playerAnswerData={playerAnswerData}
          onAnswerSelect={handleQuizAnswer}
          loadPersonalStats={loadPersonalStats}
          showStats={showStats}
          setShowStats={setShowStats}
          personalStats={personalStats}
          onNextSong={handleNextSong}
          onQuit={handleQuitGame}
          liveRank={liveRank}
        />
      </>
    );
  }

  return null;
}
