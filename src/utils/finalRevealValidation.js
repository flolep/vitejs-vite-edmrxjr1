import { database } from '../firebase';
import { ref, get } from 'firebase/database';

/**
 * Validation, cote MASTER, d'une demande de classement final.
 *
 * La regle de securite Firebase ne fait qu'exiger `auth != null` et une
 * session active : elle empeche un client non authentifie d'ecrire, mais elle
 * ne sait pas QUI est le vainqueur. Sans cette verification, n'importe quel
 * joueur authentifie pourrait terminer la partie.
 *
 * Tout est relu depuis Firebase — jamais depuis un state React.
 *
 * @returns {Promise<{valid: boolean, reason?: string}>}
 */
export async function validateFinalRevealRequest(sessionId, playMode, playerId) {
  if (!sessionId || !playerId) {
    return { valid: false, reason: 'requête incomplète' };
  }

  if (playMode === 'quiz') {
    return validateQuizWinner(sessionId, playerId);
  }
  return validateTeamWinner(sessionId, playerId);
}

/** Mode quiz : le demandeur doit etre en tete de quiz_leaderboard. */
async function validateQuizWinner(sessionId, playerId) {
  const snap = await get(ref(database, `sessions/${sessionId}/quiz_leaderboard`));
  const leaderboard = snap.val();

  if (!leaderboard) {
    // Aucun score enregistre : il n'y a pas de vainqueur a usurper, et
    // bloquer ici figerait la partie. On laisse passer.
    return { valid: true };
  }

  const ranked = Object.values(leaderboard)
    .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

  const topPoints = ranked[0]?.totalPoints || 0;
  // Ex aequo en tete : chacun d'eux peut declencher, premier clic gagnant.
  const leaders = ranked.filter(p => (p.totalPoints || 0) === topPoints);

  if (leaders.some(p => p.playerId === playerId)) {
    return { valid: true };
  }
  return { valid: false, reason: `${playerId} n'est pas en tête du classement` };
}

/**
 * Mode equipe : le demandeur doit appartenir a l'equipe en tete.
 *
 * On ne se fie pas a une equipe annoncee par le client : on retrouve le joueur
 * dans players_session pour determiner son equipe reelle.
 */
async function validateTeamWinner(sessionId, playerId) {
  const [scoresSnap, team1Snap, team2Snap] = await Promise.all([
    get(ref(database, `sessions/${sessionId}/scores`)),
    get(ref(database, `sessions/${sessionId}/players_session/team1`)),
    get(ref(database, `sessions/${sessionId}/players_session/team2`))
  ]);

  const scores = scoresSnap.val() || { team1: 0, team2: 0 };

  const belongsTo = (snap) =>
    Object.values(snap.val() || {}).some(p => p.id === playerId);

  const inTeam1 = belongsTo(team1Snap);
  const inTeam2 = belongsTo(team2Snap);

  if (!inTeam1 && !inTeam2) {
    return { valid: false, reason: `${playerId} n'appartient à aucune équipe` };
  }

  // Egalite : le resultat est un match nul, les deux equipes sont « en tete ».
  // Bloquer figerait la partie sans rien proteger.
  if (scores.team1 === scores.team2) {
    return { valid: true };
  }

  const leadingTeam = scores.team1 > scores.team2 ? 1 : 2;
  const isInLeadingTeam = leadingTeam === 1 ? inTeam1 : inTeam2;

  if (isInLeadingTeam) {
    return { valid: true };
  }
  return { valid: false, reason: `${playerId} n'est pas dans l'équipe en tête` };
}
