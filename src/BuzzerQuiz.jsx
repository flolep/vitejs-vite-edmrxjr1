import React, { useState, useEffect, useRef } from 'react';
import { database } from './firebase';
import { ref, set, onValue, remove, get } from 'firebase/database';
import { airtableService } from './airtableService';
import { n8nService } from './n8nService';
import { QuizInterface } from './components/buzzer/QuizInterface';

export default function BuzzerQuiz() {
  // États de session
  const [sessionId, setSessionId] = useState('');
  const [sessionValid, setSessionValid] = useState(false);

  // États existants
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [isPlaying, setIsPlaying] = useState(false);

  // États pour identification
  const [step, setStep] = useState('session'); // 'session' | 'name' | 'select' | 'photo' | 'preferences' | 'quiz'
  const [playerName, setPlayerName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [error, setError] = useState('');

  // États pour préférences joueur
  const [playerAge, setPlayerAge] = useState('');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [specialPhrase, setSpecialPhrase] = useState('');

  // États spécifiques au mode Quiz
  const [quizQuestion, setQuizQuestion] = useState(null); // { trackNumber, answers: [...], correctAnswer, revealed, nextSongTriggerPlayerId }
  const [selectedAnswer, setSelectedAnswer] = useState(null); // Réponse sélectionnée
  const [hasAnswered, setHasAnswered] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(0);

  // États pour statistiques personnelles
  const [showStats, setShowStats] = useState(false);
  const [personalStats, setPersonalStats] = useState({
    totalBuzzes: 0,
    winningBuzzes: 0,
    totalPoints: 0,
    recognizedSongs: []
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // ========== FONCTIONS LOCALSTORAGE ==========

  const STORAGE_KEY = 'buzzer_quiz_session_data';

  const saveToLocalStorage = (data) => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const existingData = existing ? JSON.parse(existing) : {};

      const toSave = {
        sessionId: data.sessionId || sessionId,
        playerName: data.playerName || playerName,
        selectedPlayer: data.selectedPlayer || selectedPlayer,
        playerAge: data.playerAge || playerAge,
        selectedGenres: data.selectedGenres || selectedGenres,
        specialPhrase: data.specialPhrase || specialPhrase,
        photoData: data.photoData || photoData,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      console.log('✅ Session Quiz sauvegardée dans localStorage');
    } catch (err) {
      console.error('❌ Erreur sauvegarde localStorage:', err);
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const age = Date.now() - (data.timestamp || 0);
        if (age > 3 * 60 * 60 * 1000) {
          console.log('⚠️ Données localStorage trop anciennes, suppression');
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        console.log('✅ Données trouvées dans localStorage:', data);
        return data;
      }
    } catch (err) {
      console.error('❌ Erreur lecture localStorage:', err);
    }
    return null;
  };

  const clearLocalStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('✅ localStorage nettoyé');
    } catch (err) {
      console.error('❌ Erreur nettoyage localStorage:', err);
    }
  };

  // Vérifier le code de session depuis l'URL
  useEffect(() => {
    const init = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionParam = urlParams.get('session');

      if (sessionParam) {
        let storedData = loadFromLocalStorage();
        if (storedData && storedData.sessionId && storedData.sessionId !== sessionParam) {
          console.log('🔄 Nouvelle session détectée, nettoyage du localStorage');
          clearLocalStorage();
          storedData = null;
        }

        setSessionId(sessionParam);
        await verifySession(sessionParam);
      }
    };

    init();
  }, []);

  const verifySession = async (id) => {
    const sessionRef = ref(database, `sessions/${id}`);
    return new Promise((resolve) => {
      onValue(sessionRef, (snapshot) => {
        if (snapshot.exists() && snapshot.val().active) {
          setSessionValid(true);
          setStep('name');
          resolve(true);
        } else {
          setSessionValid(false);
          setError('Code de session invalide ou expiré');
          resolve(false);
        }
      }, { onlyOnce: true });
    });
  };

  const handleJoinSession = () => {
    if (!sessionId || sessionId.trim().length !== 6) {
      setError('Le code doit contenir 6 caractères');
      return;
    }
    verifySession(sessionId.toUpperCase());
  };

  // Écouter les questions Quiz depuis Firebase
  useEffect(() => {
    if (!sessionValid || !sessionId) return;

    const quizRef = ref(database, `sessions/${sessionId}/quiz`);
    const unsubscribe = onValue(quizRef, (snapshot) => {
      const quizData = snapshot.val();
      if (quizData) {
        setQuizQuestion(quizData);
        setCurrentTrack(quizData.trackNumber || 0);
        console.log('🎯 Question Quiz:', quizData);
      } else {
        setQuizQuestion(null);
      }
    });

    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter le classement
  useEffect(() => {
    if (!sessionValid || !sessionId) return;

    const leaderboardRef = ref(database, `sessions/${sessionId}/quiz_leaderboard`);
    const unsubscribe = onValue(leaderboardRef, (snapshot) => {
      const leaderboardData = snapshot.val();
      if (leaderboardData) {
        const leaderboardArray = Object.values(leaderboardData)
          .sort((a, b) => b.totalPoints - a.totalPoints);
        setLeaderboard(leaderboardArray);
      }
    });

    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter si une chanson est en cours de lecture
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
    const unsubscribe = onValue(playingRef, (snapshot) => {
      const playingData = snapshot.val();
      setIsPlaying(playingData === true);
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // NOUVEAU : Rechercher le joueur
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
        setStep('photo');
      }
    } catch (err) {
      console.error('Erreur recherche:', err);
      setError('Erreur lors de la recherche. Continuons sans photo.');
      goToNextStep();
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlayer = (player) => {
    setSelectedPlayer(player);
    goToNextStep();
    saveToLocalStorage({ selectedPlayer: player, playerName: player.name });
  };

  const handleCreateNewPlayer = () => {
    setSearchResults([]);
    setStep('photo');
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Erreur caméra:', err);
      setError('Impossible d\'accéder à la caméra. Continuons sans photo.');
      setTimeout(() => goToNextStep(), 2000);
    }
  };

  const takeSelfie = () => {
    if (canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setPhotoData(imageData);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const confirmSelfie = async () => {
    setIsSearching(true);

    try {
      const playerData = {
        name: playerName,
        photo: photoData,
        firstSeen: new Date().toISOString()
      };

      const result = await airtableService.createPlayer(playerData);

      const newPlayer = {
        id: result.id,
        name: playerName,
        photo: photoData
      };

      setSelectedPlayer(newPlayer);
      goToNextStep();
      saveToLocalStorage({ selectedPlayer: newPlayer, playerName, photoData });
    } catch (err) {
      console.error('Erreur création joueur:', err);
      setError('Erreur lors de la sauvegarde. Continuons quand même !');
      setTimeout(() => {
        const fallbackPlayer = { name: playerName };
        setSelectedPlayer(fallbackPlayer);
        goToNextStep();
        saveToLocalStorage({ selectedPlayer: fallbackPlayer, playerName, photoData });
      }, 2000);
    } finally {
      setIsSearching(false);
    }
  };

  const retakeSelfie = () => {
    setPhotoData(null);
    startCamera();
  };

  const goToNextStep = () => {
    const storedData = loadFromLocalStorage();
    const gameAlreadyStarted = storedData?.gameAlreadyStarted === true;

    if (gameAlreadyStarted) {
      console.log('⚡ Partie démarrée → skip préférences');
      setStep('quiz');
    } else {
      console.log('⏸️ Partie non démarrée → demande des préférences');
      setStep('preferences');
    }
  };

  const savePreferencesToFirebase = async () => {
    try {
      console.log('💾 Sauvegarde des préférences via Netlify...');

      const playerId = selectedPlayer?.id || `temp_${playerName}`;

      const preferencesData = {
        name: selectedPlayer?.name || playerName,
        photo: selectedPlayer?.photo || photoData || null,
        age: parseInt(playerAge),
        genres: selectedGenres,
        specialPhrase: specialPhrase || ''
      };

      const response = await fetch('/.netlify/functions/save-player-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

      const result = await response.json();
      console.log('✅ Préférences sauvegardées:', result);

      return true;

    } catch (err) {
      console.error('❌ Erreur sauvegarde préférences:', err);
      throw err;
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
      await savePreferencesToFirebase();

      saveToLocalStorage({
        playerAge,
        selectedGenres,
        specialPhrase
      });

      console.log('✅ Préférences enregistrées. Passage au mode Quiz.');
      setStep('quiz');

    } catch (err) {
      console.error('❌ Erreur lors de la soumission des préférences:', err);
      setError(`❌ Erreur: ${err.message || 'Impossible de sauvegarder'}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Gérer la caméra pour le selfie
  useEffect(() => {
    if (step === 'photo' && !photoData) {
      startCamera();
    }

    return () => {
      if (streamRef.current && step !== 'photo') {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [step, photoData]);

  // Envoyer la réponse du joueur (avec lecture du chrono)
  const handleQuizAnswer = async (answer) => {
    console.log('🎯 handleQuizAnswer appelé avec:', { answer, sessionId, quizQuestion, hasAnswered, selectedPlayer, playerName });

    if (!sessionId || !quizQuestion || hasAnswered) {
      console.log('❌ Impossible de répondre:', { sessionId, quizQuestion, hasAnswered });
      return;
    }

    // Marquer comme répondu localement IMMÉDIATEMENT
    setSelectedAnswer(answer);
    setHasAnswered(true);

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
      timestamp: Date.now(),
      isCorrect: null // Sera calculé après révélation
    };

    console.log('📤 Envoi réponse Quiz à Firebase:', {
      path: answerPath,
      playerId,
      data: answerData
    });

    await set(answerRef, answerData);

    console.log('✅ Réponse Quiz envoyée avec succès:', {
      player: selectedPlayer?.name || playerName,
      answer,
      time: chrono,
      trackNumber: quizQuestion.trackNumber,
      path: answerPath
    });

    // Vibration feedback
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  // Passer à la chanson suivante (joueur le plus rapide uniquement)
  const handleNextSong = () => {
    if (!sessionId) {
      console.error('❌ Pas de sessionId pour passer à la chanson suivante');
      return;
    }

    console.log('➡️ Passage à la chanson suivante demandé par le joueur le plus rapide');

    // Notifier le Master de passer à la chanson suivante
    const nextSongRequestRef = ref(database, `sessions/${sessionId}/quiz_next_song_request`);
    set(nextSongRequestRef, {
      timestamp: Date.now(),
      playerId: selectedPlayer?.id || `temp_${playerName}`,
      playerName: selectedPlayer?.name || playerName
    }).then(() => {
      console.log('✅ Demande de passage à la chanson suivante envoyée');
    }).catch(error => {
      console.error('❌ Erreur lors de l\'envoi de la demande:', error);
    });
  };

  // Charger les statistiques personnelles du joueur
  const loadPersonalStats = () => {
    if (!sessionId || !selectedPlayer) return;

    // Charger le classement général
    const leaderboardRef = ref(database, `sessions/${sessionId}/quiz_leaderboard`);
    onValue(leaderboardRef, (leaderboardSnapshot) => {
      const leaderboardData = leaderboardSnapshot.val();

      if (leaderboardData) {
        // Trouver les stats du joueur actuel (leaderboardData est un objet avec playerId comme clés)
        const playerData = leaderboardData[selectedPlayer?.id || `temp_${playerName}`];

        if (playerData) {
          // Charger les détails des réponses pour avoir les chansons reconnues
          const allAnswersRef = ref(database, `sessions/${sessionId}/quiz_answers`);
          onValue(allAnswersRef, (answersSnapshot) => {
            const allAnswersData = answersSnapshot.val();
            const recognizedSongs = [];

            if (allAnswersData) {
              // Parcourir toutes les chansons
              Object.keys(allAnswersData).forEach(trackNumber => {
                const trackAnswers = allAnswersData[trackNumber];

                // Trouver la réponse du joueur pour cette chanson
                const playerId = selectedPlayer?.id || `temp_${playerName}`;
                const playerAnswer = trackAnswers[playerId];

                // Si le joueur a répondu correctement
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
              totalBuzzes: playerData.totalAnswers || 0,
              winningBuzzes: playerData.correctAnswers || 0,
              totalPoints: playerData.totalPoints || 0,
              recognizedSongs: recognizedSongs,
              percentageContribution: '0' // Pas de concept d'équipe en Quiz
            });

            setShowStats(true);
          }, { onlyOnce: true });
        } else {
          // Joueur pas encore dans le leaderboard
          setPersonalStats({
            totalBuzzes: 0,
            winningBuzzes: 0,
            totalPoints: 0,
            recognizedSongs: [],
            percentageContribution: '0'
          });
          setShowStats(true);
        }
      }
    }, { onlyOnce: true });
  };

  // Réinitialiser quand une nouvelle question arrive
  useEffect(() => {
    if (quizQuestion && !quizQuestion.revealed) {
      setHasAnswered(false);
      setSelectedAnswer(null);
    }
  }, [currentTrack, quizQuestion]);

  // ========== ÉCRANS ==========

  // ÉCRAN 0 : Saisie du code de session
  if (step === 'session') {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 BLIND TEST - QUIZ 🎵</h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
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
              backgroundColor: '#fee2e2',
              padding: '1rem',
              borderRadius: '0.5rem'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleJoinSession}
            disabled={!sessionId || sessionId.length !== 6}
            className="btn btn-green"
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.25rem',
              opacity: (!sessionId || sessionId.length !== 6) ? 0.5 : 1
            }}
          >
            ✅ Rejoindre la partie
          </button>
        </div>
      </div>
    );
  }

  // ÉCRAN 1 : Saisie du prénom
  if (step === 'name') {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 BLIND TEST - QUIZ 🎵</h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
            Quel est votre prénom ?
          </h2>

          <input
            type="text"
            placeholder="Entrez votre prénom"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearchPlayer();
              }
            }}
            autoFocus
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.5rem',
              borderRadius: '0.75rem',
              border: 'none',
              marginBottom: '1rem',
              textAlign: 'center'
            }}
          />

          {error && (
            <div style={{
              color: '#ef4444',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSearchPlayer}
            disabled={isSearching || !playerName.trim()}
            className="btn btn-green"
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.25rem',
              opacity: isSearching ? 0.5 : 1
            }}
          >
            {isSearching ? '🔍 Recherche...' : '✅ Valider'}
          </button>
        </div>
      </div>
    );
  }

  // ÉCRAN 2 : Sélection parmi joueurs existants
  if (step === 'select') {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">👥 Joueur trouvé !</h1>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
            C'est vous ?
          </h2>

          <div className="space-y">
            {searchResults.map((player, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectPlayer(player)}
                className="btn"
                style={{
                  width: '100%',
                  padding: '1.5rem',
                  backgroundColor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                {player.photo && (
                  <img
                    src={player.photo}
                    alt={player.name}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      objectFit: 'cover'
                    }}
                  />
                )}
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {player.name}
                  </div>
                  {player.lastSeen && (
                    <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                      Dernière partie : {new Date(player.lastSeen).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </button>
            ))}

            <button
              onClick={handleCreateNewPlayer}
              className="btn btn-gray"
              style={{ width: '100%', padding: '1rem' }}
            >
              ❌ Non, ce n'est pas moi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ÉCRAN 3 : Prise de selfie
  if (step === 'photo') {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">📸 Prenez un selfie</h1>

          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              color: '#ef4444'
            }}>
              {error}
            </div>
          )}

          {!photoData ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  borderRadius: '1rem',
                  marginBottom: '1rem',
                  transform: 'scaleX(-1)'
                }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <button
                onClick={takeSelfie}
                className="btn btn-green"
                style={{ width: '100%', padding: '1.5rem', fontSize: '1.5rem' }}
              >
                📸 Prendre la photo
              </button>

              <button
                onClick={() => {
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                  }
                  setStep('preferences');
                }}
                className="btn btn-gray"
                style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}
              >
                Passer sans photo
              </button>
            </>
          ) : (
            <>
              <img
                src={photoData}
                alt="Votre selfie"
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  borderRadius: '1rem',
                  marginBottom: '1rem'
                }}
              />

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={retakeSelfie}
                  className="btn btn-yellow"
                  style={{ flex: 1, padding: '1.5rem' }}
                >
                  🔄 Reprendre
                </button>

                <button
                  onClick={confirmSelfie}
                  className="btn btn-green"
                  style={{ flex: 1, padding: '1.5rem' }}
                  disabled={isSearching}
                >
                  {isSearching ? '⏳ Sauvegarde...' : '✅ Confirmer'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ÉCRAN 4 : Préférences du joueur
  if (step === 'preferences') {
    const availableGenres = [
      'Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Électro',
      'Rap français', 'R&B', 'Reggae', 'Métal', 'Indie',
      'Soul', 'Funk', 'Disco', 'Blues', 'Country'
    ];

    const toggleGenre = (genre) => {
      if (selectedGenres.includes(genre)) {
        setSelectedGenres(selectedGenres.filter(g => g !== genre));
      } else if (selectedGenres.length < 3) {
        setSelectedGenres([...selectedGenres, genre]);
      }
    };

    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '600px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 Vos Préférences</h1>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
            Parlez-nous de vous !
          </h2>

          {/* Âge */}
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '1.1rem',
              marginBottom: '0.5rem',
              fontWeight: 'bold'
            }}>
              🎂 Votre âge
            </label>
            <input
              type="number"
              placeholder="Ex: 25"
              value={playerAge}
              onChange={(e) => setPlayerAge(e.target.value)}
              min="1"
              max="120"
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.2rem',
                borderRadius: '0.75rem',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                textAlign: 'center'
              }}
            />
          </div>

          {/* Genres */}
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '1.1rem',
              marginBottom: '0.5rem',
              fontWeight: 'bold'
            }}>
              🎸 Vos 3 genres préférés ({selectedGenres.length}/3)
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '0.75rem'
            }}>
              {availableGenres.map(genre => {
                const isSelected = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    style={{
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      borderRadius: '0.5rem',
                      border: '2px solid',
                      borderColor: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.3)',
                      backgroundColor: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      transition: 'all 0.2s',
                      opacity: !isSelected && selectedGenres.length >= 3 ? 0.4 : 1
                    }}
                    disabled={!isSelected && selectedGenres.length >= 3}
                  >
                    {isSelected ? '✓ ' : ''}{genre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phrase spéciale */}
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '1.1rem',
              marginBottom: '0.5rem',
              fontWeight: 'bold'
            }}>
              💬 Votre phrase spéciale (optionnelle)
            </label>
            <textarea
              placeholder="Ex: J'adore chanter sous la douche !"
              value={specialPhrase}
              onChange={(e) => setSpecialPhrase(e.target.value)}
              maxLength={200}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                borderRadius: '0.75rem',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                minHeight: '80px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}>
              {specialPhrase.length}/200 caractères
            </div>
          </div>

          {error && (
            <div style={{
              color: '#ef4444',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              backgroundColor: '#fee2e2',
              padding: '1rem',
              borderRadius: '0.5rem'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmitPreferences}
            disabled={isSearching || !playerAge || selectedGenres.length === 0}
            className="btn btn-green"
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.25rem',
              opacity: (isSearching || !playerAge || selectedGenres.length === 0) ? 0.5 : 1
            }}
          >
            {isSearching ? '⏳ Envoi en cours...' : '✅ Valider et continuer'}
          </button>
        </div>
      </div>
    );
  }

  // ÉCRAN 5 : Mode Quiz - Utilise QuizInterface
  if (step === 'quiz') {
    return (
      <QuizInterface
        selectedPlayer={selectedPlayer}
        playerName={playerName}
        quizQuestion={quizQuestion}
        selectedAnswer={selectedAnswer}
        hasAnswered={hasAnswered}
        isPlaying={isPlaying}
        onAnswerSelect={handleQuizAnswer}
        loadPersonalStats={loadPersonalStats}
        showStats={showStats}
        setShowStats={setShowStats}
        personalStats={personalStats}
        onNextSong={handleNextSong}
      />
    );
  }

  return null;
}
