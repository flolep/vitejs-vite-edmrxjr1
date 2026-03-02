import { useState, useEffect } from 'react';
import { database } from '../../firebase';
import { ref, onValue } from 'firebase/database';

/**
 * Hook pour gérer la validation et l'écoute de la session Firebase
 * Récupère le sessionId depuis l'URL ou localStorage (ou depuis les props si fourni)
 * Vérifie que la session existe et est active
 */
export function useBuzzerSession(sessionIdFromProps = null) {
  const [sessionId, setSessionId] = useState('');
  const [sessionValid, setSessionValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playMode, setPlayMode] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // Récupérer le sessionId depuis l'URL au chargement (sauf si fourni en props)
  useEffect(() => {
    // PRIORITÉ 1 : sessionId passé en props (depuis le router)
    if (sessionIdFromProps) {
      console.log('🔑 [useBuzzerSession] SessionId reçu des props:', sessionIdFromProps);
      setSessionId(sessionIdFromProps);
      setIsLoading(false); // Le router a déjà vérifié
      setSessionValid(true); // Assumé valide si le router l'a passé
      return;
    }

    // PRIORITÉ 2 : sessionId dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');

    if (sessionParam) {
      console.log('🔑 [useBuzzerSession] SessionId trouvé dans URL:', sessionParam);
      setSessionId(sessionParam);
      localStorage.setItem('sessionId', sessionParam);
    } else {
      // PRIORITÉ 3 : Fallback sur localStorage
      const savedSessionId = localStorage.getItem('sessionId');
      if (savedSessionId) {
        console.log('🔑 [useBuzzerSession] SessionId trouvé dans localStorage:', savedSessionId);
        setSessionId(savedSessionId);
      } else {
        console.warn('⚠️ [useBuzzerSession] Aucun sessionId trouvé');
        setIsLoading(false); // Pas de session, arrêter le chargement
      }
    }
  }, [sessionIdFromProps]);

  // Vérifier automatiquement la session quand sessionId change (sauf si vient des props)
  useEffect(() => {
    if (!sessionId || sessionIdFromProps) return; // Skip si vient des props (déjà vérifié par router)

    console.log('🔍 [useBuzzerSession] Vérification session:', sessionId);
    setIsLoading(true);

    const sessionRef = ref(database, `sessions/${sessionId}`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val().active) {
        const sessionData = snapshot.val();

        console.log('✅ [useBuzzerSession] Session valide:', sessionId);
        setSessionValid(true);

        // Détecter si la partie a déjà démarré
        const hasGameStarted = sessionData.isPlaying === true || (sessionData.currentTrack && sessionData.currentTrack > 0);

        if (hasGameStarted) {
          console.log('⚡ La partie a déjà démarré');
          setGameStarted(true);
        } else {
          console.log('⏸️ La partie n\'a pas encore démarré');
          setGameStarted(false);
        }
      } else {
        console.warn('❌ [useBuzzerSession] Session invalide:', sessionId);
        setSessionValid(false);
      }
      setIsLoading(false);
    }, { onlyOnce: true });

    return () => unsubscribe();
  }, [sessionId, sessionIdFromProps]);

  // Écouter playMode depuis Firebase
  useEffect(() => {
    if (!sessionId || !sessionValid) return;

    const sessionRef = ref(database, `sessions/${sessionId}`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const sessionData = snapshot.val();
        setPlayMode(sessionData.playMode || 'team');
      }
    });

    return () => unsubscribe();
  }, [sessionId, sessionValid]);

  // Écouter isPlaying depuis Firebase
  useEffect(() => {
    if (!sessionId || !sessionValid) return;

    const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
    const unsubscribe = onValue(playingRef, (snapshot) => {
      const playingData = snapshot.val();
      setIsPlaying(playingData === true);
    });

    return () => unsubscribe();
  }, [sessionId, sessionValid]);

  return {
    sessionId,
    setSessionId,
    sessionValid,
    setSessionValid,
    isLoading,
    playMode,
    isPlaying,
    gameStarted
  };
}
