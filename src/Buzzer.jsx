import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { database } from './firebase';
import { ref, set } from 'firebase/database';

export default function BlindTestBuzzer() {
  const [team, setTeam] = useState(null);
  const [buzzed, setBuzzed] = useState(false);
  const [buzzerEnabled, setBuzzerEnabled] = useState(true);

  const selectTeam = (teamNumber) => {
    setTeam(teamNumber);
  };

  const handleBuzz = async () => {
    if (!buzzerEnabled) return;
    
    setBuzzed(true);
    setBuzzerEnabled(false);
    
    // Envoyer via Firebase
    const buzzRef = ref(database, 'buzz');
    await set(buzzRef, {
      type: 'BUZZ',
      team: `team${team}`,
      timestamp: Date.now()
    });
    
    // Vibration si disponible
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
    
    // Réactiver après 3 secondes
    setTimeout(() => {
      setBuzzed(false);
      setBuzzerEnabled(true);
    }, 3000);
  };

  // Page de sélection d'équipe
  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold mb-8">🎵 BLIND TEST 🎵</h1>
          <h2 className="text-2xl mb-8">Choisissez votre équipe</h2>
          
          <div className="space-y-4">
            <button
              onClick={() => selectTeam(1)}
              className="w-full bg-red-600 hover:bg-red-700 py-8 rounded-2xl text-3xl font-bold transform transition hover:scale-105 active:scale-95"
            >
              🔴 ÉQUIPE 1
            </button>
            
            <button
              onClick={() => selectTeam(2)}
              className="w-full bg-blue-600 hover:bg-blue-700 py-8 rounded-2xl text-3xl font-bold transform transition hover:scale-105 active:scale-95"
            >
              🔵 ÉQUIPE 2
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Page buzzer
  const teamColor = team === 1 ? 'red' : 'blue';
  const bgColor = team === 1 ? 'from-red-900 to-red-700' : 'from-blue-900 to-blue-700';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgColor} text-white flex flex-col items-center justify-center p-4`}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {team === 1 ? '🔴 ÉQUIPE 1' : '🔵 ÉQUIPE 2'}
        </h1>
        <p className="text-lg opacity-80">
          {buzzed ? 'Buzzé !' : 'Appuyez pour buzzer'}
        </p>
      </div>

      <button
        onClick={handleBuzz}
        disabled={!buzzerEnabled}
        className={`
          w-80 h-80 max-w-full rounded-full
          ${buzzed 
            ? 'bg-yellow-400 ring-8 ring-yellow-300 animate-pulse' 
            : buzzerEnabled 
              ? `bg-${teamColor}-500 hover:bg-${teamColor}-400 active:scale-95` 
              : 'bg-gray-500 cursor-not-allowed'
          }
          shadow-2xl
          flex flex-col items-center justify-center
          transform transition-all duration-200
          ${buzzerEnabled && !buzzed ? 'hover:scale-105' : ''}
        `}
        style={{
          backgroundColor: buzzed 
            ? '#fbbf24' 
            : buzzerEnabled 
              ? (team === 1 ? '#ef4444' : '#3b82f6')
              : '#6b7280'
        }}
      >
        <Bell size={80} className={buzzed ? 'animate-bounce' : ''} />
        <span className="text-3xl font-bold mt-4">
          {buzzed ? 'BUZZÉ !' : 'BUZZ'}
        </span>
      </button>

      <div className="mt-12 text-center">
        <button
          onClick={() => {
            setTeam(null);
            setBuzzed(false);
            setBuzzerEnabled(true);
          }}
          className="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg"
        >
          Changer d'équipe
        </button>
      </div>

      {!buzzerEnabled && !buzzed && (
        <div className="mt-8 text-center">
          <p className="text-sm opacity-70">Réactivation du buzzer dans quelques secondes...</p>
        </div>
      )}
    </div>
  );
}