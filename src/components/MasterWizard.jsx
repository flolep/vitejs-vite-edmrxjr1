import React, { useState, useEffect } from 'react';
import { auth, database } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, set, update, onValue } from 'firebase/database';
import { spotifyService } from '../spotifyService';
import { n8nService } from '../n8nService';
import { prepareNewSession } from '../utils/sessionCleanup';
import { useSpotifyTokenRefresh } from '../hooks/useSpotifyTokenRefresh';
import Login from './Login';

/**
 * Wizard modal pour configurer une session Master
 * Étapes :
 * 1. connections : Connexion Firebase + Spotify
 * 2. choice : NEW ou CONTINUER
 * 3. source : Choix de la source de musique (MP3 / Spotify Auto / Spotify IA) [si NEW]
 * 4. gamemode : Choix du mode de jeu (Équipe / Quiz) [seulement si Spotify-IA]
 * 5. loading : Chargement/création de la playlist
 * 6. ready : Tout prêt, ferme le wizard et lance Master
 */
export default function MasterWizard({ onComplete }) {
  // États d'étapes
  const [step, setStep] = useState('connections'); // 'connections' | 'choice' | 'source' | 'gamemode' | 'loading' | 'ready'

  // États de connexion
  const [user, setUser] = useState(null);
  const [checkingSpotify, setCheckingSpotify] = useState(true);
  const [initialToken, setInitialToken] = useState(null);

  // Hook de rafraîchissement automatique du token Spotify
  const { token: spotifyToken, isRefreshing: tokenRefreshing, error: tokenError } = useSpotifyTokenRefresh(
    initialToken,
    (newToken) => {
      console.log('🔄 Token Spotify rafraîchi automatiquement dans Wizard');
    }
  );

  // États de session
  const [sessionChoice, setSessionChoice] = useState(null); // 'new' | 'continue'
  const [lastSessionId, setLastSessionId] = useState(null);
  const [musicSource, setMusicSource] = useState(null); // 'mp3' | 'spotify-auto' | 'spotify-ai'
  const [playMode, setPlayMode] = useState(null); // 'team' | 'quiz'
  const [gameMode, setGameMode] = useState(null); // Combinaison finale (ex: 'mp3-team', 'spotify-ai-quiz')
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
    setCheckingSpotify(true);

    const token = sessionStorage.getItem('spotify_access_token');
    const tokenExpiry = sessionStorage.getItem('spotify_token_expiry');

    console.log('🔍 [WIZARD] Token lu depuis sessionStorage:', token ? token.substring(0, 20) + '...' : 'AUCUN');

    if (token) {
      // Vérifier si le token est expiré
      const now = Date.now();
      const expiry = tokenExpiry ? parseInt(tokenExpiry) : 0;

      if (expiry > now) {
        console.log('✅ [WIZARD] Token Spotify valide trouvé');
        const remainingMinutes = Math.floor((expiry - now) / 1000 / 60);
        console.log(`✅ [WIZARD] Token valide encore ${remainingMinutes} minutes`);
        setInitialToken(token);
      } else {
        console.log('⚠️ [WIZARD] Token Spotify expiré, nettoyage...');
        sessionStorage.removeItem('spotify_access_token');
        sessionStorage.removeItem('spotify_token_expiry');
      }
    } else {
      console.log('❌ [WIZARD] Pas de token dans sessionStorage');
    }

    setCheckingSpotify(false);
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

  // Passer automatiquement à l'étape suivante si déjà connecté
  useEffect(() => {
    if (step === 'connections' && user && spotifyToken) {
      console.log('✅ [WIZARD] Connexions déjà établies, passage automatique à l\'étape choix');
      setStep('choice');
    }
  }, [step, user, spotifyToken]);

  // ========== ÉTAPE 2 : NEW OU CONTINUER ==========

  const handleNewSession = () => {
    setSessionChoice('new');
    setStep('source');
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
          // Charger le mode de jeu (ancien format ou nouveau)
          const legacyMode = sessionData.gameMode; // 'mp3', 'spotify-auto', 'spotify-ai'
          setMusicSource(sessionData.musicSource || legacyMode || 'mp3');
          setPlayMode(sessionData.playMode || 'team');
          setGameMode(`${sessionData.musicSource || legacyMode}-${sessionData.playMode || 'team'}`);

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

  // ========== ÉTAPE 3 : CHOIX DE LA SOURCE ==========

  const handleSelectSource = async (source) => {
    setMusicSource(source);

    // Si MP3 ou Spotify-auto, forcer le mode Équipe et passer directement au loading
    if (source === 'mp3' || source === 'spotify-auto') {
      setPlayMode('team');
      setGameMode(`${source}-team`);
      await createSession(source, 'team');
    } else {
      // Si Spotify-IA, demander le mode de jeu
      setStep('gamemode');
    }
  };

  // ========== ÉTAPE 4 : CHOIX DU MODE DE JEU ==========

  const handleSelectPlayMode = async (mode) => {
    setPlayMode(mode);
    setGameMode(`${musicSource}-${mode}`);
    await createSession(musicSource, mode);
  };

  // ========== CRÉATION DE SESSION ==========

  const createSession = async (source, playModeParam) => {
    setStep('loading');

    // Nettoyer l'ancienne session si elle existe
    if (lastSessionId) {
      await prepareNewSession(lastSessionId, false);
    }

    // Créer une nouvelle session
    const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setSessionId(newSessionId);

    try {
      // Créer la session dans Firebase
      const updates = {};
      updates[`sessions/${newSessionId}/createdBy`] = user.uid;
      updates[`sessions/${newSessionId}/createdAt`] = Date.now();
      updates[`sessions/${newSessionId}/active`] = true;
      updates[`sessions/${newSessionId}/musicSource`] = source; // Source de musique
      updates[`sessions/${newSessionId}/playMode`] = playModeParam; // Mode de jeu
      updates[`sessions/${newSessionId}/gameMode`] = `${source}-${playModeParam}`; // Mode combiné (rétrocompatibilité)
      updates[`sessions/${newSessionId}/scores`] = { team1: 0, team2: 0 };
      updates[`sessions/${newSessionId}/chrono`] = 0;
      updates[`sessions/${newSessionId}/isPlaying`] = false;
      updates[`sessions/${newSessionId}/currentSong`] = null;
      updates[`sessions/${newSessionId}/game_status`] = { ended: false };
      updates[`sessions/${newSessionId}/showQRCode`] = false;

      await update(ref(database), updates);
      localStorage.setItem('lastSessionId', newSessionId);

      console.log(`✅ Nouvelle session ${newSessionId} créée avec succès`);

      // Selon la source, charger/créer la playlist
      if (source === 'spotify-ai') {
        await handleSpotifyAIMode(newSessionId);
      } else if (source === 'spotify-auto') {
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
      // 🔥 SOLUTION: Écouter Firebase en parallèle pour détecter la playlist
      let firebaseListenerActive = true;
      let playlistDetectedFromFirebase = false;

      // Promesse qui écoute Firebase pour détecter la création de playlist
      const firebaseListener = new Promise((resolve, reject) => {
        const playlistRef = ref(database, `sessions/${sessionId}/playlistId`);

        const unsubscribe = onValue(playlistRef, (snapshot) => {
          if (!firebaseListenerActive) return;

          const playlistId = snapshot.val();
          if (playlistId) {
            console.log('✅ Playlist détectée dans Firebase:', playlistId);
            playlistDetectedFromFirebase = true;
            unsubscribe();
            resolve({ success: true, playlistId, source: 'firebase' });
          }
        }, (error) => {
          console.error('❌ Erreur écoute Firebase:', error);
          unsubscribe();
          reject(error);
        });

        // Timeout de 30 secondes
        setTimeout(() => {
          if (firebaseListenerActive && !playlistDetectedFromFirebase) {
            unsubscribe();
            reject(new Error('Timeout: Playlist non détectée après 30s'));
          }
        }, 30000);
      });

      // Promesse pour l'appel n8n
      const n8nPromise = n8nService.createSpotifyPlaylistSimple(
        `BlindTest-${sessionId}`,
        `Playlist IA générée pour la session ${sessionId}`
      ).then(result => {
        console.log('✅ Réponse n8n reçue:', result);
        return { ...result, source: 'n8n' };
      });

      // Attendre la première réponse (n8n OU Firebase)
      console.log('⏳ Attente de la création de playlist (n8n ou Firebase)...');
      const result = await Promise.race([n8nPromise, firebaseListener]);

      // Stopper l'écoute Firebase si elle est encore active
      firebaseListenerActive = false;

      console.log('🔍 Playlist reçue depuis:', result.source);
      console.log('🔍 Structure complète de la réponse:', JSON.stringify(result, null, 2));

      if (result.success && result.playlistId) {
        // Extraire l'ID pur
        let extractedId = extractPlaylistId(result.playlistId);

        // Stocker dans Firebase si pas déjà fait
        if (result.source !== 'firebase') {
          await set(ref(database, `sessions/${sessionId}/playlistId`), extractedId);
        }
        setPlaylistId(extractedId);

        // En mode IA, la playlist sera remplie par les joueurs
        // On passe en ready avec playlist vide
        setPlaylist([]);
        setStep('ready');
      } else {
        throw new Error('Playlist ID non reçu');
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
        musicSource,
        playMode,
        gameMode,
        playlistId,
        playlist: playlist.length + ' morceaux',
        spotifyToken: spotifyToken ? spotifyToken.substring(0, 20) + '...' : 'UNDEFINED'
      });

      onComplete({
        sessionId,
        musicSource,
        playMode,
        gameMode,
        playlistId,
        playlist,
        spotifyToken
      });
    }
  }, [step, sessionId, musicSource, playMode, gameMode, playlistId, playlist, spotifyToken, onComplete]);

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
                <div style={{ fontSize: '2rem' }}>
                  {checkingSpotify ? '⏳' : spotifyToken ? '✅' : '🎵'}
                </div>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Connexion Spotify</h3>
              </div>
              {checkingSpotify ? (
                <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>
                  🔍 Vérification de la connexion existante...
                </p>
              ) : !spotifyToken ? (
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

        {/* ÉTAPE 3 : CHOIX DE LA SOURCE */}
        {step === 'source' && (
          <>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', textAlign: 'center' }}>
              🎵 Source de musique
            </h2>
            <p style={{ textAlign: 'center', opacity: 0.8, marginBottom: '2rem', fontSize: '0.95rem' }}>
              Comment souhaitez-vous charger votre playlist ?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Source MP3 */}
              <button
                onClick={() => handleSelectSource('mp3')}
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
                  MP3 Local
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Chargez vos propres fichiers MP3 manuellement • Mode Équipe uniquement
                </div>
              </button>

              {/* Source Spotify Autonome */}
              <button
                onClick={() => handleSelectSource('spotify-auto')}
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
                  Spotify Autonome
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Importez une de vos playlists Spotify • Mode Équipe uniquement
                </div>
              </button>

              {/* Source Spotify IA */}
              <button
                onClick={() => handleSelectSource('spotify-ai')}
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
                  Spotify IA
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Playlist générée par IA • Compatible Équipe ET Quiz
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

        {/* ÉTAPE 4 : CHOIX DU MODE DE JEU (Spotify-IA uniquement) */}
        {step === 'gamemode' && (
          <>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', textAlign: 'center' }}>
              🎮 Mode de jeu
            </h2>
            <p style={{ textAlign: 'center', opacity: 0.8, marginBottom: '2rem', fontSize: '0.95rem' }}>
              Comment souhaitez-vous jouer ?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Mode Équipe */}
              <button
                onClick={() => handleSelectPlayMode('team')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  border: '2px solid rgba(59, 130, 246, 0.5)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Mode Équipe
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  Buzzer par équipe • Scoring par rapidité • Bonus personnel
                </div>
              </button>

              {/* Mode Quiz */}
              <button
                onClick={() => handleSelectPlayMode('quiz')}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(251, 191, 36, 0.2)',
                  border: '2px solid rgba(251, 191, 36, 0.5)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(251, 191, 36, 0.3)';
                  e.currentTarget.style.borderColor = '#fbbf24';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(251, 191, 36, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.5)';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Mode Quiz
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                  QCM avec 4 réponses • Classement individuel temps réel
                </div>
              </button>
            </div>

            {/* Bouton Retour */}
            <button
              onClick={() => setStep('source')}
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

        {/* ÉTAPE 5 : CHARGEMENT */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              {musicSource === 'spotify-ai' ? 'Création de la playlist IA...' :
               musicSource === 'spotify-auto' ? 'Chargement de la playlist...' :
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
