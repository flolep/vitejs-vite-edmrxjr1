/**
 * Stubs pour le mode Test du Quiz
 * Génère des wrongAnswers prédéfinies et des playlists sans appeler OpenAI
 * Économise les crédits API pendant les tests
 */

// Bibliothèque de chansons pour générer des playlists stubs
const stubSongLibrary = [
  // Rock
  { artist: "Queen", title: "Bohemian Rhapsody", uri: "spotify:track:3z8h0TU7ReDPLIbEnYhWZb", genre: "rock" },
  { artist: "The Beatles", title: "Hey Jude", uri: "spotify:track:0aym2LBJBk9DAYuHHutrIl", genre: "rock" },
  { artist: "Led Zeppelin", title: "Stairway to Heaven", uri: "spotify:track:5CQ30WqJwcep0pYcV4AMNc", genre: "rock" },
  { artist: "Pink Floyd", title: "Wish You Were Here", uri: "spotify:track:6mFkJmJqdDVQ1REhVfGgd1", genre: "rock" },
  { artist: "AC/DC", title: "Highway to Hell", uri: "spotify:track:2zYzyRzz6pRmhPzyfMEC8s", genre: "rock" },
  { artist: "Nirvana", title: "Smells Like Teen Spirit", uri: "spotify:track:4CeeEOM32jQcH3eN9Q2dGj", genre: "rock" },
  { artist: "The Rolling Stones", title: "Paint It Black", uri: "spotify:track:63T7DJ1AFDD6Bn8VzG6JE8", genre: "rock" },
  { artist: "Guns N' Roses", title: "Sweet Child O' Mine", uri: "spotify:track:7o2CTH4ctstm8TNelqjb51", genre: "rock" },
  { artist: "Metallica", title: "Enter Sandman", uri: "spotify:track:1hKdDCpiI9mqz8jg4YCPha", genre: "rock" },
  { artist: "Foo Fighters", title: "Everlong", uri: "spotify:track:5UWwZ5lm5PKu6eKsHAGxOk", genre: "rock" },

  // Pop
  { artist: "Michael Jackson", title: "Billie Jean", uri: "spotify:track:7J1uxwnxfQLu4APicE5Rnj", genre: "pop" },
  { artist: "Madonna", title: "Like a Prayer", uri: "spotify:track:1z3ugFmUKoCzGsI6jdY4Ci", genre: "pop" },
  { artist: "Britney Spears", title: "Toxic", uri: "spotify:track:6I9VzXrHxO9rA9A5euc8Ak", genre: "pop" },
  { artist: "Justin Timberlake", title: "Can't Stop the Feeling", uri: "spotify:track:1WkMMavIMc4JZ8cfMmxHkI", genre: "pop" },
  { artist: "Katy Perry", title: "Firework", uri: "spotify:track:4lCv7b86sLynZbXhfScfm6", genre: "pop" },
  { artist: "Taylor Swift", title: "Shake It Off", uri: "spotify:track:0cqRj7pUJDkTCEsJkx8snD", genre: "pop" },
  { artist: "Ariana Grande", title: "Thank U, Next", uri: "spotify:track:3e9HZxeyfWwjeyPAMmWSSQ", genre: "pop" },
  { artist: "Ed Sheeran", title: "Shape of You", uri: "spotify:track:7qiZfU4dY1lWllzX7mPBI", genre: "pop" },
  { artist: "Bruno Mars", title: "Uptown Funk", uri: "spotify:track:32OlwWuMpZ6b0aN2RZOeMS", genre: "pop" },
  { artist: "The Weeknd", title: "Blinding Lights", uri: "spotify:track:0VjIjW4GlUZAMYd2vXMi3b", genre: "pop" },

  // Rap/Hip-hop
  { artist: "Eminem", title: "Lose Yourself", uri: "spotify:track:1v7L65Lzy0j0vdpRjJewt1", genre: "rap" },
  { artist: "Dr. Dre", title: "Still D.R.E.", uri: "spotify:track:6SDHZ1LBdM4IK33u2yl64Y", genre: "rap" },
  { artist: "Tupac", title: "California Love", uri: "spotify:track:3CKdP83YfnoGyfCKE5TtdO", genre: "rap" },
  { artist: "The Notorious B.I.G.", title: "Juicy", uri: "spotify:track:5ByAIlEEnxYdvpnezg7HTX", genre: "rap" },
  { artist: "Jay-Z", title: "Empire State of Mind", uri: "spotify:track:2igwFfvr1OAGX9SKDCPBwO", genre: "rap" },
  { artist: "Kendrick Lamar", title: "HUMBLE.", uri: "spotify:track:7KXjTSCq5nL1LoYtL7XAwS", genre: "rap" },
  { artist: "Drake", title: "God's Plan", uri: "spotify:track:6DCZcSspjsKoFjzjrWoCdn", genre: "rap" },
  { artist: "Kanye West", title: "Stronger", uri: "spotify:track:4fzsfWzRhPawzqhX8Qt9F3", genre: "rap" },
  { artist: "Snoop Dogg", title: "Gin and Juice", uri: "spotify:track:5Y6nVWCsLWiz029Jbx3z3f", genre: "rap" },
  { artist: "50 Cent", title: "In Da Club", uri: "spotify:track:7iL6o9tox1zgHpKUfh9vuC", genre: "rap" },

  // Electronic
  { artist: "Daft Punk", title: "Get Lucky", uri: "spotify:track:2Foc5Q5nqNiosCNqttzHof", genre: "electronic" },
  { artist: "Calvin Harris", title: "Feel So Close", uri: "spotify:track:1HNE2PX70ztbEl6MLxrpNL", genre: "electronic" },
  { artist: "Avicii", title: "Wake Me Up", uri: "spotify:track:4Cy0NHJ8Gh0xMdwyM9RkQm", genre: "electronic" },
  { artist: "David Guetta", title: "Titanium", uri: "spotify:track:0YNpixMf1GmNHRvXpJdadq", genre: "electronic" },
  { artist: "The Chemical Brothers", title: "Hey Boy Hey Girl", uri: "spotify:track:1bSpwPhBxBKsFbCNr5m0cZ", genre: "electronic" },
  { artist: "Deadmau5", title: "Strobe", uri: "spotify:track:2DKfEHy0EFLdRd4TQXIBQA", genre: "electronic" },
  { artist: "Swedish House Mafia", title: "Don't You Worry Child", uri: "spotify:track:7E1GN6RnVJviMYLv3r8pOl", genre: "electronic" },
  { artist: "Martin Garrix", title: "Animals", uri: "spotify:track:4IwXRW3YkXflD65cBuWi0W", genre: "electronic" },
  { artist: "Disclosure", title: "Latch", uri: "spotify:track:35m1qOzxqbPp60D0uhQoHA", genre: "electronic" },
  { artist: "Kraftwerk", title: "The Robots", uri: "spotify:track:6u3ybBnVGBFkvF3eC56Cuk", genre: "electronic" },

  // R&B/Soul
  { artist: "Beyoncé", title: "Crazy in Love", uri: "spotify:track:5IVuqXILoxVWvWEPm82Jxr", genre: "rnb" },
  { artist: "Usher", title: "Yeah!", uri: "spotify:track:1lCRw5FEZ1gPDNPzy1K4zW", genre: "rnb" },
  { artist: "Alicia Keys", title: "Fallin'", uri: "spotify:track:6NPVjNh8Jhru9xOmyQigds", genre: "rnb" },
  { artist: "John Legend", title: "All of Me", uri: "spotify:track:3U4isOIWM3VvDubwSI3y7a", genre: "rnb" },
  { artist: "Frank Ocean", title: "Thinkin Bout You", uri: "spotify:track:2ZWlPOoWh0626oTaHrnl2a", genre: "rnb" },
  { artist: "Aretha Franklin", title: "Respect", uri: "spotify:track:7s25THrKz86DM225dOYwnr", genre: "soul" },
  { artist: "Marvin Gaye", title: "What's Going On", uri: "spotify:track:0E5KiQTPpmREeVmzdHC38T", genre: "soul" },
  { artist: "Stevie Wonder", title: "Superstition", uri: "spotify:track:1h2xVEoJORqrg71HocgqXd", genre: "soul" },
  { artist: "Otis Redding", title: "(Sittin' On) The Dock of the Bay", uri: "spotify:track:3zBhihYUHBmGd2bcQIobrF", genre: "soul" },
  { artist: "Bill Withers", title: "Ain't No Sunshine", uri: "spotify:track:1P17dC1amhFzptugyAO7Il", genre: "soul" },

  // French
  { artist: "Stromae", title: "Papaoutai", uri: "spotify:track:4k6Uh1HXsFqBvqpTTzlWSq", genre: "french" },
  { artist: "Indila", title: "Dernière Danse", uri: "spotify:track:3lHT4u8FRWfCe1lVFJx1dZ", genre: "french" },
  { artist: "Édith Piaf", title: "La Vie en Rose", uri: "spotify:track:4wXchxfHCLUg6SVqFP5ySx", genre: "french" },
  { artist: "Charles Aznavour", title: "La Bohème", uri: "spotify:track:0YYz5W1Fgq5RjRbYQQJRqo", genre: "french" },
  { artist: "Jacques Brel", title: "Ne Me Quitte Pas", uri: "spotify:track:5qIDuu85g4PnrEWW7rsKaO", genre: "french" },
  { artist: "Serge Gainsbourg", title: "Je T'aime... Moi Non Plus", uri: "spotify:track:3wWDTAAXKYNWOPGgdW9vPU", genre: "french" },
  { artist: "Dalida", title: "Paroles Paroles", uri: "spotify:track:2hy2BhGwwOkP8djKZKoMJo", genre: "french" },
  { artist: "Claude François", title: "Comme d'Habitude", uri: "spotify:track:5XkMHp2OiwL7ZwxMGPpQkI", genre: "french" },
  { artist: "Johnny Hallyday", title: "Que Je T'aime", uri: "spotify:track:4fOZCMIbMANPKvdpj2DTDP", genre: "french" },
  { artist: "Françoise Hardy", title: "Comment Te Dire Adieu", uri: "spotify:track:67aFmvcAPEa7ePCu7BTPF1", genre: "french" }
];

