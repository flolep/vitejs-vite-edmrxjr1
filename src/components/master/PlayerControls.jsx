import React from 'react';

export default function PlayerControls({
  isPlaying,
  currentTrack,
  playlistLength,
  currentSong,
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
    <>
      <div className="controls mb-4">
        <button
          onClick={onPrev}
          disabled={currentTrack === 0}
          className="btn btn-gray btn-round"
        >
          ⏮️
        </button>

        <button
          onClick={onTogglePlay}
          disabled={!isSpotifyMode && !currentSong?.audioUrl}
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
        >
          Révéler
        </button>
      </div>
      
      <div style={{ fontSize: '0.875rem', opacity: 0.7, textAlign: 'center' }}>
        {isSpotifyMode ? '🎵 Mode Spotify' : '📁 Mode MP3'}
      </div>
    </>
  );
}