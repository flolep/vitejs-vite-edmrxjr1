import React, { useState, useEffect } from 'react';
import Master from './Master';
import Buzzer from './Buzzer';
import TV from './TV';
import SpotifyCallback from './SpotifyCallback';

export default function App() {
  // Initialiser la page depuis l'URL uniquement
  const getInitialPage = () => {
    const path = window.location.pathname;
    if (path === '/callback') return 'callback';
    if (path === '/master') return 'master';
    if (path === '/buzzer') return 'buzzer';
    if (path === '/tv') return 'tv';
    // Si on est sur '/', toujours retourner 'home' (page d'accueil)
    return 'home';
  };

  const [page, setPage] = useState(getInitialPage);
  const [masterMode, setMasterMode] = useState(null); // 'new' ou 'resume'
  const [lastSessionId, setLastSessionId] = useState(null);

  // Charger le dernier sessionId depuis localStorage
  useEffect(() => {
    const storedSessionId = localStorage.getItem('lastSessionId');
    if (storedSessionId) {
      setLastSessionId(storedSessionId);
    }
  }, []);

  // Mettre à jour l'URL quand on change de page
  useEffect(() => {
    if (page !== 'home' && page !== 'callback') {
      window.history.pushState({}, '', `/${page}`);
    }
  }, [page]);

  // Détecter si on est sur la page callback
  useEffect(() => {
    if (window.location.pathname === '/callback') {
      setPage('callback');
    }
  }, []);

  if (page === 'callback') return <SpotifyCallback />;
  if (page === 'master') return <Master initialSessionId={masterMode === 'resume' ? lastSessionId : null} />;
  if (page === 'buzzer') return <Buzzer />;
  if (page === 'tv') return <TV />;

  // Écran de sélection pour l'animateur
  if (page === 'masterChoice') {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎮 MODE ANIMATEUR</h1>
          <p style={{ color: 'white', marginBottom: '2rem', fontSize: '1.1rem' }}>
            Voulez-vous créer une nouvelle partie ou reprendre la dernière ?
          </p>
          <div className="space-y">
            <button
              onClick={() => {
                setMasterMode('new');
                setPage('master');
              }}
              className="btn btn-green"
              style={{ width: '100%', padding: '1.5rem', fontSize: '1.3rem' }}
            >
              ✨ NOUVELLE PARTIE
            </button>
            {lastSessionId && (
              <button
                onClick={() => {
                  setMasterMode('resume');
                  setPage('master');
                }}
                className="btn btn-blue"
                style={{ width: '100%', padding: '1.5rem', fontSize: '1.3rem' }}
              >
                🔄 REPRENDRE LA DERNIÈRE
                <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>
                  Session : {lastSessionId}
                </div>
              </button>
            )}
            <button
              onClick={() => setPage('home')}
              className="btn"
              style={{ width: '100%', padding: '1rem' }}
            >
              ← RETOUR
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient flex-center">
      <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
        <h1 className="title">🎵 BLIND TEST 🎵</h1>
        <div className="space-y">
          <button onClick={() => setPage('masterChoice')} className="btn btn-yellow" style={{ width: '100%', padding: '1.5rem', fontSize: '1.5rem' }}>
            🎮 ANIMATEUR
          </button>
          <button onClick={() => setPage('buzzer')} className="btn btn-green" style={{ width: '100%', padding: '1.5rem', fontSize: '1.5rem' }}>
            📱 JOUEUR
          </button>
          <button onClick={() => setPage('tv')} className="btn btn-purple" style={{ width: '100%', padding: '1.5rem', fontSize: '1.5rem' }}>
            📺 ÉCRAN TV
          </button>
        </div>
      </div>
    </div>
  );
}