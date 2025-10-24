// Configuration n8n
const N8N_WEBHOOK_BASE_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://your-n8n-instance.com/webhook';

export const n8nService = {
  /**
   * Crée une playlist vide sur Spotify via n8n
   * @param {string} userId - L'ID utilisateur Spotify
   * @param {string} playlistName - Le nom de la playlist (optionnel)
   * @param {string} description - La description de la playlist (optionnel)
   * @returns {Promise<{success: boolean, playlistId: string, playlistName: string, playlistUrl: string}>}
   */
  async createSpotifyPlaylist(userId, playlistName = null, description = null) {
    try {
      const payload = {
        userId: userId,
        playlistName: playlistName || `Blind Test - ${new Date().toLocaleDateString('fr-FR')}`,
        description: description || 'Playlist créée pour Blind Test'
      };

      console.log('📤 Création playlist Spotify via n8n:', payload);

      const response = await fetch(`${N8N_WEBHOOK_BASE_URL}/create-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`n8n webhook error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Playlist créée:', data);

      return data;
    } catch (error) {
      console.error('❌ Erreur création playlist via n8n:', error);
      throw error;
    }
  },

  /**
   * Récupère l'ID utilisateur Spotify depuis un access token
   * @param {string} accessToken - Le token d'accès Spotify
   * @returns {Promise<string>} L'ID utilisateur Spotify
   */
  async getSpotifyUserId(accessToken) {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get Spotify user info');
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error('❌ Erreur récupération userId Spotify:', error);
      throw error;
    }
  },

  /**
   * Workflow complet : récupère l'userId et crée la playlist
   * @param {string} accessToken - Le token d'accès Spotify
   * @param {string} playlistName - Le nom de la playlist
   * @param {string} description - La description de la playlist
   * @returns {Promise<{success: boolean, playlistId: string, playlistName: string, playlistUrl: string}>}
   */
  async createPlaylistWithToken(accessToken, playlistName, description) {
    try {
      // 1. Récupérer l'userId
      const userId = await this.getSpotifyUserId(accessToken);
      console.log('👤 Spotify User ID:', userId);

      // 2. Créer la playlist via n8n
      const result = await this.createSpotifyPlaylist(userId, playlistName, description);

      return result;
    } catch (error) {
      console.error('❌ Erreur workflow création playlist:', error);
      throw error;
    }
  }
};
