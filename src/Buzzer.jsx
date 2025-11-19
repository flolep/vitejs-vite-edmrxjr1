import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, onValue } from 'firebase/database';
import BuzzerTeam from './BuzzerTeam';
import BuzzerQuiz from './BuzzerQuiz';

/**
 * Router pour le mode Buzzer
 * Détecte le mode de jeu (Team ou Quiz) et affiche le bon composant
 */
export default function Buzzer() {
  const [playMode, setPlayMode] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Récupérer le sessionId depuis l'URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');

    if (sessionParam) {
      setSessionId(sessionParam);
    } else {
      // Si pas de session dans l'URL, vérifier le localStorage
      const savedSessionId = localStorage.getItem('sessionId');
      if (savedSessionId) {
        setSessionId(savedSessionId);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  // Écouter le mode de jeu depuis Firebase
  useEffect(() => {
    if (!sessionId) {
      console.log('⚠️ [Buzzer Router] Pas de sessionId');
      setIsLoading(false);
      return;
    }

    console.log('🔍 [Buzzer Router] Lecture session Firebase:', sessionId);
    const sessionRef = ref(database, `sessions/${sessionId}`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const sessionData = snapshot.val();
        const mode = sessionData.playMode || 'team';
        console.log('🎮 [Buzzer Router] Session data:', {
          playMode: sessionData.playMode,
          gameMode: sessionData.gameMode,
          musicSource: sessionData.musicSource,
          modeDetecte: mode
        });
        setPlayMode(mode);
        setIsLoading(false);
      } else {
        console.warn('⚠️ [Buzzer Router] Session introuvable:', sessionId);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [sessionId]);

  // État de chargement
  if (isLoading) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center">
          <h2 className="title">Chargement...</h2>
          <div style={{ fontSize: '3rem', marginTop: '1rem' }}>⏳</div>
        </div>
      </div>
    );
  }

  // Routage vers le bon composant
  console.log('🔀 [Buzzer Router] Routage final:', {
    playMode,
    sessionId,
    comparaison: `playMode === 'quiz' ? ${playMode === 'quiz'}`,
    typePlayMode: typeof playMode,
    composantRendu: playMode === 'quiz' ? 'BuzzerQuiz' : 'BuzzerTeam'
  });

  if (playMode === 'quiz') {
    console.log('✅ [Buzzer Router] → Affichage BuzzerQuiz');
    return <BuzzerQuiz sessionIdFromRouter={sessionId} />;
  }

  // Par défaut, mode Team
  console.log('✅ [Buzzer Router] → Affichage BuzzerTeam (défaut)');
  return <BuzzerTeam sessionIdFromRouter={sessionId} />;
}
