import { describe, it, expect, vi } from 'vitest';
import { playerToProfil, buildProfils, requestedGenreForTrack, formativeWindow } from './genreProfils.js';

describe('playerToProfil', () => {
  it('mono-genre au niveau famille', () => {
    expect(playerToProfil({ genres: ['Pop'] })).toEqual({
      poids: 1,
      famille_son: ['Pop'],
    });
  });

  it("'Variété française' → famille_son ['Variété FR'] (niveau famille)", () => {
    expect(playerToProfil({ genres: ['Variété française'] })).toEqual({
      poids: 1,
      famille_son: ['Variété FR'],
    });
  });

  it("'Pop' et 'Variété française' sont DISJOINTS depuis la scission", () => {
    expect(playerToProfil({ genres: ['Pop'] }).famille_son).toEqual(['Pop']);
    expect(playerToProfil({ genres: ['Variété française'] }).famille_son).toEqual(['Variété FR']);
  });

  it("cocher les deux cumule les familles dans l'ordre d'apparition", () => {
    expect(playerToProfil({ genres: ['Variété française', 'Pop'] })).toEqual({
      poids: 1,
      famille_son: ['Variété FR', 'Pop'],
    });
  });

  it('mono-genre au niveau sous_genre', () => {
    expect(playerToProfil({ genres: ['Funk'] })).toEqual({
      poids: 1,
      sous_genre_son: ['funk'],
    });
  });

  it('multi-genres (3) — exemple exact du contrat', () => {
    expect(playerToProfil({ genres: ['Pop', 'Funk', 'Rap français'] })).toEqual({
      poids: 1,
      famille_son: ['Pop'],
      sous_genre_son: ['funk', 'rap / hip-hop'],
      themes: ['Rap Français'],
    });
  });

  it("'Rap français' remplit DEUX champs (sous_genre + themes)", () => {
    expect(playerToProfil({ genres: ['Rap français'] })).toEqual({
      poids: 1,
      sous_genre_son: ['rap / hip-hop'],
      themes: ['Rap Français'],
    });
  });

  it('dédup quand deux libellés donnent la même valeur (Hip-Hop + Rap français)', () => {
    expect(playerToProfil({ genres: ['Hip-Hop', 'Rap français'] })).toEqual({
      poids: 1,
      sous_genre_son: ['rap / hip-hop'],
      themes: ['Rap Français'],
    });
  });

  it('libellé inconnu ignoré (warn, pas de crash)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(playerToProfil({ genres: ['Pop', 'Kpop'] })).toEqual({
      poids: 1,
      famille_son: ['Pop'],
    });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('genres vide → profil neutre { poids: 1 } sans clé de dimension', () => {
    expect(playerToProfil({ genres: [] })).toEqual({ poids: 1 });
  });

  it('preference sans genres / null → { poids: 1 }', () => {
    expect(playerToProfil({})).toEqual({ poids: 1 });
    expect(playerToProfil(null)).toEqual({ poids: 1 });
  });

  it('clés omises quand vides (le genre reste à son niveau)', () => {
    const p = playerToProfil({ genres: ['Métal'] });
    expect(p).toEqual({ poids: 1, sous_genre_son: ['hard rock / métal'] });
    expect(p).not.toHaveProperty('famille_son');
    expect(p).not.toHaveProperty('themes');
  });

  it('ne JAMAIS auto-étendre un sous_genre vers sa famille', () => {
    const p = playerToProfil({ genres: ['Funk'] });
    expect(p.famille_son).toBeUndefined();
    expect(p.sous_genre_son).toEqual(['funk']);
  });

  it('chaînes EXACTES (casse + accents), aucune normalisation', () => {
    expect(playerToProfil({ genres: ['Électro'] })).toEqual({
      poids: 1,
      famille_son: ['Électronique'],
    });
  });
});

