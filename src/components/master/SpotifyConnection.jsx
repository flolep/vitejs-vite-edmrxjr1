import React from 'react';

export default function SpotifyConnection({
  spotifyToken,
  onConnect,
  onShowPlaylists,
  onAddManual
}) {
  // Fonction qui vérifie le token avant d'agir
  const handleSpotifyAction = () => {
    if (!spotifyToken) {
      // Pas de token → Redirection automatique vers Spotify OAuth
      console.log('📤 Pas de token Spotify, redirection automatique...');
      onConnect();
    } else {
      // Token présent → Afficher les playlists
      onShowPlaylists();
    }
  };

  return (
    <div className="player-box mb-4">
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={handleSpotifyAction} className="btn btn-green">
          🎵 {spotifyToken ? 'Importer playlist Spotify' : 'Mode Spotify'}
        </button>
        <button onClick={onAddManual} className="btn btn-purple">
          📁 Mode MP3 manuel
        </button>
      </div>
      {!spotifyToken && (
        <p style={{ textAlign: 'center', marginTop: '0.5rem', opacity: 0.7, fontSize: '0.9rem' }}>
          ℹ️ Le mode Spotify vous redirigera vers l'authentification
        </p>
      )}
    </div>
  );
}