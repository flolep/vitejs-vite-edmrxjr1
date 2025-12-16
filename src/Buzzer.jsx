import React, { useState, useEffect, useRef } from 'react';
import { database } from './firebase';
import { ref, set, onValue, remove } from 'firebase/database';
import { airtableService } from './airtableService';
import { n8nService } from './n8nService';
import CooldownDisplay from './components/buzzer/CooldownDisplay';
import CooldownText from './components/buzzer/CooldownText';

export default function Buzzer() {
  // États de session
  const [sessionId, setSessionId] = useState('');
  const [sessionValid, setSessionValid] = useState(false);

  // États existants
  const [team, setTeam] = useState(null);
  const [buzzed, setBuzzed] = useState(false);
  const [buzzerEnabled, setBuzzerEnabled] = useState(true);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [someoneBuzzed, setSomeoneBuzzed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // NOUVEAUX états pour identification
  const [step, setStep] = useState('session'); // 'session' | 'name' | 'search' | 'select' | 'photo' | 'preferences' | 'team' | 'game'
  const [playerName, setPlayerName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [error, setError] = useState('');
  const [isReconnecting, setIsReconnecting] = useState(false);

  // NOUVEAUX états pour préférences joueur
  const [playerAge, setPlayerAge] = useState('');
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [specialPhrase, setSpecialPhrase] = useState('');
  const [playlistId, setPlaylistId] = useState(null);

  // Changement d'équipe - NOUVEAU
  const [playerFirebaseKey, setPlayerFirebaseKey] = useState(null);

  // Cooldown states
  const [cooldownEnd, setCooldownEnd] = useState(null);
  // cooldownRemaining supprimé car géré dans les composants enfants

  // Stats personnelles
  const [showStats, setShowStats] = useState(false);
  const [personalStats, setPersonalStats] = useState({
    totalBuzzes: 0,
    winningBuzzes: 0,
    totalPoints: 0,
    recognizedSongs: []
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const buzzerSoundRef = useRef(null); // Pour le son synthétique du buzzer

  // Créer le son de buzzer synthétique
  useEffect(() => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const playBuzzerSound = () => {
      const now = audioContext.currentTime;
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();

      osc1.connect(gain1);
      gain1.connect(audioContext.destination);

      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      osc1.type = 'sawtooth';

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.5, now + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc1.start(now);
      osc1.stop(now + 0.3);
    };

    buzzerSoundRef.current = { play: playBuzzerSound };
  }, []);

  // ========== FONCTIONS LOCALSTORAGE ==========

  const STORAGE_KEY = 'buzzer_session_data';

  // Sauvegarder l'état dans localStorage
  const saveToLocalStorage = (data) => {
    try {
      // Récupérer les données existantes pour préserver certains flags
      const existing = localStorage.getItem(STORAGE_KEY);
      const existingData = existing ? JSON.parse(existing) : {};

      const toSave = {
        sessionId: data.sessionId || sessionId,
        playerName: data.playerName || playerName,
        selectedPlayer: data.selectedPlayer || selectedPlayer,
        team: data.team !== undefined ? data.team : team,
        playerFirebaseKey: data.playerFirebaseKey || playerFirebaseKey,
        playerAge: data.playerAge || playerAge,
        selectedGenres: data.selectedGenres || selectedGenres,
        specialPhrase: data.specialPhrase || specialPhrase,
        photoData: data.photoData || photoData,
        gameAlreadyStarted: data.gameAlreadyStarted !== undefined ? data.gameAlreadyStarted : existingData.gameAlreadyStarted || false,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      console.log('✅ Session sauvegardée dans localStorage');
    } catch (err) {
      console.error('❌ Erreur sauvegarde localStorage:', err);
    }
  };

  // Charger l'état depuis localStorage
  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Vérifier que les données ne sont pas trop anciennes (3h max)
        const age = Date.now() - (data.timestamp || 0);
        if (age > 3 * 60 * 60 * 1000) {
          console.log('⚠️ Données localStorage trop anciennes, suppression');
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        console.log('✅ Données trouvées dans localStorage:', data);
        return data;
      }
    } catch (err) {
      console.error('❌ Erreur lecture localStorage:', err);
    }
    return null;
  };

  // Nettoyer localStorage
  const clearLocalStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('✅ localStorage nettoyé');
    } catch (err) {
      console.error('❌ Erreur nettoyage localStorage:', err);
    }
  };

  // Tentative de reconnexion automatique
  const attemptAutoReconnect = async (storedData) => {
    console.log('🔄 Tentative de reconnexion automatique...');
    setIsReconnecting(true);

    try {
      // Vérifier que la session existe toujours dans Firebase
      const sessionRef = ref(database, `sessions/${storedData.sessionId}`);

      return new Promise((resolve) => {
        onValue(sessionRef, async (snapshot) => {
          if (!snapshot.exists() || !snapshot.val().active) {
            console.log('❌ Session expirée ou inactive');
            clearLocalStorage();
            setIsReconnecting(false);
            resolve(false);
            return;
          }

          console.log('✅ Session toujours active');

          // Vérifier que le joueur existe toujours dans son équipe
          if (storedData.team && storedData.playerFirebaseKey) {
            const teamKey = `team${storedData.team}`;
            const playerRef = ref(database, `sessions/${storedData.sessionId}/players_session/${teamKey}/${storedData.playerFirebaseKey}`);

            onValue(playerRef, async (playerSnapshot) => {

              if (!playerSnapshot.exists()) {
                // Le joueur n'existe plus, il faut le recréer
                console.log('⚠️ Joueur non trouvé dans l\'équipe, recréation...');

                try {
                  const playerData = {
                    id: storedData.selectedPlayer?.id || `temp_${storedData.playerName}`,
                    name: storedData.selectedPlayer?.name || storedData.playerName,
                    photo: storedData.selectedPlayer?.photo || storedData.photoData || null,
                    status: 'idle',
                    cooldownEnd: null,
                    hasCooldownPending: false,
                    buzzCount: 0,
                    correctCount: 0,
                    consecutiveCorrect: 0,
                    joinedAt: Date.now()
                  };

                  await set(playerRef, playerData);
                  console.log('✅ Joueur recréé dans l\'équipe');
                } catch (err) {
                  console.error('❌ Erreur recréation joueur:', err);
                  setIsReconnecting(false);
                  resolve(false);
                  return;
                }
              } else {
                console.log('✅ Joueur trouvé dans l\'équipe');
              }

              // Restaurer tous les états
              setSessionId(storedData.sessionId);
              setSessionValid(true);
              setPlayerName(storedData.playerName);
              setSelectedPlayer(storedData.selectedPlayer);
              setTeam(storedData.team);
              setPlayerFirebaseKey(storedData.playerFirebaseKey);
              setPlayerAge(storedData.playerAge);
              setSelectedGenres(storedData.selectedGenres || []);
              setSpecialPhrase(storedData.specialPhrase || '');
              setPhotoData(storedData.photoData);
              setStep('game');

              console.log('✅ Reconnexion automatique réussie !');
              setIsReconnecting(false);
              resolve(true);
            }, { onlyOnce: true });
          } else {
            // Pas d'équipe, on revient à l'étape de sélection d'équipe
            setSessionId(storedData.sessionId);
            setSessionValid(true);
            setPlayerName(storedData.playerName);
            setSelectedPlayer(storedData.selectedPlayer);
            setPlayerAge(storedData.playerAge);
            setSelectedGenres(storedData.selectedGenres || []);
            setSpecialPhrase(storedData.specialPhrase || '');
            setPhotoData(storedData.photoData);
            setStep('team');

            console.log('✅ Reconnexion partielle (choix équipe nécessaire)');
            setIsReconnecting(false);
            resolve(true);
          }
        }, { onlyOnce: true });
      });
    } catch (err) {
      console.error('❌ Erreur reconnexion automatique:', err);
      clearLocalStorage();
      setIsReconnecting(false);
      return false;
    }
  };

  // Vérifier le code de session depuis l'URL et gérer la reconnexion
  useEffect(() => {
    const init = async () => {
      // Vérifier l'URL pour le sessionId
      const urlParams = new URLSearchParams(window.location.search);
      const sessionParam = urlParams.get('session');

      if (sessionParam) {
        // Vérifier localStorage : si session différente, nettoyer
        let storedData = loadFromLocalStorage();
        if (storedData && storedData.sessionId && storedData.sessionId !== sessionParam) {
          console.log('🔄 Nouvelle session détectée, nettoyage du localStorage');
          clearLocalStorage();
          storedData = null; // Clear the reference
        }

        setSessionId(sessionParam);

        // ✅ TENTER RECONNEXION D'ABORD (avant verifySession)
        // Si nous avons des données pour cette session, essayer de se reconnecter
        if (storedData && storedData.sessionId === sessionParam) {
          console.log('🔄 Données de session trouvées, tentative de reconnexion...');
          const reconnected = await attemptAutoReconnect(storedData);
          if (reconnected) {
            console.log('✅ Reconnexion automatique réussie');
            return; // Skip verifySession et le reste du flux
          }
          console.log('⚠️ Reconnexion échouée, redémarrage du flux');
          // localStorage est déjà nettoyé par attemptAutoReconnect en cas d'échec
        }

        // Seulement vérifier la session si on ne reconnecte pas, ou si la reconnexion a échoué
        await verifySession(sessionParam);
      }
    };

    init();
  }, []);

  // Fonction pour vérifier si la session existe et si la partie a démarré
  const verifySession = async (id) => {
    const sessionRef = ref(database, `sessions/${id}`);
    return new Promise((resolve) => {
      onValue(sessionRef, (snapshot) => {
        if (snapshot.exists() && snapshot.val().active) {
          setSessionValid(true);

          const sessionData = snapshot.val();
          const gameStarted = sessionData.isPlaying === true || (sessionData.currentTrack && sessionData.currentTrack > 0);

          if (gameStarted) {
            console.log('⚡ La partie a déjà démarré, skip préférences');
            // Stocker dans localStorage que la partie a démarré
            saveToLocalStorage({ sessionId: id, gameAlreadyStarted: true });
          } else {
            console.log('⏸️ La partie n\'a pas encore démarré');
            saveToLocalStorage({ sessionId: id, gameAlreadyStarted: false });
          }

          setStep('name');
          resolve(true);
        } else {
          setSessionValid(false);
          setError('Code de session invalide ou expiré');
          resolve(false);
        }
      }, { onlyOnce: true });
    });
  };

  // Fonction pour valider le code de session entré manuellement
  const handleJoinSession = () => {
    if (!sessionId || sessionId.trim().length !== 6) {
      setError('Le code doit contenir 6 caractères');
      return;
    }
    verifySession(sessionId.toUpperCase());
  };

  // Écouter les scores Firebase
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const scoresRef = ref(database, `sessions/${sessionId}/scores`);
    const unsubscribe = onValue(scoresRef, (snapshot) => {
      const scoresData = snapshot.val();
      if (scoresData) {
        setScores(scoresData);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Écouter si une chanson est en cours de lecture
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const playingRef = ref(database, `sessions/${sessionId}/isPlaying`);
    const unsubscribe = onValue(playingRef, (snapshot) => {
      const playingData = snapshot.val();
      setIsPlaying(playingData === true);
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

  // Récupérer l'ID de playlist depuis Firebase
  useEffect(() => {
    if (!sessionValid || !sessionId) return;
    const playlistIdRef = ref(database, `sessions/${sessionId}/playlistId`);
    const unsubscribe = onValue(playlistIdRef, (snapshot) => {
      const id = snapshot.val();
      if (id) {
        setPlaylistId(id);
        console.log('✅ Playlist ID récupéré:', id);
      }
    });
    return () => unsubscribe();
  }, [sessionValid, sessionId]);

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

  // Ajoutez cet useEffect pour écouter le cooldown du joueur
  useEffect(() => {
    if (!team || !selectedPlayer || !sessionValid || !sessionId) return;

    const teamKey = `team${team}`;
    const playersRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}`);

    const unsubscribe = onValue(playersRef, (snapshot) => {
      const players = snapshot.val();
      if (players) {
        // Trouver le joueur actuel
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

  // Gérer la caméra pour le selfie
  useEffect(() => {
    if (step === 'photo' && !photoData) {
      startCamera();
    }

    // Cleanup : arrêter la caméra si on quitte cette étape
    return () => {
      if (streamRef.current && step !== 'photo') {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [step, photoData]);

  // Compte à rebours du cooldown (Nettoyage seulement)
  // Optimisation: On ne met plus à jour le state 'cooldownRemaining' ici pour éviter
  // de re-render tout le composant Buzzer tous les 100ms.
  // La logique d'affichage est déléguée aux sous-composants CooldownDisplay et CooldownText.
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

  // NOUVEAU : Rechercher le joueur
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
        setStep('photo');
      }
    } catch (err) {
      console.error('Erreur recherche:', err);
      setError('Erreur lors de la recherche. Continuons sans photo.');
      goToNextStep();
    } finally {
      setIsSearching(false);
    }
  };

  // NOUVEAU : Sélectionner un joueur existant
  const handleSelectPlayer = (player) => {
    setSelectedPlayer(player);
    goToNextStep();
    // Sauvegarder le joueur sélectionné
    saveToLocalStorage({ selectedPlayer: player, playerName: player.name });
  };

  // NOUVEAU : Créer un nouveau joueur
  const handleCreateNewPlayer = () => {
    setSearchResults([]);
    setStep('photo');
  };

  // NOUVEAU : Démarrer la caméra
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Erreur caméra:', err);
      setError('Impossible d\'accéder à la caméra. Continuons sans photo.');
      setTimeout(() => goToNextStep(), 2000);
    }
  };

  // NOUVEAU : Prendre le selfie
  const takeSelfie = () => {
    if (canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setPhotoData(imageData);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  // NOUVEAU : Confirmer le selfie
  const confirmSelfie = async () => {
    setIsSearching(true);

    try {
      const playerData = {
        name: playerName,
        photo: photoData,
        firstSeen: new Date().toISOString()
      };

      const result = await airtableService.createPlayer(playerData);

      const newPlayer = {
        id: result.id,
        name: playerName,
        photo: photoData
      };

      setSelectedPlayer(newPlayer);
      goToNextStep();

      // Sauvegarder le nouveau joueur
      saveToLocalStorage({ selectedPlayer: newPlayer, playerName, photoData });
    } catch (err) {
      console.error('Erreur création joueur:', err);
      setError('Erreur lors de la sauvegarde. Continuons quand même !');
      setTimeout(() => {
        const fallbackPlayer = { name: playerName };
        setSelectedPlayer(fallbackPlayer);
        goToNextStep();
        // Sauvegarder quand même
        saveToLocalStorage({ selectedPlayer: fallbackPlayer, playerName, photoData });
      }, 2000);
    } finally {
      setIsSearching(false);
    }
  };

  // NOUVEAU : Retake selfie
  const retakeSelfie = () => {
    setPhotoData(null);
    startCamera();
  };

  // Helper : Décider de l'étape suivante selon si la partie a démarré
  const goToNextStep = () => {
    const storedData = loadFromLocalStorage();
    const gameAlreadyStarted = storedData?.gameAlreadyStarted === true;

    if (gameAlreadyStarted) {
      console.log('⚡ Partie démarrée → skip préférences, accès direct au choix d\'équipe');
      setStep('team');
    } else {
      console.log('⏸️ Partie non démarrée → demande des préférences');
      setStep('preferences');
    }
  };

  // Sauvegarder les préférences via fonction Netlify (sécurisé avec Firebase Admin SDK)
  // Le Master verra ces préférences et pourra générer la playlist avec TOUTES les préférences
  const savePreferencesToFirebase = async () => {
    try {
      console.log('💾 Sauvegarde des préférences via Netlify...');

      const playerId = selectedPlayer?.id || `temp_${playerName}`;

      const preferencesData = {
        name: selectedPlayer?.name || playerName,
        photo: selectedPlayer?.photo || photoData || null,
        age: parseInt(playerAge),
        genres: selectedGenres,
        specialPhrase: specialPhrase || ''
      };

      const response = await fetch('/.netlify/functions/save-player-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

      const result = await response.json();
      console.log('✅ Préférences sauvegardées:', result);

      return true;

    } catch (err) {
      console.error('❌ Erreur sauvegarde préférences:', err);
      throw err;
    }
  };

  // Valider les préférences
  const handleSubmitPreferences = async () => {
    // Validation
    if (!playerAge || selectedGenres.length === 0) {
      setError('Veuillez remplir au moins l\'âge et choisir des genres');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      // Sauvegarder dans Firebase
      await savePreferencesToFirebase();

      // Sauvegarder localement
      saveToLocalStorage({
        playerAge,
        selectedGenres,
        specialPhrase
      });

      console.log('✅ Préférences enregistrées. Le Master génèrera la playlist quand tous les joueurs seront prêts.');

      // Passer à l'étape suivante
      setStep('team');

    } catch (err) {
      console.error('❌ Erreur lors de la soumission des préférences:', err);
      setError(`❌ Erreur: ${err.message || 'Impossible de sauvegarder'}`);
    } finally {
      setIsSearching(false);
    }
  };

const selectTeam = async (teamNumber) => {
  const teamKey = `team${teamNumber}`;
  const playersRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}`);

  try {
    // ✅ VÉRIFIER SI UN JOUEUR AVEC LE MÊME NOM EXISTE DÉJÀ
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

    // Si un joueur existe déjà, réutiliser sa clé
    const playerKey = existingPlayerKey || `player_${Date.now()}`;
    const playerRef = ref(database, `sessions/${sessionId}/players_session/${teamKey}/${playerKey}`);

    const playerData = {
      id: selectedPlayer?.id || `temp_${playerName}`,
      name: currentPlayerName,
      photo: selectedPlayer?.photo || photoData || null,
      status: 'idle',
      cooldownEnd: null,
      hasCooldownPending: false,
      buzzCount: existingPlayerKey ? existingPlayers[existingPlayerKey].buzzCount || 0 : 0,
      correctCount: existingPlayerKey ? existingPlayers[existingPlayerKey].correctCount || 0 : 0,
      consecutiveCorrect: 0, // Reset streak when rejoining
      joinedAt: existingPlayerKey ? existingPlayers[existingPlayerKey].joinedAt : Date.now()
    };

    await set(playerRef, playerData);
    setPlayerFirebaseKey(playerKey);
    setTeam(teamNumber);
    setStep('game');

    if (existingPlayerKey) {
      console.log('✅ Joueur reconnecté:', playerData.name, 'dans', teamKey, 'clé:', playerKey);
    } else {
      console.log('✅ Nouveau joueur enregistré:', playerData.name, 'dans', teamKey, 'clé:', playerKey);
    }

    // Sauvegarder l'équipe et la clé Firebase
    saveToLocalStorage({ team: teamNumber, playerFirebaseKey: playerKey });
  } catch (error) {
    console.error('❌ Erreur enregistrement joueur:', error);
    // En cas d'erreur, continuer quand même
    setTeam(teamNumber);
    setStep('game');
  }
};

const handleBuzz = async () => {
  // Vérifier le cooldown AVANT de buzzer
  const isInCooldown = cooldownEnd && cooldownEnd > Date.now();
  if (!buzzerEnabled || someoneBuzzed || !isPlaying || isInCooldown) {
    if (isInCooldown) {
      console.log('🔥 Buzz bloqué : cooldown actif');
    }
    return;
  }

  setBuzzed(true);
  setBuzzerEnabled(false);

  // Jouer le son du buzzer
  if (buzzerSoundRef.current) {
    buzzerSoundRef.current.play();
  }

  const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
  await set(buzzRef, {
    type: 'BUZZ',
    team: `team${team}`,
    teamName: team === 1 ? 'Équipe 1' : 'Équipe 2',
    playerName: selectedPlayer?.name || playerName,
    playerId: selectedPlayer?.id || `temp_${playerName}`,
    playerPhoto: selectedPlayer?.photo || photoData || null,
    playerFirebaseKey: playerFirebaseKey, // ✅ AJOUTEZ CECI
    timestamp: Date.now()
  });

  // Vibration en plus du son
  if (navigator.vibrate) {
    navigator.vibrate(200);
  }
};

const changeTeam = async () => {
  // ✅ SUPPRIMER le joueur avec sa clé Firebase
  if (team && playerFirebaseKey) {
    const currentTeamKey = `team${team}`;
    const playerRef = ref(database, `sessions/${sessionId}/players_session/${currentTeamKey}/${playerFirebaseKey}`);

    try {
      await remove(playerRef);
      console.log(`✅ Joueur retiré de l'équipe ${team} (clé: ${playerFirebaseKey})`);
    } catch (error) {
      console.error('❌ Erreur suppression joueur:', error);
    }
  }

  setTeam(null);
  setBuzzed(false);
  setBuzzerEnabled(true);
  setSomeoneBuzzed(false);
  setPlayerFirebaseKey(null); // ✅ Reset la clé
  setStep('team');

  // Mettre à jour localStorage sans l'équipe
  saveToLocalStorage({ team: null, playerFirebaseKey: null });
};

// Charger les statistiques personnelles du joueur
const loadPersonalStats = () => {
  if (!sessionId || !selectedPlayer) return;

  const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times`);
  onValue(buzzTimesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const allBuzzes = [];

      // Collecter tous les buzz de toutes les chansons
      Object.keys(data).forEach(trackIndex => {
        const trackBuzzes = data[trackIndex];
        if (Array.isArray(trackBuzzes)) {
          trackBuzzes.forEach(buzz => {
            allBuzzes.push(buzz);
          });
        }
      });

      // Filtrer les buzz du joueur actuel
      const myBuzzes = allBuzzes.filter(buzz =>
        buzz.playerName === (selectedPlayer?.name || playerName)
      );

      // Calculer les statistiques
      const winningBuzzes = myBuzzes.filter(buzz => buzz.correct === true);
      const totalPoints = winningBuzzes.reduce((sum, buzz) => sum + (buzz.points || 0), 0);

      // Récupérer les chansons reconnues
      const recognizedSongs = winningBuzzes.map(buzz => ({
        title: buzz.songTitle,
        artist: buzz.songArtist,
        time: buzz.time,
        points: buzz.points,
        trackNumber: buzz.trackNumber
      }));

      // Calculer le pourcentage de contribution aux points de l'équipe
      const teamKey = team === 1 ? 'team1' : 'team2';
      const teamScore = scores[teamKey] || 0;
      const percentageContribution = teamScore > 0 ? ((totalPoints / teamScore) * 100).toFixed(1) : '0';

      setPersonalStats({
        totalBuzzes: myBuzzes.length,
        winningBuzzes: winningBuzzes.length,
        totalPoints: totalPoints,
        recognizedSongs: recognizedSongs,
        percentageContribution: percentageContribution
      });

      setShowStats(true);
    }
  }, { onlyOnce: true });
};

  // ========== ÉCRANS ==========

  // ÉCRAN -1 : Reconnexion en cours (DÉSACTIVÉ temporairement)
  // if (isReconnecting) {
  //   return (
  //     <div className="bg-gradient flex-center">
  //       <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
  //         <h1 className="title">🎵 BLIND TEST 🎵</h1>
  //         <div style={{ fontSize: '4rem', marginBottom: '2rem', animation: 'pulse 1.5s infinite' }}>
  //           🔄
  //         </div>
  //         <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
  //           Reconnexion en cours...
  //         </h2>
  //         <p style={{ fontSize: '1rem', opacity: 0.7 }}>
  //           Nous restaurons votre session
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  // ÉCRAN 0 : Saisie du code de session
  if (step === 'session') {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 BLIND TEST 🎵</h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
            Entrez le code de session
          </h2>

          <input
            type="text"
            placeholder="CODE"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value.toUpperCase())}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleJoinSession();
              }
            }}
            maxLength={6}
            autoFocus
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '2rem',
              fontWeight: 'bold',
              letterSpacing: '0.5rem',
              borderRadius: '0.75rem',
              border: 'none',
              marginBottom: '1rem',
              textAlign: 'center',
              textTransform: 'uppercase'
            }}
          />

          {error && (
            <div style={{
              color: '#ef4444',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              backgroundColor: '#fee2e2',
              padding: '1rem',
              borderRadius: '0.5rem'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleJoinSession}
            disabled={!sessionId || sessionId.length !== 6}
            className="btn btn-green"
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.25rem',
              opacity: (!sessionId || sessionId.length !== 6) ? 0.5 : 1
            }}
          >
            ✅ Rejoindre la partie
          </button>

          <p style={{
            marginTop: '2rem',
            fontSize: '0.9rem',
            opacity: 0.7
          }}>
            Scannez le QR Code affiché par l'animateur ou entrez le code à 6 caractères
          </p>
        </div>
      </div>
    );
  }

  // ÉCRAN 1 : Saisie du prénom
  if (step === 'name') {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 BLIND TEST 🎵</h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
            Quel est votre prénom ?
          </h2>

          <input
            type="text"
            placeholder="Entrez votre prénom"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearchPlayer();
              }
            }}
            autoFocus
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.5rem',
              borderRadius: '0.75rem',
              border: 'none',
              marginBottom: '1rem',
              textAlign: 'center'
            }}
          />

          {error && (
            <div style={{
              color: '#ef4444',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSearchPlayer}
            disabled={isSearching || !playerName.trim()}
            className="btn btn-green"
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.25rem',
              opacity: isSearching ? 0.5 : 1
            }}
          >
            {isSearching ? '🔍 Recherche...' : '✅ Valider'}
          </button>
        </div>
      </div>
    );
  }

  // ÉCRAN 2 : Sélection parmi joueurs existants
  if (step === 'select') {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">👥 Joueur trouvé !</h1>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
            C'est vous ?
          </h2>

          <div className="space-y">
            {searchResults.map((player, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectPlayer(player)}
                className="btn"
                style={{
                  width: '100%',
                  padding: '1.5rem',
                  backgroundColor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                {player.photo && (
                  <img
                    src={player.photo}
                    alt={player.name}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      objectFit: 'cover'
                    }}
                  />
                )}
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {player.name}
                  </div>
                  {player.lastSeen && (
                    <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                      Dernière partie : {new Date(player.lastSeen).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </button>
            ))}

            <button
              onClick={handleCreateNewPlayer}
              className="btn btn-gray"
              style={{ width: '100%', padding: '1rem' }}
            >
              ❌ Non, ce n'est pas moi
            </button>
          </div>
        </div>
      </div>
    );
  }

 // ÉCRAN 3 : Prise de selfie
if (step === 'photo') {


  return (
    <div className="bg-gradient flex-center">
      <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
        <h1 className="title">📸 Prenez un selfie</h1>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            color: '#ef4444'
          }}>
            {error}
          </div>
        )}

        {!photoData ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                maxWidth: '400px',
                borderRadius: '1rem',
                marginBottom: '1rem',
                transform: 'scaleX(-1)' // Effet miroir
              }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <button
              onClick={takeSelfie}
              className="btn btn-green"
              style={{ width: '100%', padding: '1.5rem', fontSize: '1.5rem' }}
            >
              📸 Prendre la photo
            </button>

            <button
              onClick={() => {
                if (streamRef.current) {
                  streamRef.current.getTracks().forEach(track => track.stop());
                }
                setStep('preferences');
              }}
              className="btn btn-gray"
              style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}
            >
              Passer sans photo
            </button>
          </>
        ) : (
          <>
            <img
              src={photoData}
              alt="Votre selfie"
              style={{
                width: '100%',
                maxWidth: '400px',
                borderRadius: '1rem',
                marginBottom: '1rem'
              }}
            />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={retakeSelfie}
                className="btn btn-yellow"
                style={{ flex: 1, padding: '1.5rem' }}
              >
                🔄 Reprendre
              </button>

              <button
                onClick={confirmSelfie}
                className="btn btn-green"
                style={{ flex: 1, padding: '1.5rem' }}
                disabled={isSearching}
              >
                {isSearching ? '⏳ Sauvegarde...' : '✅ Confirmer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

  // ÉCRAN 4 : Préférences du joueur
  if (step === 'preferences') {
    const availableGenres = [
      'Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Électro',
      'Rap français', 'R&B', 'Reggae', 'Métal', 'Indie',
      'Soul', 'Funk', 'Disco', 'Blues', 'Country'
    ];

    const toggleGenre = (genre) => {
      if (selectedGenres.includes(genre)) {
        setSelectedGenres(selectedGenres.filter(g => g !== genre));
      } else if (selectedGenres.length < 3) {
        setSelectedGenres([...selectedGenres, genre]);
      }
    };

    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '600px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 Vos Préférences</h1>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
            Parlez-nous de vous !
          </h2>

          {/* Âge */}
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '1.1rem',
              marginBottom: '0.5rem',
              fontWeight: 'bold'
            }}>
              🎂 Votre âge
            </label>
            <input
              type="number"
              placeholder="Ex: 25"
              value={playerAge}
              onChange={(e) => setPlayerAge(e.target.value)}
              min="1"
              max="120"
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.2rem',
                borderRadius: '0.75rem',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                textAlign: 'center'
              }}
            />
          </div>

          {/* Genres */}
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '1.1rem',
              marginBottom: '0.5rem',
              fontWeight: 'bold'
            }}>
              🎸 Vos 3 genres préférés ({selectedGenres.length}/3)
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '0.75rem'
            }}>
              {availableGenres.map(genre => {
                const isSelected = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    style={{
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      borderRadius: '0.5rem',
                      border: '2px solid',
                      borderColor: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.3)',
                      backgroundColor: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      transition: 'all 0.2s',
                      opacity: !isSelected && selectedGenres.length >= 3 ? 0.4 : 1
                    }}
                    disabled={!isSelected && selectedGenres.length >= 3}
                  >
                    {isSelected ? '✓ ' : ''}{genre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phrase spéciale */}
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '1.1rem',
              marginBottom: '0.5rem',
              fontWeight: 'bold'
            }}>
              💬 Votre phrase spéciale (optionnelle)
            </label>
            <textarea
              placeholder="Ex: J'adore chanter sous la douche !"
              value={specialPhrase}
              onChange={(e) => setSpecialPhrase(e.target.value)}
              maxLength={200}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                borderRadius: '0.75rem',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                minHeight: '80px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}>
              {specialPhrase.length}/200 caractères
            </div>
          </div>

          {/* Message d'erreur */}
          {error && (
            <div style={{
              color: '#ef4444',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              backgroundColor: '#fee2e2',
              padding: '1rem',
              borderRadius: '0.5rem'
            }}>
              {error}
            </div>
          )}

          {/* Bouton de validation */}
          <button
            onClick={handleSubmitPreferences}
            disabled={isSearching || !playerAge || selectedGenres.length === 0}
            className="btn btn-green"
            style={{
              width: '100%',
              padding: '1.5rem',
              fontSize: '1.25rem',
              opacity: (isSearching || !playerAge || selectedGenres.length === 0) ? 0.5 : 1
            }}
          >
            {isSearching ? '⏳ Envoi en cours...' : '✅ Valider et continuer'}
          </button>

          <p style={{
            marginTop: '1rem',
            fontSize: '0.875rem',
            opacity: 0.7
          }}>
            Ces informations nous aident à personnaliser votre expérience
          </p>
        </div>
      </div>
    );
  }

  // ÉCRAN 6 : Sélection d'équipe
  if (step === 'team') {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 BLIND TEST 🎵</h1>

          {selectedPlayer && (
            <div style={{
              marginBottom: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {selectedPlayer.photo && (
                <img
                  src={selectedPlayer.photo}
                  alt={selectedPlayer.name}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #fbbf24'
                  }}
                />
              )}
              <div style={{ fontSize: '1.25rem', opacity: 0.9 }}>
                Bienvenue <strong>{selectedPlayer.name}</strong> ! 👋
              </div>
            </div>
          )}

          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
            Choisissez votre équipe
          </h2>

          <div className="space-y">
            <button
              onClick={() => selectTeam(1)}
              className="team-select-btn"
              style={{ backgroundColor: '#dc2626' }}
            >
              🔴 ÉQUIPE 1
            </button>

            <button
              onClick={() => selectTeam(2)}
              className="team-select-btn"
              style={{ backgroundColor: '#2563eb' }}
            >
              🔵 ÉQUIPE 2
            </button>
          </div>
        </div>
      </div>
    );
  }

// ÉCRAN 7 : Jeu (buzzer)
if (step === 'game') {
  const bgClass = team === 1 ? 'bg-gradient-red' : 'bg-gradient-blue';
  const buttonColor = team === 1 ? '#ef4444' : '#3b82f6';
  const isInCooldown = cooldownEnd && cooldownEnd > Date.now();
  const canBuzz = buzzerEnabled && !someoneBuzzed && isPlaying && !isInCooldown; // ✅ Ajout du cooldown

  return (
    <div className={`${bgClass} flex-center`}>
      {/* Bouton de statistiques personnelles */}
      <button
        onClick={loadPersonalStats}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '1.5rem',
          zIndex: 100
        }}
        title="Mes statistiques"
      >
        📊
      </button>

      <div className="score-display">
        <div className={`score-mini ${team === 1 ? 'highlighted' : ''}`} style={{ backgroundColor: 'rgba(220, 38, 38, 0.5)' }}>
          <div className="label">ÉQUIPE 1</div>
          <div className="value">{scores.team1}</div>
        </div>
        <div className={`score-mini ${team === 2 ? 'highlighted' : ''}`} style={{ backgroundColor: 'rgba(37, 99, 235, 0.5)' }}>
          <div className="label">ÉQUIPE 2</div>
          <div className="value">{scores.team2}</div>
        </div>
      </div>

      <div className="text-center mb-8">
        {selectedPlayer?.photo && (
          <img
            src={selectedPlayer.photo}
            alt={selectedPlayer.name}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              objectFit: 'cover',
              margin: '0 auto 0.5rem',
              border: '3px solid #fbbf24'
            }}
          />
        )}
        <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          {selectedPlayer?.name || playerName}
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {team === 1 ? '🔴 ÉQUIPE 1' : '🔵 ÉQUIPE 2'}
        </h1>

        {/* ✅ Affichage du cooldown */}
        {isInCooldown ? (
          <CooldownText cooldownEnd={cooldownEnd} />
        ) : (
          <p style={{ fontSize: '1.125rem', opacity: 0.8 }}>
            {buzzed ? 'Buzzé !' :
             someoneBuzzed ? 'Une autre équipe a buzzé...' :
             !isPlaying ? 'En attente de la musique...' :
             'Appuyez pour buzzer'}
          </p>
        )}
      </div>

      <button
        onClick={handleBuzz}
        disabled={!canBuzz}
        className={`buzzer ${buzzed ? 'buzzed' : ''} ${isInCooldown ? 'cooldown' : ''}`}
        style={{
          backgroundColor: buzzed ? '#fbbf24' : isInCooldown ? '#ef4444' : canBuzz ? buttonColor : '#6b7280',
          cursor: !canBuzz ? 'not-allowed' : 'pointer',
          opacity: !canBuzz ? 0.5 : 1
        }}
      >
        {isInCooldown ? (
          <CooldownDisplay cooldownEnd={cooldownEnd} onCooldownEnd={() => setCooldownEnd(null)} />
        ) : (
          <>
            <span style={{ fontSize: '5rem' }}>🔔</span>
            <span style={{ marginTop: '1rem' }}>
              {buzzed ? 'BUZZÉ !' :
              someoneBuzzed ? 'BLOQUÉ' :
              !isPlaying ? 'EN ATTENTE' :
              'BUZZ'}
            </span>
          </>
        )}
      </button>

      <button onClick={changeTeam} className="btn btn-gray mt-8">
        Changer d'équipe
      </button>

      {someoneBuzzed && !buzzed && (
        <div className="mt-8" style={{ fontSize: '0.875rem', opacity: 0.7 }}>
          En attente de la décision de l'animateur...
        </div>
      )}

      {!isPlaying && !someoneBuzzed && !isInCooldown && (
        <div className="mt-8" style={{ fontSize: '0.875rem', opacity: 0.7 }}>
          ⏸️ Attendez que l'animateur lance la musique...
        </div>
      )}

      {/* Modale des statistiques personnelles */}
      {showStats && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
          onClick={() => setShowStats(false)}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              borderRadius: '1.5rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              color: 'white'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '2rem',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              📊 Mes Statistiques
            </h2>

            {/* Résumé des stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                padding: '1rem',
                borderRadius: '0.75rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#60a5fa' }}>
                  {personalStats.totalBuzzes}
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.5rem' }}>
                  Buzz totaux
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                padding: '1rem',
                borderRadius: '0.75rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981' }}>
                  {personalStats.winningBuzzes}
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.5rem' }}>
                  Buzz gagnants
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                padding: '1rem',
                borderRadius: '0.75rem',
                textAlign: 'center',
                gridColumn: '1 / -1'
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {personalStats.totalPoints}
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.5rem' }}>
                  Points gagnés ({personalStats.percentageContribution}% de l'équipe)
                </div>
              </div>
            </div>

            {/* Liste des chansons reconnues */}
            {personalStats.recognizedSongs.length > 0 ? (
              <>
                <h3 style={{
                  fontSize: '1.25rem',
                  marginBottom: '1rem',
                  color: '#10b981'
                }}>
                  🎵 Chansons reconnues
                </h3>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginBottom: '1.5rem'
                }}>
                  {personalStats.recognizedSongs.map((song, index) => (
                    <div
                      key={index}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        borderLeft: '4px solid #10b981'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                        {song.title}
                      </div>
                      {song.artist && (
                        <div style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                          {song.artist}
                        </div>
                      )}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.875rem',
                        opacity: 0.8
                      }}>
                        <span>⏱️ {song.time.toFixed(1)}s</span>
                        <span>💰 {song.points} pts</span>
                        <span>#{song.trackNumber}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                opacity: 0.6,
                marginBottom: '1.5rem'
              }}>
                Aucune chanson reconnue pour le moment. Continuez à buzzer ! 🎵
              </div>
            )}

            <button
              onClick={() => setShowStats(false)}
              className="btn"
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.1rem',
                backgroundColor: '#6b7280'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
