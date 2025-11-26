import React, { useState, useEffect } from 'react';
import { database } from '../../../firebase';
import { ref, onValue } from 'firebase/database';

/**
 * Étape 3: Prêt à démarrer
 *
 * Affiche un récapitulatif de la configuration:
 * - Mode de jeu sélectionné (Team/Quiz)
 * - Nombre de joueurs connectés
 * - Source musicale configurée
 * - Bouton pour démarrer la partie
 */
export default function StepReadyToStart({
  sessionId,
  sessionData,
  onStartGame,
  onBack
}) {
  // État des joueurs (pour afficher le nombre en temps réel)
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

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

  // ========== HANDLERS ==========

  const handleStartGame = async () => {
    setLoading(true);
    try {
      await onStartGame();
    } catch (error) {
      console.error('❌ Erreur au démarrage:', error);
      alert('Erreur lors du démarrage de la partie. Veuillez réessayer.');
      setLoading(false);
    }
  };

  // ========== DONNÉES POUR L'AFFICHAGE ==========

  const playMode = sessionData?.playMode || 'team';
  const musicSource = sessionData?.musicSource || 'unknown';
  const musicConfig = sessionData?.musicConfigData || {};

  const getModeIcon = () => {
    return playMode === 'team' ? '👥' : '🎯';
  };

  const getModeLabel = () => {
    return playMode === 'team' ? 'Mode Équipe' : 'Mode Quiz';
  };

  const getModeDescription = () => {
    return playMode === 'team'
      ? 'Les joueurs s\'affrontent en buzzant sur les chansons'
      : 'Les joueurs répondent à des questions à choix multiples';
  };

  const getMusicSourceLabel = () => {
    switch (musicSource) {
      case 'mp3':
        return '📤 Fichiers MP3 locaux';
      case 'spotify-auto':
        return '🎵 Playlist Spotify';
      case 'spotify-ai':
        return '🤖 Playlist générée par IA';
      default:
        return '🎵 Musique';
    }
  };

  const getMusicDetails = () => {
    if (musicSource === 'mp3' && musicConfig.files) {
      return `${musicConfig.files.length} fichier${musicConfig.files.length > 1 ? 's' : ''} uploadé${musicConfig.files.length > 1 ? 's' : ''}`;
    }
    if (musicSource === 'spotify-auto' && musicConfig.playlistName) {
      return `Playlist: ${musicConfig.playlistName}`;
    }
    if (musicSource === 'spotify-ai' && musicConfig.preferences) {
      return `Préférences: ${musicConfig.preferences}`;
    }
    return 'Configurée';
  };

  // ========== RENDU ==========

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      color: 'white',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
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
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '0.5rem',
                color: 'white',
                fontSize: '0.9rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: loading ? 0.5 : 1
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
              Prêt à démarrer !
            </h1>
            <p style={{
              fontSize: '1rem',
              opacity: 0.9
            }}>
              Vérifiez la configuration avant de lancer la partie
            </p>
          </div>

          <div style={{ width: '100px' }} /> {/* Spacer */}
        </div>

        {/* Barre de progression */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'center'
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
            backgroundColor: '#10b981',
            borderRadius: '2px'
          }} />
        </div>
      </div>

      {/* Contenu principal: Récapitulatif */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Carte: Mode de jeu */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '1rem',
          padding: '2rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              fontSize: '3rem',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem'
            }}>
              {getModeIcon()}
            </div>
            <div>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem'
              }}>
                {getModeLabel()}
              </h2>
              <p style={{
                fontSize: '1rem',
                opacity: 0.9
              }}>
                {getModeDescription()}
              </p>
            </div>
          </div>
        </div>

        {/* Carte: Joueurs */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '1rem',
          padding: '2rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <div style={{
              fontSize: '3rem',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem'
            }}>
              👤
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem'
              }}>
                {players.length} joueur{players.length > 1 ? 's' : ''} connecté{players.length > 1 ? 's' : ''}
              </h2>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginTop: '1rem'
              }}>
                {players.map((player) => (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      padding: '0.5rem 1rem',
                      borderRadius: '2rem',
                      fontSize: '0.9rem'
                    }}
                  >
                    {player.photo ? (
                      <img
                        src={player.photo}
                        alt={player.name}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}>
                        {player.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{player.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Carte: Musique */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '1rem',
          padding: '2rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <div style={{
              fontSize: '3rem',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem'
            }}>
              🎵
            </div>
            <div>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem'
              }}>
                {getMusicSourceLabel()}
              </h2>
              <p style={{
                fontSize: '1rem',
                opacity: 0.9
              }}>
                {getMusicDetails()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Bouton Démarrer */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
        marginTop: '2rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <button
          onClick={handleStartGame}
          disabled={loading || players.length === 0}
          style={{
            padding: '1.5rem 4rem',
            backgroundColor: (loading || players.length === 0)
              ? 'rgba(255, 255, 255, 0.1)'
              : '#10b981',
            border: 'none',
            borderRadius: '1rem',
            color: 'white',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            cursor: (loading || players.length === 0) ? 'not-allowed' : 'pointer',
            opacity: (loading || players.length === 0) ? 0.5 : 1,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
          onMouseEnter={(e) => {
            if (!loading && players.length > 0) {
              e.currentTarget.style.backgroundColor = '#059669';
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && players.length > 0) {
              e.currentTarget.style.backgroundColor = '#10b981';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: '24px',
                height: '24px',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Démarrage...
            </>
          ) : players.length === 0 ? (
            <>⏳ En attente de joueurs...</>
          ) : (
            <>🚀 Démarrer la partie</>
          )}
        </button>
      </div>

      {/* Animation CSS pour le spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
