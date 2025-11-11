import { useState, useEffect } from 'react';
import { ref, set, onValue, remove } from 'firebase/database';
import { database } from '../firebase';

/**
 * Hook pour gérer le mode Quiz
 * Logique spécifique au jeu en mode QCM avec classement individuel
 */
export function useQuizMode(sessionId, currentTrack, playlist, currentChronoRef) {
  const [quizAnswers, setQuizAnswers] = useState([]); // Les 4 réponses [A, B, C, D]
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(null); // Index de la bonne réponse (0-3)
  const [playerAnswers, setPlayerAnswers] = useState([]); // Liste des réponses des joueurs
  const [leaderboard, setLeaderboard] = useState([]); // Classement temps réel

  /**
   * Stocke les données quiz (wrongAnswers) pour toutes les chansons
   * À appeler lors du chargement initial de la playlist générée par l'IA
   * @param {Array} songsData - Tableau de chansons avec format:
   *   [{ uri, title, artist, wrongAnswers: ["Artist - Title", ...] }]
   */
  const storeQuizData = async (songsData) => {
    if (!sessionId || !songsData || songsData.length === 0) return;

    console.log('📦 Stockage des données quiz pour', songsData.length, 'chansons');

    // Stocker chaque chanson avec ses mauvaises réponses
    for (let trackNumber = 0; trackNumber < songsData.length; trackNumber++) {
      const song = songsData[trackNumber];

      if (!song.wrongAnswers || song.wrongAnswers.length < 3) {
        console.warn(`⚠️ Chanson ${trackNumber} n'a pas 3 mauvaises réponses, génération par défaut`);
        continue;
      }

      const quizDataRef = ref(database, `sessions/${sessionId}/quiz_data/${trackNumber}`);
      await set(quizDataRef, {
        correctAnswer: {
          title: song.title,
          artist: song.artist,
          uri: song.uri
        },
        wrongAnswers: song.wrongAnswers.slice(0, 3) // S'assurer qu'on a exactement 3
      });
    }

    console.log('✅ Données quiz stockées dans Firebase');
  };

  /**
   * Génère 4 réponses mélangées pour le track actuel
   * Lit les données depuis quiz_data/{trackNumber} stockées précédemment
   */
  const generateQuizAnswers = async (trackNumber) => {
    if (!sessionId || trackNumber === undefined) return;

    console.log('🎯 Génération des réponses pour la chanson', trackNumber);

    // Lire les données depuis Firebase
    const quizDataRef = ref(database, `sessions/${sessionId}/quiz_data/${trackNumber}`);

    onValue(quizDataRef, (snapshot) => {
      const quizData = snapshot.val();

      if (!quizData) {
        console.error('❌ Aucune donnée quiz trouvée pour le track', trackNumber);
        return;
      }

      const { correctAnswer, wrongAnswers } = quizData;

      // Formater la bonne réponse
      const correctAnswerFormatted = {
        text: `${correctAnswer.artist} - ${correctAnswer.title}`,
        isCorrect: true
      };

      // Formater les mauvaises réponses
      const wrongAnswersFormatted = wrongAnswers.map(wa => ({
        text: wa,
        isCorrect: false
      }));

      // Mélanger toutes les réponses
      const allAnswers = [correctAnswerFormatted, ...wrongAnswersFormatted]
        .sort(() => Math.random() - 0.5);

      // Trouver l'index de la bonne réponse après mélange
      const correctIndex = allAnswers.findIndex(a => a.isCorrect);

      setQuizAnswers(allAnswers);
      setCorrectAnswerIndex(correctIndex);

      // Stocker dans Firebase pour synchroniser avec les joueurs
      const quizRef = ref(database, `sessions/${sessionId}/quiz`);
      set(quizRef, {
        trackNumber: trackNumber,
        answers: allAnswers.map((a, idx) => ({
          label: String.fromCharCode(65 + idx), // A, B, C, D
          text: a.text,
          isCorrect: a.isCorrect
        })),
        correctAnswer: String.fromCharCode(65 + correctIndex), // A, B, C ou D
        revealed: false
      });

      console.log('✅ Quiz généré:', {
        trackNumber,
        correctAnswer: String.fromCharCode(65 + correctIndex),
        answers: allAnswers.map(a => a.text)
      });
    }, { onlyOnce: true });
  };

  /**
   * Écoute les réponses des joueurs en mode Quiz
   */
  useEffect(() => {
    if (!sessionId) return;

    const answersRef = ref(database, `sessions/${sessionId}/quiz_answers/${currentTrack}`);
    const unsubscribe = onValue(answersRef, (snapshot) => {
      const answersData = snapshot.val();
      if (answersData) {
        const answersList = Object.entries(answersData).map(([playerId, answer]) => ({
          playerId,
          playerName: answer.playerName,
          answer: answer.answer, // A, B, C ou D
          time: answer.time,
          timestamp: answer.timestamp,
          isCorrect: answer.isCorrect
        }));

        // Trier par temps de réponse
        answersList.sort((a, b) => a.time - b.time);
        setPlayerAnswers(answersList);

        // Calculer le classement
        updateLeaderboard(answersList);
      }
    });

    return () => unsubscribe();
  }, [sessionId, currentTrack]);

  /**
   * Met à jour le classement général du quiz
   */
  const updateLeaderboard = (answers) => {
    // Calculer les points pour chaque joueur
    const playerScores = {};

    answers.forEach((answer, index) => {
      if (answer.isCorrect) {
        // Points basés sur la rapidité (1er = plus de points)
        const basePoints = 1000;
        const timeBonus = Math.max(0, 500 - (answer.time * 10)); // Décroit avec le temps
        const rankBonus = Math.max(0, 500 - (index * 100)); // Décroit selon le rang
        const points = Math.round(basePoints + timeBonus + rankBonus);

        if (!playerScores[answer.playerId]) {
          playerScores[answer.playerId] = {
            playerId: answer.playerId,
            playerName: answer.playerName,
            totalPoints: 0,
            correctAnswers: 0
          };
        }

        playerScores[answer.playerId].totalPoints += points;
        playerScores[answer.playerId].correctAnswers += 1;
      }
    });

    // Récupérer le classement existant de Firebase
    const leaderboardRef = ref(database, `sessions/${sessionId}/quiz_leaderboard`);
    onValue(leaderboardRef, (snapshot) => {
      const existingLeaderboard = snapshot.val() || {};

      // Fusionner avec les nouveaux scores
      Object.entries(playerScores).forEach(([playerId, data]) => {
        if (!existingLeaderboard[playerId]) {
          existingLeaderboard[playerId] = data;
        } else {
          existingLeaderboard[playerId].totalPoints += data.totalPoints;
          existingLeaderboard[playerId].correctAnswers += data.correctAnswers;
        }
      });

      // Convertir en array et trier
      const leaderboardArray = Object.values(existingLeaderboard)
        .sort((a, b) => b.totalPoints - a.totalPoints);

      setLeaderboard(leaderboardArray);

      // Mettre à jour Firebase
      set(leaderboardRef, existingLeaderboard);
    }, { onlyOnce: true });
  };

  /**
   * Révèle la bonne réponse et valide les réponses des joueurs
   */
  const revealQuizAnswer = async () => {
    if (!sessionId) return;

    const quizRef = ref(database, `sessions/${sessionId}/quiz`);

    // Marquer comme révélé
    onValue(quizRef, (snapshot) => {
      const quizData = snapshot.val();
      if (quizData) {
        set(quizRef, {
          ...quizData,
          revealed: true
        });
      }
    }, { onlyOnce: true });

    // Valider les réponses des joueurs
    const answersRef = ref(database, `sessions/${sessionId}/quiz_answers/${currentTrack}`);
    onValue(answersRef, (snapshot) => {
      const answersData = snapshot.val();
      if (answersData) {
        Object.entries(answersData).forEach(([playerId, answer]) => {
          const isCorrect = answer.answer === String.fromCharCode(65 + correctAnswerIndex);

          // Mettre à jour avec la correction
          const playerAnswerRef = ref(database, `sessions/${sessionId}/quiz_answers/${currentTrack}/${playerId}`);
          set(playerAnswerRef, {
            ...answer,
            isCorrect
          });
        });
      }
    }, { onlyOnce: true });
  };

  /**
   * Réinitialise le quiz pour une nouvelle chanson
   */
  const resetQuiz = () => {
    setQuizAnswers([]);
    setCorrectAnswerIndex(null);
    setPlayerAnswers([]);

    if (sessionId) {
      const quizRef = ref(database, `sessions/${sessionId}/quiz`);
      remove(quizRef);
    }
  };

  /**
   * Écoute le classement en temps réel depuis Firebase
   */
  useEffect(() => {
    if (!sessionId) return;

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
  }, [sessionId]);

  return {
    quizAnswers,
    correctAnswerIndex,
    playerAnswers,
    leaderboard,
    storeQuizData,
    generateQuizAnswers,
    revealQuizAnswer,
    resetQuiz
  };
}
