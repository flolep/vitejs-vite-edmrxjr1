const FUNCTION_URL = '/.netlify/functions/airtable-player';

// ─── Fallback localStorage ───────────────────────────────────
const LOCAL_STORAGE_KEY = 'blindtest_players';

const localDB = {
  getPlayers() {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  savePlayer(player) {
    const players = this.getPlayers();
    const newPlayer = {
      id: `local_${Date.now()}`,
      ...player,
      createdAt: new Date().toISOString()
    };
    players.push(newPlayer);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(players));
    return { success: true, id: newPlayer.id, name: newPlayer.name, photo: newPlayer.photo };
  },
  searchPlayers(searchTerm) {
    const players = this.getPlayers();
    const term = searchTerm.toLowerCase();
    const results = players.filter(p => p.name && p.name.toLowerCase().includes(term));
    return { found: results.length > 0, count: results.length, players: results };
  }
};

// ─── Service exporté ─────────────────────────────────────────
export const airtableService = {
  async findPlayer(searchTerm) {
    if (!searchTerm) return { found: false, count: 0, players: [] };

    try {
      const response = await fetch(`${FUNCTION_URL}?search=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn('⚠️ Airtable findPlayer échoué, fallback localStorage:', err.message);
      return localDB.searchPlayers(searchTerm);
    }
  },

  async createPlayer(playerData) {
    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerData.name })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn('⚠️ Airtable createPlayer échoué, fallback localStorage:', err.message);
      return localDB.savePlayer(playerData);
    }
  }
};
