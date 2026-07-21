/**
 * Vocabulaire de genre — source de vérité SERVEUR (GET /taxonomy).
 *
 * Pourquoi : le Blindtest et le Trésor maintenaient chacun leur liste de
 * familles/sous-genres. Quand le Trésor a scindé l'ancienne famille pop/variété
 * en deux, notre valeur est devenue morte SANS AUCUN SIGNAL — les joueurs
 * « Pop » tombaient au score plancher en silence. Ce module rattrape ça : on
 * confronte nos valeurs au vocabulaire réel avant d'envoyer la requête.
 *
 * `GET /taxonomy` est NON CONSOMMATEUR (ne brûle pas le cooldown 30 j) et dérive
 * ses valeurs du catalogue par SELECT DISTINCT : il reflète l'état réel sans
 * redéploiement côté Trésor.
 *
 * Dégradation : tout échec (réseau, 4xx, forme inattendue) retombe sur le
 * vocabulaire local, ce qui revient à ne rien filtrer — comportement d'avant.
 */

import { genreMapVocabulary } from './genreProfils';

const PROXY_URL = '/.netlify/functions/tresor-proxy';

/** Normalise la réponse /taxonomy en 3 ensembles. Retourne null si la forme est inattendue. */
export function parseTaxonomy(raw) {
  const familles = raw?.familles;
  if (!familles || typeof familles !== 'object' || Array.isArray(familles)) return null;

  const famille_son = new Set(Object.keys(familles));
  if (famille_son.size === 0) return null;

  const sous_genre_son = new Set();
  for (const list of Object.values(familles)) {
    if (Array.isArray(list)) list.forEach((sg) => sous_genre_son.add(sg));
  }
  const themes = new Set(Array.isArray(raw.themes) ? raw.themes : []);

  return { famille_son, sous_genre_son, themes };
}

/**
 * Retire des profils toute valeur absente du vocabulaire serveur.
 * PUR. Une clé vidée est supprimée (clé absente = dimension ignorée, §7) —
 * on n'envoie jamais une liste vide, qui n'aurait pas la même sémantique.
 * @returns {{ profils: Array, dropped: string[] }} `dropped` = valeurs écartées
 */
export function sanitizeProfils(profils, vocab) {
  if (!Array.isArray(profils) || !vocab) return { profils, dropped: [] };
  const dropped = [];

  const cleaned = profils.map((profil) => {
    const out = { ...profil };
    for (const field of ['famille_son', 'sous_genre_son', 'themes']) {
      if (!Array.isArray(out[field])) continue;
      const kept = out[field].filter((v) => {
        const ok = vocab[field]?.has(v);
        if (!ok) dropped.push(`${field}=${v}`);
        return ok;
      });
      if (kept.length > 0) out[field] = kept;
      else delete out[field];
    }
    return out;
  });

  return { profils: cleaned, dropped };
}

let cached = null; // promesse mémoïsée : une seule requête par chargement de page

/**
 * Vocabulaire serveur, avec repli local. Ne rejette jamais.
 * @returns {Promise<{ famille_son: Set, sous_genre_son: Set, themes: Set }>}
 */
export function loadTaxonomy({ force = false } = {}) {
  if (cached && !force) return cached;

  cached = (async () => {
    try {
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'GET /taxonomy' }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const parsed = parseTaxonomy(await response.json());
      if (!parsed) throw new Error('forme de réponse inattendue');

      console.log(
        `📚 [Taxonomy] ${parsed.famille_son.size} familles, ` +
        `${parsed.sous_genre_son.size} sous-genres, ${parsed.themes.size} thèmes`
      );
      return parsed;
    } catch (err) {
      console.warn(`⚠️ [Taxonomy] indisponible (${err.message}) — repli sur le vocabulaire local`);
      return genreMapVocabulary();
    }
  })();

  return cached;
}

/** Réinitialise le cache (tests). */
export function resetTaxonomyCache() {
  cached = null;
}

export default loadTaxonomy;
