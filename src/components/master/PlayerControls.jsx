import React from 'react';

export default function PlayerControls({
  isPlaying,
  currentTrack,
  playlistLength,
  currentSong,
  currentTrackData,
  currentChrono,
  availablePoints,
  songDuration,
  isSpotifyMode,
  onPrev,
  onTogglePlay,
  onNext,
  onReveal
}) {
  return (
    <div style={{
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '0.75rem',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    }}>
      {/* Info chanson avec pochette */}
      <div style={{
        display: 'flex',
        gap: '1.5rem',
        alignItems: 'center'
      }}>
        {/* Pochette */}
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '0.5rem',
          overflow: 'hidden',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {currentTrackData?.imageUrl ? (
            <img
              src={currentTrackData.imageUrl}
              alt="Pochette"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div style={{ fontSize: '3rem', opacity: 0.3 }}>🎵</div>
          )}
        </div>

        {/* Infos chanson */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.85rem',
            opacity: 0.7,
            marginBottom: '0.5rem'
          }}>
            Chanson #{currentTrack + 1} / {playlistLength}
          </div>

          {currentSong?.revealed ? (
            <>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: '600',
                marginBottom: '0.3rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {currentSong.title}
              </div>
              <div style={{
                fontSize: '1rem',
                opacity: 0.8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {currentSong.artist}
              </div>
            </>
          ) : (
            <>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: '600',
                marginBottom: '0.3rem',
                color: '#9ca3af'
              }}>
                ??? ???
              </div>
              <div style={{
                fontSize: '1rem',
                opacity: 0.6,
                color: '#9ca3af'
              }}>
                Artiste inconnu
              </div>
            </>
          )}

          <div style={{
            fontSize: '0.75rem',
            opacity: 0.6,
            marginTop: '0.5rem'
          }}>
            {isSpotifyMode ? '🎵 Mode Spotify' : '📁 Mode MP3'}
          </div>
        </div>
      </div>

      {/* Contrôles */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={onPrev}
          disabled={currentTrack === 0}
          className="btn btn-gray btn-round"
        >
          ⏮️
        </button>

        <button
          onClick={onTogglePlay}
          disabled={!isSpotifyMode && !currentTrackData?.audioUrl}
          className="btn btn-green btn-round btn-play"
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>

        <button
          onClick={onNext}
          disabled={currentTrack >= playlistLength - 1}
          className="btn btn-gray btn-round"
        >
          ⏭️
        </button>

        <button
          onClick={onReveal}
          disabled={!currentSong || currentSong.revealed}
          className="btn btn-yellow"
          style={{ marginLeft: '1rem' }}
        >
          Révéler
        </button>
      </div>
    </div>
  );
}