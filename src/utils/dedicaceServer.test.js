import { describe, it, expect } from 'vitest';
import { resolveDedicacesServeur } from './dedicaceServer.js';
import { attribuerDedicaces } from './dedicaceAttribution.js';

// prefs = MÊME ordre que les profils envoyés (index serveur y pointe)
const prefs = [
  { id: 'p1', name: 'Marie', photo: null, genres: ['Reggae'], specialPhrase: '' },
  { id: 'p2', name: 'Léo', photo: 'l.jpg', genres: ['Jazz'], specialPhrase: 'jazz lover' },
];

// Titres réels (observés via POST /playlist) : Ska/dancehall sont famille "Reggae / Ska"
// mais leur `genre` LIBRE ne contient pas le mot "reggae" → piège du matcher client.
const tracks = [
  { title: 'Ghost Town', genre: 'Ska / New Wave', famille_son: 'Reggae / Ska', sous_genre_son: 'ska', dedicaceServerIndex: 0 },
  { title: 'One Dance', genre: 'dancehall', famille_son: 'Reggae / Ska', sous_genre_son: 'dancehall', dedicaceServerIndex: 0 },
  { title: 'No Woman No Cry', genre: 'reggae', famille_son: 'Reggae / Ska', sous_genre_son: 'roots reggae', dedicaceServerIndex: 0 },
  { title: 'La Seine', genre: 'jazz vocal', famille_son: 'Jazz / Blues', sous_genre_son: 'jazz', dedicaceServerIndex: 1 },
];

describe('resolveDedicacesServeur — corrige les misattributions du client', () => {
  it('AVANT (client) : Ska/dancehall marqués Découverte à tort', () => {
    const out = attribuerDedicaces(tracks, prefs);
    const byTitle = Object.fromEntries(out.map((t) => [t.title, t.dedicace]));
    expect(byTitle['Ghost Town'].type).toBe('decouverte'); // bug reproduit
    expect(byTitle['One Dance'].type).toBe('decouverte'); // bug reproduit
    expect(byTitle['No Woman No Cry'].type).toBe('joueur'); // le mot "reggae" matche
  });

  it('APRÈS (serveur) : Ska/dancehall dédiés au joueur Reggae (index 0)', () => {
    const out = resolveDedicacesServeur(tracks, prefs);
    const byTitle = Object.fromEntries(out.map((t) => [t.title, t.dedicace]));
    for (const title of ['Ghost Town', 'One Dance', 'No Woman No Cry']) {
      expect(byTitle[title].type).toBe('joueur');
      expect(byTitle[title].playerName).toBe('Marie');
    }
    expect(byTitle['La Seine'].playerName).toBe('Léo');
  });

  it('libellé genre (option B) = genre DEMANDÉ par le joueur, pas celui du titre', () => {
    const out = resolveDedicacesServeur(tracks, prefs);
    const byTitle = Object.fromEntries(out.map((t) => [t.title, t.dedicace]));
    // Ska → joueur Reggae → affiche "Reggae" (pas "ska")
    expect(byTitle['Ghost Town'].genre).toBe('Reggae');
    expect(byTitle['La Seine'].genre).toBe('Jazz');
  });

  it('forme identique à la TV : {type,playerId,playerName,playerPhoto,genre,specialPhrase}', () => {
    const out = resolveDedicacesServeur(tracks, prefs);
    expect(out.find((t) => t.title === 'La Seine').dedicace).toEqual({
      type: 'joueur',
      playerId: 'p2',
      playerName: 'Léo',
      playerPhoto: 'l.jpg',
      genre: 'Jazz',
      specialPhrase: 'jazz lover',
    });
  });

  it('filler (titre hors des genres du joueur) → libellé = genres cochés joints', () => {
    const filler = [{ title: 'Hey Jealousy', famille_son: 'Rock', sous_genre_son: 'indie', dedicaceServerIndex: 1 }];
    const out = resolveDedicacesServeur(filler, prefs);
    expect(out[0].dedicace.playerName).toBe('Léo');
    expect(out[0].dedicace.genre).toBe('Jazz'); // Léo n'a que Jazz → affiché tel quel
  });

  it('filet défensif : index null / hors-plage / prefs vides → decouverte', () => {
    expect(resolveDedicacesServeur([{ title: 'x', dedicaceServerIndex: null }], prefs)[0].dedicace).toEqual({ type: 'decouverte' });
    expect(resolveDedicacesServeur([{ title: 'x', dedicaceServerIndex: 9 }], prefs)[0].dedicace).toEqual({ type: 'decouverte' });
    expect(resolveDedicacesServeur([{ title: 'x', dedicaceServerIndex: 0 }], [])[0].dedicace).toEqual({ type: 'decouverte' });
  });
});
