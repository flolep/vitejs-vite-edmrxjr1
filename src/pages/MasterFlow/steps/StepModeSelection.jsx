import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../../firebase';

/**
 * Étape 1: Sélection du mode de jeu
 * L'animateur choisit entre Mode Équipe ou Mode Quiz
 */
export default function StepModeSelection({ onModeSelected, user }) {
  const [selectedMode, setSelectedMode] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleSelectMode = async (mode) => {
    setSelectedMode(mode);
    setIsCreating(true);

    try {
      await onModeSelected(mode);
    } catch (error) {
      console.error('Erreur sélection mode:', error);
      setIsCreating(false);
      setSelectedMode(null);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      color: 'white'
    }}>
      {/* Header avec logout */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <span style={{ opacity: 0.8, fontSize: '0.9rem' }}>
          {user?.email}
        </span>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.3)',
            border: '1px solid #ef4444',
            borderRadius: '0.5rem',
            color: 'white',
            fontSize: '0.9rem',
            cursor: 'pointer'
          }}
        >
          Déconnexion
        </button>
      </div>

      {/* Contenu principal */}
      <div style={{
        maxWidth: '900px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Titre */}
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          🎵 BLIND TEST
        </h1>

        <p style={{
          fontSize: '1.25rem',
          opacity: 0.9,
          marginBottom: '3rem'
        }}>
          Choisissez le mode de jeu pour commencer
        </p>

        {/* Grille des modes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* Mode Équipe */}
          <button
            onClick={() => handleSelectMode('team')}
            disabled={isCreating}
            style={{
              backgroundColor: selectedMode === 'team' && isCreating
                ? 'rgba(16, 185, 129, 0.4)'
                : 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: selectedMode === 'team' && isCreating
                ? '3px solid #10b981'
                : '2px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '1.5rem',
              padding: '3rem 2rem',
              color: 'white',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              opacity: isCreating && selectedMode !== 'team' ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isCreating) {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreating) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem'
            }}>
              👥
            </div>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              marginBottom: '0.75rem'
            }}>
              Mode Équipe
            </h2>
            <p style={{
              fontSize: '1rem',
              opacity: 0.8,
              lineHeight: '1.5'
            }}>
              Jouez en équipes avec buzzer.<br />
              La première équipe à buzzer répond.
            </p>
            {selectedMode === 'team' && isCreating && (
              <div style={{
                marginTop: '1rem',
                fontSize: '0.9rem',
                color: '#10b981'
              }}>
                ⏳ Création en cours...
              </div>
            )}
          </button>

          {/* Mode Quiz */}
          <button
            onClick={() => handleSelectMode('quiz')}
            disabled={isCreating}
            style={{
              backgroundColor: selectedMode === 'quiz' && isCreating
                ? 'rgba(124, 58, 237, 0.4)'
                : 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: selectedMode === 'quiz' && isCreating
                ? '3px solid #7c3aed'
                : '2px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '1.5rem',
              padding: '3rem 2rem',
              color: 'white',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              opacity: isCreating && selectedMode !== 'quiz' ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isCreating) {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCreating) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem'
            }}>
              🎯
            </div>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              marginBottom: '0.75rem'
            }}>
              Mode Quiz
            </h2>
            <p style={{
              fontSize: '1rem',
              opacity: 0.8,
              lineHeight: '1.5'
            }}>
              Jouez individuellement avec QCM.<br />
              4 réponses possibles, classement par points.
            </p>
            {selectedMode === 'quiz' && isCreating && (
              <div style={{
                marginTop: '1rem',
                fontSize: '0.9rem',
                color: '#7c3aed'
              }}>
                ⏳ Création en cours...
              </div>
            )}
          </button>
        </div>

        {/* Info complémentaire */}
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '1rem',
          padding: '1.5rem',
          fontSize: '0.9rem',
          opacity: 0.8
        }}>
          <strong>💡 Astuce :</strong> Les joueurs pourront se connecter via QR Code dès l'étape suivante.
          Vous pourrez configurer la musique en parallèle.
        </div>
      </div>
    </div>
  );
}
