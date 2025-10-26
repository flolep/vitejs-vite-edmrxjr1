const CLIENT_ID = '4a234a00902a452a8d326ddfb1534f81';

// URL de callback dynamique basée sur l'environnement actuel
// Fonctionne sur : production, staging, develop, et localhost
const getRedirectUri = () => `${window.location.origin}/callback`;

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ');

export const spotifyService = {
  // Générer l'URL de connexion
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: getRedirectUri(),
      scope: SCOPES,
      show_dialog: true
    });
    return `https://accounts.spotify.com/authorize?${params}`;
  },

  // Échanger le code contre un token
  async getAccessToken(code) {
    try {
      console.log('🔑 getAccessToken appelé');
      console.log('🔑 Code:', code ? code.substring(0, 20) + '...' : 'MANQUANT');
      console.log('🔑 RedirectUri:', getRedirectUri());

      const response = await fetch('/.netlify/functions/spotify-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri: getRedirectUri() })
      });

      console.log('🔑 Réponse fonction Netlify:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erreur fonction Netlify:', response.status, errorText);
        throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔑 Données reçues:', data);

      return data;
    } catch (error) {
      console.error('❌ Error getting access token:', error);
      throw error;
    }
  },

  // Récupérer les playlists de l'utilisateur
  async getUserPlaylists(accessToken) {
    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to get playlists');
    const data = await response.json();
    
    return data.items;
  },

  // Récupérer les morceaux d'une playlist
  async getPlaylistTracks(accessToken, playlistId) {
    console.log('🎵 Récupération playlist:', playlistId);
    console.log('🔑 Token utilisé:', accessToken ? `${accessToken.substring(0, 20)}...` : 'AUCUN TOKEN');

    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    console.log('📡 Réponse Spotify:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Erreur Spotify:', response.status, errorData);
      throw new Error('Failed to get playlist tracks');
    }

    const data = await response.json();
    
    return data.items.map(item => ({
      title: item.track.name,
      artist: item.track.artists.map(a => a.name).join(', '),
      imageUrl: item.track.album.images[0]?.url,
      duration: item.track.duration_ms / 1000,
      spotifyUri: item.track.uri,
      previewUrl: item.track.preview_url,
      revealed: false
    }));
  },

  // Initialiser le Web Playback SDK
  async initPlayer(accessToken, onReady, onStateChange) {
    return new Promise((resolve) => {
      window.onSpotifyWebPlaybackSDKReady = () => {
        const player = new window.Spotify.Player({
          name: 'Blind Test Player',
          getOAuthToken: cb => cb(accessToken),
          volume: 0.8
        });

        player.addListener('ready', ({ device_id }) => {
          console.log('Player ready with device ID:', device_id);
          onReady(device_id);
          resolve(player);
        });

        player.addListener('player_state_changed', onStateChange);

        player.connect();
      };

      // Charger le SDK si pas déjà chargé
      if (!window.Spotify) {
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        document.body.appendChild(script);
      } else {
        window.onSpotifyWebPlaybackSDKReady();
      }
    });
  },

  // Jouer un morceau - CORRIGÉ : ne pas parser JSON
  async playTrack(accessToken, deviceId, spotifyUri, positionMs = 0) {
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [spotifyUri],
        position_ms: positionMs
      })
    });
    
    // IMPORTANT : L'API play ne retourne pas de JSON, juste un status 204
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Spotify play error: ${response.status} - ${errorText}`);
    }
    
    // Ne pas essayer de parser JSON, la réponse est vide
    return;
  },

  // Pause - CORRIGÉ : ne pas parser JSON
  async pausePlayback(accessToken) {
    const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    // L'API pause ne retourne pas de JSON non plus
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Spotify pause error: ${response.status} - ${errorText}`);
    }
    
    return;
  },

  // Resume - CORRIGÉ : ne pas parser JSON
  async resumePlayback(accessToken) {
    const response = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    // L'API resume ne retourne pas de JSON
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Spotify resume error: ${response.status} - ${errorText}`);
    }
    
    return;
  }
};