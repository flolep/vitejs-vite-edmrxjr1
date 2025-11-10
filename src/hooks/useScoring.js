import { ref, set, onValue } from 'firebase/database';
import { database } from '../firebase';

/**
 * Calcule les points disponibles selon le système de décroissance
 * Phase 1 (0-5s): 2500 points fixes
 * Phase 2 (5-15s): Décroissance rapide de 2000 à 1000 points (-100 pts/sec)
 * Phase 3 (15s-fin): Décroissance ajustée de 1000 à 0 points (atteint exactement 0 à la fin)
 */
export function calculatePoints(chrono, songDuration) {
  if (chrono <= 5) {
    // Phase 1: Points fixes
    return 2500;
  }

  // Chanson courte (< 15s) : ajuster la décroissance pour arriver à 0 à la fin
  if (songDuration < 15) {
    const timeAfter5 = chrono - 5;
    const remainingDuration = Math.max(1, songDuration - 5);
    const decayRatio = Math.min(1, timeAfter5 / remainingDuration);
    const availablePoints = 2000 * (1 - decayRatio);
    return Math.max(0, Math.round(availablePoints));
  }

  // Chanson normale (>= 15s) : système à 3 phases
  if (chrono < 15) {
    // Phase 2: Décroissance rapide (10 secondes pour perdre 1000 points)
    const timeInPhase = chrono - 5;
    const phaseDuration = 10;
    const availablePoints = 2000 - (timeInPhase / phaseDuration) * 1000;
    return Math.max(0, Math.round(availablePoints));
  } else {
    // Phase 3: Décroissance lente ajustée pour arriver à 0 exactement à la fin
    const timeAfter15 = chrono - 15;
    const remainingDuration = Math.max(1, songDuration - 15);
    const decayRatio = Math.min(1, timeAfter15 / remainingDuration);
    const availablePoints = 1000 * (1 - decayRatio);
    return Math.max(0, Math.round(availablePoints));
  }
}

/**
 * Hook pour gérer le système de scoring
 * Logique commune de calcul et attribution des points
 */
export function useScoring(sessionId, currentTrack, currentChrono, songDuration, cooldownConfig = {}) {

  /**
   * Ajoute des points à une équipe et enregistre le buzz comme correct
   */
  const addPointsToTeam = async (team, scores, playlist, buzzData, bonusInfo = null) => {
    let points = calculatePoints(currentChrono, songDuration);
    let hasPersonalBonus = false;
    let bonusPlayerName = '';

    // Ajouter le bonus personnel si applicable
    if (bonusInfo?.hasBonus) {
      hasPersonalBonus = true;
      bonusPlayerName = bonusInfo.playerName;
      points += 500;
    }

    const newScores = { ...scores, [team]: scores[team] + points };

    // Mettre à jour les scores dans Firebase
    const scoresRef = ref(database, `sessions/${sessionId}/scores`);
    await set(scoresRef, newScores);

    // Marquer le dernier buzz comme correct
    await markBuzzAsCorrect(points, hasPersonalBonus, bonusPlayerName);

    // Mettre à jour les stats du joueur avec la config du cooldown
    if (buzzData?.playerFirebaseKey) {
      await updatePlayerStats(team, buzzData.playerFirebaseKey, true, cooldownConfig);
    }

    return { newScores, points, hasPersonalBonus, bonusPlayerName };
  };

  /**
   * Marque le dernier buzz comme incorrect
   */
  const markBuzzAsWrong = async (buzzData) => {
    const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times/${currentTrack}`);

    return new Promise((resolve) => {
      onValue(buzzTimesRef, (snapshot) => {
        const existingBuzzes = snapshot.val() || [];
        if (existingBuzzes.length > 0) {
          const lastIndex = existingBuzzes.length - 1;
          existingBuzzes[lastIndex].correct = false;
          existingBuzzes[lastIndex].points = 0;
          set(buzzTimesRef, existingBuzzes);
        }
        resolve();
      }, { onlyOnce: true });
    });
  };

  /**
   * Marque le dernier buzz comme correct
   */
  const markBuzzAsCorrect = async (points, hasPersonalBonus, bonusPlayerName) => {
    const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times/${currentTrack}`);

    return new Promise((resolve) => {
      onValue(buzzTimesRef, (snapshot) => {
        const existingBuzzes = snapshot.val() || [];
        if (existingBuzzes.length > 0) {
          const lastIndex = existingBuzzes.length - 1;
          existingBuzzes[lastIndex].correct = true;
          existingBuzzes[lastIndex].points = points;
          existingBuzzes[lastIndex].hasPersonalBonus = hasPersonalBonus;
          if (hasPersonalBonus) {
            existingBuzzes[lastIndex].basePoints = points - 500;
            existingBuzzes[lastIndex].bonusPoints = 500;
          }
          set(buzzTimesRef, existingBuzzes);
        }
        resolve();
      }, { onlyOnce: true });
    });
  };

  /**
   * Met à jour les statistiques du joueur
   */
  const updatePlayerStats = async (team, playerFirebaseKey, isCorrect, cooldownConfig = {}) => {
    const { threshold = 2, duration = 5000 } = cooldownConfig;
    const teamKey = team === 'team1' ? 'team1' : 'team2';
    const playerRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}/${playerFirebaseKey}`);

    return new Promise((resolve) => {
      onValue(playerRef, async (playerSnapshot) => {
        const playerData = playerSnapshot.val();

        if (playerData) {
          if (isCorrect) {
            const consecutiveCorrect = (playerData.consecutiveCorrect || 0) + 1;
            const correctCount = (playerData.correctCount || 0) + 1;

            const updates = {
              consecutiveCorrect: consecutiveCorrect,
              correctCount: correctCount,
              buzzCount: (playerData.buzzCount || 0) + 1
            };

            // Cooldown si seuil atteint
            if (consecutiveCorrect >= threshold) {
              updates.hasCooldownPending = true;
              updates.consecutiveCorrect = 0;
            }

            await set(playerRef, { ...playerData, ...updates });
          } else {
            // Reset le streak en cas d'erreur
            await set(playerRef, {
              ...playerData,
              consecutiveCorrect: 0
            });
          }
        }
        resolve();
      }, { onlyOnce: true });
    });
  };

  return {
    calculatePoints: () => calculatePoints(currentChrono, songDuration),
    addPointsToTeam,
    markBuzzAsWrong,
    updatePlayerStats
  };
}
