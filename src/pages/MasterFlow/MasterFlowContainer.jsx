import React, { useState, useEffect } from 'react';
import { auth, database } from '../../firebase';
import { ref, get, set, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import Login from '../../components/Login';

// Import des étapes
import StepModeSelection from './steps/StepModeSelection';
import StepPlayerConnection from './steps/StepPlayerConnection';
// import StepReadyToStart from './steps/StepReadyToStart';

// Import de l'interface de partie active
// import ActiveGameContainer from './ActiveGame/ActiveGameContainer';

/**
 * États du flux Master
 */
const FLOW_STATES = {
  LOADING: 'loading',                  // Chargement initial + vérification partie en cours
  ACTIVE_GAME: 'active_game',          // Partie en cours détectée → afficher interface active
  MODE_SELECTION: 'mode_selection',    // Étape 1: Choix Mode Équipe ou Quiz
  PLAYER_CONNECTION: 'player_connection', // Étape 2: Connexion joueurs + config musique
  READY: 'ready',                      // Étape 3: Prêt à démarrer
  GAME_PLAYING: 'game_playing'         // Partie lancée (même que ACTIVE_GAME mais depuis ce flux)
};

/**
 * Container principal du flux Master refactorisé
 * Gère la state machine et la navigation entre les étapes
 */
export default function MasterFlowContainer() {
  // État d'authentification
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // État du flux (state machine)
  const [flowState, setFlowState] = useState(FLOW_STATES.LOADING);

  // Données de session partagées entre les étapes
  const [sessionData, setSessionData] = useState({
    sessionId: null,
    playMode: null,           // 'team' | 'quiz'
    musicSource: null,        // 'mp3' | 'spotify-auto' | 'spotify-ai'
    gameMode: null,           // Combinaison: 'mp3-team', 'spotify-ai-quiz', etc.
    players: [],              // Liste des joueurs connectés
    playlist: [],             // Playlist chargée
    playlistId: null,         // ID Spotify playlist (si applicable)
    spotifyToken: null        // Token Spotify (si applicable)
  });

  // État de chargement/erreur
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // ========== AUTHENTIFICATION ==========

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);

      // Une fois authentifié, vérifier si une partie est en cours
      if (currentUser) {
        checkForActiveGame();
      } else {
        setFlowState(FLOW_STATES.MODE_SELECTION);
      }
    });

    return () => unsubscribe();
  }, []);

  // ========== DÉTECTION PARTIE EN COURS ==========

  const checkForActiveGame = async () => {
    try {
      setIsLoading(true);

      // 1. Récupérer le dernier sessionId depuis localStorage
      const lastSessionId = localStorage.getItem('lastSessionId');

      if (!lastSessionId) {
        console.log('📝 Aucune session précédente trouvée');
        setFlowState(FLOW_STATES.MODE_SELECTION);
        return;
      }

      console.log('🔍 Vérification de la session:', lastSessionId);

      // 2. Vérifier dans Firebase si la session existe et est active
      const sessionRef = ref(database, `sessions/${lastSessionId}`);
      const snapshot = await get(sessionRef);
      const existingSession = snapshot.val();

      if (!existingSession) {
        console.log('❌ Session inexistante dans Firebase');
        setFlowState(FLOW_STATES.MODE_SELECTION);
        return;
      }

      // 3. Vérifier si la partie est active et non terminée
      const isActive = existingSession.active === true &&
                      existingSession.game_status?.ended !== true;

      if (!isActive) {
        console.log('⏸️ Session trouvée mais inactive ou terminée');
        setFlowState(FLOW_STATES.MODE_SELECTION);
        return;
      }

      console.log('✅ Partie en cours détectée !');

      // 4. Restaurer les données de session
      setSessionData({
        sessionId: lastSessionId,
        playMode: existingSession.playMode || null,
        musicSource: existingSession.musicSource || null,
        gameMode: existingSession.gameMode || null,
        players: [],
        playlist: [],
        playlistId: existingSession.playlistId || null,
        spotifyToken: sessionStorage.getItem('spotify_access_token')
      });

      // 5. Passer en mode partie active
      setFlowState(FLOW_STATES.ACTIVE_GAME);

    } catch (error) {
      console.error('❌ Erreur lors de la vérification de partie active:', error);
      setError('Erreur lors de la vérification de session');
      setFlowState(FLOW_STATES.MODE_SELECTION);
    } finally {
      setIsLoading(false);
    }
  };

  // ========== HANDLERS NAVIGATION ==========

  /**
   * Depuis StepModeSelection → StepPlayerConnection
   * Crée une nouvelle session avec le mode choisi
   */
  const handleModeSelected = async (selectedMode) => {
    try {
      setIsLoading(true);
      setError('');

      // Générer un sessionId unique
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      console.log('🆕 Création nouvelle session:', newSessionId, 'Mode:', selectedMode);

      // Créer la session dans Firebase
      const updates = {};
      updates[`sessions/${newSessionId}/sessionId`] = newSessionId;
      updates[`sessions/${newSessionId}/createdBy`] = user.uid;
      updates[`sessions/${newSessionId}/createdAt`] = Date.now();
      updates[`sessions/${newSessionId}/active`] = true;
      updates[`sessions/${newSessionId}/playMode`] = selectedMode;
      updates[`sessions/${newSessionId}/scores`] = { team1: 0, team2: 0 };
      updates[`sessions/${newSessionId}/chrono`] = 0;
      updates[`sessions/${newSessionId}/isPlaying`] = false;
      updates[`sessions/${newSessionId}/currentTrackNumber`] = 1;
      updates[`sessions/${newSessionId}/currentSong`] = null;
      updates[`sessions/${newSessionId}/game_status`] = { ended: false };
      updates[`sessions/${newSessionId}/showQRCode`] = false;

      await update(ref(database), updates);

      // Sauvegarder dans localStorage
      localStorage.setItem('lastSessionId', newSessionId);

      // Mettre à jour les données de session
      setSessionData(prev => ({
        ...prev,
        sessionId: newSessionId,
        playMode: selectedMode
      }));

      console.log('✅ Session créée avec succès');

      // Passer à l'étape suivante
      setFlowState(FLOW_STATES.PLAYER_CONNECTION);

    } catch (err) {
      console.error('❌ Erreur création session:', err);
      setError('Erreur lors de la création de la session');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Depuis StepPlayerConnection → StepReadyToStart
   * Quand joueurs connectés + musique configurée
   */
  const handleConnectionComplete = (musicSource, additionalData = {}) => {
    console.log('✅ Configuration connexion/musique complète');

    // Mettre à jour les données de session
    setSessionData(prev => ({
      ...prev,
      musicSource,
      gameMode: `${musicSource}-${prev.playMode}`,
      ...additionalData
    }));

    // Passer à l'étape suivante
    setFlowState(FLOW_STATES.READY);
  };

  /**
   * Depuis StepReadyToStart → Démarrage de la partie
   */
  const handleStartGame = async () => {
    try {
      setIsLoading(true);

      // Marquer la partie comme démarrée dans Firebase (si nécessaire)
      const sessionRef = ref(database, `sessions/${sessionData.sessionId}`);
      await update(sessionRef, {
        musicSource: sessionData.musicSource,
        gameMode: sessionData.gameMode,
        startedAt: Date.now()
      });

      console.log('🎮 Partie démarrée !');

      // Passer en mode partie active
      setFlowState(FLOW_STATES.GAME_PLAYING);

    } catch (err) {
      console.error('❌ Erreur démarrage partie:', err);
      setError('Erreur lors du démarrage de la partie');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Terminer la partie en cours et revenir à la sélection de mode
   */
  const handleEndGame = async () => {
    try {
      setIsLoading(true);

      if (sessionData.sessionId) {
        // Marquer la partie comme terminée dans Firebase
        const sessionRef = ref(database, `sessions/${sessionData.sessionId}`);
        await update(sessionRef, {
          active: false,
          'game_status/ended': true,
          endedAt: Date.now()
        });

        console.log('🏁 Partie terminée');
      }

      // Réinitialiser les données
      setSessionData({
        sessionId: null,
        playMode: null,
        musicSource: null,
        gameMode: null,
        players: [],
        playlist: [],
        playlistId: null,
        spotifyToken: null
      });

      // Retour à la sélection de mode
      setFlowState(FLOW_STATES.MODE_SELECTION);

    } catch (err) {
      console.error('❌ Erreur fin de partie:', err);
      setError('Erreur lors de la fin de partie');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== RENDU ==========

  // Écran de connexion si non authentifié
  if (!authChecked || !user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  // Écran de chargement
  if (flowState === FLOW_STATES.LOADING || isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <h2 style={{ fontSize: '1.5rem' }}>Chargement...</h2>
        </div>
      </div>
    );
  }

  // Affichage des erreurs
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #ef4444',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Erreur</h2>
          <p style={{ marginBottom: '1.5rem' }}>{error}</p>
          <button
            onClick={() => {
              setError('');
              setFlowState(FLOW_STATES.MODE_SELECTION);
            }}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ef4444',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  // Rendu selon l'état du flux
  switch (flowState) {
    case FLOW_STATES.MODE_SELECTION:
      return (
        <StepModeSelection
          onModeSelected={handleModeSelected}
          user={user}
        />
      );

    case FLOW_STATES.PLAYER_CONNECTION:
      return (
        <StepPlayerConnection
          sessionId={sessionData.sessionId}
          playMode={sessionData.playMode}
          onContinue={handleConnectionComplete}
          onBack={() => setFlowState(FLOW_STATES.MODE_SELECTION)}
        />
      );

    case FLOW_STATES.READY:
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem'
        }}>
          <h1>Étape 3: Prêt à démarrer</h1>
          <p>Mode: {sessionData.playMode}</p>
          <p>Musique: {sessionData.musicSource}</p>
          <button onClick={handleStartGame}>
            🎮 Démarrer la partie
          </button>
        </div>
      );

    case FLOW_STATES.ACTIVE_GAME:
    case FLOW_STATES.GAME_PLAYING:
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem'
        }}>
          <h1>🎮 PARTIE EN COURS</h1>
          <p>Session: {sessionData.sessionId}</p>
          <p>Mode: {sessionData.playMode}</p>
          <button
            onClick={handleEndGame}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ef4444',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              fontSize: '1rem',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            🏁 Terminer la partie
          </button>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', opacity: 0.7 }}>
            [TODO: Intégrer ActiveGameContainer ici]
          </p>
        </div>
      );

    default:
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          État inconnu: {flowState}
        </div>
      );
  }
}
