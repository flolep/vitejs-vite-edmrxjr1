import { useState, useEffect, useCallback } from 'react';
import { database } from '../../firebase';
import { ref, onValue, set, serverTimestamp } from 'firebase/database';
import { GAME_PHASES, resolveGamePhase } from '../../utils/gamePhase';
import { ensureAnonymousAuth } from '../../utils/buzzerAuth';

/**
 * Bouton « Révéler le classement final » chez le vainqueur.
 *
 * Mecanique calquee sur `quiz_next_song_request` : le joueur ecrit une
 * requete, le Master l'ecoute, la VALIDE et la supprime. Le buzzer ne decide
 * de rien — il demande. C'est le Master qui verifie que le demandeur est bien
 * le vainqueur, sinon n'importe quel joueur pourrait terminer la partie.
 *
 * @param {string} sessionId
 * @param {string} playerId
 * @param {string} playerName
 * @param {boolean} isWinner  calcule par l'appelant, la ou vivent les scores
 */
export function useFinalReveal(sessionId, playerId, playerName, isWinner) {
  const [phase, setPhase] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    const gameStatusRef = ref(database, `sessions/${sessionId}/game_status`);
    const unsubscribe = onValue(gameStatusRef, (snapshot) => {
      setPhase(resolveGamePhase(snapshot.val()));
    });
    return () => unsubscribe();
  }, [sessionId]);

  // On sort de last_reveal (partie terminee, ou reset) : on rearme.
  useEffect(() => {
    if (phase !== GAME_PHASES.LAST_REVEAL) {
      setRequestSent(false);
      setError(null);
    }
  }, [phase]);

  const canTrigger = phase === GAME_PHASES.LAST_REVEAL && isWinner && !requestSent;

  const requestFinalReveal = useCallback(async () => {
    if (!sessionId || !playerId) return;

    setIsRequesting(true);
    setError(null);

    try {
      // `final_reveal_request` exige `auth != null` : sans session
      // d'authentification, l'ecriture part en PERMISSION_DENIED.
      await ensureAnonymousAuth();

      const requestRef = ref(database, `sessions/${sessionId}/final_reveal_request`);
      await set(requestRef, {
        playerId,
        playerName: playerName || 'Anonyme',
        timestamp: serverTimestamp()
      });

      setRequestSent(true);
      console.log('🏆 Demande de classement final envoyée');
    } catch (err) {
      console.error('❌ Demande de classement final refusée:', err);
      // Message explicite plutot qu'un bouton qui ne fait rien : sans ce
      // retour, un refus de permission est indiscernable d'un bug.
      setError("Impossible d'envoyer la demande. L'animateur peut afficher le classement.");
    } finally {
      setIsRequesting(false);
    }
  }, [sessionId, playerId, playerName]);

  return {
    isLastReveal: phase === GAME_PHASES.LAST_REVEAL,
    canTrigger,
    requestSent,
    isRequesting,
    error,
    requestFinalReveal
  };
}
