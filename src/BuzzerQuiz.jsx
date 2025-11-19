import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, set, onValue, get } from 'firebase/database';
import { airtableService } from './airtableService';
import { useBuzzerLocalStorage } from './hooks/buzzer/useBuzzerLocalStorage';
import { useBuzzerCamera } from './hooks/buzzer/useBuzzerCamera';
import { useBuzzerSession } from './hooks/buzzer/useBuzzerSession';
import { NameScreen } from './components/buzzer/screens/NameScreen';
import { SelectScreen } from './components/buzzer/screens/SelectScreen';
import { PhotoScreen } from './components/buzzer/screens/PhotoScreen';
import { PreferencesScreen } from './components/buzzer/screens/PreferencesScreen';
import { QuizInterface } from './components/buzzer/QuizInterface';

/**
 * Mode Quiz avec QCM
 * Flux : session → name → select → photo → preferences → quiz
 */
export default function BuzzerQuiz() {
  // Hooks personnalisés
  const { sessionId, sessionValid, isLoading, isPlaying } = useBuzzerSession();
  const localStorage = useBuzzerLocalStorage();
  const camera = useBuzzerCamera();

  // États du flux
  const [step, setStep] = useState('name'); // 'name' | 'select' | 'photo' | 'preferences' | 'quiz'
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // États joueur
  const [playerName, setPlayerName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // États préférences
  const [playerAge, setPlayerAge] = useState('');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [specialPhrase, setSpecialPhrase] = useState('');

  // États Quiz
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [personalStats, setPersonalStats] = useState({
    totalBuzzes: 0,
    winningBuzzes: 0,
    totalPoints: 0,
    recognizedSongs: []
  });

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
    }
  }, [quizQuestion?.trackNumber, quizQuestion?.revealed]);

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

  const handleSelectPlayer = (player) => {
    setSelectedPlayer(player);
    localStorage.save({ selectedPlayer: player, playerName: player.name });

    // Mode Quiz : aller directement aux préférences ou au quiz
    const gameStarted = localStorage.load()?.gameAlreadyStarted === true;
    if (gameStarted) {
      setStep('quiz'); // Skip préférences si partie démarrée
    } else {
      setStep('preferences'); // Mode Quiz : preferences PUIS quiz
    }
  };

  const handleCreateNewPlayer = () => {
    setSearchResults([]);
    setStep('photo');
    camera.startCamera();
  };

  // ========== HANDLERS - PHOTO SCREEN ==========

  const handleSkipPhoto = () => {
    camera.stopCamera();

    const gameStarted = localStorage.load()?.gameAlreadyStarted === true;
    if (gameStarted) {
      setStep('quiz');
    } else {
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

      setStep('preferences');
    } catch (err) {
      console.error('Erreur création joueur:', err);
      setError('Erreur lors de la sauvegarde. Continuons quand même !');

      // Fallback
      setTimeout(() => {
        const fallbackPlayer = { name: playerName };
        setSelectedPlayer(fallbackPlayer);
        localStorage.save({ selectedPlayer: fallbackPlayer, playerName, photoData: camera.photoData });
        setStep('preferences');
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
    console.log('🎯 handleQuizAnswer appelé avec:', { answer, sessionId, quizQuestion, hasAnswered });

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

    console.log('✅ Réponse Quiz envoyée avec succès');

    // Vibration feedback
    if (navigator.vibrate) {
      navigator.vibrate(100);
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
      timestamp: Date.now(),
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
              totalBuzzes: playerData.totalAnswers || 0,
              winningBuzzes: playerData.correctAnswers || 0,
              totalPoints: playerData.totalPoints || 0,
              recognizedSongs: recognizedSongs,
              percentageContribution: '0'
            });

            setShowStats(true);
          }, { onlyOnce: true });
        } else {
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

  // ========== RENDU DES ÉCRANS ==========

  // Écran de chargement pendant la vérification de la session
  if (isLoading) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center">
          <h2 className="title">Chargement...</h2>
          <div style={{ fontSize: '3rem', marginTop: '1rem' }}>⏳</div>
        </div>
      </div>
    );
  }

  // Session invalide après vérification
  if (!sessionValid) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center">
          <h2 className="title">⚠️ Session invalide</h2>
          <p>Scannez le QR Code pour rejoindre la partie.</p>
        </div>
      </div>
    );
  }

  if (step === 'name') {
    return (
      <NameScreen
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        onSubmit={handleSearchPlayer}
        isSearching={isSearching}
        error={error}
      />
    );
  }

  if (step === 'select') {
    return (
      <SelectScreen
        searchResults={searchResults}
        onSelectPlayer={handleSelectPlayer}
        onCreateNew={handleCreateNewPlayer}
      />
    );
  }

  if (step === 'photo') {
    return (
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
    );
  }

  if (step === 'preferences') {
    return (
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
    );
  }

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
