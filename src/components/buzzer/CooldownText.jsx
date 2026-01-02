import React, { useState, useEffect } from 'react';

const CooldownText = React.memo(({ cooldownEnd }) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!cooldownEnd) return;

    const update = () => {
      const timeLeft = Math.max(0, (cooldownEnd - Date.now()) / 1000);
      setRemaining(timeLeft);
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [cooldownEnd]);

  if (!cooldownEnd || remaining <= 0) return null;

  return (
    <div style={{
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: '#ef4444',
      marginTop: '1rem'
    }}>
      🔥 COOLDOWN : {remaining.toFixed(1)}s
      <div style={{ fontSize: '1rem', marginTop: '0.5rem', opacity: 0.8 }}>
        (2 bonnes réponses de suite)
      </div>
    </div>
  );
});

export default CooldownText;
