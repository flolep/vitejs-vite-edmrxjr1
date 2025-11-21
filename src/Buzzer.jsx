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
  const [showSessionInput, setShowSessionInput] = useState(false);
  const [sessionInputValue, setSessionInputValue] = useState('');
  const [sessionError, setSessionError] = useState('');

  // Récupérer le sessionId depuis l'URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');

    if (sessionParam) {
      setSessionId(sessionParam);
      localStorage.setItem('sessionId', sessionParam);
    } else {
      // Pas de session dans l'URL, vérifier le localStorage
      const savedSessionId = localStorage.getItem('sessionId');
      if (savedSessionId) {
        setSessionId(savedSessionId);
      } else {
        // Aucune session : afficher l'écran de saisie
        setShowSessionInput(true);
        setIsLoading(false);
      }
    }
  }, []);

  // Valider le code de session saisi manuellement
  const handleJoinSession = () => {
    const code = sessionInputValue.trim().toUpperCase();

    if (code.length !== 6) {
      setSessionError('Le code doit contenir 6 caractères');
      return;
    }

    console.log('🔍 [Buzzer Router] Validation du code:', code);
    setSessionError('');
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
      console.log('⚠️ [Buzzer Router] Pas de sessionId');
      setIsLoading(false);
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
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
            🎵 BLIND TEST 🎵
          </h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem', color: '#fff' }}>
            Entrez le code de session
          </h2>
          <input
            type="text"
            placeholder="CODE (6 caractères)"
            value={sessionInputValue}
            onChange={(e) => setSessionInputValue(e.target.value.toUpperCase())}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && sessionInputValue.trim()) {
                handleJoinSession();
              }
            }}
            maxLength={6}
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.8rem',
              textAlign: 'center',
              border: '3px solid #fff',
              borderRadius: '15px',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              fontWeight: 'bold'
            }}
          />
          {sessionError && (
            <div style={{
              color: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              padding: '1rem',
              borderRadius: '10px',
              marginBottom: '1rem',
              fontSize: '1.1rem'
            }}>
              ⚠️ {sessionError}
            </div>
          )}
          <button
            onClick={handleJoinSession}
            disabled={!sessionInputValue.trim()}
            className="buzzer-button"
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              borderRadius: '15px',
              border: 'none',
              background: sessionInputValue.trim()
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : '#ccc',
              color: '#fff',
              cursor: sessionInputValue.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease',
              opacity: sessionInputValue.trim() ? 1 : 0.5
            }}
          >
            ✅ Rejoindre la partie
          </button>
        </div>
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
