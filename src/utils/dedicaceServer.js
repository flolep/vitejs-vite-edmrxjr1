/**
 * Dédicaces AUTORITATIVES — source serveur (§7 contrat Trésor).
 *
 * Le Trésor renvoie, sur chaque titre de POST /playlist, un champ `dedicace` =
 * index 0-based du joueur dédié dans le tableau `profils` envoyé (mappé côté
 * client en `dedicaceServerIndex`). Ce module transforme cet index en le MÊME
 * objet `dedicace` que la TV attend déjà — on ne change que la SOURCE, pas la forme.
 *
 * ⚠️ `prefs` DOIT être le tableau ordonné passé à buildProfils :
 *    prefs[i] ↔ profils[i] ↔ dedicaceServerIndex === i.
 * Libellé « genre » : option B — un genre DEMANDÉ par le joueur (cf. requestedGenreForTrack).
 */

import { requestedGenreForTrack } from './genreProfils';

const DECOUVERTE = { type: 'decouverte' };

// Option B : le genre demandé qui matche le titre, sinon les genres du joueur (filler).
const displayGenre = (player, track) => {
  const matched = requestedGenreForTrack(player.genres, track);
  if (matched) return matched;
  const genres = Array.isArray(player.genres) ? player.genres : [];
  return genres.length ? genres.join(' / ') : null;
};

// Même forme que l'objet attendu par TV.jsx (currentSong.dedicace).
const buildFromPlayer = (player, track) => ({
  type: 'joueur',
  playerId: player.id,
  playerName: player.name,
  playerPhoto: player.photo || null,
  genre: displayGenre(player, track),
  specialPhrase: player.specialPhrase || null,
});

/**
 * Annote chaque titre d'un champ `dedicace` à partir de l'index serveur.
 * @param {Array} tracks titres mappés portant `dedicaceServerIndex`
 * @param {Array} prefs  MÊME tableau ordonné que celui passé à buildProfils
 * @returns {Array} tracks annotés (forme identique à l'attribution client)
 */
export function resolveDedicacesServeur(tracks = [], prefs = []) {
  if (!Array.isArray(tracks)) return tracks;
  const list = Array.isArray(prefs) ? prefs : [];
  return tracks.map((t) => {
    const idx = t?.dedicaceServerIndex;
    // Filet défensif : index absent/hors-plage → découverte (ne crashe jamais).
    if (typeof idx !== 'number' || idx < 0 || idx >= list.length || !list[idx]) {
      return { ...t, dedicace: DECOUVERTE };
    }
    return { ...t, dedicace: buildFromPlayer(list[idx], t) };
  });
}

export default resolveDedicacesServeur;
