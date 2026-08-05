/**
 * Machine a etats de la partie — `sessions/{id}/game_status.phase`.
 *
 *   playing ──────► revealed ──────► last_reveal ──────► ended
 *      ▲               │
 *      └───────────────┘  (question suivante, s'il reste des pistes)
 *
 * | Phase         | Signification                                    |
 * |---------------|--------------------------------------------------|
 * | playing       | question en cours, chrono actif                   |
 * | revealed      | reponse revelee, points attribues                 |
 * | last_reveal   | derniere question revelee, attente du final       |
 * | ended         | partie terminee, ecran de victoire                |
 *
 * ⚠️ EXPAND/CONTRACT — le booleen `game_status.ended` est CONSERVE en
 * ecriture. `phase` et `ended` expriment la meme information, mais `phase`
 * est plus riche. Le contract (arret d'ecriture puis suppression de `ended`)
 * est hors perimetre : il attend qu'un tracer confirme qu'aucun lecteur ne
 * subsiste.
 *
 * Tous les lecteurs passent par resolveGamePhase() : c'est ce qui permet aux
 * sessions creees AVANT ce changement — qui n'ont que `ended` — de continuer
 * a fonctionner.
 */

export const GAME_PHASES = {
  PLAYING: 'playing',
  REVEALED: 'revealed',
  LAST_REVEAL: 'last_reveal',
  ENDED: 'ended'
};

const KNOWN_PHASES = Object.values(GAME_PHASES);

/**
 * Phase effective d'une session, quelle que soit son anciennete.
 *
 * Une session creee avant l'introduction de `phase` n'a que `ended`. Lire
 * `status.phase` directement y renverrait `undefined`, et un test comme
 * `phase !== 'ended'` serait vrai sur une partie pourtant terminee — ce qui,
 * cote TV, declenche la detection de reset et boucle sur un rechargement.
 * On retombe donc sur le booleen quand `phase` est absent ou inconnu.
 *
 * @param {object|null} status  contenu de game_status
 * @returns {'playing'|'revealed'|'last_reveal'|'ended'|null}
 *          null si game_status n'existe pas encore
 */
export function resolveGamePhase(status) {
  if (!status) return null;

  if (KNOWN_PHASES.includes(status.phase)) {
    return status.phase;
  }

  // Retrocompatibilite : sessions anterieures a `phase`.
  return status.ended === true ? GAME_PHASES.ENDED : GAME_PHASES.PLAYING;
}

/** La partie est-elle terminee ? (ecran de victoire) */
export function isGameEnded(status) {
  return resolveGamePhase(status) === GAME_PHASES.ENDED;
}

/** Derniere question revelee, en attente du classement final. */
export function isLastReveal(status) {
  return resolveGamePhase(status) === GAME_PHASES.LAST_REVEAL;
}
