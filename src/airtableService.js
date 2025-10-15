const USE_LOCAL_STORAGE = true;
const LOCAL_STORAGE_KEY = 'blindtest_players';

const localDB = {
  getPlayers() {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  
  savePlayer(player) {
    const players = this.getPlayers();
    players.push({
      id: `local_${Date.now()}`,
      ...player,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(players));
    return players[players.length - 1];
  },
  
  searchPlayers(searchTerm) {
    const players = this.getPlayers();
    const term = searchTerm.toLowerCase();
    return players.filter(p => p.name.toLowerCase().includes(term));
  }
};

export const airtableService = {
  async findPlayer(searchTerm) {
    console.log('🔍 Recherche locale:', searchTerm);
    const results = localDB.searchPlayers(searchTerm);
    
    return {
      found: results.length > 0,
      count: results.length,
      players: results
    };
  },

  async createPlayer(playerData) {
    console.log('💾 Création locale:', playerData.name);
    const newPlayer = localDB.savePlayer(playerData);
    
    return {
      success: true,
      id: newPlayer.id,
      name: newPlayer.name,
      photo: newPlayer.photo
    };
  }
};