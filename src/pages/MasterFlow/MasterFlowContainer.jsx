import React, { useState, useEffect } from 'react';
import { auth, database } from '../../firebase';
import { ref, get, set, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import Login from '../../components/Login';
import { getValidSpotifyToken } from '../../utils/spotifyUtils';

// Import des étapes
import StepModeSelection from './steps/StepModeSelection';
import StepPlayerConnection from './steps/StepPlayerConnection';
import StepReadyToStart from './steps/StepReadyToStart';

// Import de l'interface de partie active
import ActiveGameContainer from './ActiveGame/ActiveGameContainer';

/**
 * États du flux Master
 */
const FLOW_STATES = {
  LOADING: 'loading',                  // Chargement initial + vérification partie en cours
  MODE_SELECTION: 'mode_selection',    // Étape 1: Choix Mode Équipe ou Quiz (ou reprise partie)
  PLAYER_CONNECTION: 'player_connection', // Étape 2: Connexion joueurs + config musique
  READY: 'ready',                      // Étape 3: Prêt à démarrer
  GAME_PLAYING: 'game_playing'         // Partie en cours (nouvelle ou reprise)
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

  // Détecter les changements de flowState
  useEffect(() => {
    console.log('🔄 [MasterFlowContainer] flowState changé vers:', flowState);
  }, [flowState]);

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

  // Détecter les changements de sessionData
  useEffect(() => {
    console.log('📊 [MasterFlowContainer] sessionData changé:', {
      sessionId: sessionData.sessionId,
      playMode: sessionData.playMode,
      musicSource: sessionData.musicSource
    });
  }, [sessionData]);

  // Partie active détectée (si elle existe)
  const [activeGame, setActiveGame] = useState(null);

  // État de chargement/erreur
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // ========== AUTHENTIFICATION ==========

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);

      // Une fois authentifié, vérifier si on revient de Spotify OAuth
      if (currentUser) {
        const pendingSessionId = localStorage.getItem('pendingSessionId');

        if (pendingSessionId) {
          // Retour de Spotify OAuth, restaurer l'état
          console.log('🔄 Retour de Spotify OAuth, restauration session:', pendingSessionId);

          // Récupérer le playMode depuis Firebase
          const sessionRef = ref(database, `sessions/${pendingSessionId}`);
          get(sessionRef).then((snapshot) => {
            const sessionData = snapshot.val();

            if (sessionData) {
              // Restaurer les données de session
              setSessionData({
                sessionId: pendingSessionId,
                playMode: sessionData.playMode,
                musicSource: null,
                gameMode: null,
                players: [],
                playlist: [],
                playlistId: null,
                spotifyToken: getValidSpotifyToken()
              });

              // Retour à l'étape de configuration musicale
              setFlowState(FLOW_STATES.PLAYER_CONNECTION);
            } else {
              // Session n'existe plus, recommencer
              setFlowState(FLOW_STATES.MODE_SELECTION);
            }

            // Nettoyer le flag
            localStorage.removeItem('pendingSessionId');
          });
        } else {
          // Pas de retour Spotify, vérifier si une partie est en cours
          checkForActiveGame();
        }
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

      // 4. Stocker les infos de la partie active
      setActiveGame({
        sessionId: lastSessionId,
        playMode: existingSession.playMode || null,
        musicSource: existingSession.musicSource || null,
        gameMode: existingSession.gameMode || null,
        playlistId: existingSession.playlistId || null,
        spotifyToken: getValidSpotifyToken()
      });

      // 5. Aller à la sélection de mode (qui affichera l'option de reprendre la partie)
      setFlowState(FLOW_STATES.MODE_SELECTION);

    } catch (error) {
      // Log de l'erreur en console mais pas de message à l'utilisateur
      // C'est normal de ne pas avoir de partie en cours
      console.error('❌ Erreur lors de la vérification de partie active:', error);
      setFlowState(FLOW_STATES.MODE_SELECTION);
    } finally {
      setIsLoading(false);
    }
  };

  // ========== HANDLERS NAVIGATION ==========

  /**
   * Depuis StepModeSelection → Rejoindre la partie en cours
   */
  const handleResumeGame = async () => {
    if (!activeGame) return;

    try {
      setIsLoading(true);
      console.log('▶️ Reprise de la partie en cours:', activeGame.sessionId);

      // Charger la playlist depuis Firebase
      const playlistRef = ref(database, `sessions/${activeGame.sessionId}/playlist`);
      const playlistSnapshot = await get(playlistRef);
      const savedPlaylist = playlistSnapshot.val() || [];

      console.log('📋 Playlist restaurée depuis Firebase:', savedPlaylist.length, 'chansons');
      console.log('📋 Type de savedPlaylist:', typeof savedPlaylist, Array.isArray(savedPlaylist));
      console.log('📋 Première chanson:', savedPlaylist[0]);

      // Restaurer les données de session avec la playlist
      setSessionData({
        sessionId: activeGame.sessionId,
        playMode: activeGame.playMode,
        musicSource: activeGame.musicSource,
        gameMode: activeGame.gameMode,
        players: [],
        playlist: savedPlaylist,
        playlistId: activeGame.playlistId,
        spotifyToken: activeGame.spotifyToken
      });

      // Réinitialiser activeGame pour éviter de l'afficher à nouveau
      setActiveGame(null);

      // Aller directement à la partie active
      setFlowState(FLOW_STATES.GAME_PLAYING);

    } catch (error) {
      console.error('❌ Erreur lors de la reprise de la partie:', error);
      setError('Erreur lors de la reprise de la partie');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Depuis StepModeSelection → StepPlayerConnection
   * Crée une nouvelle session avec le mode choisi
   */
  const handleModeSelected = async (selectedMode) => {
    try {
      setIsLoading(true);
      setError('');

      // Générer un sessionId unique (6 caractères alphanumériques en majuscules)
      const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();

      console.log('🆕 Création nouvelle session:', newSessionId, 'Mode:', selectedMode);

      // Réinitialiser la partie active (on crée une nouvelle partie)
      setActiveGame(null);

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
   * @param {Array} playlistData - Playlist générée par StepReadyToStart
   */
  const handleStartGame = async (playlistData = []) => {
    console.log('🎬 [MasterFlowContainer] handleStartGame début, playlist:', playlistData?.length || 0, 'chansons');
    try {
      // Stocker la playlist dans sessionData pour éviter de la recharger depuis Firebase
      setSessionData(prev => ({
        ...prev,
        playlist: playlistData
      }));

      // Marquer la partie comme démarrée dans Firebase (si nécessaire)
      const sessionRef = ref(database, `sessions/${sessionData.sessionId}`);
      await update(sessionRef, {
        musicSource: sessionData.musicSource,
        gameMode: sessionData.gameMode,
        startedAt: Date.now()
      });

      console.log('🎮 [MasterFlowContainer] Partie démarrée, passage à GAME_PLAYING');

      // Passer en mode partie active
      setFlowState(FLOW_STATES.GAME_PLAYING);

    } catch (err) {
      console.error('❌ Erreur démarrage partie:', err);
      setError('Erreur lors du démarrage de la partie');
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

  console.log('🎨 [MasterFlowContainer] Rendu avec:', { flowState, isLoading, hasError: !!error });

  // Écran de connexion si non authentifié
  if (!authChecked || !user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  // Écran de chargement
  if (flowState === FLOW_STATES.LOADING || isLoading) {
    console.log('⏳ [MasterFlowContainer] Affichage écran de chargement');
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
      console.log('📱 [MasterFlowContainer] Rendu: StepModeSelection');
      return (
        <StepModeSelection
          onModeSelected={handleModeSelected}
          onResumeGame={handleResumeGame}
          activeGame={activeGame}
          user={user}
        />
      );

    case FLOW_STATES.PLAYER_CONNECTION:
      console.log('👥 [MasterFlowContainer] Rendu: StepPlayerConnection');
      return (
        <StepPlayerConnection
          sessionId={sessionData.sessionId}
          playMode={sessionData.playMode}
          onContinue={handleConnectionComplete}
          onBack={() => setFlowState(FLOW_STATES.MODE_SELECTION)}
        />
      );

    case FLOW_STATES.READY:
      console.log('✅ [MasterFlowContainer] Rendu: StepReadyToStart');
      return (
        <StepReadyToStart
          sessionId={sessionData.sessionId}
          sessionData={sessionData}
          onStartGame={handleStartGame}
          onBack={() => setFlowState(FLOW_STATES.PLAYER_CONNECTION)}
        />
      );

    case FLOW_STATES.GAME_PLAYING:
      console.log('🎮 [MasterFlowContainer] Rendu: ActiveGameContainer');
      return (
        <ActiveGameContainer
          sessionId={sessionData.sessionId}
          sessionData={sessionData}
          onEndGame={handleEndGame}
        />
      );

    default:
      console.log('❓ [MasterFlowContainer] Rendu: État inconnu');
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
