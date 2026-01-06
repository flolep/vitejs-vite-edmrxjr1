import { useState, useEffect, useRef } from 'react';

/**
 * Hook pour gérer la playlist et la navigation
 * Logique commune à tous les modes
 */
export function usePlaylist(initialPlaylist = []) {
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const prevInitialPlaylistRef = useRef(initialPlaylist);

  // Mettre à jour la playlist quand initialPlaylist change
  // Ceci est important pour la restauration de parties en cours
  useEffect(() => {
    // Vérifier si initialPlaylist a vraiment changé (référence différente)
    if (initialPlaylist !== prevInitialPlaylistRef.current) {
      prevInitialPlaylistRef.current = initialPlaylist;

      if (initialPlaylist && initialPlaylist.length > 0) {
        console.log('🔄 [usePlaylist] Mise à jour de la playlist:', initialPlaylist.length, 'chansons');
        setPlaylist(initialPlaylist);
      }
    }
  }, [initialPlaylist]);

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

  const revealTrack = (trackNumber) => {
    // ✅ trackNumber commence à 1, donc on accède au tableau avec trackNumber - 1
    updateTrack(trackNumber - 1, { revealed: true });
  };

  // ✅ currentTrack commence à 1 au lieu de 0
  const canNavigateNext = (currentTrack) => {
    return currentTrack < playlist.length; // Peut naviguer si currentTrack < length (ex: track 10 avec 10 chansons)
  };

  const canNavigatePrev = (currentTrack) => {
    return currentTrack > 1; // Peut revenir si > 1 (la première chanson est track 1)
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
