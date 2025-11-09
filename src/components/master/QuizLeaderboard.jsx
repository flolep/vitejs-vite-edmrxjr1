import React from 'react';

/**
 * Composant pour afficher le classement du Quiz en temps réel
 */
export default function QuizLeaderboard({ leaderboard }) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          🏆 Classement
        </h3>
        <p style={{ textAlign: 'center', opacity: 0.7, fontSize: '0.9rem' }}>
          Aucune réponse correcte pour le moment
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: '0.75rem',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: '600',
        marginBottom: '1rem',
        textAlign: 'center'
      }}>
        🏆 Classement
      </h3>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        {leaderboard.map((player, index) => {
          const rank = index + 1;
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;

          return (
            <div
              key={player.playerId}
              style={{
                padding: '0.75rem',
                backgroundColor: rank <= 3
                  ? 'rgba(251, 191, 36, 0.2)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: rank <= 3
                  ? '1px solid #fbbf24'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  minWidth: '2rem'
                }}>
                  {medal}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: '500',
                    marginBottom: '0.25rem'
                  }}>
                    {player.playerName}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    opacity: 0.7
                  }}>
                    {player.correctAnswers} bonne{player.correctAnswers > 1 ? 's' : ''} réponse{player.correctAnswers > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#fbbf24'
              }}>
                {player.totalPoints.toLocaleString()} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
