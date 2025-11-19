import React from 'react';

/**
 * Écran de sélection d'un joueur existant
 * Affiche les résultats de recherche Airtable
 * Utilisé par BuzzerTeam et BuzzerQuiz
 */
export function SelectScreen({
  searchResults,
  onSelectPlayer,
  onCreateNew,
  debugPanel = null
}) {
  return (
    <div className="bg-gradient flex-center">
      {debugPanel}
      <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
        <h1 className="title">👥 Joueur trouvé !</h1>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
          C'est vous ?
        </h2>

        <div className="space-y">
          {searchResults.map((player, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPlayer(player)}
              className="btn"
              style={{
                width: '100%',
                padding: '1.5rem',
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              {player.photo && (
                <img
                  src={player.photo}
                  alt={player.name}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              )}
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {player.name}
                </div>
                {player.lastSeen && (
                  <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                    Dernière partie : {new Date(player.lastSeen).toLocaleDateString()}
                  </div>
                )}
              </div>
            </button>
          ))}

          <button
            onClick={onCreateNew}
            className="btn btn-gray"
            style={{ width: '100%', padding: '1rem' }}
          >
            ❌ Non, ce n'est pas moi
          </button>
        </div>
      </div>
    </div>
  );
}
