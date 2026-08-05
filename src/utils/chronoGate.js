/**
 * Règle de gel du chrono de scoring.
 *
 * ⚠️ INVARIANT CRITIQUE — le chrono mesure le TEMPS DE REPONSE a la question,
 * pas le temps de lecture audio. Depuis que la musique continue apres la
 * revelation (pour qu'on puisse enfin ecouter la chanson), les deux ne
 * coincident plus : il faut les decoupler explicitement.
 *
 * Si le chrono suivait la lecture audio, apres revelation :
 *   - les points disponibles affiches sur la TV s'effondreraient en direct
 *   - un chrono gonfle risquerait d'etre relu comme temps de reponse
 *
 * Extrait ici en fonction pure pour etre couvert par des tests : c'est la
 * regle dont depend l'exactitude du scoring en mode quiz.
 */
export function isChronoFrozen({ playMode, quizRevealed }) {
  // Mode equipe : comportement historique inchange. La musique y est coupee
  // au buzz, le chrono se fige donc naturellement via isPlaying.
  if (playMode !== 'quiz') return false;

  // Mode quiz : le chrono s'arrete a la revelation, quoi que fasse l'audio.
  return quizRevealed === true;
}

/**
 * Le chrono doit-il avancer ?
 * Il faut que la musique tourne ET que la question soit encore en cours.
 */
export function shouldAdvanceChrono({ isPlaying, playMode, quizRevealed }) {
  return isPlaying === true && !isChronoFrozen({ playMode, quizRevealed });
}
