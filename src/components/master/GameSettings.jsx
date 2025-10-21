import React from 'react';

export default function GameSettings({ 
  playlist,
  scores,
  showStats,
  buzzStats,
  showEndGameConfirm,
  onResetGame,
  onShowStats,
  onEndGame,
  onConfirmEndGame,
  onCancelEndGame
}) {
  return (
    <div className="player-box">
      <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        ⚙️ Paramètres de la partie
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Bouton Statistiques */}
        {playlist.length > 0 && (
          <button 
            onClick={onShowStats} 
            className="btn btn-purple"
          >
            📊 Voir les statistiques des buzz
          </button>
        )}
        
        {/* Bouton Terminer la partie */}
        {playlist.length > 0 && (
          <button 
            onClick={onEndGame} 
            className="btn btn-yellow"
          >
            🏁 Terminer la partie
          </button>
        )}
        
        {/* Bouton Réinitialiser */}
        <button 
          onClick={onResetGame} 
          className="btn btn-gray"
        >
          🔄 Réinitialiser tout
        </button>
      </div>

      {/* Modal de confirmation de fin de partie */}
      {showEndGameConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1f2937',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              🏁 Terminer la partie ?
            </h2>
            <p style={{ marginBottom: '2rem', opacity: 0.8 }}>
              Cela lancera l'animation de victoire sur l'écran TV
            </p>
            
            {/* Affichage des scores */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                padding: '1rem',
                borderRadius: '0.5rem'
              }}>
                <div style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                  🔴 ÉQUIPE 1
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                  {scores.team1}
                </div>
              </div>
              
              <div style={{
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                padding: '1rem',
                borderRadius: '0.5rem'
              }}>
                <div style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                  🔵 ÉQUIPE 2
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                  {scores.team2}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={onCancelEndGame}
                className="btn btn-gray"
                style={{ flex: 1 }}
              >
                Annuler
              </button>
              <button 
                onClick={onConfirmEndGame}
                className="btn btn-green"
                style={{ flex: 1 }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal des statistiques */}
      {showStats && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
          onClick={() => onShowStats(false)}
        >
          <div 
            style={{
              backgroundColor: '#1f2937',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>
              📊 Statistiques des Buzz
            </h2>
            
            {buzzStats.length === 0 ? (
              <p style={{ textAlign: 'center', opacity: 0.7 }}>
                Aucun buzz enregistré pour le moment
              </p>
            ) : (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>
                    🏆 Top des buzz les plus rapides
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {buzzStats.slice(0, 10).map((buzz, index) => (
                      <div 
                        key={index}
                        style={{
                          backgroundColor: buzz.team === 'team1' 
                            ? 'rgba(220, 38, 38, 0.2)' 
                            : 'rgba(37, 99, 235, 0.2)',
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>
                          {index === 0 && '🥇 '}
                          {index === 1 && '🥈 '}
                          {index === 2 && '🥉 '}
                          {buzz.team === 'team1' ? '🔴' : '🔵'} 
                          {buzz.playerName || 'Joueur anonyme'}
                        </span>
                        <span style={{ fontWeight: 'bold' }}>
                          {buzz.time.toFixed(2)}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>
                    📈 Statistiques par équipe
                  </h3>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '1rem' 
                  }}>
                    {['team1', 'team2'].map((team) => {
                      const teamBuzzes = buzzStats.filter(b => b.team === team);
                      const avgTime = teamBuzzes.length > 0
                        ? (teamBuzzes.reduce((sum, b) => sum + b.time, 0) / teamBuzzes.length)
                        : 0;
                      
                      return (
                        <div 
                          key={team}
                          style={{
                            backgroundColor: team === 'team1'
                              ? 'rgba(220, 38, 38, 0.2)'
                              : 'rgba(37, 99, 235, 0.2)',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                            {team === 'team1' ? '🔴 ÉQUIPE 1' : '🔵 ÉQUIPE 2'}
                          </div>
                          <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                            {teamBuzzes.length} buzz
                          </div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                            ⌀ {avgTime.toFixed(2)}s
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            
            <button 
              onClick={() => onShowStats(false)}
              className="btn btn-gray"
              style={{ marginTop: '1.5rem', width: '100%' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}