// Bibliothèque de fausses réponses par genre musical
const wrongAnswersByGenre = {
  rock: [
    "The Rolling Stones - Paint It Black",
    "Led Zeppelin - Stairway to Heaven",
    "Pink Floyd - Wish You Were Here",
    "AC/DC - Highway to Hell",
    "Nirvana - Come As You Are",
    "Guns N' Roses - Sweet Child O' Mine",
    "Queen - We Will Rock You",
    "The Who - Baba O'Riley",
    "Metallica - Enter Sandman",
    "Foo Fighters - Everlong"
  ],
  pop: [
    "Michael Jackson - Thriller",
    "Madonna - Like a Prayer",
    "Britney Spears - Toxic",
    "Justin Timberlake - Can't Stop the Feeling",
    "Katy Perry - Firework",
    "Taylor Swift - Shake It Off",
    "Ariana Grande - Thank U, Next",
    "Ed Sheeran - Perfect",
    "Bruno Mars - Uptown Funk",
    "The Weeknd - Starboy"
  ],
  rap: [
    "Eminem - Lose Yourself",
    "Dr. Dre - Still D.R.E.",
    "Tupac - California Love",
    "Notorious B.I.G. - Juicy",
    "Jay-Z - Empire State of Mind",
    "Kendrick Lamar - HUMBLE.",
    "Drake - God's Plan",
    "Kanye West - Stronger",
    "Snoop Dogg - Gin and Juice",
    "50 Cent - In Da Club"
  ],
  electronic: [
    "Daft Punk - One More Time",
    "Calvin Harris - Feel So Close",
    "Avicii - Wake Me Up",
    "David Guetta - Titanium",
    "The Chemical Brothers - Hey Boy Hey Girl",
    "Deadmau5 - Strobe",
    "Swedish House Mafia - Don't You Worry Child",
    "Martin Garrix - Animals",
    "Disclosure - Latch",
    "Kraftwerk - The Robots"
  ],
  rnb: [
    "Beyoncé - Crazy in Love",
    "Usher - Yeah!",
    "Alicia Keys - Fallin'",
    "John Legend - All of Me",
    "Frank Ocean - Thinkin Bout You",
    "The Weeknd - Can't Feel My Face",
    "SZA - The Weekend",
    "H.E.R. - Focus",
    "Daniel Caesar - Best Part",
    "Anderson .Paak - Come Down"
  ],
  soul: [
    "Aretha Franklin - Respect",
    "Marvin Gaye - What's Going On",
    "Stevie Wonder - Superstition",
    "Otis Redding - Sittin' On The Dock of the Bay",
    "Al Green - Let's Stay Together",
    "Sam Cooke - A Change Is Gonna Come",
    "Etta James - At Last",
    "Bill Withers - Ain't No Sunshine",
    "Curtis Mayfield - Move On Up",
    "Nina Simone - Feeling Good"
  ],
  jazz: [
    "Miles Davis - So What",
    "John Coltrane - A Love Supreme",
    "Louis Armstrong - What a Wonderful World",
    "Ella Fitzgerald - Summertime",
    "Duke Ellington - Take the A Train",
    "Billie Holiday - Strange Fruit",
    "Thelonious Monk - Round Midnight",
    "Charlie Parker - Ornithology",
    "Chet Baker - My Funny Valentine",
    "Herbie Hancock - Watermelon Man"
  ],
  french: [
    "Edith Piaf - La Vie en Rose",
    "Charles Aznavour - La Bohème",
    "Jacques Brel - Ne Me Quitte Pas",
    "Serge Gainsbourg - Je T'aime... Moi Non Plus",
    "Dalida - Paroles Paroles",
    "Claude François - Comme d'Habitude",
    "Johnny Hallyday - Que Je T'aime",
    "Françoise Hardy - Comment Te Dire Adieu",
    "Stromae - Papaoutai",
    "Indila - Dernière Danse"
  ],
  default: [
    "Unknown Artist 1 - Mystery Song A",
    "Unknown Artist 2 - Mystery Song B",
    "Unknown Artist 3 - Mystery Song C",
    "Unknown Artist 4 - Mystery Song D",
    "Unknown Artist 5 - Mystery Song E",
    "Unknown Artist 6 - Mystery Song F",
    "Unknown Artist 7 - Mystery Song G",
    "Unknown Artist 8 - Mystery Song H",
    "Unknown Artist 9 - Mystery Song I",
    "Unknown Artist 10 - Mystery Song J"
  ]
};

