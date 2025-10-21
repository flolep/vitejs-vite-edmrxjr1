import React, { useEffect } from 'react';
import { spotifyService } from './spotifyService';

export default function SpotifyCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      
      if (code) {
        try {
          const tokenData = await spotifyService.getAccessToken(code);
          
          // Stocker le token (en mémoire pour cette session)
          sessionStorage.setItem('spotify_access_token', tokenData.access_token);
          sessionStorage.setItem('spotify_refresh_token', tokenData.refresh_token);

          // Forcer la page master dans localStorage avant de rediriger
          localStorage.setItem('currentPage', 'master');

          // Rediriger vers Master
          window.location.href = '/master';
        } catch (error) {
          console.error('Error during callback:', error);
          alert('Erreur de connexion Spotify');
        }
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