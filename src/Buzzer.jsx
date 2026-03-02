import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, onValue } from 'firebase/database';
import BuzzerTeam from './BuzzerTeam';
import BuzzerQuiz from './BuzzerQuiz';
import SessionCodeInput from './components/SessionCodeInput';

/**
 * Router pour le mode Buzzer
 * Détecte le mode de jeu (Team ou Quiz) et affiche le bon composant
 */
export default function Buzzer() {
  const [playMode, setPlayMode] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSessionInput, setShowSessionInput] = useState(false);

  // Récupérer le sessionId depuis l'URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');

    if (sessionParam) {
      // Session dans l'URL : l'utiliser et la sauvegarder
      console.log('✅ [Buzzer Router] Session trouvée dans l\'URL:', sessionParam);
      setSessionId(sessionParam);
      localStorage.setItem('sessionId', sessionParam);
    } else {
      // Pas de session dans l'URL : afficher l'écran de saisie du code
      // ⚠️ Ne PAS utiliser le localStorage automatiquement car il peut contenir une ancienne session
      console.log('⚠️ [Buzzer Router] Pas de session dans l\'URL → affichage écran de saisie');
      setShowSessionInput(true);
      setIsLoading(false);
    }
  }, []);

  // Valider le code de session saisi manuellement
  const handleJoinSession = (code) => {
    console.log('🔍 [Buzzer Router] Validation du code:', code);
    setIsLoading(true);
    setShowSessionInput(false);

    // Sauvegarder et définir la session
    localStorage.setItem('sessionId', code);
    setSessionId(code);

    // Mettre à jour l'URL
    window.history.pushState({}, '', `/buzzer?session=${code}`);
  };

  // Écouter le mode de jeu depuis Firebase
  useEffect(() => {
    if (!sessionId) {
      console.log('⚠️ [Buzzer Router] Pas de sessionId - en attente...');
      // ⚠️ NE PAS mettre isLoading(false) ici !
      // Il faut attendre d'avoir le sessionId ET le playMode avant de router
      return;
    }

    console.log('🔍 [Buzzer Router] Lecture session Firebase:', sessionId);
    const sessionRef = ref(database, `sessions/${sessionId}`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const sessionData = snapshot.val();
        const mode = sessionData.playMode;

        console.log('🎮 [Buzzer Router] Session data:', {
          playMode: sessionData.playMode,
          gameMode: sessionData.gameMode,
          musicSource: sessionData.musicSource,
          modeDetecte: mode,
          playModeExiste: sessionData.playMode !== undefined,
          playModeType: typeof sessionData.playMode,
          playModeRaw: JSON.stringify(sessionData.playMode)
        });

        // IMPORTANT : Ne pas utiliser de valeur par défaut !
        // Attendre que playMode soit explicitement défini
        if (mode) {
          // Nettoyer le mode pour éviter les problèmes de casse/espaces
          const cleanMode = String(mode).trim().toLowerCase();
          console.log(`✅ [Buzzer Router] playMode détecté et nettoyé: "${cleanMode}" (original: "${mode}")`);
          setPlayMode(cleanMode);
          setIsLoading(false);
        } else {
          console.warn('⚠️ [Buzzer Router] playMode non défini dans la session, en attente...');
          // Garder isLoading = true pour attendre que le Master définisse le mode
        }
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

  // Écran de saisie du code de session (si pas de session trouvée)
  if (showSessionInput) {
    return (
      <div className="bg-gradient flex-center">
        <SessionCodeInput
          onSubmit={handleJoinSession}
          onError={(errorMsg) => console.error('Erreur de validation:', errorMsg)}
        />
      </div>
    );
  }

  // Routage vers le bon composant
  console.log('🔀 [Buzzer Router] Routage final:', {
    playMode,
    sessionId,
    playModeNormalized: playMode ? String(playMode).trim().toLowerCase() : null,
    comparaison: `playMode === 'quiz' ? ${playMode === 'quiz'}`,
    typePlayMode: typeof playMode,
    composantRendu: playMode === 'quiz' ? 'BuzzerQuiz' : 'BuzzerTeam'
  });

  // Normaliser playMode pour la comparaison (case-insensitive)
  const normalizedMode = playMode ? String(playMode).trim().toLowerCase() : null;

  if (normalizedMode === 'quiz') {
    console.log('✅ [Buzzer Router] → Affichage BuzzerQuiz');
    return <BuzzerQuiz sessionIdFromRouter={sessionId} />;
  }

  // Par défaut, mode Team
  console.log('✅ [Buzzer Router] → Affichage BuzzerTeam (défaut)', { normalizedMode });
  return <BuzzerTeam sessionIdFromRouter={sessionId} />;
}
