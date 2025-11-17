/**
 * Stubs pour le mode Test du Quiz
 * Génère des wrongAnswers prédéfinies sans appeler OpenAI
 * Économise les crédits API pendant les tests
 */

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
