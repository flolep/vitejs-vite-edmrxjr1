import React, { useState, useEffect } from 'react';
import { auth, database } from '../../firebase';
import { ref, get, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import Login from '../../components/Login';
import { hasRefreshToken } from '../../utils/spotifyUtils';
import { useSpotifyToken } from '../../contexts/SpotifyTokenContext';

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
  // Token Spotify centralisé via contexte
  const { spotifyToken: contextSpotifyToken, refreshToken: contextRefreshToken } = useSpotifyToken();

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
                spotifyToken: contextSpotifyToken
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

      const lastSessionId = localStorage.getItem('lastSessionId');

      if (!lastSessionId) {
        console.log('[Resume] Aucune session précédente trouvée');
        setFlowState(FLOW_STATES.MODE_SELECTION);
        return;
      }

      console.log('[Resume] Vérification de la session:', lastSessionId);

      const sessionRef = ref(database, `sessions/${lastSessionId}`);
      const snapshot = await get(sessionRef);
      const existingSession = snapshot.val();

      if (!existingSession) {
        console.log('[Resume] Session inexistante dans Firebase');
        setFlowState(FLOW_STATES.MODE_SELECTION);
        return;
      }

      // Critères stricts : active, non terminée, démarrée, avec playlist
      const isResumable = existingSession.active === true
        && existingSession.game_status?.ended !== true
        && existingSession.startedAt != null
        && existingSession.playlistId != null;

      if (!isResumable) {
        console.log('[Resume] Session trouvée mais non reprendable:', {
          active: existingSession.active,
          ended: existingSession.game_status?.ended,
          startedAt: existingSession.startedAt,
          playlistId: existingSession.playlistId
        });
        setFlowState(FLOW_STATES.MODE_SELECTION);
        return;
      }

      console.log('[Resume] Partie reprendable détectée !');

      // Dériver musicSource depuis gameMode si manquant
      let derivedMusicSource = existingSession.musicSource;
      if (!derivedMusicSource && existingSession.gameMode) {
        if (existingSession.gameMode.startsWith('spotify-auto')) derivedMusicSource = 'spotify-auto';
        else if (existingSession.gameMode.startsWith('spotify-ai')) derivedMusicSource = 'spotify-ai';
        else if (existingSession.gameMode.startsWith('mp3')) derivedMusicSource = 'mp3';
      }

      setActiveGame({
        sessionId: lastSessionId,
        playMode: existingSession.playMode || null,
        musicSource: derivedMusicSource || null,
        gameMode: existingSession.gameMode || null,
        playlistId: existingSession.playlistId || null,
        spotifyToken: contextSpotifyToken,
        canRefresh: hasRefreshToken()
      });

      setFlowState(FLOW_STATES.MODE_SELECTION);

    } catch (error) {
      console.error('[Resume] Erreur vérification partie active:', error);
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

    console.log('[Resume] Reprise de la partie:', activeGame.sessionId);
    setIsLoading(true);

    try {
      // 1. Résoudre le token Spotify via le contexte
      let spotifyToken = contextSpotifyToken;
      const isSpotifyMode = activeGame.musicSource === 'spotify-ai' || activeGame.musicSource === 'spotify-auto';

      if (isSpotifyMode && !spotifyToken) {
        console.log('[Resume] Token expiré, refresh via contexte...');
        const refreshed = await contextRefreshToken();
        if (refreshed) {
          spotifyToken = refreshed;
          console.log('[Resume] Token rafraîchi via contexte');
        } else {
          console.warn('[Resume] Refresh échoué, Spotify ne sera pas disponible');
        }
      }

      // 2. Recharger les joueurs connectés depuis Firebase
      let players = [];
      try {
        const team1Snap = await get(ref(database, `sessions/${activeGame.sessionId}/players_session/team1`));
        const team2Snap = await get(ref(database, `sessions/${activeGame.sessionId}/players_session/team2`));

        const parseTeam = (snapshot, teamName) => {
          const data = snapshot.val();
          if (!data) return [];
          return Object.entries(data)
            .filter(([, player]) => player.connected)
            .map(([key, player]) => ({
              id: player.id || key,
              name: player.name,
              photo: player.photo,
              team: teamName
            }));
        };

        players = [
          ...parseTeam(team1Snap, 'team1'),
          ...parseTeam(team2Snap, 'team2')
        ];
        console.log('[Resume] Joueurs rechargés:', players.length);
      } catch (err) {
        console.error('[Resume] Erreur rechargement joueurs:', err);
      }

      // 3. Restaurer les données de session et lancer la partie
      setSessionData({
        sessionId: activeGame.sessionId,
        playMode: activeGame.playMode,
        musicSource: activeGame.musicSource,
        gameMode: activeGame.gameMode,
        players,
        playlist: [],
        playlistId: activeGame.playlistId,
        spotifyToken
      });

      setActiveGame(null);
      setFlowState(FLOW_STATES.GAME_PLAYING);

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

      console.log('🆕 Nouvelle session (pré-création):', newSessionId, 'Mode:', selectedMode);

      // Réinitialiser la partie active (on crée une nouvelle partie)
      setActiveGame(null);

      // Créer un noeud minimal dans Firebase (active: true pour que les joueurs
      // puissent écrire dans players_session via QR code — les règles Firebase
      // exigent active === true). Pas de startedAt ni playlistId, donc
      // checkForActiveGame() ne la détectera PAS comme partie reprendable.
      const updates = {};
      updates[`sessions/${newSessionId}/sessionId`] = newSessionId;
      updates[`sessions/${newSessionId}/createdBy`] = user.uid;
      updates[`sessions/${newSessionId}/active`] = true;
      updates[`sessions/${newSessionId}/playMode`] = selectedMode;

      await update(ref(database), updates);

      // Stocker le mode et sessionId en mémoire — pas de localStorage.lastSessionId
      // pour éviter qu'une session non démarrée soit détectée comme "partie en cours"
      setSessionData(prev => ({
        ...prev,
        sessionId: newSessionId,
        playMode: selectedMode
      }));

      console.log('✅ Session pré-créée (active: false)');

      // Passer à l'étape suivante
      setFlowState(FLOW_STATES.PLAYER_CONNECTION);

    } catch (err) {
      console.error('❌ Erreur pré-création session:', err);
      setError('Erreur lors de la création de la session');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Depuis StepPlayerConnection → StepReadyToStart
   * Quand joueurs connectés + musique configurée
   */
  const handleConnectionComplete = async (musicSource, additionalData = {}) => {
    console.log('✅ Configuration connexion/musique complète');

    const gameMode = `${musicSource}-${sessionData.playMode}`;

    // Stocker en mémoire — sera persisté dans Firebase par handleStartGame()
    setSessionData(prev => ({
      ...prev,
      musicSource,
      gameMode,
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
      // Créer la session complète dans Firebase maintenant que tout est configuré
      const sid = sessionData.sessionId;
      const updates = {};
      updates[`sessions/${sid}/sessionId`] = sid;
      updates[`sessions/${sid}/createdBy`] = user.uid;
      updates[`sessions/${sid}/createdAt`] = Date.now();
      updates[`sessions/${sid}/active`] = true;
      updates[`sessions/${sid}/playMode`] = sessionData.playMode;
      updates[`sessions/${sid}/musicSource`] = sessionData.musicSource;
      updates[`sessions/${sid}/gameMode`] = sessionData.gameMode;
      updates[`sessions/${sid}/scores`] = { team1: 0, team2: 0 };
      updates[`sessions/${sid}/chrono`] = 0;
      updates[`sessions/${sid}/isPlaying`] = false;
      updates[`sessions/${sid}/currentTrackNumber`] = 1;
      updates[`sessions/${sid}/currentSong`] = null;
      updates[`sessions/${sid}/game_status`] = { ended: false };
      updates[`sessions/${sid}/showQRCode`] = false;
      updates[`sessions/${sid}/startedAt`] = Date.now();

      await update(ref(database), updates);
      localStorage.setItem('lastSessionId', sid);

      console.log('✅ Session Firebase créée (active: true)');

      // Stocker la playlist dans sessionData
      setSessionData(prev => ({
        ...prev,
        playlist: playlistData
      }));

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
