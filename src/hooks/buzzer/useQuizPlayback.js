import { useState, useCallback } from 'react';
import { database } from '../../firebase';
import { ref, set, serverTimestamp } from 'firebase/database';
import { ensureAnonymousAuth } from '../../utils/buzzerAuth';

/**
 * Contrôle play/pause de la chanson par le vainqueur de la question.
 *
 * Meme pattern que final_reveal_request : le joueur ecrit une demande, le
 * Master la valide et l'execute. Le buzzer ne touche jamais a l'audio — le
 * son sort du Master, qui porte le SDK Spotify.
 *
 * La reprise repart au bon endroit sans travail supplementaire :
 * SpotifyPlayerAdapter sauvegarde deja `currentPosition` au pause et la
 * restitue au play.
 */
export function useQuizPlayback(sessionId, playerId) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState(null);

  const requestPlayback = useCallback(async (action) => {
    if (!sessionId || !playerId) return;
    if (action !== 'play' && action !== 'pause') return;

    setIsRequesting(true);
    setError(null);

    try {
      // Le noeud exige `auth != null`, comme final_reveal_request.
      await ensureAnonymousAuth();

      const requestRef = ref(database, `sessions/${sessionId}/quiz_playback_request`);
      await set(requestRef, {
        action,
        playerId,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('❌ Demande de lecture refusée:', err);
      setError('Contrôle indisponible');
    } finally {
      setIsRequesting(false);
    }
  }, [sessionId, playerId]);

  return { requestPlayback, isRequesting, error };
}
