import React from 'react';

/**
 * Bouton « Révéler le classement final », affiche uniquement chez le
 * vainqueur en phase `last_reveal`.
 *
 * Il ne termine pas la partie lui-meme : il ecrit une demande que le Master
 * valide. Si l'ecriture est refusee (authentification anonyme indisponible),
 * on le dit explicitement plutot que de laisser un bouton inerte — l'animateur
 * garde son bouton et le timeout de 45 s finit par declencher de toute facon.
 */
export default function FinalRevealButton({
  canTrigger,
  requestSent,
  isRequesting,
  error,
  onTrigger
}) {
  if (!canTrigger && !requestSent && !error) return null;

  // Position fixe : les ecrans du buzzer sont des conteneurs pleine hauteur,
  // un bouton dans le flux serait pousse hors de l'ecran.
  return (
    <div style={{
      position: 'fixed',
      left: '1rem',
      right: '1rem',
      bottom: '1rem',
      zIndex: 9500,
      textAlign: 'center',
      backgroundColor: 'rgba(15, 12, 41, 0.92)',
      borderRadius: '1.25rem',
      padding: '1rem',
      boxShadow: '0 0 1.5rem rgba(0, 0, 0, 0.5)'
    }}>
      {canTrigger && (
        <button
          onClick={onTrigger}
          disabled={isRequesting}
          style={{
            width: '100%',
            padding: '1.25rem',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#1e1b4b',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            border: 'none',
            borderRadius: '1rem',
            cursor: isRequesting ? 'default' : 'pointer',
            opacity: isRequesting ? 0.6 : 1,
            boxShadow: '0 0.25rem 1rem rgba(251, 191, 36, 0.4)'
          }}
        >
          {isRequesting ? '⏳ Envoi...' : '🏆 Révéler le classement final'}
        </button>
      )}

      {requestSent && !error && (
        <div style={{ marginTop: '0.75rem', fontSize: '1rem', opacity: 0.85 }}>
          ✅ Classement final demandé — regardez la TV !
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '0.75rem',
          fontSize: '0.9rem',
          color: '#fca5a5',
          lineHeight: 1.4
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
