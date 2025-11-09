import { useState } from 'react';

/**
 * Hook pour gérer la playlist et la navigation
 * Logique commune à tous les modes
 */
export function usePlaylist(initialPlaylist = []) {
  const [playlist, setPlaylist] = useState(initialPlaylist);

  const addTrack = (track) => {
    setPlaylist(prev => [...prev, track]);
  };

  const updateTrack = (index, updates) => {
    setPlaylist(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const revealTrack = (index) => {
    updateTrack(index, { revealed: true });
  };

  const canNavigateNext = (currentTrack) => {
    return currentTrack < playlist.length - 1;
  };

  const canNavigatePrev = (currentTrack) => {
    return currentTrack > 0;
  };

  return {
    playlist,
    setPlaylist,
    addTrack,
    updateTrack,
    revealTrack,
    canNavigateNext,
    canNavigatePrev
  };
}
