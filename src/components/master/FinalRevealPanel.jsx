import React, { useState, useEffect } from 'react';

/**
 * Bandeau animateur affiche en phase `last_reveal`.
 *
 * FALLBACK obligatoire : le declenchement du classement final appartient au
 * vainqueur, mais celui-ci peut avoir repose son telephone, etre sorti de la
 * piece, ou ne pas comprendre que c'est a lui d'agir. Sans ce bouton,
 * l'animateur n'aurait aucun moyen de debloquer la partie avant le timeout.
 *
 * Le compte a rebours est purement indicatif : le timer qui fait foi est celui
 * du Master (source de verite unique). Ce composant se contente de lire
 * l'echeance.
 */
export default function FinalRevealPanel({ deadline, onRevealNow }) {
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }

    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <div style={{
      position: 'fixed',
      left: '1rem',
      right: '1rem',
      bottom: '1rem',
      zIndex: 900,
      backgroundColor: '#0d1f38',
      border: '1px solid #fbbf24',
      borderRadius: '1rem',
      padding: '1rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap',
      boxShadow: '0 0 1.5rem rgba(0, 0, 0, 0.5)'
    }}>
      <div>
        <div style={{ fontWeight: 'bold', color: '#fbbf24', marginBottom: '0.25rem' }}>
          🏁 Dernière question révélée
        </div>
        <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
          En attente du vainqueur
          {secondsLeft !== null && ` · bascule automatique dans ${secondsLeft} s`}
        </div>
      </div>

      <button
        onClick={onRevealNow}
        style={{
          padding: '0.75rem 1.25rem',
          fontSize: '1rem',
          fontWeight: 'bold',
          color: '#1e1b4b',
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          border: 'none',
          borderRadius: '0.75rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        🏆 Afficher le classement final
      </button>
    </div>
  );
}
