import React from 'react';

export default function PlaylistSelector({ 
  show,
  playlists,
  onSelect,
  onClose 
}) {
  if (!show) return null;

  return (
    <div className="player-box mb-4">
      <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        Choisissez une playlist
      </h3>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {playlists.map(pl => (
          <div 
            key={pl.id}
            onClick={() => onSelect(pl.id)}
            className="playlist-item"
            style={{ cursor: 'pointer', marginBottom: '0.5rem' }}
          >
            <strong>{pl.name}</strong> - {pl.tracks.total} morceaux
          </div>
        ))}
      </div>
      <button 
        onClick={onClose} 
        className="btn btn-gray" 
        style={{ marginTop: '1rem' }}
      >
        Annuler
      </button>
    </div>
  );
}