/**
 * Détecte le genre d'une chanson basé sur l'artiste
 * @param {string} artist - Nom de l'artiste
 * @returns {string} - Genre détecté
 */
function detectGenre(artist) {
  const artistLower = artist.toLowerCase();

  // Rock
  if (/(queen|beatles|stones|zeppelin|nirvana|metallica|floyd|ac\/dc|guns)/i.test(artistLower)) {
    return 'rock';
  }

  // Pop
  if (/(swift|sheeran|grande|perry|bieber|timberlake|gaga|madonna|jackson)/i.test(artistLower)) {
    return 'pop';
  }

  // Rap/Hip-hop
  if (/(eminem|drake|kendrick|kanye|jay-z|tupac|biggie|nas|snoop)/i.test(artistLower)) {
    return 'rap';
  }

  // Electronic
  if (/(daft punk|calvin harris|avicii|guetta|deadmau5|skrillex|diplo|tiesto)/i.test(artistLower)) {
    return 'electronic';
  }

  // R&B
  if (/(beyoncé|usher|weeknd|alicia|john legend|frank ocean|sza|h\.e\.r)/i.test(artistLower)) {
    return 'rnb';
  }

  // Soul
  if (/(aretha|marvin gaye|stevie wonder|otis|sam cooke|bill withers)/i.test(artistLower)) {
    return 'soul';
  }

  // Jazz
  if (/(miles davis|coltrane|armstrong|ella|duke|billie|monk|parker)/i.test(artistLower)) {
    return 'jazz';
  }

  // French
  if (/(piaf|aznavour|brel|gainsbourg|dalida|hallyday|stromae|angèle|indila)/i.test(artistLower)) {
    return 'french';
  }

  return 'default';
}

