import React from 'react';

export default function SpotifyConnection({
  spotifyToken,
  onConnect,
  onShowPlaylists,
  onAddManual,
  onCreateAIPlaylist,
  gameMode,
  isCreatingAI
}) {
  if (!spotifyToken) {
    return (
      <div className="player-box text-center mb-4">
        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          Connectez-vous à Spotify
        </h3>
        <button onClick={onConnect} className="btn btn-green">
          🎵 Se connecter avec Spotify
        </button>
        <p style={{ marginTop: '1rem', opacity: 0.7 }}>ou</p>
        <button onClick={onAddManual} className="btn btn-purple" style={{ marginTop: '0.5rem' }}>
          📁 Mode MP3 manuel
        </button>
      </div>
    );
  }

  return (
    <div className="player-box mb-4">
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* Boutons selon le mode de jeu */}
        {gameMode === 'mp3' && (
          <button onClick={onAddManual} className="btn btn-purple">
            📁 Ajouter MP3
          </button>
        )}

        {gameMode === 'spotify-import' && (
          <button onClick={onShowPlaylists} className="btn btn-green">
            🎵 Importer playlist
          </button>
        )}

        {gameMode === 'spotify-ai' && (
          <button
            onClick={onCreateAIPlaylist}
            className="btn btn-blue"
            disabled={isCreatingAI}
            style={{ opacity: isCreatingAI ? 0.5 : 1 }}
          >
            {isCreatingAI ? '⏳ Génération en cours...' : '🤖 Régénérer avec IA'}
          </button>
        )}

        {/* Si aucun mode n'est sélectionné, afficher tous les boutons */}
        {!gameMode && (
          <>
            <button onClick={onShowPlaylists} className="btn btn-green">
              🎵 Importer playlist
            </button>
            <button onClick={onAddManual} className="btn btn-purple">
              📁 Ajouter MP3
            </button>
          </>
        )}
      </div>
    </div>
  );
}