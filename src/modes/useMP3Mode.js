import { useRef } from 'react';

/**
 * Hook pour gérer le mode MP3
 * Logique spécifique au chargement manuel de fichiers MP3
 */
export function useMP3Mode(playlist, setPlaylist) {
  const audioRef = useRef(null);

  const handleManualAdd = () => {
    const newTrack = {
      title: 'En attente de fichier...',
      artist: '',
      audioUrl: null,
      imageUrl: null,
      revealed: false
    };

    setPlaylist([...playlist, newTrack]);
  };

  const handleImageForTrack = (index, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const updatedPlaylist = [...playlist];
      updatedPlaylist[index].imageUrl = e.target.result;
      setPlaylist(updatedPlaylist);
    };
    reader.onerror = () => console.error('Erreur lecture image');
    reader.readAsDataURL(file);
  };

  const handleAudioForTrack = (index, file) => {
    const fileName = file.name.replace(/\.(mp3|wav|ogg|m4a)$/i, '');
    let title = fileName;
    let artist = '';

    if (fileName.includes(' - ')) {
      const parts = fileName.split(' - ');
      artist = parts[0].trim();
      title = parts[1].trim();
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const updatedPlaylist = [...playlist];
      updatedPlaylist[index].audioUrl = e.target.result;
      updatedPlaylist[index].fileName = file.name;
      updatedPlaylist[index].title = title;
      updatedPlaylist[index].artist = artist;
      setPlaylist(updatedPlaylist);
    };
    reader.onerror = () => console.error('Erreur lecture fichier');
    reader.readAsDataURL(file);
  };

  return {
    audioRef,
    handleManualAdd,
    handleImageForTrack,
    handleAudioForTrack
  };
}
