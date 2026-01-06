import React, { useState, useEffect } from 'react';
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
  console.log('🎮 [ActiveGameContainer] ========== MONTAGE/RENDU ==========');
  console.log('🎮 [ActiveGameContainer] Rendu avec:', {
    sessionId,
    playMode: sessionData?.playMode,
    musicSource: sessionData?.musicSource,
    hasSessionData: !!sessionData
  });

  // Détecter les démontages
  useEffect(() => {
    console.log('✅ [ActiveGameContainer] MONTÉ');
    return () => {
      console.log('❌ [ActiveGameContainer] DÉMONTÉ - Le composant a été retiré du DOM !');
    };
  }, []);

  // Détecter les changements de sessionId
  useEffect(() => {
    console.log('🔄 [ActiveGameContainer] sessionId changé:', sessionId);
  }, [sessionId]);

  // Extraire les données de la session
  const {
    playMode = 'team',
    musicSource = 'mp3',
    musicConfigData = {},
    playlistId = null,
    spotifyToken = null,
    playlist: playlistFromSessionData = []
  } = sessionData || {};

  // État de chargement (pour compatibilité)
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);

  // Si la playlist est déjà dans sessionData, pas besoin de charger depuis Firebase
  useEffect(() => {
    if (playlistFromSessionData && playlistFromSessionData.length > 0) {
      console.log(`✅ [ActiveGameContainer] Playlist reçue via sessionData: ${playlistFromSessionData.length} chansons`);
      setIsLoadingPlaylist(false);
    } else {
      console.log('⚠️ [ActiveGameContainer] Pas de playlist dans sessionData');
      setIsLoadingPlaylist(false);
    }
  }, [playlistFromSessionData]);

  // Construire la playlist initiale selon la source musicale
  const getInitialPlaylist = () => {
    console.log('🔍 [ActiveGameContainer] getInitialPlaylist appelé');
    console.log('🔍 [ActiveGameContainer] playlistFromSessionData:', playlistFromSessionData);
    console.log('🔍 [ActiveGameContainer] Type:', typeof playlistFromSessionData, 'Array?', Array.isArray(playlistFromSessionData));
    console.log('🔍 [ActiveGameContainer] Length:', playlistFromSessionData?.length);

    // Priorité 1 : Playlist depuis sessionData (nouveau flux)
    if (playlistFromSessionData && playlistFromSessionData.length > 0) {
      console.log('🎵 [ActiveGameContainer] Utilisation playlist depuis sessionData:', playlistFromSessionData.length, 'chansons');
      return playlistFromSessionData;
    }

    // Priorité 2 : Pour MP3 uniquement, construire depuis les fichiers uploadés (legacy)
    if (musicSource === 'mp3' && musicConfigData?.files) {
      console.log('📂 [ActiveGameContainer] Construction playlist MP3 depuis fichiers uploadés');
      return musicConfigData.files.map((file, index) => ({
        trackNumber: index + 1,
        title: file.name || `Track ${index + 1}`,
        artist: 'Artiste inconnu',
        revealed: false,
        file: file
      }));
    }

    // Par défaut, playlist vide (sera chargée par les hooks dans Master)
    console.log('⚠️ [ActiveGameContainer] Playlist vide par défaut');
    return [];
  };

  // Déterminer le gameMode pour rétrocompatibilité avec Master
  const gameMode = `${musicSource}-${playMode}`;

  // Afficher un écran de chargement pendant le chargement de la playlist
  if (isLoadingPlaylist) {
    console.log('⏳ [ActiveGameContainer] Affichage écran de chargement playlist');
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '2rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '6px solid rgba(255, 255, 255, 0.3)',
          borderTopColor: 'white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          Chargement de la partie...
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const initialPlaylist = getInitialPlaylist();
  console.log('🎵 [ActiveGameContainer] Rendu Master avec playlist:', initialPlaylist.length, 'chansons');

  // ✨ Utiliser une key unique pour forcer le remontage de Master lors de la restauration
  // Cela garantit que tous les hooks (useState, useEffect, etc.) sont réinitialisés
  const masterKey = `master-${sessionId}-${initialPlaylist.length}`;
  console.log('🔑 [ActiveGameContainer] Master key:', masterKey);

  return (
    <Master
      key={masterKey}
      initialSessionId={sessionId}
      initialMusicSource={musicSource}
      initialPlayMode={playMode}
      initialGameMode={gameMode}
      initialPlaylist={initialPlaylist}
      initialPlaylistId={playlistId}
      initialSpotifyToken={spotifyToken || sessionStorage.getItem('spotify_access_token')}
    />
  );
}
