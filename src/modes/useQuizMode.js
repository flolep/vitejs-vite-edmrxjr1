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
    // ✅ Commence à 1 pour que le premier track soit numéro 1 (pas 0)
    for (let trackNumber = 1; trackNumber <= songsData.length; trackNumber++) {
      const song = songsData[trackNumber - 1]; // Accès au tableau avec index - 1

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

    const answersPath = `sessions/${sessionId}/quiz_answers/${currentTrack}`;
    const answersRef = ref(database, answersPath);

    console.log('👂 Écoute des réponses Quiz sur:', answersPath);

    const unsubscribe = onValue(answersRef, (snapshot) => {
      const answersData = snapshot.val();

      console.log('📥 Réponses reçues de Firebase:', { currentTrack, answersData });

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

        console.log('✅ Réponses traitées:', answersList);

        setPlayerAnswers(answersList);

        // Calculer le classement
        updateLeaderboard(answersList);
      } else {
        console.log('ℹ️ Aucune réponse pour currentTrack:', currentTrack);
        setPlayerAnswers([]);
      }
    });

    return () => unsubscribe();
  }, [sessionId, currentTrack]);

  /**
   * Met à jour le classement général du quiz
   */
  const updateLeaderboard = (answers) => {
    // Calculer les points pour chaque joueur (bonnes et mauvaises réponses)
    const playerUpdates = {};

    answers.forEach((answer, index) => {
      // Initialiser l'entrée du joueur si nécessaire
      if (!playerUpdates[answer.playerId]) {
        playerUpdates[answer.playerId] = {
          playerId: answer.playerId,
          playerName: answer.playerName,
          totalPoints: 0,
          correctAnswers: 0,
          totalAnswers: 0
        };
      }

      // Compter toutes les réponses
      playerUpdates[answer.playerId].totalAnswers += 1;

      // Calculer les points uniquement pour les bonnes réponses (aligné sur l'affichage TV)
      if (answer.isCorrect) {
        const responseTime = answer.time;
        let points = 0;
        if (responseTime <= 5) {
          points = 2500;
        } else if (responseTime < 15) {
          const timeInPhase = responseTime - 5;
          const phaseDuration = 10;
          points = Math.round(2000 - (timeInPhase / phaseDuration) * 1000);
        } else {
          const timeAfter15 = responseTime - 15;
          points = Math.max(0, Math.round(500 - (timeAfter15 * 20)));
        }

        playerUpdates[answer.playerId].totalPoints += points;
        playerUpdates[answer.playerId].correctAnswers += 1;
      }
    });

    // Récupérer le classement existant de Firebase
    const leaderboardRef = ref(database, `sessions/${sessionId}/quiz_leaderboard`);
    onValue(leaderboardRef, (snapshot) => {
      const existingLeaderboard = snapshot.val() || {};

      // Fusionner avec les nouveaux scores
      Object.entries(playerUpdates).forEach(([playerId, data]) => {
        if (!existingLeaderboard[playerId]) {
          // Nouveau joueur
          existingLeaderboard[playerId] = data;
        } else {
          // Joueur existant - incrémenter les valeurs
          existingLeaderboard[playerId].totalPoints += data.totalPoints;
          existingLeaderboard[playerId].correctAnswers += data.correctAnswers;
          existingLeaderboard[playerId].totalAnswers += data.totalAnswers;
        }
      });

      // Convertir en array et trier pour l'affichage
      const leaderboardArray = Object.values(existingLeaderboard)
        .sort((a, b) => b.totalPoints - a.totalPoints);

      setLeaderboard(leaderboardArray);

      // Sauvegarder dans Firebase (toujours comme objet pour cohérence)
      set(leaderboardRef, existingLeaderboard);
    }, { onlyOnce: true });
  };

  /**
   * Révèle la bonne réponse et valide les réponses des joueurs
   */
  const revealQuizAnswer = async () => {
    if (!sessionId || currentTrack === null) return;

    const quizRef = ref(database, `sessions/${sessionId}/quiz`);

    // Récupérer les infos de la chanson actuelle
    // ✅ currentTrack commence à 1, donc on accède à playlist[currentTrack - 1]
    const currentSong = playlist[currentTrack - 1];
    const songTitle = currentSong?.title || 'Inconnu';
    const songArtist = currentSong?.artist || 'Inconnu';

    // Valider les réponses des joueurs
    const answersRef = ref(database, `sessions/${sessionId}/quiz_answers/${currentTrack}`);
    onValue(answersRef, (snapshot) => {
      const answersData = snapshot.val();
      if (answersData) {
        // Convertir en array et trier par temps de réponse pour calculer le rang
        const answersArray = Object.entries(answersData).map(([playerId, answer]) => ({
          playerId,
          ...answer
        }));
        answersArray.sort((a, b) => a.time - b.time);

        // Déterminer qui peut passer à la chanson suivante :
        // 1. Si bonne réponse : le gagnant le plus rapide
        // 2. Si aucune bonne réponse : le dernier à avoir répondu (pour ne pas bloquer le jeu)
        const correctAnswer = String.fromCharCode(65 + correctAnswerIndex);
        const winnersOnly = answersArray.filter(answer => answer.answer === correctAnswer);

        let nextSongTriggerId;
        if (winnersOnly.length > 0) {
          // Cas 1 : Au moins une bonne réponse → le plus rapide des gagnants
          nextSongTriggerId = winnersOnly[0].playerId;
        } else if (answersArray.length > 0) {
          // Cas 2 : Aucune bonne réponse → le dernier à avoir répondu
          nextSongTriggerId = answersArray[answersArray.length - 1].playerId;
        } else {
          // Cas 3 : Personne n'a répondu → null (animateur doit intervenir)
          nextSongTriggerId = null;
        }

        // Marquer comme révélé et désigner qui peut passer à la chanson suivante
        onValue(quizRef, (quizSnapshot) => {
          const quizData = quizSnapshot.val();
          if (quizData) {
            set(quizRef, {
              ...quizData,
              revealed: true,
              nextSongTriggerPlayerId: nextSongTriggerId
            });
          }
        }, { onlyOnce: true });

        // Mettre à jour chaque réponse avec correction, points, et infos chanson
        answersArray.forEach((answer, rank) => {
          const isCorrect = answer.answer === correctAnswer;

          // Calculer les points selon le temps de réponse (aligné sur l'affichage TV)
          let points = 0;
          if (isCorrect) {
            const responseTime = answer.time;
            if (responseTime <= 5) {
              points = 2500;
            } else if (responseTime < 15) {
              const timeInPhase = responseTime - 5;
              const phaseDuration = 10;
              points = Math.round(2000 - (timeInPhase / phaseDuration) * 1000);
            } else {
              // Après 15s, points résiduels
              const timeAfter15 = responseTime - 15;
              points = Math.max(0, Math.round(500 - (timeAfter15 * 20)));
            }
          }

          // Mettre à jour avec la correction, points, et infos chanson
          const playerAnswerRef = ref(database, `sessions/${sessionId}/quiz_answers/${currentTrack}/${answer.playerId}`);
          set(playerAnswerRef, {
            ...answer,
            isCorrect,
            points,
            songTitle,
            songArtist
          });
        });

        // Note: Le classement sera automatiquement mis à jour par updateLeaderboard()
        // qui est appelé par le useEffect écoutant quiz_answers quand isCorrect est ajouté
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
