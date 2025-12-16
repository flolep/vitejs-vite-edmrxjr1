import React, { useState, useEffect } from 'react';

/**
 * Composant qui gère l'affichage du cooldown indépendamment du composant parent.
 * Cela évite de re-rendre tout le parent chaque 100ms.
 */
const CooldownDisplay = React.memo(({ cooldownEnd, onCooldownEnd }) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!cooldownEnd) {
      setRemaining(0);
      return;
    }

    // Mise à jour immédiate
    const update = () => {
      const timeLeft = Math.max(0, (cooldownEnd - Date.now()) / 1000);
      setRemaining(timeLeft);

      if (timeLeft <= 0 && onCooldownEnd) {
        onCooldownEnd();
      }
    };

    update();
    const interval = setInterval(update, 100);

    return () => clearInterval(interval);
  }, [cooldownEnd, onCooldownEnd]);

  if (remaining <= 0) return null;

  return (
    <>
      <span style={{ fontSize: '5rem' }}>🔥</span>
      <span style={{ marginTop: '1rem' }}>
        {remaining.toFixed(1)}s
      </span>
    </>
  );
});

export default CooldownDisplay;
