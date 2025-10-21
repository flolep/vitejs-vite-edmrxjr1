import React from 'react';

export default function BuzzAlert({
  buzzedTeam,
  buzzedPlayerName,
  buzzedPlayerPhoto,
  currentChrono,
  availablePoints,
  onCorrect,
  onWrong
}) {
  if (!buzzedTeam) return null;

  return (
    <div style={{
      backgroundColor: buzzedTeam === 'team1' ? 'rgba(220, 38, 38, 0.2)' : 'rgba(37, 99, 235, 0.2)',
      borderRadius: '1rem',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      border: `3px solid ${buzzedTeam === 'team1' ? '#dc2626' : '#2563eb'}`
    }}>
      <h3 style={{ 
        fontSize: '1.5rem', 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <span>🔔</span>
        <span>BUZZ !</span>
      </h3>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        {/* Photo du joueur */}
        {buzzedPlayerPhoto && (
          <img 
            src={buzzedPlayerPhoto}
            alt={buzzedPlayerName}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid #fbbf24',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          />
        )}
        
        {/* Informations */}
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '1.75rem', 
            fontWeight: 'bold',
            color: '#fbbf24',
            marginBottom: '0.25rem'
          }}>
            {buzzedPlayerName || 'Joueur inconnu'}
          </div>
          <div style={{ 
            fontSize: '1.25rem',
            opacity: 0.9
          }}>
            {buzzedTeam === 'team1' ? '🔴 Équipe 1' : '🔵 Équipe 2'}
          </div>
          <div style={{
            fontSize: '1rem',
            opacity: 0.7,
            marginTop: '0.25rem'
          }}>
            ⏱️ {currentChrono.toFixed(1)}s
          </div>
        </div>
      </div>
      
      {/* Boutons d'action */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '0.75rem' 
      }}>
        <button
          onClick={onCorrect}
          className="btn btn-green"
          style={{ fontSize: '1.125rem', padding: '1rem' }}
        >
          ✅ Bonne réponse<br/>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            +{availablePoints} pts
          </span>
        </button>
        
        <button
          onClick={onWrong}
          className="btn btn-yellow"
          style={{ fontSize: '1.125rem', padding: '1rem' }}
        >
          ❌ Mauvaise réponse
        </button>
      </div>
    </div>
  );
}