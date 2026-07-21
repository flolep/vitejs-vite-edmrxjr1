/**
 * Traducteur PUR : préférences de genre d'un joueur → profils de scoring Trésor.
 *
 * Contrat Trésor §7 (impératif) :
 *  - UN profil par joueur, `poids: 1` pour tous.
 *  - Chaque libellé part À SON NIVEAU (famille_son OU sous_genre_son selon la
 *    table). JAMAIS d'auto-extension d'un sous_genre vers sa famille.
 *  - famille_son / sous_genre_son / themes sont des LISTES : on n'inclut une clé
 *    QUE si elle est non vide (clé absente = dimension ignorée, sans pénalité).
 *  - Chaînes EXACTES (casse + accents). On ne normalise rien.
 *
 * ⚠️ Aucune dépendance Firebase/React : fonction pure, testable en isolation.
 * ⚠️ Vocabulaire aligné sur la scission de l'ancienne famille pop/variété en
 *    deux familles distinctes, `Pop` et `Variété FR` (HANDOFF §2) : l'ancienne
 *    valeur unique n'existe plus en base et ne matcherait plus aucun titre.
 */

// Libellé joueur → une ou plusieurs cibles { field, value } (valeurs EXACTES).
const GENRE_MAP = {
  // → famille_son
  Pop: [{ field: 'famille_son', value: 'Pop' }],
  'Variété française': [{ field: 'famille_son', value: 'Variété FR' }],
  Rock: [{ field: 'famille_son', value: 'Rock' }],
  Électro: [{ field: 'famille_son', value: 'Électronique' }],
  Reggae: [{ field: 'famille_son', value: 'Reggae / Ska' }],

  // → sous_genre_son
  'Hip-Hop': [{ field: 'sous_genre_son', value: 'rap / hip-hop' }],
  'R&B': [{ field: 'sous_genre_son', value: 'R&B' }],
  Métal: [{ field: 'sous_genre_son', value: 'hard rock / métal' }],
  Indie: [{ field: 'sous_genre_son', value: 'indie' }],
  Soul: [{ field: 'sous_genre_son', value: 'soul' }],
  Funk: [{ field: 'sous_genre_son', value: 'funk' }],
  Disco: [{ field: 'sous_genre_son', value: 'disco' }],
  Jazz: [{ field: 'sous_genre_son', value: 'jazz' }],
  Blues: [{ field: 'sous_genre_son', value: 'blues' }],
  Country: [{ field: 'sous_genre_son', value: 'country' }],

  // Cas spécial : DEUX champs
  'Rap français': [
    { field: 'sous_genre_son', value: 'rap / hip-hop' },
    { field: 'themes', value: 'Rap Français' },
  ],
};

const FIELDS = ['famille_son', 'sous_genre_son', 'themes'];

/**
 * Vocabulaire effectivement utilisé par la table de mapping, par champ.
 * Sert de FALLBACK quand GET /taxonomy est injoignable : on se replie sur nos
 * propres valeurs, ce qui revient à ne rien filtrer (comportement d'avant).
 * @returns {{ famille_son: Set<string>, sous_genre_son: Set<string>, themes: Set<string> }}
 */
export function genreMapVocabulary() {
  const vocab = { famille_son: new Set(), sous_genre_son: new Set(), themes: new Set() };
  for (const targets of Object.values(GENRE_MAP)) {
    for (const { field, value } of targets) vocab[field].add(value);
  }
  return vocab;
}

// Fenêtre « formatrice » : les goûts se fixent grosso modo entre 13 et 27 ans
// (HANDOFF §7). Le serveur scinde ensuite le quota du joueur via `panachage`.
const FORMATIVE_FROM = 13;
const FORMATIVE_TO = 27;

// Bornes de plausibilité. Le bas est à FORMATIVE_FROM : en dessous, la fenêtre
// serait entièrement dans le futur donc vide de sens. Le haut reprend la
// validation de saisie (save-player-preferences.js : 1..120).
const AGE_MIN = FORMATIVE_FROM;
const AGE_MAX = 120;

