import React from 'react';
import Master from '../../../Master';

/**
 * Container pour la partie active dans le nouveau flux Master
 *
 * Ce composant sert de pont entre le nouveau flux (MasterFlowContainer)
 * et le composant Master existant qui contient toute la logique de jeu.
 *
 * Props reçues du MasterFlowContainer:
 * - sessionId: ID de la session Firebase
 * - sessionData: Données complètes de la session (playMode, musicSource, etc.)
 * - onEndGame: Callback pour terminer la partie et retourner à la sélection de mode
 */
export default function ActiveGameContainer({
  sessionId,
  sessionData,
  onEndGame
}) {
  console.log('🎮 [ActiveGameContainer] Rendu avec:', {
    sessionId,
    playMode: sessionData?.playMode,
    musicSource: sessionData?.musicSource
  });

  // Extraire les données de la session
  const {
    playMode = 'team',
    musicSource = 'mp3',
    musicConfigData = {},
    playlistId = null,
    spotifyToken = null
  } = sessionData || {};

  // Construire la playlist initiale selon la source musicale
  const getInitialPlaylist = () => {
    if (musicSource === 'mp3' && musicConfigData?.files) {
      // Pour MP3: construire la playlist depuis les fichiers uploadés
      return musicConfigData.files.map((file, index) => ({
        trackNumber: index + 1,
        title: file.name || `Track ${index + 1}`,
        artist: 'Artiste inconnu',
        revealed: false,
        file: file
      }));
    }

    // Pour Spotify: la playlist sera chargée par les hooks dans Master
    return [];
  };

  // Déterminer le gameMode pour rétrocompatibilité avec Master
  const gameMode = `${musicSource}-${playMode}`;

  return (
    <Master
      initialSessionId={sessionId}
      initialMusicSource={musicSource}
      initialPlayMode={playMode}
      initialGameMode={gameMode}
      initialPlaylist={getInitialPlaylist()}
      initialPlaylistId={playlistId}
      initialSpotifyToken={spotifyToken || sessionStorage.getItem('spotify_access_token')}
    />
  );
}
