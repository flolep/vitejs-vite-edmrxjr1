import React, { useState } from 'react';

/**
 * Composant réutilisable pour la saisie du code de session
 * Utilisé dans Buzzer.jsx et TV.jsx
 */
export default function SessionCodeInput({ onSubmit, onError }) {
  const [sessionCode, setSessionCode] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    // Convertir en majuscules automatiquement
    const value = e.target.value.toUpperCase();
    setSessionCode(value);
    setError('');
  };

  const handleSubmit = () => {
    const code = sessionCode.trim();

    // Validation : le code doit contenir 6 caractères
    if (code.length !== 6) {
      const errorMsg = 'Le code doit contenir 6 caractères';
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return;
    }

    // Appeler le callback avec le code validé
    onSubmit(code);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && sessionCode.trim()) {
      handleSubmit();
    }
  };

  return (
    <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
      <h1 className="title" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
        🎵 BLIND TEST 🎵
      </h1>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem', color: '#fff' }}>
        Entrez le code de session
      </h2>

      <input
        type="text"
        placeholder="CODE"
        value={sessionCode}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        maxLength={6}
        style={{
          width: '100%',
          padding: '1.5rem',
          fontSize: '1.8rem',
          textAlign: 'center',
          border: '3px solid #fff',
          borderRadius: '15px',
          marginBottom: '1rem',
          textTransform: 'uppercase',
          letterSpacing: '0.3em',
          fontWeight: 'bold'
        }}
        autoFocus
      />

      {error && (
        <div style={{
          color: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          padding: '1rem',
          borderRadius: '10px',
          marginBottom: '1rem',
          fontSize: '1.1rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!sessionCode.trim()}
        className="buzzer-button"
        style={{
          width: '100%',
          padding: '1.5rem',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          opacity: sessionCode.trim() ? 1 : 0.5,
          cursor: sessionCode.trim() ? 'pointer' : 'not-allowed'
        }}
      >
        ✅ REJOINDRE
      </button>
    </div>
  );
}
