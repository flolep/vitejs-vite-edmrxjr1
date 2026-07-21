import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseTaxonomy, sanitizeProfils, loadTaxonomy, resetTaxonomyCache } from './taxonomy.js';
import { genreMapVocabulary } from './genreProfils.js';

// Réponse réelle de la prod (extrait fidèle de GET /taxonomy).
const RAW = {
  familles: {
    Pop: ['dance-pop', 'pop internationale', 'synth-pop'],
    'Variété FR': ['variété française'],
    Rock: ['classic rock', 'hard rock / métal', 'indie', 'punk'],
  },
  themes: ['Rap Français', 'Chanson Française'],
};

afterEach(() => {
  resetTaxonomyCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseTaxonomy', () => {
  it('aplatit familles → familles + sous-genres + thèmes', () => {
    const v = parseTaxonomy(RAW);
    expect([...v.famille_son].sort()).toEqual(['Pop', 'Rock', 'Variété FR']);
    expect(v.sous_genre_son.has('variété française')).toBe(true);
    expect(v.sous_genre_son.has('hard rock / métal')).toBe(true);
    expect(v.themes.has('Rap Français')).toBe(true);
  });

  it('formes inattendues → null (déclenche le repli)', () => {
    for (const bad of [null, undefined, {}, { familles: null }, { familles: [] }, { familles: {} }]) {
      expect(parseTaxonomy(bad)).toBeNull();
    }
  });

  it('tolère une réponse sans thèmes', () => {
    expect(parseTaxonomy({ familles: { Pop: ['synth-pop'] } }).themes.size).toBe(0);
  });
});

describe('sanitizeProfils', () => {
  const vocab = parseTaxonomy(RAW);

  it('laisse intact un profil entièrement valide', () => {
    const profils = [{ poids: 1, famille_son: ['Pop'], sous_genre_son: ['indie'] }];
    const { profils: out, dropped } = sanitizeProfils(profils, vocab);
    expect(out).toEqual(profils);
    expect(dropped).toEqual([]);
  });

  // Régression : c'est exactement le mécanisme qui a manqué lors de la scission
  // de l'ancienne famille pop/variété (valeur devenue morte, échec silencieux).
  it('écarte une famille que le serveur ne connaît plus, et la signale', () => {
    const { profils: out, dropped } = sanitizeProfils(
      [{ poids: 1, famille_son: ['Ancienne Famille Fusionnée'] }],
      vocab
    );
    expect(out[0]).not.toHaveProperty('famille_son');
    expect(dropped).toEqual(['famille_son=Ancienne Famille Fusionnée']);
  });

  it('supprime la clé vidée au lieu d\'envoyer une liste vide', () => {
    const { profils: out } = sanitizeProfils([{ poids: 1, themes: ['Inconnu'] }], vocab);
    expect(out[0]).toEqual({ poids: 1 });
  });

  it('ne garde que les valeurs valides quand la liste est mixte', () => {
    const { profils: out, dropped } = sanitizeProfils(
      [{ poids: 1, famille_son: ['Pop', 'Zouk'] }],
      vocab
    );
    expect(out[0].famille_son).toEqual(['Pop']);
    expect(dropped).toEqual(['famille_son=Zouk']);
  });

  it('ne touche jamais aux clés hors vocabulaire (poids, annee_min/max)', () => {
    const { profils: out } = sanitizeProfils(
      [{ poids: 1, annee_min: 1999, annee_max: 2013, famille_son: ['Pop'] }],
      vocab
    );
    expect(out[0]).toEqual({ poids: 1, annee_min: 1999, annee_max: 2013, famille_son: ['Pop'] });
  });

  it('ne mute pas les profils d\'entrée', () => {
    const profils = [{ poids: 1, famille_son: ['Mort'] }];
    sanitizeProfils(profils, vocab);
    expect(profils[0].famille_son).toEqual(['Mort']);
  });

  it('vocab absent → passe-plat', () => {
    const profils = [{ poids: 1, famille_son: ['Mort'] }];
    expect(sanitizeProfils(profils, null).profils).toBe(profils);
  });
});

describe('loadTaxonomy', () => {
  it('récupère et normalise le vocabulaire serveur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => RAW }));
    const v = await loadTaxonomy();
    expect(v.famille_son.has('Variété FR')).toBe(true);
  });

  it('mémoïse : un seul appel réseau par chargement', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => RAW });
    vi.stubGlobal('fetch', spy);
    await loadTaxonomy();
    await loadTaxonomy();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('erreur réseau → repli sur le vocabulaire local, sans rejet', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const v = await loadTaxonomy();
    expect(v.famille_son).toEqual(genreMapVocabulary().famille_son);
  });

  it('HTTP 500 → repli', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const v = await loadTaxonomy();
    expect(v.famille_son.has('Pop')).toBe(true);
  });

  it('le repli local laisse TOUS nos profils intacts (aucun filtrage)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const vocab = await loadTaxonomy();
    const profils = [{ poids: 1, famille_son: ['Variété FR'], sous_genre_son: ['funk'], themes: ['Rap Français'] }];
    const { dropped } = sanitizeProfils(profils, vocab);
    expect(dropped).toEqual([]);
  });
});
