import { useState, useEffect, useRef } from 'react';
import { database } from '../firebase';
import { ref, set, onValue } from 'firebase/database';

/**
 * Hook pour gérer la session de jeu (scores, chrono, état de lecture)
 * Logique commune à tous les modes
 */
export function useGameSession(sessionId) {
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [currentChrono, setCurrentChrono] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(1); // ✅ Commence à 1 au lieu de 0
  const [songDuration, setSongDuration] = useState(0);

  const currentChronoRef = useRef(0);

  // Synchroniser chrono avec Firebase
  useEffect(() => {
    if (!sessionId) return;
    try {
      const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
      const unsubscribe = onValue(chronoRef, (snapshot) => {
        const value = snapshot.val();
        if (value !== null) {
          setCurrentChrono(value);
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('Error syncing chrono:', e);
    }
  }, [sessionId]);

  // Synchroniser la ref du chrono avec le state
  useEffect(() => {
    currentChronoRef.current = currentChrono;
  }, [currentChrono]);

  // Synchroniser scores avec Firebase
  useEffect(() => {
    if (!sessionId) return;
    try {
      const scoresRef = ref(database, `sessions/${sessionId}/scores`);
      const unsubscribe = onValue(scoresRef, (snapshot) => {
        const value = snapshot.val();
        if (value) {
          setScores(value);
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('Error syncing scores:', e);
    }
  }, [sessionId]);

  // Synchroniser isPlaying avec Firebase
  useEffect(() => {
    if (!sessionId) return;
    try {
      const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
      const unsubscribe = onValue(playingRef, (snapshot) => {
        const value = snapshot.val();
        if (value !== null) {
          setIsPlaying(value);
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('Error syncing isPlaying:', e);
    }
  }, [sessionId]);

  // Synchroniser currentTrackNumber avec Firebase
  useEffect(() => {
    if (!sessionId) return;
    try {
      const trackRef = ref(database, `sessions/${sessionId}/currentTrackNumber`);
      const unsubscribe = onValue(trackRef, (snapshot) => {
        const value = snapshot.val();
        if (value !== null) {
          setCurrentTrack(value);
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('Error syncing currentTrackNumber:', e);
    }
  }, [sessionId]);

  // Synchroniser songDuration avec Firebase
  useEffect(() => {
    if (!sessionId) return;
    const durationRef = ref(database, `sessions/${sessionId}/songDuration`);
    const unsubscribe = onValue(durationRef, (snapshot) => {
      const duration = snapshot.val();
      if (duration !== null) {
        setSongDuration(duration);
      }
    });
    return () => unsubscribe();
  }, [sessionId]);

  // Mettre à jour le chrono toutes les 100ms quand la musique joue
  useEffect(() => {
    if (!sessionId) return;
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentChrono(prev => {
          const newChrono = parseFloat((prev + 0.1).toFixed(1));
          const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
          set(chronoRef, newChrono);
          return newChrono;
        });
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, sessionId]);

  // Fonctions de mise à jour
  const updateScores = (newScores) => {
    setScores(newScores);
    if (sessionId) {
      const scoresRef = ref(database, `sessions/${sessionId}/scores`);
      set(scoresRef, newScores);
    }
  };

  const updateIsPlaying = (playing) => {
    setIsPlaying(playing);
    if (sessionId) {
      const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
      set(playingRef, playing);
    }
  };

  const updateCurrentTrack = (trackIndex) => {
    setCurrentTrack(trackIndex);
    if (sessionId) {
      const trackNumberRef = ref(database, `sessions/${sessionId}/currentTrackNumber`);
      set(trackNumberRef, trackIndex);
    }
  };

  const resetChrono = () => {
    setCurrentChrono(0);
    if (sessionId) {
      const chronoRef = ref(database, `sessions/${sessionId}/chrono`);
      set(chronoRef, 0);
    }
  };

  const updateCurrentSong = (songData) => {
    if (sessionId) {
      const songRef = ref(database, `sessions/${sessionId}/currentSong`);
      set(songRef, songData);
    }
  };

  return {
    scores,
    currentChrono,
    isPlaying,
    currentTrack,
    songDuration,
    currentChronoRef,
    setScores,
    setSongDuration,
    updateScores,
    updateIsPlaying,
    updateCurrentTrack,
    resetChrono,
    updateCurrentSong
  };
}
