import { useState, useEffect, useRef } from 'react';
import { database } from '../../firebase';
import { ref, onValue } from 'firebase/database';

/**
 * Determine si le joueur doit etre alerte qu'on l'attend.
 *
 * Le calcul est LOCAL au buzzer (comparaison quiz_answers / joueurs
 * connectes) et non pousse par la TV : le mobile a deja les deux
 * informations, un aller-retour par la TV ajouterait de la latence sur un
 * signal qui doit arriver vite.
 *
 * Escalade en deux temps :
 *   'warning' — il reste 2 non-repondants dont moi : pulsation discrete
 *   'last'    — je suis le seul restant : flash plein ecran
 *
 * ⚠️ Ce canal est le SEUL a dire « tu es le dernier ». Le beep du Master est
 * uniforme par conception : l'audio ne porte plus cette information.
 *
 * @param {string} sessionId
 * @param {object} quizQuestion  { trackNumber, revealed }
 * @param {string} playerId      identifiant du joueur dans quiz_answers
 * @param {boolean} isPlaying    la chanson tourne
 * @returns {'none'|'warning'|'last'}
 */
export function useLastResponderAlert(sessionId, quizQuestion, playerId, isPlaying) {
  const [answersCount, setAnswersCount] = useState(0);
  const [selfAnswered, setSelfAnswered] = useState(false);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const trackNumber = quizQuestion?.trackNumber;
  const revealed = quizQuestion?.revealed;

  // Nombre de joueurs connectes. En mode quiz tout le monde est dans team1.
  useEffect(() => {
    if (!sessionId) return;
    const playersRef = ref(database, `sessions/${sessionId}/players_session/team1`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const players = snapshot.val();
      if (!players) {
        setTotalPlayers(0);
        return;
      }
      // Seulement les joueurs connectes : un joueur parti ne doit pas bloquer
      // l'escalade a « tu es le dernier » pour les autres.
      const connected = Object.values(players).filter(p => p.connected);
      setTotalPlayers(connected.length);
    });
    return () => unsubscribe();
  }, [sessionId]);

  // Reponses sur la question en cours. On lit aussi depuis Firebase si le
  // joueur a repondu, plutot que de se fier a l'etat React local : apres un
  // rechargement en cours de question, l'etat local repart a false alors que
  // la reponse est bien enregistree, et le joueur serait alerte a tort.
  useEffect(() => {
    if (!sessionId || trackNumber === undefined || trackNumber === null) {
      setAnswersCount(0);
      setSelfAnswered(false);
      return;
    }
    const answersRef = ref(database, `sessions/${sessionId}/quiz_answers/${trackNumber}`);
    const unsubscribe = onValue(answersRef, (snapshot) => {
      const answers = snapshot.val();
      const keys = answers ? Object.keys(answers) : [];
      setAnswersCount(keys.length);
      setSelfAnswered(playerId ? keys.includes(playerId) : false);
    });
    return () => unsubscribe();
  }, [sessionId, trackNumber, playerId]);

  // Question inactive : aucune alerte.
  if (!quizQuestion || revealed || !isPlaying || selfAnswered) return 'none';
  // En dessous de 2 joueurs l'escalade n'a pas de sens.
  if (totalPlayers < 2) return 'none';

  const remaining = totalPlayers - answersCount;

  // remaining compte les non-repondants, et selfAnswered est faux : j'en fais
  // donc partie. remaining === 1 => c'est moi et personne d'autre.
  if (remaining === 1) return 'last';
  if (remaining === 2) return 'warning';
  return 'none';
}

/**
 * Declenche une vibration courte, si le materiel la supporte.
 *
 * navigator.vibrate n'existe PAS sur iOS Safari : sur iPhone cet appel ne
 * partira jamais. L'alerte visuelle doit donc fonctionner seule — la
 * vibration est un bonus Android, jamais le canal principal.
 */
export function vibrateIfSupported(pattern = [120, 60, 120]) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }
  try {
    return navigator.vibrate(pattern);
  } catch {
    // Certains navigateurs exposent la methode mais la refusent hors geste
    // utilisateur : on ignore, l'alerte visuelle suffit.
    return false;
  }
}

/**
 * Vibre une seule fois au passage en 'last'.
 */
export function useAlertVibration(level) {
  const previousRef = useRef('none');
  useEffect(() => {
    if (level === 'last' && previousRef.current !== 'last') {
      vibrateIfSupported();
    }
    previousRef.current = level;
  }, [level]);
}
