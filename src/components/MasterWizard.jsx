import React, { useState, useEffect } from 'react';
import { auth, database } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, set, update, onValue } from 'firebase/database';
import { spotifyService } from '../spotifyService';
import { n8nService } from '../n8nService';
import Login from './Login';

/**
 * Wizard modal pour configurer une session Master
 * Étapes :
 * 1. connections : Connexion Firebase + Spotify
 * 2. choice : NEW ou CONTINUER
 * 3. modes : Choix du mode (MP3 / Spotify Auto / Spotify IA) [si NEW]
 * 4. loading : Chargement/création de la playlist
 * 5. ready : Tout prêt, ferme le wizard et lance Master
 */
export default function MasterWizard({ onComplete }) {
  // États d'étapes
  const [step, setStep] = useState('connections'); // 'connections' | 'choice' | 'modes' | 'loading' | 'ready'

  // États de connexion
  const [user, setUser] = useState(null);
  const [spotifyToken, setSpotifyToken] = useState(null);

  // États de session
  const [sessionChoice, setSessionChoice] = useState(null); // 'new' | 'continue'
  const [lastSessionId, setLastSessionId] = useState(null);
  const [gameMode, setGameMode] = useState(null); // 'mp3' | 'spotify-auto' | 'spotify-ai'
  const [sessionId, setSessionId] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [playlistId, setPlaylistId] = useState(null);

  // États de chargement
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ========== ÉTAPE 1 : CONNEXIONS ==========

  // Écouter l'authentification Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Vérifier le token Spotify au chargement
  useEffect(() => {
    console.log('🔍 [WIZARD] useEffect chargement token');
    console.log('🔍 [WIZARD] sessionStorage keys:', Object.keys(sessionStorage));
    const token = sessionStorage.getItem('spotify_access_token');
    console.log('🔍 [WIZARD] Token lu depuis sessionStorage:', token ? token.substring(0, 20) + '...' : 'AUCUN');

    if (token) {
      console.log('✅ [WIZARD] setSpotifyToken appelé');
      setSpotifyToken(token);
    } else {
      console.log('❌ [WIZARD] Pas de token dans sessionStorage');
    }
  }, []);

  // Récupérer la dernière session depuis localStorage
  useEffect(() => {
    const storedSessionId = localStorage.getItem('lastSessionId');
    if (storedSessionId) {
      setLastSessionId(storedSessionId);
    }
  }, []);

  const handleSpotifyLogin = () => {
    // Marquer que le wizard est en cours pour le rouvrir après le callback
    localStorage.setItem('wizardInProgress', 'true');
    window.location.href = spotifyService.getAuthUrl();
  };

  const canProceedFromConnections = user && spotifyToken;

  // ========== ÉTAPE 2 : NEW OU CONTINUER ==========

  const handleNewSession = () => {
    setSessionChoice('new');
    setStep('modes');
  };

  const handleContinueSession = async () => {
    if (!lastSessionId) {
      setError('Aucune session précédente trouvée');
      return;
    }

    setSessionChoice('continue');
    setSessionId(lastSessionId);
    setStep('loading');

    // Charger la session depuis Firebase
    try {
      const sessionRef = ref(database, `sessions/${lastSessionId}`);
      onValue(sessionRef, (snapshot) => {
        const sessionData = snapshot.val();
        if (sessionData && sessionData.active !== false) {
          setGameMode(sessionData.gameMode || 'mp3');

          // Charger la playlist selon le mode
          if (sessionData.playlistId && spotifyToken) {
            loadSpotifyPlaylistById(sessionData.playlistId);
          }

          setStep('ready');
        } else {
          setError('Session expirée ou inactive');
          setStep('choice');
        }
      }, { onlyOnce: true });
    } catch (err) {
      console.error('Erreur chargement session:', err);
      setError('Impossible de charger la session');
      setStep('choice');
    }
  };

  // ========== ÉTAPE 3 : CHOIX DES MODES ==========

  const handleSelectMode = async (mode) => {
    setGameMode(mode);
    setStep('loading');

    // Créer une nouvelle session
    const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionId(newSessionId);

    try {
      // Créer la session dans Firebase
      const updates = {};
      updates[`sessions/${newSessionId}/createdBy`] = user.uid;
      updates[`sessions/${newSessionId}/createdAt`] = Date.now();
      updates[`sessions/${newSessionId}/active`] = true;
      updates[`sessions/${newSessionId}/gameMode`] = mode;
      updates[`sessions/${newSessionId}/scores`] = { team1: 0, team2: 0 };
      updates[`sessions/${newSessionId}/chrono`] = 0;
      updates[`sessions/${newSessionId}/isPlaying`] = false;
      updates[`sessions/${newSessionId}/currentSong`] = null;
      updates[`sessions/${newSessionId}/game_status`] = { ended: false };
      updates[`sessions/${newSessionId}/showQRCode`] = false;

      await update(ref(database), updates);
      localStorage.setItem('lastSessionId', newSessionId);

      // Selon le mode, charger/créer la playlist
      if (mode === 'spotify-ai') {
        await handleSpotifyAIMode(newSessionId);
      } else if (mode === 'spotify-auto') {
        await handleSpotifyAutoMode(newSessionId);
      } else {
        // Mode MP3 → Playlist vide, on passe direct à ready
        setStep('ready');
      }
    } catch (err) {
      console.error('Erreur création session:', err);
      setError('Erreur lors de la création de la session');
    }
  };

  // ========== ÉTAPE 4 : CHARGEMENT SELON MODE ==========

  const handleSpotifyAIMode = async (sessionId) => {
    setLoading(true);
    setError('');

    try {
      // Créer une playlist vide via n8n
      const result = await n8nService.createSpotifyPlaylistSimple(
        `BlindTest-${sessionId}`,
        `Playlist IA générée pour la session ${sessionId}`
      );

      if (result.success && result.playlistId) {
        // Extraire l'ID pur
        let extractedId = extractPlaylistId(result.playlistId);

        // Stocker dans Firebase
        await set(ref(database, `sessions/${sessionId}/playlistId`), extractedId);
        setPlaylistId(extractedId);

        // En mode IA, la playlist sera remplie par les joueurs
        // On passe en ready avec playlist vide
        setPlaylist([]);
        setStep('ready');
      } else {
        throw new Error('Playlist ID non reçu de n8n');
      }
    } catch (err) {
      console.error('Erreur création playlist IA:', err);
      setError(`Erreur création playlist IA: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSpotifyAutoMode = async (sessionId) => {
    // Pour Spotify Auto, on pourrait charger une playlist par défaut
    // ou laisser l'utilisateur choisir
    // Pour l'instant, on passe en ready et l'utilisateur chargera manuellement
    setStep('ready');
  };

  const loadSpotifyPlaylistById = async (playlistIdParam) => {
    if (!spotifyToken) return;

    try {
      const extractedId = extractPlaylistId(playlistIdParam);
      const tracks = await spotifyService.getPlaylistTracks(spotifyToken, extractedId);
      setPlaylist(tracks);
      setPlaylistId(extractedId);
    } catch (err) {
      console.error('Erreur chargement playlist:', err);
      setError('Erreur chargement playlist Spotify');
    }
  };

  // Utilitaire : extraire l'ID pur d'une playlist Spotify
  const extractPlaylistId = (id) => {
    let cleanId = id;

    // URI: spotify:playlist:ID
    if (cleanId.startsWith('spotify:playlist:')) {
      cleanId = cleanId.replace('spotify:playlist:', '');
    }

    // URL: https://open.spotify.com/playlist/ID
    if (cleanId.includes('open.spotify.com/playlist/')) {
      cleanId = cleanId.split('/playlist/')[1].split('?')[0];
    }

    return cleanId;
  };

  // ========== ÉTAPE 5 : READY - FERMER LE WIZARD ==========

  useEffect(() => {
    if (step === 'ready' && sessionId && gameMode) {
      // Appeler le callback parent pour lancer Master
      console.log('🎯 onComplete appelé avec:', {
        sessionId,
        gameMode,
        playlistId,
        playlist: playlist.length + ' morceaux',
        spotifyToken: spotifyToken ? spotifyToken.substring(0, 20) + '...' : 'UNDEFINED'
      });

      onComplete({
        sessionId,
        gameMode,
        playlistId,
        playlist,
        spotifyToken
      });
    }
  }, [step, sessionId, gameMode, playlistId, playlist, spotifyToken, onComplete]);

  // ========== RENDU DES ÉTAPES ==========

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: '#1f2937',
        borderRadius: '1rem',
        padding: '2rem',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        color: 'white'
      }}>
        {/* ÉTAPE 1 : CONNEXIONS */}
        {step === 'connections' && (
          <>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              🎮 Configuration Animateur
            </h2>

            {/* Connexion Firebase */}
            <div style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              marginBottom: '1rem',
              border: user ? '2px solid #10b981' : '2px solid #3b82f6'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '2rem' }}>{user ? '✅' : '🔐'}</div>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Connexion Firebase</h3>
              </div>
              {!user ? (
                <Login onLoginSuccess={() => {}} />
              ) : (
                <p style={{ margin: 0, opacity: 0.9 }}>
                  Connecté en tant que <strong>{user.email}</strong>
                </p>
              )}
            </div>

            {/* Connexion Spotify */}
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              marginBottom: '2rem',
              border: spotifyToken ? '2px solid #10b981' : '2px solid #10b981'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '2rem' }}>{spotifyToken ? '✅' : '🎵'}</div>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Connexion Spotify</h3>
              </div>
              {!spotifyToken ? (
                <button
                  onClick={handleSpotifyLogin}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: '#10b981',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}
                >
                  Se connecter à Spotify
                </button>
              ) : (
                <p style={{ margin: 0, opacity: 0.9 }}>
                  ✅ Connecté à Spotify
                </p>
              )}
            </div>

            {/* Bouton Suivant */}
            <button
              onClick={() => setStep('choice')}
              disabled={!canProceedFromConnections}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: canProceedFromConnections ? '#7c3aed' : '#6b7280',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: canProceedFromConnections ? 'pointer' : 'not-allowed',
                fontSize: '1.1rem',
                fontWeight: '600',
                opacity: canProceedFromConnections ? 1 : 0.5
              }}
            >
              Suivant →
            </button>

            {!canProceedFromConnections && (
              <p style={{ textAlign: 'center', marginTop: '1rem', opacity: 0.7, fontSize: '0.875rem' }}>
                Connectez-vous à Firebase et Spotify pour continuer
              </p>
            )}
          </>
        )}

        {/* ÉTAPE 2 : NEW OU CONTINUER */}
        {step === 'choice' && (
          <>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              🎮 Nouvelle partie ou Continuer ?
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Nouvelle Partie */}
              <button
                onClick={handleNewSession}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(124, 58, 237, 0.3)',
                  border: '2px solid #7c3aed',
                  borderRadius: '0.75rem',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Nouvelle Partie
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  Créer une nouvelle session avec un nouveau code
                </div>
              </button>

              {/* Continuer */}
              {lastSessionId && (
                <button
                  onClick={handleContinueSession}
                  style={{
                    padding: '1.5rem',
                    backgroundColor: 'rgba(16, 185, 129, 0.3)',
                    border: '2px solid #10b981',
                    borderRadius: '0.75rem',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔄</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Continuer la dernière
                  </div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                    Session : {lastSessionId}
                  </div>
                </button>
              )}
            </div>

            {error && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                borderRadius: '0.5rem',
                color: '#ef4444'
              }}>
                {error}
              </div>
            )}
          </>
        )}

        {/* ÉTAPE 3 : CHOIX DES MODES */}
        {step === 'modes' && (
          <>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', textAlign: 'center' }}>
              🎮 Choisissez le mode de jeu
            </h2>
            <p style={{ textAlign: 'center', opacity: 0.8, marginBottom: '2rem', fontSize: '0.95rem' }}>
              Comment souhaitez-vous créer votre playlist ?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Mode MP3 */}
              <button
                onClick={() => handleSelectMode('mp3')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(124, 58, 237, 0.2)',
                  border: '2px solid rgba(124, 58, 237, 0.5)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.3)';
                  e.currentTarget.style.borderColor = '#7c3aed';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.5)';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Mode MP3
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Chargez vos propres fichiers MP3 manuellement
                </div>
              </button>

              {/* Mode Spotify Autonome */}
              <button
                onClick={() => handleSelectMode('spotify-auto')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  border: '2px solid rgba(16, 185, 129, 0.5)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
                  e.currentTarget.style.borderColor = '#10b981';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎵</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Mode Spotify - Autonome
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Importez une de vos playlists Spotify existantes
                </div>
              </button>

              {/* Mode Spotify IA */}
              <button
                onClick={() => handleSelectMode('spotify-ai')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(236, 72, 153, 0.2)',
                  border: '2px solid rgba(236, 72, 153, 0.5)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(236, 72, 153, 0.3)';
                  e.currentTarget.style.borderColor = '#ec4899';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(236, 72, 153, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.5)';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤖</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Mode Spotify - IA
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Playlist générée automatiquement par IA selon les préférences des joueurs
                </div>
              </button>
            </div>

            {/* Bouton Retour */}
            <button
              onClick={() => setStep('choice')}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'rgba(156, 163, 175, 0.3)',
                border: '1px solid #9ca3af',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                marginTop: '1rem'
              }}
            >
              ← Retour
            </button>
          </>
        )}

        {/* ÉTAPE 4 : CHARGEMENT */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              {gameMode === 'spotify-ai' ? 'Création de la playlist IA...' :
               gameMode === 'spotify-auto' ? 'Chargement de la playlist...' :
               'Préparation...'}
            </h2>
            {loading && (
              <p style={{ opacity: 0.8 }}>Veuillez patienter...</p>
            )}
            {error && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                borderRadius: '0.5rem',
                color: '#ef4444'
              }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
