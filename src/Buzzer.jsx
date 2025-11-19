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
      setIsLoading(false);
      return;
    }

    const sessionRef = ref(database, `sessions/${sessionId}`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const sessionData = snapshot.val();
        const mode = sessionData.playMode || 'team';
        console.log('🎮 [Buzzer Router] Mode détecté:', mode);
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
  if (playMode === 'quiz') {
    console.log('📝 [Buzzer Router] Affichage BuzzerQuiz');
    return <BuzzerQuiz />;
  }

  // Par défaut, mode Team
  console.log('👥 [Buzzer Router] Affichage BuzzerTeam');
  return <BuzzerTeam />;
}