describe('buildProfils', () => {
  it('un profil par joueur, ordre préservé', () => {
    const prefs = [
      { genres: ['Pop'] },
      { genres: ['Funk', 'Rap français'] },
      { genres: ['Rock', 'Métal', 'Indie'] },
    ];
    const profils = buildProfils(prefs);
    expect(profils).toHaveLength(3);
    expect(profils[0]).toEqual({ poids: 1, famille_son: ['Pop'] });
    expect(profils[1]).toEqual({
      poids: 1,
      sous_genre_son: ['funk', 'rap / hip-hop'],
      themes: ['Rap Français'],
    });
    expect(profils[2]).toEqual({
      poids: 1,
      famille_son: ['Rock'],
      sous_genre_son: ['hard rock / métal', 'indie'],
    });
  });

  it('prefs vide / non-tableau → tableau vide', () => {
    expect(buildProfils([])).toEqual([]);
    expect(buildProfils(null)).toEqual([]);
    expect(buildProfils(undefined)).toEqual([]);
  });

  it('poids: 1 pour tous', () => {
    const profils = buildProfils([{ genres: ['Pop'] }, { genres: ['Jazz'] }]);
    expect(profils.every((p) => p.poids === 1)).toBe(true);
  });
});

describe('requestedGenreForTrack (libellé de dédicace, option B)', () => {
  it('matche un titre sur la famille renommée `Pop`', () => {
    expect(requestedGenreForTrack(['Pop'], { famille_son: 'Pop' })).toBe('Pop');
  });

  it('matche un titre `Variété FR` sur le 16e bouton', () => {
    expect(
      requestedGenreForTrack(['Variété française'], { famille_son: 'Variété FR' })
    ).toBe('Variété française');
  });

  it('ne confond plus Pop et Variété FR (effet de la scission)', () => {
    expect(requestedGenreForTrack(['Pop'], { famille_son: 'Variété FR' })).toBeNull();
    expect(requestedGenreForTrack(['Variété française'], { famille_son: 'Pop' })).toBeNull();
  });

  it('titre sans classification (famille_son NULL) → null, pas de crash', () => {
    expect(requestedGenreForTrack(['Pop'], { famille_son: null })).toBeNull();
    expect(requestedGenreForTrack(['Pop'], {})).toBeNull();
  });
});

describe('époque formatrice (âge → annee_min/annee_max)', () => {
  const Y = 2026; // millésime figé pour des tests déterministes

  it('âge 40 → fenêtre [naissance+13, naissance+27]', () => {
    expect(formativeWindow(40, Y)).toEqual({ annee_min: 1999, annee_max: 2013 });
  });

  it('le profil porte la fenêtre à côté des genres', () => {
    expect(playerToProfil({ genres: ['Funk'], age: 40 }, { currentYear: Y })).toEqual({
      poids: 1,
      sous_genre_son: ['funk'],
      annee_min: 1999,
      annee_max: 2013,
    });
  });

  it('âge absent → aucune clé annee (match genre simple)', () => {
    const p = playerToProfil({ genres: ['Pop'] }, { currentYear: Y });
    expect(p).not.toHaveProperty('annee_min');
    expect(p).not.toHaveProperty('annee_max');
  });

  it('âges aberrants → pas de fenêtre', () => {
    for (const bad of [null, undefined, 0, -5, 12, 121, 999, NaN, 'quarante', 40.5]) {
      expect(formativeWindow(bad, Y)).toBeNull();
    }
  });

  it("âge en chaîne (saisie <input>) accepté s'il est entier", () => {
    expect(formativeWindow('40', Y)).toEqual({ annee_min: 1999, annee_max: 2013 });
  });

  it('jamais de borne dans le futur (annee_max bornée au millésime courant)', () => {
    const w = formativeWindow(20, Y); // naissance 2006 → 2019..2033
    expect(w).toEqual({ annee_min: 2019, annee_max: Y });
  });

  it('buildProfils fige le même millésime pour tout le tableau', () => {
    const profils = buildProfils(
      [{ genres: ['Pop'], age: 40 }, { genres: ['Jazz'], age: 40 }],
      { currentYear: Y }
    );
    expect(profils[0].annee_min).toBe(profils[1].annee_min);
    expect(profils[0].annee_max).toBe(profils[1].annee_max);
  });

  it('buildProfils : un joueur sans âge ne pénalise pas les autres', () => {
    const profils = buildProfils(
      [{ genres: ['Pop'], age: 40 }, { genres: ['Jazz'] }],
      { currentYear: Y }
    );
    expect(profils[0]).toHaveProperty('annee_min');
    expect(profils[1]).not.toHaveProperty('annee_min');
    expect(profils).toHaveLength(2); // alignement des index dédicace préservé
  });
});
