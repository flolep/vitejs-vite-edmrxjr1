import React from 'react';

export default function PlaylistSelector({
  show,
  playlists,
  onSelect,
  onClose
}) {
  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1f2937',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          color: 'white'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>
          📚 Choisissez une playlist
        </h3>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {playlists.map(pl => (
            <div
              key={pl.id}
              onClick={() => onSelect(pl.id)}
              style={{
                padding: '1rem',
                backgroundColor: 'rgba(124, 58, 237, 0.2)',
                border: '1px solid rgba(124, 58, 237, 0.5)',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.3)';
                e.currentTarget.style.borderColor = '#7c3aed';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.5)';
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                {pl.name}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                {pl.tracks.total} morceaux
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'rgba(156, 163, 175, 0.3)',
            border: '1px solid #9ca3af',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '1rem',
            width: '100%'
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}