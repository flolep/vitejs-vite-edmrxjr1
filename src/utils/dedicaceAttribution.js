/**
 * Attribution des « dédicaces » — v1 (attribution seule, côté client).
 *
 * L'API Le Trésor score la playlist pour le GROUPE (score_composite) mais
 * n'attribue pas un titre à un joueur précis. On calcule donc l'attribution
 * localement : on rapproche le `genre` renvoyé par chaque titre des genres
 * demandés par chaque joueur (players_preferences), avec équilibrage.
 *
 * Cf. memory/dedicaces-genre-feature.md pour la spec.
 */

// Minuscules, sans accents, séparateurs unifiés (pour comparer des genres)
const normalize = (str = '') =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/[-_]/g, ' ')
    .trim();

// Découpe le genre d'une chanson en tokens ("Pop / Funk" -> ["pop", "funk"])
const genreTokens = (songGenre = '') =>
  normalize(songGenre)
    .split(/[/,&+]|\bet\b/)
    .map((t) => t.trim())
    .filter(Boolean);

// Un genre joueur `g` correspond-il à l'un des tokens du titre ?
const genreMatchesTokens = (g, tokens) => {
  const ng = normalize(g);
  if (ng.length < 3) return false;
  return tokens.some((t) => t === ng || t.includes(ng) || ng.includes(t));
};

const playerMatchesTokens = (player, tokens) =>
  (player.genres || []).some((g) => genreMatchesTokens(g, tokens));

// Le genre du joueur qui a matché ce titre (pour l'afficher dans la dédicace)
const matchedGenre = (player, tokens) =>
  (player.genres || []).find((g) => genreMatchesTokens(g, tokens)) ||
  (player.genres || [])[0] ||
  null;

const buildDedicace = (player, tokens) => ({
  type: 'joueur',
  playerId: player.id,
  playerName: player.name,
  playerPhoto: player.photo || null,
  genre: matchedGenre(player, tokens),
  specialPhrase: player.specialPhrase || null,
});

const DECOUVERTE = { type: 'decouverte' };

/**
 * Annote chaque chanson avec un champ `dedicace`.
 * Ne réordonne jamais la playlist (l'ordre pilote la génération des questions quiz).
 *
 * @param {Array} songs   Chansons issues de tresorService (portent `genre`)
 * @param {Array} players Joueurs { id, name, photo, genres[], specialPhrase }
 * @returns {Array} songs annotés d'un champ `dedicace`
 */
export function attribuerDedicaces(songs = [], players = []) {
  if (!Array.isArray(songs) || songs.length === 0) return songs;

  const eligible = (players || []).filter(
    (p) => p && p.id && Array.isArray(p.genres) && p.genres.length > 0
  );

  // Personne n'a de préférences exploitables -> aucune dédicace
  if (eligible.length === 0) {
    return songs.map((s) => ({ ...s, dedicace: DECOUVERTE }));
  }

  const counts = Object.fromEntries(eligible.map((p) => [p.id, 0]));

  // Candidats par chanson (pré-calcul) + tokens réutilisés pour l'affichage
  const tokensPerSong = songs.map((song) => genreTokens(song.genre));
  const candidatesPerSong = songs.map((song, i) =>
    eligible.filter((p) => playerMatchesTokens(p, tokensPerSong[i]))
  );

  // Attribution gloutonne équilibrée : au candidat le moins doté (tie-break stable)
  const attributed = songs.map((song, i) => {
    const candidates = candidatesPerSong[i];
    if (candidates.length === 0) {
      return { ...song, dedicace: DECOUVERTE };
    }
    const chosen = candidates
      .slice()
      .sort(
        (a, b) =>
          counts[a.id] - counts[b.id] ||
          String(a.id).localeCompare(String(b.id))
      )[0];
    counts[chosen.id] += 1;
    return { ...song, dedicace: buildDedicace(chosen, tokensPerSong[i]) };
  });

  // Garantie best-effort : >= 1 dédicace par joueur éligible.
  // On « vole » un titre candidat à un joueur mieux doté (>1) si possible.
  for (const p of eligible) {
    if (counts[p.id] > 0) continue;
    const idx = attributed.findIndex(
      (s, i) =>
        s.dedicace?.type === 'joueur' &&
        candidatesPerSong[i].some((c) => c.id === p.id) &&
        counts[s.dedicace.playerId] > 1
    );
    if (idx !== -1) {
      const prevId = attributed[idx].dedicace.playerId;
      counts[prevId] -= 1;
      counts[p.id] += 1;
      attributed[idx] = {
        ...attributed[idx],
        dedicace: buildDedicace(p, tokensPerSong[idx]),
      };
    }
  }

  return attributed;
}

export default attribuerDedicaces;
