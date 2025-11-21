import React from 'react';

/**
 * Écran de saisie du prénom
 * Utilisé par BuzzerTeam et BuzzerQuiz
 */
export function NameScreen({
  playerName,
  onPlayerNameChange,
  onSubmit,
  isSearching = false,
  error = '',
  debugPanel = null
}) {
  return (
    <div className="bg-gradient flex-center">
      {debugPanel}
      <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
        <h1 className="title">🎵 BLIND TEST 🎵</h1>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
          Quel est votre prénom ?
        </h2>

        <input
          type="text"
          placeholder="Entrez votre prénom"
          value={playerName}
          onChange={(e) => onPlayerNameChange(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && playerName.trim() && !isSearching) {
              onSubmit();
            }
          }}
          autoFocus
          style={{
            width: '100%',
            padding: '1.5rem',
            fontSize: '1.5rem',
            borderRadius: '0.75rem',
            border: 'none',
            marginBottom: '1rem',
            textAlign: 'center'
          }}
        />

        {error && (
          <div style={{
            color: '#ef4444',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={onSubmit}
          disabled={isSearching || !playerName.trim()}
          className="btn btn-green"
          style={{
            width: '100%',
            padding: '1.5rem',
            fontSize: '1.25rem',
            opacity: (isSearching || !playerName.trim()) ? 0.5 : 1
          }}
        >
          {isSearching ? '🔍 Recherche...' : '✅ Valider'}
        </button>
      </div>
    </div>
  );
}
