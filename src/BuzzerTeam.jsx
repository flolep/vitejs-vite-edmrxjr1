import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, set, onValue, remove, serverTimestamp } from 'firebase/database';
import { airtableService } from './airtableService';
import { useBuzzerLocalStorage } from './hooks/buzzer/useBuzzerLocalStorage';
import { useBuzzerCamera } from './hooks/buzzer/useBuzzerCamera';
import { useBuzzerSession } from './hooks/buzzer/useBuzzerSession';
import { NameScreen } from './components/buzzer/screens/NameScreen';
import { SelectScreen } from './components/buzzer/screens/SelectScreen';
import { PhotoScreen } from './components/buzzer/screens/PhotoScreen';
import { PreferencesScreen } from './components/buzzer/screens/PreferencesScreen';
import CooldownText from './components/buzzer/CooldownText';

/**
 * Mode Équipe avec Buzzer
 * Flux : session → name → select → photo → TEAM → preferences → game
 */
export default function BuzzerTeam({ sessionIdFromRouter = null }) {
  // Hooks personnalisés
  const { sessionId, sessionValid, isLoading, isPlaying } = useBuzzerSession(sessionIdFromRouter);
  const localStorage = useBuzzerLocalStorage();
  const camera = useBuzzerCamera();

  // États du flux
  const [step, setStep] = useState('name'); // 'name' | 'select' | 'photo' | 'team' | 'preferences' | 'game'
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // États joueur
  const [playerName, setPlayerName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // États équipe
  const [team, setTeam] = useState(null);
  const [playerFirebaseKey, setPlayerFirebaseKey] = useState(null);

  // États préférences
  const [playerAge, setPlayerAge] = useState('');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [specialPhrase, setSpecialPhrase] = useState('');

  // États jeu
  const [buzzed, setBuzzed] = useState(false);
  const [someoneBuzzed, setSomeoneBuzzed] = useState(false);
  const [buzzerEnabled, setBuzzerEnabled] = useState(true);
  const [cooldownEnd, setCooldownEnd] = useState(null);

  // ========== HANDLERS - NAME SCREEN ==========

  const handleSearchPlayer = async () => {
    if (!playerName.trim()) {
      setError('Veuillez saisir un prénom');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const result = await airtableService.findPlayer(playerName);

      if (result.found && result.count > 0) {
        setSearchResults(result.players);
        setStep('select');
      } else {
        // Pas de joueur trouvé, passer à la photo
        setStep('photo');
        camera.startCamera();
      }
    } catch (err) {
      console.error('Erreur recherche:', err);
      setError('Erreur lors de la recherche. Continuons sans photo.');
      setStep('photo');
      camera.startCamera();
    } finally {
      setIsSearching(false);
    }
  };

  // ========== HANDLERS - SELECT SCREEN ==========

  const handleSelectPlayer = (player) => {
    setSelectedPlayer(player);
    localStorage.save({ selectedPlayer: player, playerName: player.name });

    // Toujours passer au choix d'équipe en mode Team
    // La vérification de gameAlreadyStarted se fait après le choix d'équipe
    setStep('team');
  };

  const handleCreateNewPlayer = () => {
    setSearchResults([]);
    setStep('photo');
    camera.startCamera();
  };

  // ========== HANDLERS - PHOTO SCREEN ==========

  const handleSkipPhoto = () => {
    camera.stopCamera();
    setStep('team'); // Mode équipe : team avant prefs
  };

  const handleConfirmSelfie = async () => {
    setIsSearching(true);

    try {
      const playerData = {
        name: playerName,
        photo: camera.photoData,
        firstSeen: new Date().toISOString()
      };

      const result = await airtableService.createPlayer(playerData);

      const newPlayer = {
        id: result.id,
        name: playerName,
        photo: camera.photoData
      };

      setSelectedPlayer(newPlayer);
      localStorage.save({ selectedPlayer: newPlayer, playerName, photoData: camera.photoData });

      setStep('team'); // Mode équipe : team avant prefs
    } catch (err) {
      console.error('Erreur création joueur:', err);
      setError('Erreur lors de la sauvegarde. Continuons quand même !');

      // Fallback
      setTimeout(() => {
        const fallbackPlayer = { name: playerName };
        setSelectedPlayer(fallbackPlayer);
        localStorage.save({ selectedPlayer: fallbackPlayer, playerName, photoData: camera.photoData });
        setStep('team');
      }, 2000);
    } finally {
      setIsSearching(false);
    }
  };

  // ========== HANDLERS - TEAM SCREEN ==========

  const handleSelectTeam = async (teamNumber) => {
    const teamKey = `team${teamNumber}`;
    const playersRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}`);

    try {
      // Vérifier si un joueur avec le même nom existe déjà
      const snapshot = await new Promise((resolve) => {
        onValue(playersRef, resolve, { onlyOnce: true });
      });

      const existingPlayers = snapshot.val() || {};
      const currentPlayerName = selectedPlayer?.name || playerName;

      // Chercher un joueur existant avec le même nom
      let existingPlayerKey = null;
      for (const [key, player] of Object.entries(existingPlayers)) {
        if (player.name === currentPlayerName) {
          existingPlayerKey = key;
          console.log('⚠️ Joueur existant trouvé:', currentPlayerName, 'clé:', key);
          break;
        }
      }

      // Utiliser la clé existante ou créer une nouvelle
      const playerKey = existingPlayerKey || `player_${Date.now()}`;
      const playerRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}/${playerKey}`);

      const playerData = {
        id: selectedPlayer?.id || `temp_${playerName}`,
        name: currentPlayerName,
        photo: selectedPlayer?.photo || camera.photoData || null,
        status: 'idle',
        cooldownEnd: null,
        hasCooldownPending: false,
        buzzCount: existingPlayerKey ? existingPlayers[existingPlayerKey].buzzCount || 0 : 0,
        correctCount: existingPlayerKey ? existingPlayers[existingPlayerKey].correctCount || 0 : 0,
        consecutiveCorrect: 0,
        joinedAt: existingPlayerKey ? existingPlayers[existingPlayerKey].joinedAt : Date.now()
      };

      await set(playerRef, playerData);
      setPlayerFirebaseKey(playerKey);
      setTeam(teamNumber);

      localStorage.save({ team: teamNumber, playerFirebaseKey: playerKey });

      console.log('✅ Joueur enregistré dans', teamKey, 'clé:', playerKey);

      // Aller aux préférences ou directement au jeu
      // Si la partie a déjà commencé (au moins une chanson jouée), skip les préférences
      const gameStarted = window.localStorage.getItem('gameAlreadyStarted') === 'true';
      console.log('🎮 gameAlreadyStarted:', gameStarted);
      if (gameStarted) {
        console.log('⚡ Partie déjà commencée → skip préférences, aller directement au jeu');
        setStep('game');
      } else {
        console.log('🎵 Partie pas encore commencée → demander les préférences');
        setStep('preferences');
      }
    } catch (error) {
      console.error('❌ Erreur enregistrement joueur:', error);
      setStep('preferences'); // Continuer malgré l'erreur
    }
  };

  // ========== HANDLERS - PREFERENCES SCREEN ==========

  const handleToggleGenre = (genre) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else if (selectedGenres.length < 3) {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleSubmitPreferences = async () => {
    if (!playerAge || selectedGenres.length === 0) {
      setError('Veuillez remplir au moins l\'âge et choisir des genres');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const playerId = selectedPlayer?.id || `temp_${playerName}`;

      const preferencesData = {
        name: selectedPlayer?.name || playerName,
        photo: selectedPlayer?.photo || camera.photoData || null,
        age: parseInt(playerAge),
        genres: selectedGenres,
        specialPhrase: specialPhrase || ''
      };

      const response = await fetch('/.netlify/functions/save-player-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          playerId,
          preferences: preferencesData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur serveur');
      }

      localStorage.save({ playerAge, selectedGenres, specialPhrase });

      console.log('✅ Préférences enregistrées');
      setStep('game');
    } catch (err) {
      console.error('❌ Erreur préférences:', err);
      setError(`❌ Erreur: ${err.message || 'Impossible de sauvegarder'}`);
    } finally {
      setIsSearching(false);
    }
  };

  // ========== HANDLERS - GAME SCREEN ==========

  const handleBuzz = async () => {
    const isInCooldown = cooldownEnd && cooldownEnd > Date.now();
    if (!buzzerEnabled || someoneBuzzed || !isPlaying || isInCooldown) {
      if (isInCooldown) {
        console.log('🔥 Buzz bloqué : cooldown actif');
      }
      return;
    }

    setBuzzed(true);
    setBuzzerEnabled(false);

    const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
    const buzzPayload = {
      type: 'BUZZ',
      team: `team${team}`,
      teamName: team === 1 ? 'Équipe 1' : 'Équipe 2',
      playerName: selectedPlayer?.name || playerName,
      playerId: selectedPlayer?.id || `temp_${playerName}`,
      playerPhoto: selectedPlayer?.photo || camera.photoData || null,
      playerFirebaseKey: playerFirebaseKey,
      timestamp: serverTimestamp() // ✅ Timestamp serveur Firebase pour précision absolue
    };

    await set(buzzRef, buzzPayload);

    // Vibration
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  // Écouter si quelqu'un a buzzé
  useEffect(() => {
    if (!sessionValid || !sessionId) return;

    const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
    const unsubscribe = onValue(buzzRef, (snapshot) => {
      const buzzData = snapshot.val();
      if (buzzData) {
        setSomeoneBuzzed(true);
        setBuzzerEnabled(false);
      } else {
        setSomeoneBuzzed(false);
        setBuzzerEnabled(true);
        setBuzzed(false);
      }
    });

    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter le cooldown du joueur
  useEffect(() => {
    if (!team || !sessionValid || !sessionId) return;

    const teamKey = `team${team}`;
    const playersRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}`);

    const unsubscribe = onValue(playersRef, (snapshot) => {
      const players = snapshot.val();
      if (players) {
        Object.values(players).forEach(player => {
          if (player.name === (selectedPlayer?.name || playerName)) {
            if (player.cooldownEnd && player.cooldownEnd > Date.now()) {
              setCooldownEnd(player.cooldownEnd);
            } else {
              setCooldownEnd(null);
            }
          }
        });
      }
    });

    return () => unsubscribe();
  }, [team, selectedPlayer, playerName, sessionValid, sessionId]);

  // Compte à rebours du cooldown optimisé
  // Déplacé dans le composant CooldownText pour éviter les re-renders fréquents
  useEffect(() => {
    if (!cooldownEnd) return;

    const checkEnd = setInterval(() => {
      if (Date.now() >= cooldownEnd) {
        setCooldownEnd(null);
        clearInterval(checkEnd);
      }
    }, 500); // Check moins fréquent, juste pour l'état global

    return () => clearInterval(checkEnd);
  }, [cooldownEnd]);

  // ========== RENDU DES ÉCRANS ==========

  // Écran de chargement pendant la vérification de la session
  if (isLoading) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center">
          <h2 className="title">Chargement...</h2>
          <div style={{ fontSize: '3rem', marginTop: '1rem' }}>⏳</div>
        </div>
      </div>
    );
  }

  // Session invalide après vérification
  if (!sessionValid) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center">
          <h2 className="title">⚠️ Session invalide</h2>
          <p>Scannez le QR Code pour rejoindre la partie.</p>
        </div>
      </div>
    );
  }

  if (step === 'name') {
    return (
      <NameScreen
        playerName={playerName}
        onPlayerNameChange={setPlayerName}
        onSubmit={handleSearchPlayer}
        isSearching={isSearching}
        error={error}
      />
    );
  }

  if (step === 'select') {
    return (
      <SelectScreen
        searchResults={searchResults}
        onSelectPlayer={handleSelectPlayer}
        onCreateNew={handleCreateNewPlayer}
      />
    );
  }

  if (step === 'photo') {
    return (
      <PhotoScreen
        videoRef={camera.videoRef}
        canvasRef={camera.canvasRef}
        photoData={camera.photoData}
        onTakePhoto={camera.takeSelfie}
        onRetake={camera.retakeSelfie}
        onConfirm={handleConfirmSelfie}
        onSkip={handleSkipPhoto}
        isConfirming={isSearching}
        error={camera.error}
      />
    );
  }

  if (step === 'team') {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '600px', width: '100%', padding: '2rem' }}>
          <h1 className="title">👥 Choisissez votre équipe</h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
            <button
              onClick={() => handleSelectTeam(1)}
              className="btn"
              style={{
                padding: '2rem',
                fontSize: '2rem',
                backgroundColor: '#ef4444',
                border: '4px solid #fff'
              }}
            >
              🔴 ÉQUIPE 1
            </button>

            <button
              onClick={() => handleSelectTeam(2)}
              className="btn"
              style={{
                padding: '2rem',
                fontSize: '2rem',
                backgroundColor: '#3b82f6',
                border: '4px solid #fff'
              }}
            >
              🔵 ÉQUIPE 2
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'preferences') {
    return (
      <PreferencesScreen
        playerAge={playerAge}
        onPlayerAgeChange={setPlayerAge}
        selectedGenres={selectedGenres}
        onToggleGenre={handleToggleGenre}
        specialPhrase={specialPhrase}
        onSpecialPhraseChange={setSpecialPhrase}
        onSubmit={handleSubmitPreferences}
        isSubmitting={isSearching}
        error={error}
      />
    );
  }

  if (step === 'game') {
    const isInCooldown = cooldownEnd && cooldownEnd > Date.now();
    const bgClass = team === 1 ? 'bg-gradient-red' : 'bg-gradient-blue';

    return (
      <div className={`${bgClass} flex-center`} style={{ minHeight: '100vh' }}>
        <div className="text-center" style={{ padding: '2rem', maxWidth: '600px', width: '100%' }}>
          {/* En-tête */}
          <div style={{ marginBottom: '2rem' }}>
            {selectedPlayer?.photo && (
              <img
                src={selectedPlayer.photo}
                alt={selectedPlayer.name}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  margin: '0 auto 1rem',
                  border: '4px solid white'
                }}
              />
            )}
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              {selectedPlayer?.name || playerName}
            </h2>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {team === 1 ? '🔴 ÉQUIPE 1' : '🔵 ÉQUIPE 2'}
            </div>
          </div>

          {/* Buzzer */}
          {!isPlaying && (
            <div style={{ fontSize: '1.5rem', marginBottom: '2rem', opacity: 0.8 }}>
              ⏸️ En attente de la musique...
            </div>
          )}

          {isInCooldown && (
            <CooldownText cooldownEnd={cooldownEnd} />
          )}

          <button
            onClick={handleBuzz}
            disabled={!isPlaying || someoneBuzzed || isInCooldown}
            style={{
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              fontSize: '4rem',
              fontWeight: 'bold',
              border: '10px solid white',
              backgroundColor: buzzed ? '#fbbf24' : (someoneBuzzed || isInCooldown) ? '#6b7280' : team === 1 ? '#ef4444' : '#3b82f6',
              color: 'white',
              cursor: (isPlaying && !someoneBuzzed && !isInCooldown) ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              opacity: (someoneBuzzed || isInCooldown) ? 0.5 : 1,
              transform: buzzed ? 'scale(1.1)' : 'scale(1)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
            }}
          >
            {buzzed ? '✅' : '🔔'}
          </button>

          {someoneBuzzed && !buzzed && (
            <div style={{ marginTop: '2rem', fontSize: '1.25rem', opacity: 0.8 }}>
              Quelqu'un a déjà buzzé !
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
