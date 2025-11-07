// Configuration n8n
// On passe par une Netlify Function pour éviter les problèmes CORS
const N8N_PROXY_URL = '/.netlify/functions/n8n-proxy';

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

      const response = await fetch(N8N_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: 'create-playlist-simple',
          payload: payload
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`n8n proxy error: ${response.status} - ${errorText}`);
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

      const response = await fetch(N8N_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: 'create-playlist',
          payload: payload
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`n8n proxy error: ${response.status} - ${errorText}`);
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

      const response = await fetch(N8N_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: 'blindtest-player-input',
          payload: payload
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`n8n proxy error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Playlist remplie avec IA:', data);

      return data;
    } catch (error) {
      console.error('❌ Erreur remplissage playlist IA:', error);
      throw error;
    }
  },

  /**
   * Génère une playlist Quiz avec questions à choix multiples
   * Chaque chanson est accompagnée de 3 mauvaises réponses (faux titre ou artiste)
   * @param {object} params - Les paramètres
   * @param {string} params.playlistId - ID de la playlist à remplir
   * @param {number} params.age - Âge du joueur
   * @param {array} params.genres - Liste de 3 genres musicaux favoris
   * @param {string} params.genre1Preferences - Préférences détaillées (optionnel)
   * @param {string} params.genre2Preferences - Préférences détaillées (optionnel)
   * @param {string} params.genre3Preferences - Préférences détaillées (optionnel)
   * @returns {Promise<{success: boolean, playlistId: string, totalSongs: number, songs: array}>}
   */
  async fillPlaylistQuizMode({
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

      console.log('🎯 Génération playlist Quiz via n8n:', payload);

      const response = await fetch(N8N_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: 'blindtest-quiz-mode',
          payload: payload
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`n8n proxy error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Playlist Quiz générée:', data);

      // Format attendu de la réponse:
      // {
      //   success: true,
      //   playlistId: "xxx",
      //   totalSongs: 10,
      //   songs: [
      //     {
      //       uri: "spotify:track:xxx",
      //       title: "Song Title",
      //       artist: "Artist Name",
      //       correctAnswer: "Song Title - Artist Name",
      //       wrongAnswers: ["Wrong 1", "Wrong 2", "Wrong 3"],
      //       allAnswers: ["Correct", "Wrong 1", "Wrong 2", "Wrong 3"] // Mélangées
      //     }
      //   ]
      // }

      return data;
    } catch (error) {
      console.error('❌ Erreur génération playlist Quiz:', error);
      throw error;
    }
  },

  /**
   * 🆕 NOUVEAU : Génère une playlist avec toutes les préférences de tous les joueurs
   * Envoie toutes les préférences en une seule fois à n8n pour une génération globale
   * @param {object} params - Les paramètres
   * @param {string} params.playlistId - ID de la playlist à remplir (créée précédemment)
   * @param {array} params.players - Tableau des joueurs avec leurs préférences
   *   Chaque joueur doit avoir : { name, age, genres, specialPhrase }
   * @returns {Promise<{success: boolean, playlistId: string, totalSongs: number, totalPlayers: number, songs: array}>}
   *
   * Exemple d'utilisation :
   * await n8nService.generatePlaylistWithAllPreferences({
   *   playlistId: "spotify_playlist_id",
   *   players: [
   *     { name: "John", age: 25, genres: ["Pop", "Rock"], specialPhrase: "J'aime danser" },
   *     { name: "Marie", age: 30, genres: ["Jazz", "Soul"], specialPhrase: "Smooth vibes" }
   *   ]
   * });
   */
  async generatePlaylistWithAllPreferences({ playlistId, players }) {
    try {
      // Validation
      if (!playlistId) {
        throw new Error('playlistId est requis');
      }

      if (!Array.isArray(players) || players.length === 0) {
        throw new Error('players doit être un tableau non vide');
      }

      // Valider chaque joueur
      players.forEach((player, index) => {
        if (!player.name) {
          throw new Error(`Le joueur ${index + 1} doit avoir un nom`);
        }
        if (!player.age || typeof player.age !== 'number') {
          throw new Error(`Le joueur ${index + 1} (${player.name}) doit avoir un âge valide`);
        }
        if (!Array.isArray(player.genres) || player.genres.length === 0) {
          throw new Error(`Le joueur ${index + 1} (${player.name}) doit avoir au moins un genre`);
        }
      });

      const payload = {
        playlistId: playlistId,
        players: players
      };

      console.log('🎵 Génération playlist GROUPÉE via n8n:');
      console.log(`   📊 ${players.length} joueur(s)`);
      console.log(`   🎼 Genres: ${[...new Set(players.flatMap(p => p.genres))].join(', ')}`);
      console.log(`   👥 Âges: ${Math.min(...players.map(p => p.age))}-${Math.max(...players.map(p => p.age))} ans`);

      const response = await fetch(N8N_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: 'blindtest-batch-playlist',
          payload: payload
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`n8n proxy error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Playlist générée avec succès:');
      console.log(`   🎵 ${data.totalSongs} chansons ajoutées`);
      console.log(`   👥 ${data.totalPlayers} joueurs satisfaits`);

      return data;
    } catch (error) {
      console.error('❌ Erreur génération playlist groupée:', error);
      throw error;
    }
  }
};
