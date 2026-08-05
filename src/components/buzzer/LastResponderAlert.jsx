import React from 'react';

/**
 * Alerte visuelle « on t'attend » sur le buzzer du joueur.
 *
 * Deux niveaux :
 *   'warning' — il reste 2 non-repondants : pulsation lente du bord d'ecran
 *   'last'    — le joueur est le dernier : flash plein ecran + message
 *
 * ⚠️ SECURITE PHOTOSENSIBLE — les deux animations restent tres en dessous de
 * 3 Hz : 1,25 Hz pour le flash (periode 0,8 s) et 0,5 Hz pour la pulsation
 * (periode 2 s). Ne pas raccourcir ces durees sans revoir ce point : au-dela
 * de 3 Hz il y a un risque de crise chez les personnes photosensibles, et
 * c'est agressif sur un ecran tenu a 30 cm.
 *
 * L'overlay est en `pointer-events: none` : il ne doit JAMAIS empecher le
 * joueur de toucher une reponse — c'est precisement ce qu'on lui demande.
 *
 * `prefers-reduced-motion` supprime le clignotement mais conserve un etat
 * statique bien contraste : ce canal est le seul a signaler qu'on est le
 * dernier, il ne peut pas simplement disparaitre.
 */

const alertStyles = `
@keyframes lastResponderFlash {
  0%, 100% { opacity: 0.12; }
  50%      { opacity: 0.42; }
}
@keyframes lastResponderBanner {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.04); }
}
@keyframes lastResponderEdge {
  0%, 100% { opacity: 0.25; }
  50%      { opacity: 0.7; }
}

.last-responder-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9000;
}

/* Niveau 1 — bord d'ecran, discret. Periode 2 s = 0,5 Hz. */
.last-responder-edge {
  box-shadow: inset 0 0 0 0.5rem #fbbf24;
  animation: lastResponderEdge 2s ease-in-out infinite;
}

/* Niveau 2 — flash plein ecran. Periode 0,8 s = 1,25 Hz. */
.last-responder-flash {
  background: #ef4444;
  animation: lastResponderFlash 0.8s ease-in-out infinite;
}

.last-responder-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9001;
  pointer-events: none;
  background: #ef4444;
  color: #fff;
  text-align: center;
  padding: 0.9rem 1rem;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.4);
  animation: lastResponderBanner 0.8s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .last-responder-edge,
  .last-responder-flash,
  .last-responder-banner {
    animation: none;
  }
  /* Pas de clignotement, mais l'alerte reste lisible : c'est le seul canal. */
  .last-responder-edge { opacity: 0.7; }
  .last-responder-flash { opacity: 0.3; }
}
`;

export default function LastResponderAlert({ level }) {
  if (level !== 'warning' && level !== 'last') return null;

  return (
    <>
      <style>{alertStyles}</style>
      {level === 'warning' && (
        <div className="last-responder-overlay last-responder-edge" aria-hidden="true" />
      )}
      {level === 'last' && (
        <>
          <div className="last-responder-overlay last-responder-flash" aria-hidden="true" />
          <div className="last-responder-banner" role="status" aria-live="assertive">
            ⚡ Tu es le dernier !
          </div>
        </>
      )}
    </>
  );
}
