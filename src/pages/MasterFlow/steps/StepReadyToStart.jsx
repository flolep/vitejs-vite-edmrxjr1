import React, { useState, useEffect } from 'react';
import { database } from '../../../firebase';
import { ref, onValue, set } from 'firebase/database';
import { n8nService } from '../../../n8nService';
import { useSpotifyAIMode } from '../../../modes/useSpotifyAIMode';
import { useSpotifyAutoMode } from '../../../modes/useSpotifyAutoMode';
import { useQuizMode } from '../../../modes/useQuizMode';

/**
 * Étape 3: Prêt à démarrer
 *
 * Affiche un récapitulatif de la configuration:
 * - Mode de jeu sélectionné (Team/Quiz)
 * - Nombre de joueurs connectés
 * - Source musicale configurée
 * - Bouton pour démarrer la partie
 */
export default function StepReadyToStart({
  sessionId,
  sessionData,
  onStartGame,
  onBack
}) {
  // État des joueurs (pour afficher le nombre en temps réel)
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  // États pour la génération de playlist
  const [playlist, setPlaylist] = useState([]);
  const [isGeneratingPlaylist, setIsGeneratingPlaylist] = useState(false);
  const [playlistPollAttempt, setPlaylistPollAttempt] = useState(0);
  const [playlistReady, setPlaylistReady] = useState(false);
  const [generationError, setGenerationError] = useState('');

  // États pour les questions Quiz (mode Quiz uniquement)
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsReady, setQuestionsReady] = useState(false);

  // Mode Test (stubs au lieu d'appels n8n/Spotify)
  const [testMode] = useState(() => localStorage.getItem('quizTestMode') === 'true');

  // Hooks pour les modes Spotify
  const spotifyAIMode = useSpotifyAIMode();
  const spotifyAutoMode = useSpotifyAutoMode();

  // Hook pour le mode Quiz (uniquement pour storeQuizData)
  const quizMode = useQuizMode(sessionId, null, [], null);

  const MAX_POLL_ATTEMPTS = 100; // 5 minutes (3s interval)

  // ========== SYNCHRONISATION JOUEURS ==========

  useEffect(() => {
    if (!sessionId) return;

    // Écouter les joueurs connectés dans Firebase
    // Les joueurs peuvent être dans team1 ou team2 (mode Team) ou team1 (mode Quiz)
    const team1Ref = ref(database, `sessions/${sessionId}/players_session/team1`);
    const team2Ref = ref(database, `sessions/${sessionId}/players_session/team2`);

    let team1Players = [];
    let team2Players = [];

    const updatePlayers = () => {
      const allPlayers = [...team1Players, ...team2Players];
      setPlayers(allPlayers);
    };

    const unsubscribe1 = onValue(team1Ref, (snapshot) => {
      const team1Data = snapshot.val();
      team1Players = team1Data ? Object.entries(team1Data)
        .filter(([_, player]) => player.connected)
        .map(([key, player]) => ({
          id: player.id || key,
          name: player.name,
          photo: player.photo,
          team: 'team1'
        })) : [];
      updatePlayers();
    });

    const unsubscribe2 = onValue(team2Ref, (snapshot) => {
      const team2Data = snapshot.val();
      team2Players = team2Data ? Object.entries(team2Data)
        .filter(([_, player]) => player.connected)
        .map(([key, player]) => ({
          id: player.id || key,
          name: player.name,
          photo: player.photo,
          team: 'team2'
        })) : [];
      updatePlayers();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [sessionId]);

  // ========== GÉNÉRATION AUTOMATIQUE AU MONTAGE ==========

  useEffect(() => {
    // Lancer automatiquement la génération de playlist au montage du composant
    // SEULEMENT si on n'a pas déjà une playlist prête
    if (players.length > 0 && !playlistReady && !isGeneratingPlaylist && !generationError) {
      console.log('🚀 [StepReadyToStart] Lancement automatique de la génération');
      handleGeneratePlaylist();
    }
  }, [players.length]); // Déclencher quand les joueurs sont chargés

  // ========== TRANSITION AUTOMATIQUE VERS GAME_PLAYING ==========

  useEffect(() => {
    // Une fois que la playlist est prête ET les questions (si Quiz) sont prêtes
    // Démarrer automatiquement la partie
    const playMode = sessionData?.playMode || 'team';
    const isReady = playlistReady && (playMode === 'team' || (playMode === 'quiz' && questionsReady));

    if (isReady && !loading && playlist.length > 0) {
      console.log('✅ [StepReadyToStart] Playlist et questions prêtes → Démarrage automatique');

      // Attendre 1 seconde pour que l'utilisateur voie le message de succès
      setTimeout(() => {
        handleStartGame();
      }, 1000);
    }
  }, [playlistReady, questionsReady, playlist.length, sessionData?.playMode, loading]);

  // ========== HANDLERS ==========

  /**
   * Génère la playlist selon la source musicale configurée
   */
  const handleGeneratePlaylist = async () => {
    setIsGeneratingPlaylist(true);
    setGenerationError('');

    const musicSource = sessionData?.musicSource;
    const playMode = sessionData?.playMode || 'team';

    console.log('🎵 Génération playlist - Source:', musicSource, 'Mode:', playMode);

    try {
      // === CAS 1: MP3 Local ===
      if (musicSource === 'mp3') {
        console.log('📂 Utilisation des fichiers MP3 locaux');
        const mp3Files = sessionData?.musicConfigData?.playlist || [];
        setPlaylist(mp3Files);
        setPlaylistReady(true);
        setIsGeneratingPlaylist(false);

        // En mode Quiz, générer automatiquement les questions
        // On passe mp3Files directement car l'état n'est pas encore mis à jour
        if (playMode === 'quiz') {
          await handleGenerateQuizQuestions(mp3Files);
        }
        return;
      }

      // === CAS 2 & 3: Spotify (Auto ou IA) ===
      if (musicSource === 'spotify-auto' || musicSource === 'spotify-ai') {
        // Récupérer ou générer l'ID de playlist
        let playlistId = sessionData?.playlistId;

        if (!playlistId) {
          // Générer un ID de playlist basé sur le sessionId
          // Le format attendu est l'ID réel d'une playlist Spotify
          // Pour l'instant, on ne peut pas procéder sans playlist ID
          throw new Error('Playlist Spotify non configurée. Veuillez sélectionner une playlist à l\'étape 2.');
        }

        // === SPOTIFY-AI : Génération avec préférences ===
        if (musicSource === 'spotify-ai') {
          console.log('🤖 Génération IA avec préférences des joueurs');

          // Formater les joueurs pour n8n
          const playersFormatted = players.map(p => ({
            name: p.name,
            age: p.age || 25,
            genres: p.genres || ['Pop', 'Rock'],
            specialPhrase: p.specialPhrase || ''
          }));

          // Appel n8n pour générer (retournera des stubs si mode Test activé)
          const netlifyCallbackUrl = window.location.origin;

          const generatePromise = n8nService.generatePlaylistWithAllPreferences({
            playlistId,
            players: playersFormatted,
            netlifyCallbackUrl
          });

          // 🎭 Mode Test : Utiliser directement les stubs sans polling Spotify
          if (testMode) {
            console.log('🎭 [TEST MODE] Utilisation directe des chansons stub (skip polling Spotify)');

            generatePromise
              .then(result => {
                console.log('✅ Playlist stub générée:', result);
                console.log(`   🎵 ${result.totalSongs} chansons stub pour ${result.totalPlayers || playersFormatted.length} joueurs`);

                // Convertir les chansons stub au format attendu par setPlaylist
                const stubTracks = result.songs.map((song, index) => ({
                  spotifyUri: song.uri,
                  title: song.title,
                  artist: song.artist,
                  imageUrl: 'https://via.placeholder.com/300?text=Test+Mode',
                  duration: 180, // 3 minutes en secondes (utilisé pour le calcul des points)
                  durationMs: 180000, // 3 minutes en millisecondes (pour compatibilité)
                  previewUrl: null
                }));

                setPlaylist(stubTracks);
                setPlaylistReady(true);
                setIsGeneratingPlaylist(false);
                setPlaylistPollAttempt(0);

                console.log(`✅ [TEST MODE] Playlist stub créée avec ${stubTracks.length} chansons !`);

                // En mode Quiz, générer automatiquement les questions
                // On passe stubTracks directement car l'état n'est pas encore mis à jour
                if (playMode === 'quiz') {
                  handleGenerateQuizQuestions(stubTracks);
                }
              })
              .catch(error => {
                console.error('❌ Erreur génération playlist stub:', error);
                setGenerationError('Erreur lors de la génération de la playlist stub');
                setIsGeneratingPlaylist(false);
                setPlaylistPollAttempt(0);
              });

            return; // Skip le polling Spotify
          }

          // Mode Production : Polling Firebase pour notification callback
          console.log('🔔 Génération async lancée, écoute Firebase...');

          let pollAttempts = 0;
          const pollInterval = 3000; // 3s

          const pollPlaylist = setInterval(async () => {
            pollAttempts++;
            setPlaylistPollAttempt(pollAttempts);

            try {
              // ⚠️ IMPORTANT: n8n écrit dans playlists/{playlistId} avec status="playlist_ready"
              // et NON dans sessions/{sessionId}/playlistGeneration
              const playlistGenRef = ref(database, `playlists/${playlistId}`);
              const snapshot = await new Promise((resolve) => {
                onValue(playlistGenRef, resolve, { onlyOnce: true });
              });

              const genData = snapshot.val();

              if (genData && genData.status === 'playlist_ready') {
                console.log('✅ Notification reçue via Firebase');
                clearInterval(pollPlaylist);

                const tracks = await spotifyAIMode.loadPlaylistById(playlistId, setPlaylist);

                if (tracks && tracks.length > 0) {
                  console.log(`✅ ${tracks.length} chansons chargées`);
                  setPlaylistReady(true);
                  setIsGeneratingPlaylist(false);

                  if (playMode === 'quiz') {
                    await handleGenerateQuizQuestions(tracks);
                  }
                }
              } else if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                console.warn('⚠️ Timeout - Fallback sur polling Spotify');
                // Fallback : essayer quand même de charger depuis Spotify
                const tracks = await spotifyAIMode.loadPlaylistById(playlistId, setPlaylist);
                if (tracks && tracks.length > 0) {
                  console.log(`✅ ${tracks.length} chansons récupérées (fallback)`);
                  setPlaylistReady(true);
                  setIsGeneratingPlaylist(false);
                  if (playMode === 'quiz') {
                    await handleGenerateQuizQuestions(tracks);
                  }
                } else {
                  setGenerationError('Timeout');
                  setIsGeneratingPlaylist(false);
                }
                clearInterval(pollPlaylist);
              }
            } catch (error) {
              console.error('❌ Erreur:', error);
              if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                setGenerationError('Erreur');
                setIsGeneratingPlaylist(false);
                clearInterval(pollPlaylist);
              }
            }
          }, pollInterval);

        } else {
          // === SPOTIFY-AUTO : Charger playlist existante ===

          // 🎭 Mode Test : Générer des stubs au lieu de charger depuis Spotify
          if (testMode) {
            console.log('🎭 [TEST MODE] Génération playlist stub pour Spotify-Auto');

            // Générer une playlist stub générique
            const { generateStubPlaylist } = await import('../../../utils/quizStubs');
            const result = await generateStubPlaylist({
              playlistId,
              players: players.map(p => ({
                name: p.name,
                age: 25,
                genres: ['Pop', 'Rock', 'Electronic']
              }))
            });

            const stubTracks = result.songs.map(song => ({
              spotifyUri: song.uri,
              title: song.title,
              artist: song.artist,
              imageUrl: 'https://via.placeholder.com/300?text=Test+Mode',
              duration: 180, // 3 minutes en secondes (utilisé pour le calcul des points)
              durationMs: 180000, // 3 minutes en millisecondes (pour compatibilité)
              previewUrl: null
            }));

            setPlaylist(stubTracks);
            setPlaylistReady(true);
            setIsGeneratingPlaylist(false);

            console.log(`✅ [TEST MODE] Playlist stub créée avec ${stubTracks.length} chansons`);

            // En mode Quiz, générer automatiquement les questions
            // On passe stubTracks directement car l'état n'est pas encore mis à jour
            if (playMode === 'quiz') {
              await handleGenerateQuizQuestions(stubTracks);
            }
          } else {
            // Mode Production : Charger depuis Spotify
            console.log('🎵 Chargement playlist Spotify existante');
            const tracks = await spotifyAutoMode.loadPlaylistById(playlistId, setPlaylist);

            if (tracks && tracks.length > 0) {
              setPlaylistReady(true);
              setIsGeneratingPlaylist(false);

              // En mode Quiz, générer automatiquement les questions
              // On passe tracks directement car l'état peut ne pas être encore mis à jour
              if (playMode === 'quiz') {
                await handleGenerateQuizQuestions(tracks);
              }
            } else {
              throw new Error('Playlist vide ou introuvable');
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ Erreur génération playlist:', error);
      setGenerationError(error.message || 'Erreur lors de la génération');
      setIsGeneratingPlaylist(false);
    }
  };

  /**
   * Génère les questions Quiz (uniquement en mode Quiz)
   * Appelle n8nService.generateWrongAnswers qui gère automatiquement le mode Test
   * @param {Array} playlistToUse - Playlist optionnelle à utiliser (si pas encore dans l'état)
   */
  const handleGenerateQuizQuestions = async (playlistToUse = null) => {
    if (sessionData?.playMode !== 'quiz') return;

    // Utiliser la playlist fournie en paramètre ou celle de l'état
    const playlistData = playlistToUse || playlist;

    if (playlistData.length === 0) {
      console.warn('⚠️ Pas de playlist pour générer les questions');
      return;
    }

    setIsGeneratingQuestions(true);
    console.log('🎲 Génération des wrongAnswers pour', playlistData.length, 'chansons');

    try {
      // Formater les chansons pour n8nService
      const songsForWrongAnswers = playlistData
        .map((track) => ({
          artist: track.artist,
          title: track.title,
          uri: track.spotifyUri || track.uri
        }))
        .filter((song) => {
          if (!song.uri) {
            console.warn(`⚠️ Chanson ignorée: pas d'URI`, song);
            return false;
          }
          return true;
        });

      console.log(`📤 Envoi de ${songsForWrongAnswers.length} chansons à n8n...`);

      // 🔄 Découper en batches de 10 chansons pour éviter le timeout
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < songsForWrongAnswers.length; i += batchSize) {
        batches.push(songsForWrongAnswers.slice(i, i + batchSize));
      }

      const allWrongAnswers = [];

      // Traiter chaque batch séquentiellement
      for (let batchNum = 0; batchNum < batches.length; batchNum++) {
        const batch = batches[batchNum];
        console.log(`🔄 Batch ${batchNum + 1}/${batches.length}: ${batch.length} chansons`);

        try {
          // n8nService.generateWrongAnswers gère le mode Test automatiquement
          const wrongAnswersResponse = await n8nService.generateWrongAnswers(batch);

          // Ajouter les wrongAnswers de ce batch
          for (let i = 0; i < batch.length; i++) {
            if (!batch[i].uri) {
              console.warn(`⚠️ Chanson sans URI ignorée:`, batch[i]);
              continue;
            }
            const wrongAnswersData = wrongAnswersResponse.wrongAnswers[i];
            allWrongAnswers.push({
              uri: batch[i].uri,
              title: batch[i].title,
              artist: batch[i].artist,
              wrongAnswers: wrongAnswersData ? wrongAnswersData.wrongAnswers : [
                `Fallback 1 - Song ${allWrongAnswers.length + 1}A`,
                `Fallback 2 - Song ${allWrongAnswers.length + 1}B`,
                `Fallback 3 - Song ${allWrongAnswers.length + 1}C`
              ]
            });
          }

          console.log(`✅ Batch ${batchNum + 1}/${batches.length} terminé`);
        } catch (error) {
          console.error(`❌ Erreur batch ${batchNum + 1}:`, error);
          // Ajouter des fallbacks pour ce batch en cas d'erreur
          for (let i = 0; i < batch.length; i++) {
            if (!batch[i].uri) {
              console.warn(`⚠️ Chanson sans URI ignorée (fallback):`, batch[i]);
              continue;
            }
            allWrongAnswers.push({
              uri: batch[i].uri,
              title: batch[i].title,
              artist: batch[i].artist,
              wrongAnswers: [
                `Fallback 1 - Song ${allWrongAnswers.length + 1}A`,
                `Fallback 2 - Song ${allWrongAnswers.length + 1}B`,
                `Fallback 3 - Song ${allWrongAnswers.length + 1}C`
              ]
            });
          }
        }
      }

      // Réinitialiser le classement Quiz avant de stocker les nouvelles données
      console.log('🧹 Réinitialisation du classement Quiz...');
      await quizMode.resetLeaderboard();

      // Sauvegarder dans Firebase via quizMode.storeQuizData
      // Cette fonction stocke les données au bon endroit : sessions/{sessionId}/quiz_data/{trackNumber}
      if (allWrongAnswers.length > 0) {
        console.log(`💾 Stockage de ${allWrongAnswers.length} questions Quiz dans Firebase...`);
        await quizMode.storeQuizData(allWrongAnswers);
        console.log(`✅ ${allWrongAnswers.length} questions Quiz stockées avec succès`);
      }

      setQuestionsReady(true);
      setIsGeneratingQuestions(false);
      console.log('✅ Questions Quiz générées avec succès');

    } catch (error) {
      console.error('❌ Erreur génération questions:', error);
      setGenerationError('Erreur lors de la génération des questions');
      setIsGeneratingQuestions(false);
    }
  };

  /**
   * Démarre la partie (après génération de playlist)
   */
  const handleStartGame = async () => {
    setLoading(true);
    try {
      // Sauvegarder la playlist dans Firebase avant de démarrer
      if (playlist.length > 0) {
        const sessionRef = ref(database, `sessions/${sessionId}/playlist`);
        await set(sessionRef, playlist);
        console.log(`💾 [StepReadyToStart] ${playlist.length} chansons sauvegardées dans Firebase`);
      }

      // Passer la playlist au parent pour qu'il la stocke dans sessionData
      await onStartGame(playlist);
    } catch (error) {
      console.error('❌ Erreur au démarrage:', error);
      alert('Erreur lors du démarrage de la partie. Veuillez réessayer.');
      setLoading(false);
    }
  };

  // ========== DONNÉES POUR L'AFFICHAGE ==========

  const playMode = sessionData?.playMode || 'team';
  const musicSource = sessionData?.musicSource || 'unknown';
  const musicConfig = sessionData?.musicConfigData || {};

  const getModeIcon = () => {
    return playMode === 'team' ? '👥' : '🎯';
  };

  const getModeLabel = () => {
    return playMode === 'team' ? 'Mode Équipe' : 'Mode Quiz';
  };

  const getModeDescription = () => {
    return playMode === 'team'
      ? 'Les joueurs s\'affrontent en buzzant sur les chansons'
      : 'Les joueurs répondent à des questions à choix multiples';
  };

  const getMusicSourceLabel = () => {
    switch (musicSource) {
      case 'mp3':
        return '📤 Fichiers MP3 locaux';
      case 'spotify-auto':
        return '🎵 Playlist Spotify';
      case 'spotify-ai':
        return '🤖 Playlist générée par IA';
      default:
        return '🎵 Musique';
    }
  };

  const getMusicDetails = () => {
    if (musicSource === 'mp3' && musicConfig.files) {
      return `${musicConfig.files.length} fichier${musicConfig.files.length > 1 ? 's' : ''} uploadé${musicConfig.files.length > 1 ? 's' : ''}`;
    }
    if (musicSource === 'spotify-auto' && musicConfig.playlistName) {
      return `Playlist: ${musicConfig.playlistName}`;
    }
    if (musicSource === 'spotify-ai' && musicConfig.preferences) {
      return `Préférences: ${musicConfig.preferences}`;
    }
    return 'Configurée';
  };

  // ========== RENDU ==========

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      color: 'white',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem'
        }}>
          {/* Bouton retour */}
          {onBack && (
            <button
              onClick={onBack}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '0.5rem',
                color: 'white',
                fontSize: '0.9rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: loading ? 0.5 : 1
              }}
            >
              ← Retour
            </button>
          )}

          {/* Titre */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem'
            }}>
              Prêt à démarrer !
            </h1>
            <p style={{
              fontSize: '1rem',
              opacity: 0.9
            }}>
              Vérifiez la configuration avant de lancer la partie
            </p>
          </div>

          <div style={{ width: '100px' }} /> {/* Spacer */}
        </div>

        {/* Barre de progression */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'center'
        }}>
          <div style={{
            flex: 1,
            maxWidth: '150px',
            height: '4px',
            backgroundColor: '#10b981',
            borderRadius: '2px'
          }} />
          <div style={{
            flex: 1,
            maxWidth: '150px',
            height: '4px',
            backgroundColor: '#10b981',
            borderRadius: '2px'
          }} />
          <div style={{
            flex: 1,
            maxWidth: '150px',
            height: '4px',
            backgroundColor: '#10b981',
            borderRadius: '2px'
          }} />
        </div>
      </div>

      {/* Contenu principal: Récapitulatif */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Carte: Mode de jeu */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '1rem',
          padding: '2rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              fontSize: '3rem',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem'
            }}>
              {getModeIcon()}
            </div>
            <div>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem'
              }}>
                {getModeLabel()}
              </h2>
              <p style={{
                fontSize: '1rem',
                opacity: 0.9
              }}>
                {getModeDescription()}
              </p>
            </div>
          </div>
        </div>

        {/* Carte: Joueurs */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '1rem',
          padding: '2rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <div style={{
              fontSize: '3rem',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem'
            }}>
              👤
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem'
              }}>
                {players.length} joueur{players.length > 1 ? 's' : ''} connecté{players.length > 1 ? 's' : ''}
              </h2>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginTop: '1rem'
              }}>
                {players.map((player) => (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      padding: '0.5rem 1rem',
                      borderRadius: '2rem',
                      fontSize: '0.9rem'
                    }}
                  >
                    {player.photo ? (
                      <img
                        src={player.photo}
                        alt={player.name}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}>
                        {player.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{player.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Carte: Musique */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '1rem',
          padding: '2rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <div style={{
              fontSize: '3rem',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem'
            }}>
              🎵
            </div>
            <div>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem'
              }}>
                {getMusicSourceLabel()}
              </h2>
              <p style={{
                fontSize: '1rem',
                opacity: 0.9
              }}>
                {getMusicDetails()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Progression automatique */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
        marginTop: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem'
      }}>
        {/* Message d'erreur */}
        {generationError && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            fontSize: '1rem',
            textAlign: 'center',
            maxWidth: '600px',
            width: '100%'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
            <div>{generationError}</div>
            <button
              onClick={() => {
                setGenerationError('');
                handleGeneratePlaylist();
              }}
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#10b981',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Progression de la génération */}
        {!generationError && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            textAlign: 'center'
          }}>
            {/* Étape 1: Génération playlist */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: isGeneratingPlaylist
                ? 'rgba(251, 191, 36, 0.2)'
                : playlistReady
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              borderRadius: '0.75rem',
              border: isGeneratingPlaylist
                ? '2px solid rgba(251, 191, 36, 0.5)'
                : playlistReady
                ? '2px solid rgba(16, 185, 129, 0.5)'
                : '2px solid transparent'
            }}>
              <div style={{ fontSize: '2rem' }}>
                {isGeneratingPlaylist ? '⏳' : playlistReady ? '✅' : '⏹️'}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  Génération de la playlist
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  {isGeneratingPlaylist
                    ? playlistPollAttempt > 0
                      ? `Vérification ${playlistPollAttempt}/${MAX_POLL_ATTEMPTS}...`
                      : 'En cours...'
                    : playlistReady
                    ? `${playlist.length} chanson${playlist.length > 1 ? 's' : ''} prête${playlist.length > 1 ? 's' : ''}`
                    : 'En attente...'}
                </div>
              </div>
              {isGeneratingPlaylist && (
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '4px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              )}
            </div>

            {/* Étape 2: Génération questions (Quiz uniquement) */}
            {sessionData?.playMode === 'quiz' && playlistReady && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: isGeneratingQuestions
                  ? 'rgba(251, 191, 36, 0.2)'
                  : questionsReady
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(255, 255, 255, 0.05)',
                borderRadius: '0.75rem',
                border: isGeneratingQuestions
                  ? '2px solid rgba(251, 191, 36, 0.5)'
                  : questionsReady
                  ? '2px solid rgba(16, 185, 129, 0.5)'
                  : '2px solid transparent'
              }}>
                <div style={{ fontSize: '2rem' }}>
                  {isGeneratingQuestions ? '⏳' : questionsReady ? '✅' : '⏹️'}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    Génération des questions
                  </div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                    {isGeneratingQuestions
                      ? 'En cours...'
                      : questionsReady
                      ? 'Questions prêtes !'
                      : 'En attente...'}
                  </div>
                </div>
                {isGeneratingQuestions && (
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '4px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
              </div>
            )}

            {/* Étape 3: Démarrage */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              backgroundColor: loading
                ? 'rgba(251, 191, 36, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              borderRadius: '0.75rem',
              border: loading
                ? '2px solid rgba(251, 191, 36, 0.5)'
                : '2px solid transparent'
            }}>
              <div style={{ fontSize: '2rem' }}>
                {loading ? '🚀' : '⏹️'}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  Démarrage de la partie
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  {loading
                    ? 'Initialisation...'
                    : 'En attente...'}
                </div>
              </div>
              {loading && (
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '4px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Animation CSS pour le spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