/**
 * Époque formatrice d'un joueur, dérivée de son âge.
 * @returns {{ annee_min: number, annee_max: number } | null} null si l'âge est
 *   absent/aberrant → le joueur est alors servi par simple match de genre.
 */
export function formativeWindow(age, currentYear) {
  const a = typeof age === 'number' ? age : Number(age);
  if (!Number.isFinite(a) || !Number.isInteger(a) || a < AGE_MIN || a > AGE_MAX) {
    return null;
  }
  const naissance = currentYear - a;
  const annee_min = naissance + FORMATIVE_FROM;
  // Pas de titre dans le futur : on borne au millésime courant.
  const annee_max = Math.min(naissance + FORMATIVE_TO, currentYear);
  if (annee_min > annee_max) return null; // fenêtre dégénérée
  return { annee_min, annee_max };
}

/**
 * Traduit les préférences d'UN joueur en profil de scoring.
 * @param {{ genres?: string[], age?: number }} preference
 * @param {{ currentYear?: number }} [opts] injectable pour des tests déterministes
 * @returns {{ poids: number, famille_son?: string[], sous_genre_son?: string[],
 *            themes?: string[], annee_min?: number, annee_max?: number }}
 */
export function playerToProfil(preference, opts = {}) {
  const currentYear = opts.currentYear ?? new Date().getFullYear();
  const genres = Array.isArray(preference?.genres) ? preference.genres : [];
  const buckets = { famille_son: [], sous_genre_son: [], themes: [] };

  for (const label of genres) {
    const targets = GENRE_MAP[label];
    if (!targets) {
      console.warn(`[genreProfils] Libellé de genre inconnu, ignoré : "${label}"`);
      continue;
    }
    for (const { field, value } of targets) {
      if (!buckets[field].includes(value)) {
        buckets[field].push(value); // dédup en préservant l'ordre d'apparition
      }
    }
  }

  const profil = { poids: 1 };
  for (const field of FIELDS) {
    if (buckets[field].length > 0) {
      profil[field] = buckets[field]; // clé présente uniquement si non vide
    }
  }

  // Époque formatrice : clés ajoutées SEULEMENT si l'âge est exploitable
  // (sans fenêtre, le serveur sert le joueur par simple match de genre).
  const window = formativeWindow(preference?.age, currentYear);
  if (window) {
    profil.annee_min = window.annee_min;
    profil.annee_max = window.annee_max;
  }

  return profil;
}

/**
 * Construit le tableau de profils (un par joueur) à envoyer au Trésor.
 * @param {Array<{ genres?: string[], age?: number }>} preferences
 * @param {{ currentYear?: number }} [opts]
 * @returns {Array<object>} un profil par entrée (au minimum { poids: 1 })
 */
export function buildProfils(preferences, opts = {}) {
  if (!Array.isArray(preferences)) return [];
  // Millésime figé pour TOUT le tableau : deux joueurs du même âge doivent
  // obtenir la même fenêtre, même si l'appel chevauche un 31 décembre.
  const currentYear = opts.currentYear ?? new Date().getFullYear();
  return preferences.map((p) => playerToProfil(p, { currentYear }));
}

/**
 * Reverse-lookup (option B) : parmi les genres DEMANDÉS par un joueur, lequel
 * correspond à la classification serveur d'un titre (famille_son OU sous_genre_son) ?
 * Sert à afficher « a demandé du {genre} » avec le libellé joueur, pas celui du titre.
 * @param {string[]} genres  libellés cochés par le joueur (les 16 boutons)
 * @param {{ famille_son?: string, sous_genre_son?: string }} track
 * @returns {string|null} le libellé joueur qui matche, sinon null (titre « filler »)
 */
export function requestedGenreForTrack(genres, track) {
  if (!Array.isArray(genres) || !track) return null;
  return (
    genres.find((label) => {
      const targets = GENRE_MAP[label];
      if (!targets) return false;
      return targets.some(
        (t) =>
          (t.field === 'famille_son' && t.value === track.famille_son) ||
          (t.field === 'sous_genre_son' && t.value === track.sous_genre_son)
      );
    }) || null
  );
}

export default buildProfils;
