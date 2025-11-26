import React, { useState, useEffect } from 'react';
import { database } from '../../../firebase';
import { ref, onValue, update } from 'firebase/database';
import { spotifyService } from '../../../spotifyService';
import { getSessionCode } from '../../../utils/sessionUtils';
import PlayerConnectionPanel from './PlayerConnectionPanel';
import MusicConfigPanel from './MusicConfigPanel';

/**
 * Étape 2: Connexion des joueurs + Configuration musicale
 *
 * Affiche côte à côte:
 * - Gauche: QR Code + Liste des joueurs connectés
 * - Droite: Choix de la source musicale (MP3, Spotify Auto, Spotify IA)
 *
 * L'utilisateur peut continuer quand:
 * - Au moins 1 joueur est connecté
 * - Une source musicale est configurée
 */
export default function StepPlayerConnection({
  sessionId,
  playMode,
  onContinue,
  onBack
}) {
  // État des joueurs connectés
  const [players, setPlayers] = useState([]);

  // État de la configuration musicale
  const [musicSource, setMusicSource] = useState(null);
  const [musicConfig, setMusicConfig] = useState(null);

  // État Spotify
  const [spotifyToken, setSpotifyToken] = useState(null);

  // ========== SYNCHRONISATION JOUEURS ==========

  useEffect(() => {
    if (!sessionId) return;

    // Écouter les joueurs connectés dans Firebase
    // Les joueurs peuvent être dans team1 ou team2 (mode Team) ou team1 (mode Quiz)
    const team1Ref = ref(database, `sessions/${sessionId}/players_session/team1`);
    const team2Ref = ref(database, `sessions/${sessionId}/players_session/team2`);

    let team1Players = [];
    let team2Players = [];

    const updatePlayers = () => {
      const allPlayers = [...team1Players, ...team2Players];
      console.log('👥 Joueurs connectés:', allPlayers.length);
      setPlayers(allPlayers);
    };

    const unsubscribe1 = onValue(team1Ref, (snapshot) => {
      const team1Data = snapshot.val();
      team1Players = team1Data ? Object.entries(team1Data)
        .filter(([_, player]) => player.connected)
        .map(([key, player]) => ({
          id: player.id || key,
          name: player.name,
          photo: player.photo,
          team: 'team1'
        })) : [];
      updatePlayers();
    });

    const unsubscribe2 = onValue(team2Ref, (snapshot) => {
      const team2Data = snapshot.val();
      team2Players = team2Data ? Object.entries(team2Data)
        .filter(([_, player]) => player.connected)
        .map(([key, player]) => ({
          id: player.id || key,
          name: player.name,
          photo: player.photo,
          team: 'team2'
        })) : [];
      updatePlayers();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [sessionId]);

  // ========== SYNCHRONISATION SPOTIFY TOKEN ==========

  useEffect(() => {
    // Récupérer le token Spotify depuis sessionStorage
    const token = sessionStorage.getItem('spotify_access_token');
    if (token) {
      setSpotifyToken(token);
      console.log('🎵 Token Spotify détecté');
    }
  }, []);

  // ========== HANDLERS ==========

  /**
   * Handler quand la source musicale est configurée
   */
  const handleMusicConfigured = (source, config) => {
    console.log('🎵 Musique configurée:', source, config);
    setMusicSource(source);
    setMusicConfig(config);
  };

  /**
   * Handler pour connecter Spotify
   */
  const handleSpotifyConnect = () => {
    console.log('🔗 Demande de connexion Spotify...');

    // Sauvegarder l'état pour revenir après OAuth
    localStorage.setItem('wizardInProgress', 'true');
    localStorage.setItem('pendingSessionId', sessionId);

    // Utiliser le service Spotify existant pour générer l'URL
    const authUrl = spotifyService.getAuthUrl();
    console.log('🔗 Redirection vers:', authUrl);

    window.location.href = authUrl;
  };

  /**
   * Handler pour continuer vers l'étape suivante
   */
  const handleContinue = async () => {
    if (!canContinue) return;

    try {
      console.log('➡️ Passage à l\'étape suivante...');

      // Sauvegarder la configuration musicale dans Firebase
      const sessionRef = ref(database, `sessions/${sessionId}`);
      await update(sessionRef, {
        musicSource,
        musicConfigData: musicConfig,
        musicConfiguredAt: Date.now()
      });

      // Notifier le parent avec les données
      onContinue(musicSource, {
        ...musicConfig,
        players: players.length,
        spotifyToken
      });

    } catch (error) {
      console.error('❌ Erreur lors de la continuation:', error);
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
    }
  };

  // ========== CONDITIONS ==========

  const canContinue = players.length > 0 && musicSource !== null;

  // ========== RENDU ==========

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem'
        }}>
          {/* Bouton retour */}
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '0.5rem',
                color: 'white',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              ← Retour
            </button>
          )}

          {/* Titre */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem'
            }}>
              Étape 2 : Connexion et Configuration
            </h1>
            <p style={{
              fontSize: '1rem',
              opacity: 0.9
            }}>
              Mode: <strong>{playMode === 'team' ? 'Équipe' : 'Quiz'}</strong> • Session: <strong>{getSessionCode(sessionId)}</strong>
            </p>
          </div>

          <div style={{ width: '100px' }} /> {/* Spacer pour centrer le titre */}
        </div>

        {/* Barre de progression */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'center',
          marginBottom: '2rem'
        }}>
          <div style={{
            flex: 1,
            maxWidth: '150px',
            height: '4px',
            backgroundColor: '#10b981',
            borderRadius: '2px'
          }} />
          <div style={{
            flex: 1,
            maxWidth: '150px',
            height: '4px',
            backgroundColor: '#10b981',
            borderRadius: '2px'
          }} />
          <div style={{
            flex: 1,
            maxWidth: '150px',
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '2px'
          }} />
        </div>
      </div>

      {/* Contenu principal: 2 panels côte à côte */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Panel gauche: Connexion des joueurs */}
        <PlayerConnectionPanel
          sessionId={sessionId}
          playMode={playMode}
          players={players}
        />

        {/* Panel droit: Configuration musicale */}
        <MusicConfigPanel
          onMusicConfigured={handleMusicConfigured}
          spotifyToken={spotifyToken}
          onSpotifyConnect={handleSpotifyConnect}
        />
      </div>

      {/* Footer: Bouton Continuer */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        {/* Messages d'aide */}
        {!canContinue && (
          <div style={{
            backgroundColor: 'rgba(251, 191, 36, 0.2)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1.5rem',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            {players.length === 0 && musicSource === null && (
              <>⚠️ Attendez qu'au moins 1 joueur se connecte et configurez une source musicale</>
            )}
            {players.length === 0 && musicSource !== null && (
              <>⚠️ Attendez qu'au moins 1 joueur se connecte</>
            )}
            {players.length > 0 && musicSource === null && (
              <>⚠️ Configurez une source musicale pour continuer</>
            )}
          </div>
        )}

        {/* Bouton Continuer */}
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          style={{
            padding: '1rem 3rem',
            backgroundColor: canContinue
              ? '#10b981'
              : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '0.75rem',
            color: 'white',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            opacity: canContinue ? 1 : 0.5,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
          onMouseEnter={(e) => {
            if (canContinue) {
              e.currentTarget.style.backgroundColor = '#059669';
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (canContinue) {
              e.currentTarget.style.backgroundColor = '#10b981';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          {canContinue ? (
            <>
              ✅ Continuer
              <span style={{ fontSize: '1rem', opacity: 0.8 }}>
                ({players.length} joueur{players.length > 1 ? 's' : ''} • {musicSource})
              </span>
            </>
          ) : (
            '⏳ En attente...'
          )}
        </button>
      </div>
    </div>
  );
}
