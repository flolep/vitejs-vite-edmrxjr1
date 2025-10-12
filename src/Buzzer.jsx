import React, { useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, set, onValue } from 'firebase/database';
import { airtableService } from './airtableService';

export default function Buzzer() {
  const [team, setTeam] = useState(null);
  const [buzzed, setBuzzed] = useState(false);
  const [buzzerEnabled, setBuzzerEnabled] = useState(true);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  
  // Nouveaux states pour Airtable
  const [availableTeams, setAvailableTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger les équipes depuis Airtable au démarrage
  useEffect(() => {
    const loadTeams = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const teams = await airtableService.getEquipes();
        
        if (teams.length === 0) {
          setError('Aucune équipe active trouvée dans Airtable');
        } else {
          setAvailableTeams(teams);
          console.log('Équipes chargées depuis Airtable:', teams);
        }
      } catch (err) {
        setError('Erreur lors du chargement des équipes');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadTeams();
  }, []);

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

  const selectTeam = (teamIndex) => {
    setTeam(teamIndex);
  };

  const handleBuzz = async () => {
    if (!buzzerEnabled) return;
    
    setBuzzed(true);
    setBuzzerEnabled(false);
    
    const buzzRef = ref(database, 'buzz');
    await set(buzzRef, {
      type: 'BUZZ',
      team: `team${team}`,
      teamName: availableTeams[team - 1]?.nom || `Équipe ${team}`,
      timestamp: Date.now()
    });
    
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
    
    setTimeout(() => {
      setBuzzed(false);
      setBuzzerEnabled(true);
    }, 3000);
  };

  const changeTeam = () => {
    setTeam(null);
    setBuzzed(false);
    setBuzzerEnabled(true);
  };

  // Écran de chargement
  if (loading) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 BLIND TEST 🎵</h1>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <h2 style={{ fontSize: '1.5rem' }}>Chargement des équipes...</h2>
        </div>
      </div>
    );
  }

  // Écran d'erreur
  if (error) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 BLIND TEST 🎵</h1>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#ef4444' }}>⚠️</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ef4444' }}>{error}</h2>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-yellow"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Sélection d'équipe
  if (!team) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 BLIND TEST 🎵</h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Choisissez votre équipe</h2>
          
          <div className="space-y">
            {availableTeams.length > 0 ? (
              availableTeams.map((equipe, index) => (
                <button
                  key={equipe.id}
                  onClick={() => selectTeam(index + 1)}
                  className="team-select-btn"
                  style={{ 
                    backgroundColor: equipe.couleur || '#6b7280',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <span style={{ fontSize: '2rem', marginRight: '1rem' }}>
                    {index === 0 ? '🔴' : index === 1 ? '🔵' : '🟢'}
                  </span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {equipe.nom}
                  </span>
                </button>
              ))
            ) : (
              <p style={{ color: '#ef4444' }}>Aucune équipe disponible</p>
            )}
          </div>
          
          <p style={{ marginTop: '2rem', fontSize: '0.875rem', opacity: 0.7 }}>
            {availableTeams.length} équipe(s) chargée(s) depuis Airtable
          </p>
        </div>
      </div>
    );
  }

  // Écran de buzzer
  const selectedTeam = availableTeams[team - 1];
  const bgClass = `bg-gradient-${team === 1 ? 'red' : team === 2 ? 'blue' : 'gradient'}`;
  const buttonColor = selectedTeam?.couleur || '#6b7280';

  return (
    <div className={bgClass} style={{ minHeight: '100vh' }}>
      <div className="score-display">
        {availableTeams.map((equipe, index) => (
          <div 
            key={equipe.id}
            className={`score-mini ${team === index + 1 ? 'highlighted' : ''}`} 
            style={{ backgroundColor: `${equipe.couleur}80` }}
          >
            <div className="label">{equipe.nom}</div>
            <div className="value">{scores[`team${index + 1}`] || 0}</div>
          </div>
        ))}
      </div>

      <div className="flex-center" style={{ paddingTop: '8rem' }}>
        <div className="text-center mb-8">
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {selectedTeam?.nom || `Équipe ${team}`}
          </h1>
          <p style={{ fontSize: '1.125rem', opacity: 0.8 }}>
            {buzzed ? 'Buzzé !' : 'Appuyez pour buzzer'}
          </p>
        </div>

        <button
          onClick={handleBuzz}
          disabled={!buzzerEnabled}
          className={`buzzer ${buzzed ? 'buzzed' : ''}`}
          style={{
            backgroundColor: buzzed ? '#fbbf24' : buzzerEnabled ? buttonColor : '#6b7280'
          }}
        >
          <span style={{ fontSize: '5rem' }}>🔔</span>
          <span style={{ marginTop: '1rem' }}>
            {buzzed ? 'BUZZÉ !' : 'BUZZ'}
          </span>
        </button>

        <button onClick={changeTeam} className="btn btn-gray mt-8">
          Changer d'équipe
        </button>

        {!buzzerEnabled && !buzzed && (
          <div className="mt-8" style={{ fontSize: '0.875rem', opacity: 0.7 }}>
            Réactivation du buzzer dans quelques secondes...
          </div>
        )}
      </div>
    </div>
  );
}