import { describe, it, expect } from 'vitest';
import {
  playerHasReadyPref,
  allPlayersHavePrefs,
  readyPrefsCount,
} from './generationGate.js';

// Helpers de lisibilité
const P = (id, name) => ({ id, name });
const pref = (id, name, ready = true) => ({ id, name, ready });

describe('playerHasReadyPref', () => {
  it('match par id', () => {
    const prefs = { k1: pref('temp_Marie', 'Marie') };
    expect(playerHasReadyPref(P('temp_Marie', 'Marie'), prefs)).toBe(true);
  });

  it('match par prénom (fallback) quand les id diffèrent', () => {
    const prefs = { k1: pref('airtable_1', 'Marie') };
    // players_session.id ≠ pref.id, mais même prénom → fallback
    expect(playerHasReadyPref(P('player_999', 'Marie'), prefs)).toBe(true);
  });

  it('aucun match (joueur sans pref)', () => {
    const prefs = { k1: pref('temp_Marie', 'Marie') };
    expect(playerHasReadyPref(P('temp_Leo', 'Léo'), prefs)).toBe(false);
  });

  it('ignore une pref ready:false', () => {
    const prefs = { k1: pref('temp_Marie', 'Marie', false) };
    expect(playerHasReadyPref(P('temp_Marie', 'Marie'), prefs)).toBe(false);
  });

  it('readyPrefs vide → false', () => {
    expect(playerHasReadyPref(P('x', 'X'), {})).toBe(false);
    expect(playerHasReadyPref(P('x', 'X'), null)).toBe(false);
  });
});

describe('allPlayersHavePrefs (gate Option A)', () => {
  it('true quand tous les présents ont une pref ready', () => {
    const players = [P('a', 'Ana'), P('b', 'Bob')];
    const prefs = { k1: pref('a', 'Ana'), k2: pref('b', 'Bob') };
    expect(allPlayersHavePrefs(players, prefs)).toBe(true);
  });

  it('false si UN joueur présent n’a pas encore de pref', () => {
    const players = [P('a', 'Ana'), P('b', 'Bob')];
    const prefs = { k1: pref('a', 'Ana') }; // Bob manquant
    expect(allPlayersHavePrefs(players, prefs)).toBe(false);
  });

  it('false si aucun joueur présent', () => {
    expect(allPlayersHavePrefs([], { k1: pref('a', 'Ana') })).toBe(false);
    expect(allPlayersHavePrefs(null, {})).toBe(false);
  });

  it('RISQUE RÉSIDUEL DOCUMENTÉ : deux prénoms identiques, une seule pref → gate à tort satisfaite', () => {
    // Deux joueurs "Marie" distincts (ids différents), UNE seule pref "Marie".
    const players = [P('id_marie_1', 'Marie'), P('id_marie_2', 'Marie')];
    const prefs = { k1: pref('id_marie_1', 'Marie') };
    // Le 2e "Marie" matche par fallback prénom → gate satisfaite alors qu'il
    // n'a pas soumis ses prefs. Comportement CONNU (fallback fragile), non corrigé.
    expect(allPlayersHavePrefs(players, prefs)).toBe(true);
  });
});

describe('readyPrefsCount', () => {
  it('compte ready/total', () => {
    const players = [P('a', 'Ana'), P('b', 'Bob'), P('c', 'Cid')];
    const prefs = { k1: pref('a', 'Ana'), k2: pref('b', 'Bob') };
    expect(readyPrefsCount(players, prefs)).toEqual({ ready: 2, total: 3 });
  });
});
