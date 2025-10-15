import React, { useState, useEffect, useRef } from 'react';
import { database } from './firebase';
import { ref, set, onValue } from 'firebase/database';
import { airtableService } from './airtableService';

export default function Buzzer() {
  // États existants
  const [team, setTeam] = useState(null);
  const [buzzed, setBuzzed] = useState(false);
  const [buzzerEnabled, setBuzzerEnabled] = useState(true);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [someoneBuzzed, setSomeoneBuzzed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // NOUVEAUX états pour identification
  const [step, setStep] = useState('name'); // 'name' | 'search' | 'select' | 'photo' | 'team' | 'game'
  const [playerName, setPlayerName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [error, setError] = useState('');
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

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
  
  // Écouter si une chanson est en cours de lecture
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
        setSomeoneBuzzed(true);
        setBuzzerEnabled(false);
      } else {
        setSomeoneBuzzed(false);
        setBuzzerEnabled(true);
        setBuzzed(false);
      }
    });
    return () => unsubscribe();
  }, []);

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
      setStep('team');
    } finally {
      setIsSearching(false);
    }
  };

  // NOUVEAU : Sélectionner un joueur existant
  const handleSelectPlayer = (player) => {
    setSelectedPlayer(player);
    setStep('team');
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
      setTimeout(() => setStep('team'), 2000);
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
      
      setSelectedPlayer({
        id: result.id,
        name: playerName,
        photo: photoData
      });
      
      setStep('team');
    } catch (err) {
      console.error('Erreur création joueur:', err);
      setError('Erreur lors de la sauvegarde. Continuons quand même !');
      setTimeout(() => {
        setSelectedPlayer({ name: playerName });
        setStep('team');
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

  const selectTeam = (teamNumber) => {
    setTeam(teamNumber);
    setStep('game');
  };

  const handleBuzz = async () => {
    if (!buzzerEnabled || someoneBuzzed || !isPlaying) return;
    
    setBuzzed(true);
    setBuzzerEnabled(false);
    
    const buzzRef = ref(database, 'buzz');
    await set(buzzRef, {
      type: 'BUZZ',
      team: `team${team}`,
      teamName: team === 1 ? 'Équipe 1' : 'Équipe 2',
      playerName: selectedPlayer?.name || playerName,
      playerId: selectedPlayer?.id || null,
      playerPhoto: selectedPlayer?.photo || photoData || null,
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
    setStep('team');
  };

  // ========== ÉCRANS ==========

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
  if (step === 'photo' && !photoData) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">📸 Selfie !</h1>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
            Pour vous identifier lors des prochaines parties
          </h2>
          
          <div style={{
            position: 'relative',
            borderRadius: '1rem',
            overflow: 'hidden',
            marginBottom: '2rem',
            backgroundColor: '#000'
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              onLoadedMetadata={startCamera}
              style={{
                width: '100%',
                maxHeight: '400px',
                display: 'block'
              }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          
          {error && (
            <div style={{ color: '#ef4444', marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          
          <div className="space-y">
            <button
              onClick={takeSelfie}
              className="btn btn-green"
              style={{ width: '100%', padding: '1.5rem', fontSize: '1.25rem' }}
            >
              📸 Prendre la photo
            </button>
            
            <button
              onClick={() => {
                if (streamRef.current) {
                  streamRef.current.getTracks().forEach(track => track.stop());
                }
                setStep('team');
              }}
              className="btn btn-gray"
              style={{ width: '100%', padding: '1rem' }}
            >
              ⏭️ Passer sans photo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ÉCRAN 4 : Validation du selfie
  if (step === 'photo' && photoData) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">✨ Parfait !</h1>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
            Valider cette photo ?
          </h2>
          
          <img
            src={photoData}
            alt="Selfie"
            style={{
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              objectFit: 'cover',
              marginBottom: '2rem',
              border: '4px solid #fbbf24'
            }}
          />
          
          {error && (
            <div style={{ color: '#ef4444', marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          
          <div className="space-y">
            <button
              onClick={confirmSelfie}
              disabled={isSearching}
              className="btn btn-green"
              style={{ 
                width: '100%', 
                padding: '1.5rem',
                fontSize: '1.25rem',
                opacity: isSearching ? 0.5 : 1
              }}
            >
              {isSearching ? '💾 Sauvegarde...' : '✅ Valider'}
            </button>
            
            <button
              onClick={retakeSelfie}
              disabled={isSearching}
              className="btn btn-gray"
              style={{ width: '100%', padding: '1rem' }}
            >
              🔄 Reprendre
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ÉCRAN 5 : Sélection d'équipe
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

  // ÉCRAN 6 : Jeu (buzzer)
  if (step === 'game') {
    const bgClass = team === 1 ? 'bg-gradient-red' : 'bg-gradient-blue';
    const buttonColor = team === 1 ? '#ef4444' : '#3b82f6';
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
        
        {!isPlaying && !someoneBuzzed && (
          <div className="mt-8" style={{ fontSize: '0.875rem', opacity: 0.7 }}>
            ⏸️ Attendez que l'animateur lance la musique...
          </div>
        )}
      </div>
    );
  }

  return null;
}