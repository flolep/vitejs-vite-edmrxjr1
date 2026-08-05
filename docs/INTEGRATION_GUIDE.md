# Le Trésor — Guide d'intégration
**À destination du développeur de l'application blindtest**
Version 1.0 — 2025

---

## Ce qu'est le Trésor

Le Trésor est un service API REST qui expose un catalogue de chansons
pour une application de blindtest. Il calcule et retourne des playlists
adaptées, prêtes à être jouées via Spotify.

Il ne gère pas : les sessions joueurs, la lecture audio, le score de jeu,
ni l'interface utilisateur. C'est ton application qui s'en charge.

---

## Accès au service

| Environnement | URL de base |
|---------------|-------------|
| Développement | `http://localhost:8001` |
| Production | À communiquer |

**Authentification** : toutes les requêtes doivent porter le header :

```
X-API-Key: <clé communiquée par l'opérateur>
```

---

## Flux typique d'une partie

```
1. Ton app appelle POST /playlist avec les préférences
2. Le Trésor retourne 50 chansons triées avec leurs spotify_uri
3. Ton app crée une playlist Spotify avec ces URI
4. Ton app joue les titres un par un via Spotify Web Playback SDK
5. Pour chaque révélation, ton app appelle GET /song/{id}
   pour afficher l'anecdote et l'indice
```

---

## Endpoint principal — POST /playlist

```http
POST /playlist
Content-Type: application/json
X-API-Key: <clé>
```

### Body minimal (sans scoring)

```json
{
  "n": 50,
  "quiz": true,
  "profils": [{"poids": 1}]
}
```

### Body avec préférences joueurs

```json
{
  "n": 50,
  "quiz": true,
  "profils": [
    {
      "poids": 3,
      "energie_min": 6,
      "energie_max": 10,
      "bpm_min": 100,
      "bpm_max": 160,
      "difficulte_max": 2,
      "annee_min": 1970,
      "annee_max": 2010,
      "themes": ["Groove Funk", "Dancefloor électrique"],
      "langue": "FR"
    },
    {
      "poids": 2,
      "energie_min": 4,
      "energie_max": 8,
      "difficulte_max": 3,
      "themes": [],
      "langue": "EN"
    }
  ]
}
```

**Champs d'un profil — tous optionnels sauf `poids` :**

| Champ | Type | Description |
|-------|------|-------------|
| `poids` | int | Poids relatif du joueur dans le scoring composite |
| `energie_min` / `energie_max` | int 1–10 | Plage d'énergie souhaitée |
| `bpm_min` / `bpm_max` | int 50–200 | Plage de tempo |
| `difficulte_max` | int 1–3 | Niveau maximum accepté (1=facile, 3=expert) |
| `annee_min` / `annee_max` | int | Période souhaitée |
| `themes` | list[str] | Thèmes souhaités — liste vide = tous acceptés |
| `langue` | str | `FR` \| `EN` \| `ES` \| `DE` — null = toutes |

### Réponse

```json
{
  "total": 50,
  "mode": "scoring",
  "cooldown_active": false,
  "songs": [
    {
      "id": "3f2504e0-...",
      "titre": "Billie Jean",
      "artiste": "Michael Jackson",
      "annee": 1982,
      "langue": "EN",
      "theme": "Dancefloor électrique",
      "genre": "Pop / Funk",
      "bpm": 117,
      "energie": 8,
      "difficulte": 1,
      "spotify_uri": "spotify:track:5ChkMS8OtdzJeq...",
      "img_medium": "https://i.scdn.co/image/...",
      "img_couleur": "#1a1a2e",
      "score_composite": 0.87,
      "wrong_answers": [
        {"titre": "Kiss", "artiste": "Prince"},
        {"titre": "Superstition", "artiste": "Stevie Wonder"},
        {"titre": "Don't Stop 'Til You Get Enough", "artiste": "Michael Jackson"}
      ]
    }
  ]
}
```

**Points importants :**

- `wrong_answers` est présent uniquement si `quiz: true`
- `wrong_answers` contient 1 à 3 entrées (jamais garanti à 3 — pool vocal parfois insuffisant)
- `cooldown_active: true` signale que le catalogue est épuisé et que des titres récents ont été réintroduits
- `score_composite` est entre 0 et 1 — utile pour debug, pas nécessaire à afficher

---

## Endpoint simplifié — GET /playlist

Sans scoring composite, tirage aléatoire :

```http
GET /playlist?n=50&langue=FR&difficulte=1,2&quiz=true
X-API-Key: <clé>
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `n` | int 1–200 | Nombre de titres (défaut 50) |
| `langue` | str | `FR` \| `EN` \| `ES` \| `DE` |
| `difficulte` | str | `1` \| `2` \| `3` \| `1,2` \| `1,2,3` |
| `themes` | str | Thèmes séparés par virgule |
| `annee_min` / `annee_max` | int | Période |
| `quiz` | bool | Inclure `wrong_answers` |

---

## Endpoint révélation — GET /song/{id}

À appeler après chaque réponse pour afficher la fiche complète :

```http
GET /song/3f2504e0-4f89-11d3-9a0c-0305e82c3301
X-API-Key: <clé>
```

Retourne en plus des champs playlist : `anecdote`, `indice`, `img_large`,
`voix_genre`, `voix_registre`, `famille_genre`.

---

## Mode quiz — utilisation des wrong_answers

Pour afficher les 4 options :

```javascript
const bonneReponse = { titre: song.titre, artiste: song.artiste }
const options = [bonneReponse, ...song.wrong_answers]
  .sort(() => Math.random() - 0.5)  // mélanger
```

Les `wrong_answers` sont cohérents avec la cible : même langue,
même registre vocal, même famille de genre, époque proche.
Ils ne contiennent jamais le même artiste que la cible.

---

## Anti-répétition automatique

Le Trésor gère un cooldown de 30 jours sur les titres déjà servis.
Un titre joué ce soir ne réapparaîtra pas pendant 30 jours.
Ton application n'a rien à gérer de son côté.

---

## Champs utiles par écran

| Écran | Champs à utiliser |
|-------|------------------|
| Liste de la playlist | `titre`, `artiste`, `annee`, `img_medium`, `img_couleur`, `difficulte` |
| Pendant l'écoute | `spotify_uri`, `img_large`, `img_couleur` (couleur de fond) |
| Question quiz | `titre` + `artiste` (bonne réponse) + `wrong_answers` |
| Révélation | `anecdote`, `indice`, `img_large` |

---

## Codes d'erreur

| Code | Signification |
|------|--------------|
| 401 | Clé API manquante ou incorrecte |
| 400 | Body invalide ou `profils` vide |
| 422 | `n` hors plage (0 ou >200) |
| 404 | Song ID inexistant |
| 500 | Erreur interne |

---

## Documentation interactive

L'API expose une documentation Swagger complète :

```
http://<url-service>/docs
```

Tous les endpoints sont testables directement depuis cette interface.

---

## Catalogue disponible

| Métrique | Valeur actuelle |
|----------|----------------|
| Titres total | 439 |
| Francophones | ~180 |
| Internationaux | ~260 |
| Période couverte | 1938 – 2023 |
| Thèmes | 25 |
| Avec distracteurs quiz | 426/439 |

Le catalogue est enrichi régulièrement. Cible : 2 000 titres.
