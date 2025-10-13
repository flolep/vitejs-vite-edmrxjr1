// Service pour communiquer avec n8n qui interroge Airtable
const N8N_BASE_URL = 'https://votre-n8n-instance.com/webhook';

export const airtableService = {
  /**
   * Rechercher un joueur par prénom/nom/alias
   */
  async findPlayer(searchTerm) {
    try {
      const response = await fetch(`${N8N_BASE_URL}/find-player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ search: searchTerm })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error finding player:', error);
      return { found: false, count: 0, players: [] };
    }
  },

  /**
   * Créer un nouveau joueur avec selfie
   */
  async createPlayer(playerData) {
    try {
      const response = await fetch(`${N8N_BASE_URL}/create-player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(playerData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating player:', error);
      throw error;
    }
  }
};