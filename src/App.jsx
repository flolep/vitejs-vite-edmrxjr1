import React, { useState, useEffect } from 'react';
import Buzzer from './Buzzer';
import TV from './TV';
import SpotifyCallback from './SpotifyCallback';
import MasterFlowContainer from './pages/MasterFlow/MasterFlowContainer';
import { SpotifyTokenProvider } from './contexts/SpotifyTokenContext';
import { sessionStorage_ } from './utils/storage';

export default function App() {
  // Initialiser la page depuis l'URL uniquement
  const getInitialPage = () => {
    const path = window.location.pathname;
    if (path === '/callback') return 'callback';
    if (path === '/buzzer') return 'buzzer';
    if (path === '/tv') return 'tv';
    // Si on est sur '/', toujours retourner 'home' (page d'accueil)
    return 'home';
  };

  const [page, setPage] = useState(getInitialPage);

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

  // Détecter si on revient de Spotify OAuth et rediriger vers le nouveau flux
  useEffect(() => {
    const wizardInProgress = sessionStorage_.getWizardInProgress();
    if (wizardInProgress === 'true' && page === 'home') {
      // Nettoyer le flag
      sessionStorage_.removeWizardInProgress();

      // Rediriger vers le nouveau flux master-flow
      console.log('🔄 Retour de Spotify OAuth → Redirection vers master-flow');
      setPage('master-flow');
    }
  }, [page]);

  // Handler du bouton Animateur
  const handleAnimatorClick = () => {
    setPage('master-flow');
  };

  if (page === 'callback') return <SpotifyCallback />;

  // Flux Master refactorisé
  if (page === 'master-flow') {
    return (
      <SpotifyTokenProvider>
        <MasterFlowContainer />
      </SpotifyTokenProvider>
    );
  }

  if (page === 'buzzer') return <Buzzer />;
  if (page === 'tv') return <TV />;

  return (
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
  );
}
