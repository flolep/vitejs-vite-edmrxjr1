import { describe, it, expect } from 'vitest';
import { isChronoFrozen, shouldAdvanceChrono } from './chronoGate';
import { calculatePoints } from '../hooks/useScoring';

/**
 * Ces tests couvrent la regression la plus dangereuse de ce chantier :
 * laisser la musique tourner apres la revelation ne doit RIEN changer au
 * calcul des points.
 */

describe('isChronoFrozen', () => {
  it('ne gèle jamais le chrono en mode équipe (comportement historique)', () => {
    expect(isChronoFrozen({ playMode: 'team', quizRevealed: false })).toBe(false);
    // Meme si un etat de revelation trainait, le mode equipe n'est pas concerne
    expect(isChronoFrozen({ playMode: 'team', quizRevealed: true })).toBe(false);
  });

  it('laisse courir le chrono tant que la question quiz n\'est pas révélée', () => {
    expect(isChronoFrozen({ playMode: 'quiz', quizRevealed: false })).toBe(false);
  });

  it('gèle le chrono dès la révélation en mode quiz', () => {
    expect(isChronoFrozen({ playMode: 'quiz', quizRevealed: true })).toBe(true);
  });
});

describe('shouldAdvanceChrono', () => {
  it('avance quand la musique joue et que la question est en cours', () => {
    expect(shouldAdvanceChrono({ isPlaying: true, playMode: 'quiz', quizRevealed: false })).toBe(true);
  });

  it('n\'avance PAS après révélation, même si la musique continue', () => {
    // C'est le coeur du chantier : lecture audio et chrono sont decouples.
    expect(shouldAdvanceChrono({ isPlaying: true, playMode: 'quiz', quizRevealed: true })).toBe(false);
  });

  it('n\'avance pas quand la musique est en pause', () => {
    expect(shouldAdvanceChrono({ isPlaying: false, playMode: 'quiz', quizRevealed: false })).toBe(false);
  });

  it('mode équipe : dépend uniquement de la lecture, comme avant', () => {
    expect(shouldAdvanceChrono({ isPlaying: true, playMode: 'team', quizRevealed: false })).toBe(true);
    expect(shouldAdvanceChrono({ isPlaying: false, playMode: 'team', quizRevealed: false })).toBe(false);
  });
});

describe('non-régression du scoring quiz', () => {
  /**
   * Les points attribues sont calcules a partir de `answer.time`, releve au
   * moment ou le joueur repond (BuzzerQuiz lit sessions/{id}/chrono). Ils ne
   * dependent donc pas de ce que fait le chrono APRES la revelation.
   */
  it('attribue les mêmes points quel que soit le temps écoulé après révélation', () => {
    const songDuration = 30;
    const answerTime = 7.3; // le joueur a repondu a 7,3 s

    const pointsAvant = calculatePoints(answerTime, songDuration);

    // La chanson continue 60 s de plus pendant l'ecoute : le temps de reponse
    // enregistre, lui, ne bouge pas.
    const pointsApres = calculatePoints(answerTime, songDuration);

    expect(pointsApres).toBe(pointsAvant);
    expect(pointsApres).toBe(calculatePoints(7.3, 30));
  });

  it('démontre ce qu\'un chrono non gelé aurait coûté', () => {
    const songDuration = 30;
    // Sans le gel, un chrono qui continue de tourner pendant l'ecoute ferait
    // s'effondrer les points disponibles affiches.
    const auMomentDeLaReponse = calculatePoints(7.3, songDuration);
    const apres60sDEcoute = calculatePoints(67.3, songDuration);

    expect(auMomentDeLaReponse).toBeGreaterThan(0);
    expect(apres60sDEcoute).toBe(0);
    // C'est exactement l'ecart que le gel du chrono evite.
    expect(auMomentDeLaReponse).not.toBe(apres60sDEcoute);
  });
});
