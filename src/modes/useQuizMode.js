import { useState, useEffect } from 'react';
import { ref, set, get, update, onValue, remove } from 'firebase/database';
import { database } from '../firebase';
import { calculatePoints } from '../hooks/useScoring';

/**
 * Hook pour gérer le mode Quiz
 * Logique spécifique au jeu en mode QCM avec classement individuel
 */
export function useQuizMode(sessionId, currentTrack, playlist) {
  const [quizAnswers, setQuizAnswers] = useState([]); // Les 4 réponses [A, B, C, D]
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(null); // Index de la bonne réponse (0-3)
  const [playerAnswers, setPlayerAnswers] = useState([]); // Liste des réponses des joueurs
  const [leaderboard, setLeaderboard] = useState([]); // Classement temps réel

  /**
   * Stocke les données quiz (wrongAnswers) pour toutes les chansons
   * Utilise un index 0-based : track 0 = première chanson
   * Écrit aussi totalTracks pour la progression côté joueurs
   *
   * @param {Array} songsData - [{ uri, title, artist, wrongAnswers: ["Artist - Title", ...] }]
   */
  const storeQuizData = async (songsData) => {
    if (!sessionId || !songsData || songsData.length === 0) return;

    console.log('[Quiz] Stockage quiz_data pour', songsData.length, 'chansons (index 0-based)');

    for (let i = 0; i < songsData.length; i++) {
      const song = songsData[i];

      if (!song.wrongAnswers || song.wrongAnswers.length < 3) {
        console.warn(`[Quiz] Chanson ${i} n'a pas 3 mauvaises réponses, skip`);
        continue;
      }

      const quizDataRef = ref(database, `sessions/${sessionId}/quiz_data/${i}`);
      await set(quizDataRef, {
        correctAnswer: {
          title: song.title,
          artist: song.artist,
          uri: song.uri
        },
        wrongAnswers: song.wrongAnswers.slice(0, 3)
      });
    }

    // Écrire totalTracks pour la progression côté joueur
    const totalTracksRef = ref(database, `sessions/${sessionId}/totalTracks`);
    await set(totalTracksRef, songsData.length);

    console.log('[Quiz] quiz_data stocké + totalTracks =', songsData.length);
  };

  /**
   * Génère 4 réponses mélangées pour le track actuel
   * Lit depuis quiz_data/{index} où index = trackNumber - 1 (0-based)
   * Persiste correctAnswerIndex dans Firebase pour survie au reload
   */
  const generateQuizAnswers = async (trackNumber) => {
    if (!sessionId || trackNumber === undefined) return;

    // trackNumber est 1-based dans l'app, quiz_data est 0-based
    const quizDataIndex = trackNumber - 1;
    console.log('[Quiz] Génération réponses pour track', trackNumber, '(index', quizDataIndex, ')');

    const quizDataRef = ref(database, `sessions/${sessionId}/quiz_data/${quizDataIndex}`);
    const snapshot = await get(quizDataRef);
    const quizData = snapshot.val();

    if (!quizData) {
      console.error('[Quiz] Aucune donnée quiz pour index', quizDataIndex);
      return;
    }

    const { correctAnswer, wrongAnswers } = quizData;

    // Formater les réponses avec un champ .text unifié
    const correctAnswerFormatted = {
      text: `${correctAnswer.artist} - ${correctAnswer.title}`,
      isCorrect: true
    };

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

    // Persister dans Firebase pour synchro joueurs + survie au reload
    const quizRef = ref(database, `sessions/${sessionId}/quiz`);
    await set(quizRef, {
      trackNumber,
      totalTracks: playlist?.length || 0,
      answers: allAnswers.map((a, idx) => ({
        label: String.fromCharCode(65 + idx), // A, B, C, D
        text: a.text,
        isCorrect: a.isCorrect
      })),
      correctAnswer: String.fromCharCode(65 + correctIndex),
      correctAnswerIndex: correctIndex,
      revealed: false
    });

    console.log('[Quiz] Quiz généré:', {
      trackNumber,
      correctAnswer: String.fromCharCode(65 + correctIndex),
      correctIndex
    });
  };

  /**
   * Restaure correctAnswerIndex depuis Firebase (survie au reload)
   */
  useEffect(() => {
    if (!sessionId) return;

    const quizRef = ref(database, `sessions/${sessionId}/quiz`);
    const unsubscribe = onValue(quizRef, (snapshot) => {
      const quizData = snapshot.val();
      if (quizData && quizData.correctAnswerIndex != null) {
        setCorrectAnswerIndex(quizData.correctAnswerIndex);
      }
      if (quizData && quizData.answers) {
        setQuizAnswers(quizData.answers.map(a => ({
          text: a.text,
          isCorrect: a.isCorrect
        })));
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  /**
   * Écoute les réponses des joueurs en mode Quiz
   */
  useEffect(() => {
    if (!sessionId) return;

    const answersPath = `sessions/${sessionId}/quiz_answers/${currentTrack}`;
    const answersRef = ref(database, answersPath);

    const unsubscribe = onValue(answersRef, (snapshot) => {
      const answersData = snapshot.val();

      if (answersData) {
        const answersList = Object.entries(answersData).map(([playerId, answer]) => ({
          playerId,
          playerName: answer.playerName,
          answer: answer.answer,
          time: answer.time,
          timestamp: answer.timestamp,
          isCorrect: answer.isCorrect
        }));

        answersList.sort((a, b) => a.time - b.time);
        setPlayerAnswers(answersList);
      } else {
        setPlayerAnswers([]);
      }
    });

    return () => unsubscribe();
  }, [sessionId, currentTrack]);

  /**
   * Met à jour le classement général du quiz
   * Utilise get() (lecture unique) au lieu de onValue pour éviter les appels multiples
   */
  const updateLeaderboard = async (answers) => {
    const playerUpdates = {};

    answers.forEach((answer) => {
      if (!playerUpdates[answer.playerId]) {
        playerUpdates[answer.playerId] = {
          playerId: answer.playerId,
          playerName: answer.playerName,
          totalPoints: 0,
          correctAnswers: 0,
          totalAnswers: 0
        };
      }

      playerUpdates[answer.playerId].totalAnswers += 1;

      if (answer.isCorrect) {
        const songDuration = playlist[currentTrack - 1]?.duration || 30;
        const points = calculatePoints(answer.time, songDuration);
        playerUpdates[answer.playerId].totalPoints += points;
        playerUpdates[answer.playerId].correctAnswers += 1;
      }
    });

    // Lecture unique du leaderboard existant (pas de listener temps réel)
    const leaderboardRef = ref(database, `sessions/${sessionId}/quiz_leaderboard`);
    const snapshot = await get(leaderboardRef);
    const existingLeaderboard = snapshot.val() || {};

    // Fusionner avec les nouveaux scores
    Object.entries(playerUpdates).forEach(([playerId, data]) => {
      if (!existingLeaderboard[playerId]) {
        existingLeaderboard[playerId] = data;
      } else {
        existingLeaderboard[playerId].totalPoints += data.totalPoints;
        existingLeaderboard[playerId].correctAnswers += data.correctAnswers;
        existingLeaderboard[playerId].totalAnswers += data.totalAnswers;
      }
    });

    // Convertir en array, trier, et sauvegarder
    const leaderboardArray = Object.values(existingLeaderboard)
      .sort((a, b) => b.totalPoints - a.totalPoints);

    setLeaderboard(leaderboardArray);
    await set(leaderboardRef, existingLeaderboard);
  };

  /**
   * Révèle la bonne réponse et valide les réponses des joueurs
   * Appelle updateLeaderboard une seule fois à la fin
   */
  const revealQuizAnswer = async () => {
    if (!sessionId || currentTrack === null) return;

    const currentSong = playlist[currentTrack - 1];
    const songTitle = currentSong?.title || 'Inconnu';
    const songArtist = currentSong?.artist || 'Inconnu';
    const songDuration = currentSong?.duration || 30;

    // Lire le quiz actuel (lecture unique)
    const quizRef = ref(database, `sessions/${sessionId}/quiz`);
    const quizSnapshot = await get(quizRef);
    const quizData = quizSnapshot.val();

    // Lire les réponses des joueurs (lecture unique)
    const answersRef = ref(database, `sessions/${sessionId}/quiz_answers/${currentTrack}`);
    const answersSnapshot = await get(answersRef);
    const answersData = answersSnapshot.val();

    const answersArray = answersData
      ? Object.entries(answersData).map(([playerId, answer]) => ({
          playerId,
          ...answer
        })).sort((a, b) => a.time - b.time)
      : [];

    // Déterminer qui déclenche la chanson suivante
    const correctAnswer = String.fromCharCode(65 + correctAnswerIndex);
    const winnersOnly = answersArray.filter(answer => answer.answer === correctAnswer);

    let nextSongTriggerId;
    if (winnersOnly.length > 0) {
      nextSongTriggerId = winnersOnly[0].playerId;
    } else if (answersArray.length > 0) {
      nextSongTriggerId = answersArray[answersArray.length - 1].playerId;
    } else {
      nextSongTriggerId = null;
    }

    // Marquer comme révélé
    if (quizData) {
      await set(quizRef, {
        ...quizData,
        revealed: true,
        nextSongTriggerPlayerId: nextSongTriggerId
      });
    }

    // Si pas de réponses, on s'arrête là
    if (!answersData || answersArray.length === 0) return;

    // Corriger chaque réponse avec les points calculés
    const correctedAnswers = answersArray.map((answer) => {
      const isCorrect = answer.answer === correctAnswer;
      const points = isCorrect ? calculatePoints(answer.time, songDuration) : 0;

      return {
        ...answer,
        isCorrect,
        points,
        songTitle,
        songArtist
      };
    });

    // Écrire toutes les corrections d'un coup (batch)
    const updates = {};
    correctedAnswers.forEach((answer) => {
      updates[`sessions/${sessionId}/quiz_answers/${currentTrack}/${answer.playerId}`] = answer;
    });

    await update(ref(database), updates);

    // Appeler updateLeaderboard UNE SEULE FOIS avec les réponses corrigées
    await updateLeaderboard(correctedAnswers);
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
   * Réinitialise le classement pour une nouvelle partie
   */
  const resetLeaderboard = async () => {
    console.log('[Quiz] Réinitialisation classement...');
    setLeaderboard([]);

    if (sessionId) {
      try {
        await remove(ref(database, `sessions/${sessionId}/quiz_leaderboard`));
        await remove(ref(database, `sessions/${sessionId}/quiz_answers`));
        await remove(ref(database, `sessions/${sessionId}/quiz_data`));
        console.log('[Quiz] Classement et données réinitialisés');
      } catch (error) {
        console.error('[Quiz] Erreur réinitialisation:', error);
      }
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
    resetQuiz,
    resetLeaderboard
  };
}