/**
 * Génère 3 wrongAnswers pour une chanson sans appeler l'API
 * @param {object} song - { artist, title, uri }
 * @returns {Array<string>} - 3 wrongAnswers
 */
export function generateStubWrongAnswers(song) {
  const genre = detectGenre(song.artist);
  const pool = wrongAnswersByGenre[genre] || wrongAnswersByGenre.default;

  // Mélanger le pool et prendre 3 éléments aléatoires
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  console.log(`🎭 [STUB] Generated wrong answers for "${song.artist} - ${song.title}" (genre: ${genre})`);

  return selected;
}

/**
 * Génère des wrongAnswers pour un batch de chansons (mode Test)
 * @param {Array<object>} songs - Liste de {artist, title, uri}
 * @returns {Promise<object>} - Format compatible avec n8nService
 */
export async function generateStubBatch(songs) {
  console.log(`🎭 [TEST MODE] Generating stub wrong answers for ${songs.length} songs...`);

  // Simuler un délai réseau (200ms par chanson)
  await new Promise(resolve => setTimeout(resolve, songs.length * 200));

  const wrongAnswersMap = {};

  songs.forEach((song, index) => {
    wrongAnswersMap[index] = {
      artist: song.artist,
      title: song.title,
      uri: song.uri,
      wrongAnswers: generateStubWrongAnswers(song)
    };
  });

  console.log(`✅ [TEST MODE] Generated ${songs.length} stub wrong answers`);

  return {
    success: true,
    totalSongs: songs.length,
    wrongAnswers: wrongAnswersMap
  };
}

