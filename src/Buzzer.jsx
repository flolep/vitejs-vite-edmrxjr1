import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, set, onValue, remove } from 'firebase/database';

export default function Buzzer() {
  const [team, setTeam] = useState(null);
  const [buzzed, setBuzzed] = useState(false);
  const [buzzerEnabled, setBuzzerEnabled] = useState(true);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [someoneBuzzed, setSomeoneBuzzed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); // NOUVEAU

  // Écouter les scores Firebase
  useEffect(() => {
    const scoresRef = ref(database, 'scores');
    
    const unsubscribe = onValue(scoresRef, (snapshot) => {
      const scoresData = snapshot.val();
      if (scoresData) {
        setScores(scoresData);
      }
    });

    return () => unsubscribe();
  }, []);
  
  // NOUVEAU : Écouter si une chanson est en cours de lecture
  useEffect(() => {
    const playingRef = ref(database, 'isPlaying');
    
    const unsubscribe = onValue(playingRef, (snapshot) => {
      const playingData = snapshot.val();
      setIsPlaying(playingData === true);
    });

    return () => unsubscribe();
  }, []);
  
  // Écouter si quelqu'un a buzzé
  useEffect(() => {
    const buzzRef = ref(database, 'buzz');
    
    const unsubscribe = onValue(buzzRef, (snapshot) => {
      const buzzData = snapshot.val();
      if (buzzData) {
        // Quelqu'un a buzzé - bloquer tous les buzzers
        setSomeoneBuzzed(true);
        setBuzzerEnabled(false);
      } else {
        // Le buzz a été effacé - réactiver les buzzers
        setSomeoneBuzzed(false);
        setBuzzerEnabled(true);
        setBuzzed(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const selectTeam = (teamNumber) => {
    setTeam(teamNumber);
  };

  const handleBuzz = async () => {
    // MODIFIÉ : Vérifier aussi que la musique est en cours
    if (!buzzerEnabled || someoneBuzzed || !isPlaying) return;
    
    setBuzzed(true);
    setBuzzerEnabled(false);
    
    const buzzRef = ref(database, 'buzz');
    await set(buzzRef, {
      type: 'BUZZ',
      team: `team${team}`,
      teamName: team === 1 ? 'Équipe 1' : 'Équipe 2',
      timestamp: Date.now()
    });
    
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  const changeTeam = () => {
    setTeam(null);
    setBuzzed(false);
    setBuzzerEnabled(true);
    setSomeoneBuzzed(false);
  };

  // Sélection d'équipe
  if (!team) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 BLIND TEST 🎵</h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Choisissez votre équipe</h2>
          
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

  // Écran de buzzer
  const bgClass = team === 1 ? 'bg-gradient-red' : 'bg-gradient-blue';
  const buttonColor = team === 1 ? '#ef4444' : '#3b82f6';
  
  // MODIFIÉ : Déterminer si le buzzer est actif
  const canBuzz = buzzerEnabled && !someoneBuzzed && isPlaying;

  return (
    <div className={`${bgClass} flex-center`}>
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
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {team === 1 ? '🔴 ÉQUIPE 1' : '🔵 ÉQUIPE 2'}
        </h1>
        <p style={{ fontSize: '1.125rem', opacity: 0.8 }}>
          {buzzed ? 'Buzzé !' : 
           someoneBuzzed ? 'Une autre équipe a buzzé...' : 
           !isPlaying ? 'En attente de la musique...' : 
           'Appuyez pour buzzer'}
        </p>
      </div>

      <button
        onClick={handleBuzz}
        disabled={!canBuzz}
        className={`buzzer ${buzzed ? 'buzzed' : ''}`}
        style={{
          backgroundColor: buzzed ? '#fbbf24' : canBuzz ? buttonColor : '#6b7280',
          cursor: !canBuzz ? 'not-allowed' : 'pointer',
          opacity: !canBuzz ? 0.5 : 1
        }}
      >
        <span style={{ fontSize: '5rem' }}>🔔</span>
        <span style={{ marginTop: '1rem' }}>
          {buzzed ? 'BUZZÉ !' : 
           someoneBuzzed ? 'BLOQUÉ' : 
           !isPlaying ? 'EN ATTENTE' : 
           'BUZZ'}
        </span>
      </button>

      <button onClick={changeTeam} className="btn btn-gray mt-8">
        Changer d'équipe
      </button>

      {someoneBuzzed && !buzzed && (
        <div className="mt-8" style={{ fontSize: '0.875rem', opacity: 0.7 }}>
          En attente de la décision de l'animateur...
        </div>
      )}
      
      {/* NOUVEAU : Message si pas de musique */}
      {!isPlaying && !someoneBuzzed && (
        <div className="mt-8" style={{ fontSize: '0.875rem', opacity: 0.7 }}>
          ⏸️ Attendez que l'animateur lance la musique...
        </div>
      )}
    </div>
  );
}