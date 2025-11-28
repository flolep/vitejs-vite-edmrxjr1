import React, { useState, useEffect } from 'react';
import { database } from '../../../firebase';
import { ref, onValue } from 'firebase/database';
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

  // État pour la playlist chargée depuis Firebase
  const [playlistFromFirebase, setPlaylistFromFirebase] = useState(null);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(true);

  // Extraire les données de la session
  const {
    playMode = 'team',
    musicSource = 'mp3',
    musicConfigData = {},
    playlistId = null,
    spotifyToken = null
  } = sessionData || {};

  // Charger la playlist depuis Firebase
  useEffect(() => {
    if (!sessionId) {
      console.log('⚠️ [ActiveGameContainer] Pas de sessionId, skip chargement playlist');
      setIsLoadingPlaylist(false);
      return;
    }

    console.log('📥 [ActiveGameContainer] Chargement playlist depuis Firebase...');
    setIsLoadingPlaylist(true);

    const playlistRef = ref(database, `sessions/${sessionId}/playlist`);
    const unsubscribe = onValue(playlistRef, (snapshot) => {
      const playlistData = snapshot.val();

      if (playlistData && Array.isArray(playlistData) && playlistData.length > 0) {
        console.log(`✅ [ActiveGameContainer] Playlist chargée: ${playlistData.length} chansons`);
        setPlaylistFromFirebase(playlistData);
      } else {
        console.log('⚠️ [ActiveGameContainer] Aucune playlist trouvée dans Firebase');
        setPlaylistFromFirebase([]);
      }

      console.log('✅ [ActiveGameContainer] Fin chargement, setIsLoadingPlaylist(false)');
      setIsLoadingPlaylist(false);
    });

    return () => {
      console.log('🧹 [ActiveGameContainer] Cleanup listener Firebase');
      unsubscribe();
    };
  }, [sessionId]);

  // Construire la playlist initiale selon la source musicale
  const getInitialPlaylist = () => {
    // Si une playlist a été chargée depuis Firebase, l'utiliser
    if (playlistFromFirebase) {
      console.log('🎵 [ActiveGameContainer] Utilisation playlist Firebase:', playlistFromFirebase.length, 'chansons');
      return playlistFromFirebase;
    }

    // Sinon, pour MP3 uniquement, construire depuis les fichiers uploadés (legacy)
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

  return (
    <Master
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