/**
 * Génère une playlist stub basée sur les préférences des joueurs (mode Test)
 * @param {object} params - { playlistId, players }
 * @returns {Promise<object>} - Format compatible avec n8nService
 */
export async function generateStubPlaylist({ playlistId, players }) {
  console.log(`🎭 [TEST MODE] Generating stub playlist...`);
  console.log(`   📊 ${players.length} joueur(s)`);

  // Extraire tous les genres demandés par les joueurs
  const requestedGenres = [...new Set(players.flatMap(p => p.genres || []))];
  console.log(`   🎼 Genres demandés: ${requestedGenres.join(', ')}`);

  // Mapper les genres textuels vers nos genres internes
  const genreMapping = {
    'Rock': 'rock',
    'Pop': 'pop',
    'Rap': 'rap',
    'Hip-Hop': 'rap',
    'Electronic': 'electronic',
    'Electro': 'electronic',
    'R&B': 'rnb',
    'Soul': 'soul',
    'Jazz': 'jazz',
    'French': 'french',
    'Français': 'french',
    'Chanson française': 'french'
  };

  // Filtrer les chansons par genres demandés
  let selectedSongs = [];

  if (requestedGenres.length > 0) {
    // Convertir les genres demandés en genres internes
    const internalGenres = requestedGenres
      .map(g => genreMapping[g] || g.toLowerCase())
      .filter((g, i, arr) => arr.indexOf(g) === i); // Déduplication

    console.log(`   🔍 Genres internes: ${internalGenres.join(', ')}`);

    // Filtrer les chansons qui matchent les genres
    const matchingSongs = stubSongLibrary.filter(song =>
      internalGenres.includes(song.genre)
    );

    if (matchingSongs.length >= 50) {
      // Assez de chansons, en prendre 50 aléatoirement
      selectedSongs = [...matchingSongs]
        .sort(() => Math.random() - 0.5)
        .slice(0, 50);
    } else {
      // Pas assez de chansons dans les genres demandés, compléter avec d'autres
      selectedSongs = [...matchingSongs];
      const remaining = stubSongLibrary.filter(song =>
        !internalGenres.includes(song.genre)
      );
      const additionalSongs = [...remaining]
        .sort(() => Math.random() - 0.5)
        .slice(0, 50 - selectedSongs.length);
      selectedSongs = [...selectedSongs, ...additionalSongs];
    }
  } else {
    // Aucun genre spécifié, prendre 50 chansons aléatoires
    selectedSongs = [...stubSongLibrary]
      .sort(() => Math.random() - 0.5)
      .slice(0, 50);
  }

  // Simuler un délai réseau (3 secondes pour simuler génération IA)
  await new Promise(resolve => setTimeout(resolve, 3000));

  const songs = selectedSongs.map(song => ({
    uri: song.uri,
    title: song.title,
    artist: song.artist
  }));

  console.log(`✅ [TEST MODE] Generated stub playlist with ${songs.length} songs`);

  return {
    success: true,
    playlistId: playlistId,
    totalSongs: songs.length,
    totalPlayers: players.length,
    songs: songs
  };
}
