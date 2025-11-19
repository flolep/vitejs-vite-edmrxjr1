import { useState, useEffect } from 'react';
import { database } from '../../firebase';
import { ref, onValue } from 'firebase/database';

/**
 * Hook pour gérer la validation et l'écoute de la session Firebase
 * Récupère le sessionId depuis l'URL ou localStorage
 * Vérifie que la session existe et est active
 */
export function useBuzzerSession() {
  const [sessionId, setSessionId] = useState('');
  const [sessionValid, setSessionValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playMode, setPlayMode] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Récupérer le sessionId depuis l'URL au chargement
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');

    if (sessionParam) {
      setSessionId(sessionParam);
      localStorage.setItem('sessionId', sessionParam);
    } else {
      // Fallback sur localStorage si pas dans l'URL
      const savedSessionId = localStorage.getItem('sessionId');
      if (savedSessionId) {
        setSessionId(savedSessionId);
      } else {
        setIsLoading(false); // Pas de session, arrêter le chargement
      }
    }
  }, []);

  // Vérifier automatiquement la session quand sessionId change
  useEffect(() => {
    if (!sessionId) return;

    console.log('🔍 [useBuzzerSession] Vérification session:', sessionId);
    setIsLoading(true);

    const sessionRef = ref(database, `sessions/${sessionId}`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (snapshot.exists() && snapshot.val().active) {
        const sessionData = snapshot.val();

        console.log('✅ [useBuzzerSession] Session valide:', sessionId);
        setSessionValid(true);

        // Détecter si la partie a déjà démarré
        const gameStarted = sessionData.isPlaying === true || (sessionData.currentTrack && sessionData.currentTrack > 0);

        if (gameStarted) {
          console.log('⚡ La partie a déjà démarré');
          localStorage.setItem('gameAlreadyStarted', 'true');
        } else {
          console.log('⏸️ La partie n\'a pas encore démarré');
          localStorage.setItem('gameAlreadyStarted', 'false');
        }
      } else {
        console.warn('❌ [useBuzzerSession] Session invalide:', sessionId);
        setSessionValid(false);
      }
      setIsLoading(false);
    }, { onlyOnce: true });

    return () => unsubscribe();
  }, [sessionId]);

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
    isPlaying
  };
}
