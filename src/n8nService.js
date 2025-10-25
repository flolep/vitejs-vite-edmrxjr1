// Configuration n8n
const N8N_WEBHOOK_BASE_URL = 'https://n8n.srv1038816.hstgr.cloud/webhook-test';

export const n8nService = {
  /**
   * Crée une playlist vide sur Spotify via n8n (VERSION SIMPLE - Animateur unique)
   * Utilise le compte Spotify configuré dans n8n (vos credentials personnels)
   * @param {string} playlistName - Le nom de la playlist (optionnel). Si non fourni, génère "BlindTest-YYYY-MM-DD-XXX"
   * @param {string} description - La description de la playlist (optionnel)
   * @returns {Promise<{success: boolean, playlistId: string, playlistName: string, playlistUrl: string}>}
   */
  async createSpotifyPlaylistSimple(playlistName = null, description = null) {
    try {
      const payload = {};

      // Ajouter le nom seulement s'il est fourni (sinon n8n le génère automatiquement)
      if (playlistName) {
        payload.playlistName = playlistName;
      }

      // Ajouter la description seulement si elle est fournie
      if (description) {
        payload.description = description;
      }

      console.log('📤 Création playlist Spotify via n8n (simple):', payload);

      const response = await fetch(`${N8N_WEBHOOK_BASE_URL}/create-playlist-simple`, {
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
   * Crée une playlist vide sur Spotify via n8n (VERSION MULTI-UTILISATEURS)
   * @param {string} userId - L'ID utilisateur Spotify
   * @param {string} playlistName - Le nom de la playlist (optionnel). Si non fourni, génère "BlindTest-YYYY-MM-DD-XXX"
   * @param {string} description - La description de la playlist (optionnel)
   * @returns {Promise<{success: boolean, playlistId: string, playlistName: string, playlistUrl: string}>}
   */
  async createSpotifyPlaylist(userId, playlistName = null, description = null) {
    try {
      const payload = {
        userId: userId
      };

      // Ajouter le nom seulement s'il est fourni (sinon n8n le génère automatiquement)
      if (playlistName) {
        payload.playlistName = playlistName;
      }

      // Ajouter la description seulement si elle est fournie
      if (description) {
        payload.description = description;
      }

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
  },

  /**
   * Remplit une playlist Spotify avec des chansons générées par IA
   * Basé sur les préférences du joueur (âge, genres musicaux, etc.)
   * @param {object} params - Les paramètres
   * @param {string} params.playlistId - ID de la playlist à remplir (créée précédemment)
   * @param {number} params.age - Âge du joueur
   * @param {array} params.genres - Liste de 3 genres musicaux favoris (ex: ["Pop", "Rock", "Electronic"])
   * @param {string} params.genre1Preferences - Préférences détaillées pour le genre 1 (optionnel)
   * @param {string} params.genre2Preferences - Préférences détaillées pour le genre 2 (optionnel)
   * @param {string} params.genre3Preferences - Préférences détaillées pour le genre 3 (optionnel)
   * @returns {Promise<{success: boolean, playlistId: string, totalSongs: number, songs: array}>}
   */
  async fillPlaylistWithAI({
    playlistId,
    age,
    genres,
    genre1Preferences = '',
    genre2Preferences = '',
    genre3Preferences = ''
  }) {
    try {
      const payload = {
        playlistId: playlistId,
        age: age,
        genres: genres,
        genre1Preferences: genre1Preferences,
        genre2Preferences: genre2Preferences,
        genre3Preferences: genre3Preferences
      };

      console.log('🤖 Génération playlist IA via n8n:', payload);

      const response = await fetch(`${N8N_WEBHOOK_BASE_URL}/blindtest-player-input`, {
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
      console.log('✅ Playlist remplie avec IA:', data);

      return data;
    } catch (error) {
      console.error('❌ Erreur remplissage playlist IA:', error);
      throw error;
    }
  }
};
