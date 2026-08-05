import { useState, useEffect, useRef } from 'react';
import { database } from '../firebase';
import { ref, set, remove, onValue, serverTimestamp } from 'firebase/database';
import { playFinalBuzzSound, unlockBuzzSounds } from '../services/buzzSounds';

/**
 * Hook pour gérer le système de buzzer
 * Logique commune à tous les modes
 */
export function useBuzzer(sessionId, isPlaying, currentTrack, playlist, currentChronoRef, updateIsPlaying, playerAdapter) {
  const [buzzedTeam, setBuzzedTeam] = useState(null);
  const [buzzedPlayerKey, setBuzzedPlayerKey] = useState(null);
  const [buzzedPlayerName, setBuzzedPlayerName] = useState(null);
  const [buzzedPlayerPhoto, setBuzzedPlayerPhoto] = useState(null);
  const buzzerSoundRef = useRef(null);

  // Le son du buzz vit desormais dans services/buzzSounds.js : il est partage
  // avec le beep du dernier buzz en mode quiz, pour qu'il n'existe qu'une
  // seule definition de ce son.
  useEffect(() => {
    buzzerSoundRef.current = { play: playFinalBuzzSound };
  }, []);

  const unlockAudioContext = async () => {
    await unlockBuzzSounds();
  };

  // Écouter les buzz
  useEffect(() => {
    if (!sessionId) return;

    const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
    const unsubscribe = onValue(buzzRef, (snapshot) => {
      const buzzData = snapshot.val();

      console.log('👂 [useBuzzer] Firebase notification:', {
        hasBuzzData: !!buzzData,
        isPlaying,
        buzzData
      });

      if (buzzData && isPlaying) {
        const { team } = buzzData;
        const buzzTime = currentChronoRef.current;

        console.log('🔔 [useBuzzer] Buzz reçu et traité:', {
          team,
          playerName: buzzData.playerName,
          playerPhoto: buzzData.playerPhoto,
          playerFirebaseKey: buzzData.playerFirebaseKey,
          fullBuzzData: buzzData
        });

        setBuzzedTeam(team);
        setBuzzedPlayerKey(buzzData.playerFirebaseKey || null);
        setBuzzedPlayerName(buzzData.playerName || 'Anonyme');
        setBuzzedPlayerPhoto(buzzData.playerPhoto || null);

        // ✅ ARRÊTER LA MUSIQUE ET LE CHRONO
        // 1. Arrêter le lecteur audio/Spotify
        if (playerAdapter) {
          playerAdapter.pause().catch(err => {
            console.error('❌ Erreur pause playerAdapter:', err);
          });
        }

        // 2. Mettre à jour l'état Firebase
        if (updateIsPlaying) {
          updateIsPlaying(false);
        }

        // 3. Jouer le son de buzzer
        if (buzzerSoundRef.current) {
          buzzerSoundRef.current.play();
        }

        // Enregistrer TOUS les buzz (gagnants et perdants)
        const buzzTimesRef = ref(database, `sessions/${sessionId}/buzz_times/${currentTrack}`);
        const newBuzz = {
          team,
          teamName: team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2',
          time: buzzTime,
          playerName: buzzData.playerName || 'Anonyme',
          // ✅ currentTrack commence à 1, donc accès tableau avec currentTrack - 1
          songTitle: playlist[currentTrack - 1]?.title || 'Inconnu',
          songArtist: playlist[currentTrack - 1]?.artist || 'Inconnu',
          trackNumber: currentTrack, // ✅ Pas besoin de + 1 car commence déjà à 1
          timestamp: serverTimestamp(), // ✅ Timestamp serveur Firebase pour précision absolue
          correct: null,
          points: 0
        };

        onValue(buzzTimesRef, (snapshot) => {
          const existingBuzzes = snapshot.val() || [];
          set(buzzTimesRef, [...existingBuzzes, newBuzz]);
        }, { onlyOnce: true });
      }
    });

    return () => unsubscribe();
  }, [isPlaying, currentTrack, sessionId, playlist, currentChronoRef, updateIsPlaying, playerAdapter]);

  const clearBuzz = () => {
    setBuzzedTeam(null);
    setBuzzedPlayerKey(null);
    setBuzzedPlayerName(null);
    setBuzzedPlayerPhoto(null);
    if (sessionId) {
      const buzzRef = ref(database, `sessions/${sessionId}/buzz`);
      remove(buzzRef);
    }
  };

  return {
    buzzedTeam,
    buzzedPlayerKey,
    buzzedPlayerName,
    buzzedPlayerPhoto,
    setBuzzedTeam,
    clearBuzz,
    unlockAudioContext
  };
}
