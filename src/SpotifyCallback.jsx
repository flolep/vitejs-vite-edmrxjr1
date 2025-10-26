import React, { useEffect } from 'react';
import { spotifyService } from './spotifyService';

export default function SpotifyCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      console.log('🔐 SpotifyCallback démarré');
      console.log('🔐 URL:', window.location.href);

      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');

      console.log('🔐 Code reçu:', code ? code.substring(0, 20) + '...' : 'AUCUN');
      console.log('🔐 Erreur reçue:', error);

      if (error) {
        console.error('❌ Erreur OAuth Spotify:', error);
        alert(`Erreur Spotify: ${error}`);
        return;
      }

      if (code) {
        try {
          console.log('🔐 Appel getAccessToken...');
          const tokenData = await spotifyService.getAccessToken(code);
          console.log('🔐 Token reçu:', tokenData);
          console.log('🔐 access_token:', tokenData.access_token ? tokenData.access_token.substring(0, 20) + '...' : 'MANQUANT');
          console.log('🔐 refresh_token:', tokenData.refresh_token ? 'Présent' : 'MANQUANT');

          // Stocker le token (en mémoire pour cette session)
          sessionStorage.setItem('spotify_access_token', tokenData.access_token);
          sessionStorage.setItem('spotify_refresh_token', tokenData.refresh_token);
          console.log('✅ Tokens stockés dans sessionStorage');

          // Rediriger vers l'accueil pour relancer le wizard
          console.log('🔐 Redirection vers / (home) pour continuer le wizard...');
          window.location.href = '/';
        } catch (error) {
          console.error('❌ Error during callback:', error);
          alert('Erreur de connexion Spotify: ' + error.message);
        }
      } else {
        console.error('❌ Pas de code dans l\'URL');
        alert('Erreur: Pas de code d\'autorisation reçu');
      }
    };

    handleCallback();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
          🎵 Connexion à Spotify...
        </h1>
        <div style={{ fontSize: '3rem' }}>⏳</div>
      </div>
    </div>
  );
}