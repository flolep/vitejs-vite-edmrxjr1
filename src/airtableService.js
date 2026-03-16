const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const TABLE_NAME = 'Joueurs';

const USE_AIRTABLE = !!API_KEY && !!BASE_ID;

if (!USE_AIRTABLE) {
  console.warn('⚠️ Airtable non configuré — fallback localStorage');
}

// ─── Fallback localStorage ───────────────────────────────────
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
    return players.filter(p => p.name && p.name.toLowerCase().includes(term));
  }
};

// ─── API Airtable ────────────────────────────────────────────
const airtableFetch = async (path, options = {}) => {
  const response = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Airtable ${response.status}: ${errorBody}`);
  }

  return response.json();
};

// ─── Service exporté ─────────────────────────────────────────
export const airtableService = {
  async findPlayer(searchTerm) {
    if (!searchTerm) return { found: false, count: 0, players: [] };

    // Airtable
    if (USE_AIRTABLE) {
      try {
        const formula = encodeURIComponent(
          `OR(SEARCH(LOWER("${searchTerm}"), LOWER({Prénom})), SEARCH(LOWER("${searchTerm}"), LOWER({Alias})))`
        );
        const data = await airtableFetch(`?filterByFormula=${formula}&maxRecords=10`);

        const players = data.records.map(r => ({
          id: r.id,
          name: r.fields['Prénom'] || r.fields['Alias'] || '',
          photo: r.fields['Selfie']?.[0]?.url || null
        }));

        return { found: players.length > 0, count: players.length, players };
      } catch (err) {
        console.warn('⚠️ Airtable findPlayer échoué, fallback localStorage:', err.message);
      }
    }

    // Fallback localStorage
    const results = localDB.searchPlayers(searchTerm);
    return { found: results.length > 0, count: results.length, players: results };
  },

  async createPlayer(playerData) {
    // Airtable
    if (USE_AIRTABLE) {
      try {
        const data = await airtableFetch('', {
          method: 'POST',
          body: JSON.stringify({
            fields: {
              'Prénom': playerData.name,
              'Actif ?': 'Oui'
            }
          })
        });

        return {
          success: true,
          id: data.id,
          name: data.fields['Prénom'],
          photo: null
        };
      } catch (err) {
        console.warn('⚠️ Airtable createPlayer échoué, fallback localStorage:', err.message);
      }
    }

    // Fallback localStorage
    const newPlayer = localDB.savePlayer(playerData);
    return {
      success: true,
      id: newPlayer.id,
      name: newPlayer.name,
      photo: newPlayer.photo
    };
  }
};
