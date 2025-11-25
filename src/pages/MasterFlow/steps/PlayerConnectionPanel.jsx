import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

/**
 * Panel gauche : QR Code + Liste des joueurs connectés en temps réel
 */
export default function PlayerConnectionPanel({ sessionId, players, playMode }) {
  const buzzerUrl = `${window.location.origin}/buzzer?session=${sessionId}`;

  return (
    <div style={{
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      border: '2px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '1.5rem',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    }}>
      {/* Titre */}
      <div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📱 Connexion des joueurs
        </h2>
        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
          Scannez le QR Code ou saisissez le code de session
        </p>
      </div>

      {/* QR Code */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '1.5rem',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '1rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '1rem',
          borderRadius: '0.75rem'
        }}>
          <QRCodeSVG
            value={buzzerUrl}
            size={180}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Code de session */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '0.75rem',
            opacity: 0.7,
            marginBottom: '0.25rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Code de session
          </div>
          <div style={{
            fontSize: '1.75rem',
            fontWeight: 'bold',
            letterSpacing: '0.2rem',
            fontFamily: 'monospace',
            color: '#fbbf24',
            textShadow: '0 0 10px rgba(251, 191, 36, 0.3)'
          }}>
            {sessionId}
          </div>
        </div>

        {/* Bouton copier */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(sessionId);
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'rgba(124, 58, 237, 0.3)',
            border: '1px solid #7c3aed',
            borderRadius: '0.5rem',
            color: 'white',
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.3)';
          }}
        >
          📋 Copier le code
        </button>
      </div>

      {/* Liste des joueurs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontSize: '1rem',
          fontWeight: '600',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          👥 Joueurs connectés
          <span style={{
            backgroundColor: players.length > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(156, 163, 175, 0.3)',
            border: players.length > 0 ? '1px solid #10b981' : '1px solid #9ca3af',
            borderRadius: '1rem',
            padding: '0.25rem 0.75rem',
            fontSize: '0.85rem',
            fontWeight: 'bold'
          }}>
            {players.length}
          </span>
        </div>

        <div style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '0.75rem',
          padding: '1rem',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {players.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              opacity: 0.6,
              fontSize: '0.9rem'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                ⏳
              </div>
              En attente des joueurs...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {players.map((player, index) => (
                <div
                  key={player.id || player.name || index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.5rem',
                    animation: 'fadeIn 0.3s ease-in'
                  }}
                >
                  {/* Photo ou avatar */}
                  {player.photo ? (
                    <img
                      src={player.photo}
                      alt={player.name}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid rgba(255, 255, 255, 0.3)'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(124, 58, 237, 0.3)',
                      border: '2px solid rgba(124, 58, 237, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: 'bold'
                    }}>
                      {player.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}

                  {/* Info joueur */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}>
                      {player.name}
                    </div>
                    {playMode === 'team' && player.team && (
                      <div style={{
                        fontSize: '0.75rem',
                        opacity: 0.7
                      }}>
                        Équipe {player.team}
                      </div>
                    )}
                  </div>

                  {/* Badge connecté */}
                  {player.connected && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        animation: 'pulse 2s infinite'
                      }} />
                      En ligne
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages d'aide */}
      <div style={{
        fontSize: '0.85rem',
        opacity: 0.7,
        padding: '0.75rem',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '0.5rem'
      }}>
        💡 <strong>Astuce :</strong> Les joueurs peuvent continuer à se connecter pendant la partie.
      </div>

      {/* Animations CSS */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
