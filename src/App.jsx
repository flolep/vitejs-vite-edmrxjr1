import React, { useState, useEffect, useCallback } from 'react';
import Master from './Master';
import Buzzer from './Buzzer';
import TV from './TV';
import SpotifyCallback from './SpotifyCallback';
import MasterWizard from './components/MasterWizard';

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

  // État du wizard animateur
  const [showWizard, setShowWizard] = useState(false);
  const [masterConfig, setMasterConfig] = useState(null);

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

  // Détecter si on revient de Spotify OAuth et rouvrir le wizard automatiquement
  useEffect(() => {
    const wizardInProgress = localStorage.getItem('wizardInProgress');
    if (wizardInProgress === 'true' && page === 'home') {
      // Nettoyer le flag
      localStorage.removeItem('wizardInProgress');
      // Rouvrir le wizard
      setShowWizard(true);
    }
  }, [page]);

  // Handler de completion du wizard
  const handleWizardComplete = useCallback((config) => {
    console.log('✅ Wizard complété avec config:', config);
    setMasterConfig(config);
    setShowWizard(false);
    setPage('master');
    // Nettoyer le flag wizard en cours
    localStorage.removeItem('wizardInProgress');
  }, []);

  // Handler du bouton Animateur
  const handleAnimatorClick = () => {
    // Marquer le wizard en cours
    localStorage.setItem('wizardInProgress', 'true');
    setShowWizard(true);
  };

  if (page === 'callback') return <SpotifyCallback />;

  if (page === 'master') {
    return (
      <Master
        initialSessionId={masterConfig?.sessionId}
        initialMusicSource={masterConfig?.musicSource}
        initialPlayMode={masterConfig?.playMode}
        initialGameMode={masterConfig?.gameMode}
        initialPlaylist={masterConfig?.playlist}
        initialPlaylistId={masterConfig?.playlistId}
        initialSpotifyToken={masterConfig?.spotifyToken}
      />
    );
  }

  if (page === 'buzzer') return <Buzzer />;
  if (page === 'tv') return <TV />;

  return (
    <>
      <div className="bg-gradient flex-center">
        <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
          <h1 className="title">🎵 BLIND TEST 🎵</h1>
          <div className="space-y">
            <button onClick={handleAnimatorClick} className="btn btn-yellow" style={{ width: '100%', padding: '1.5rem', fontSize: '1.5rem' }}>
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

      {/* Wizard modal */}
      {showWizard && (
        <MasterWizard onComplete={handleWizardComplete} />
      )}
    </>
  );
}
