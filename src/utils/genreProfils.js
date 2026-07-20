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
 * ⚠️ La dimension de scoring genre n'est pas encore déployée côté Trésor ; ce
 *    module produit la FORME correcte du payload (validation de forme, pas
 *    d'orientation réelle tant que le chantier #1 Trésor n'est pas livré).
 */

// Libellé joueur → une ou plusieurs cibles { field, value } (valeurs EXACTES).
const GENRE_MAP = {
  // → famille_son
  Pop: [{ field: 'famille_son', value: 'Pop / Variété' }],
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
 * Traduit les préférences d'UN joueur en profil de scoring.
 * @param {{ genres?: string[] }} preference
 * @returns {{ poids: number, famille_son?: string[], sous_genre_son?: string[], themes?: string[] }}
 */
export function playerToProfil(preference) {
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
  return profil;
}

/**
 * Construit le tableau de profils (un par joueur) à envoyer au Trésor.
 * @param {Array<{ genres?: string[] }>} preferences
 * @returns {Array<object>} un profil par entrée (au minimum { poids: 1 })
 */
export function buildProfils(preferences) {
  if (!Array.isArray(preferences)) return [];
  return preferences.map(playerToProfil);
}

export default buildProfils;
