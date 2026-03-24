const PROXY_URL = '/.netlify/functions/tresor-proxy';

const mapWrongAnswers = (raw = []) => {
  const mapped = raw.map(wa => ({ text: `${wa.artiste} - ${wa.titre}` }));
  while (mapped.length < 3) {
    mapped.push({ text: '?' });
  }
  return mapped;
};

const mapSong = (song) => ({
  spotifyUri:   song.spotify_uri,
  title:        song.titre,
  artist:       song.artiste,
  imageUrl:     song.img_medium,
  duration:     song.duration_ms / 1000,
  durationMs:   song.duration_ms,
  previewUrl:   null,
  revealed:     false,
  id:           song.id,
  imgCouleur:   song.img_couleur,
  annee:        song.annee,
  difficulte:   song.difficulte,
  genre:        song.genre || null,
  theme:        song.theme || null,
  langue:       song.langue || null,
  wrongAnswers: mapWrongAnswers(song.wrong_answers),
});

const tresorService = {
  async getPlaylist({ n = 50, quiz = false, profils = [{ poids: 1 }] } = {}) {
    const start = performance.now();

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'POST /playlist', payload: { n, quiz, profils } }),
    });

    if (!response.ok) {
      throw new Error(`Le Trésor error: ${response.status}`);
    }

    const data = await response.json();
    const songs = (data.songs || []).map(mapSong);

    const elapsed = Math.round(performance.now() - start);
    console.log(`[tresorService] getPlaylist — ${songs.length} chansons reçues en ${elapsed}ms`);

    return { songs };
  },

  async getSong(id) {
    const start = performance.now();

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'GET /song/:id', params: { id } }),
    });

    if (!response.ok) {
      throw new Error(`Le Trésor error (getSong ${id}): ${response.status}`);
    }

    const data = await response.json();

    const elapsed = Math.round(performance.now() - start);
    console.log(`[tresorService] getSong(${id}) — ${elapsed}ms`);

    return data;
  },
};

export default tresorService;
