# Firebase Data Management

This document describes the data structure and management processes for the Firebase Realtime Database used in the Blind Test application.

## Overview

The application uses Firebase Realtime Database to synchronize game state between the Master (host), Players (buzzers), and the TV display. The primary data is stored under `sessions/{sessionId}`.

## Data Structure

### Root Paths

- `sessions/{sessionId}/`: Contains all data for a specific game session.
- `playlists/{playlistId}`: Used for communication with n8n automation (e.g., status updates).

### Session Data (`sessions/{sessionId}/`)

#### Core Game State
| Path | Type | Description | Updated By |
|------|------|-------------|------------|
| `chrono` | `number` | Current playback time in seconds. Synced every 100ms during playback. | `useGameSession` (Master) |
| `scores` | `object` | `{ team1: number, team2: number }`. Current scores. | `useGameSession` (Master) |
| `isPlaying` | `boolean` | `true` if music is playing, `false` otherwise. | `useGameSession` (Master) |
| `currentTrackNumber` | `number` | Index of the current track (1-based). | `useGameSession` (Master) |
| `songDuration` | `number` | Duration of the current song in seconds. Used for score calculation. | `useGameSession`, Modes (Master) |
| `showQRCode` | `boolean` | Whether the QR code is displayed on the TV. | `Master.jsx` |
| `playlistId` | `string` | ID of the current Spotify playlist (if applicable). | `useSpotifyAutoMode`, `useSpotifyAIMode` |
| `lastPlaylistUpdate` | `object` | `{ timestamp: number, playerName: string, songsAdded: number }`. Tracks updates from n8n. | n8n (via REST API) |

#### Current Song Info (`sessions/{sessionId}/currentSong`)
Updated by `Master.jsx` when track changes or is revealed.
```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "imageUrl": "https://...",
  "revealed": boolean,
  "number": number
}
```

#### Game Status (`sessions/{sessionId}/game_status`)
Written when the game ends.
```json
{
  "ended": true,
  "winner": "team1" | "team2" | "draw",
  "final_scores": { "team1": 1000, "team2": 800 },
  "timestamp": 1234567890
}
```

### Buzzers & Gameplay

#### Current Buzz (`sessions/{sessionId}/buzz`)
Temporary state representing the currently active buzz. Cleared after processing.
```json
{
  "team": "team1" | "team2",
  "playerName": "John Doe",
  "playerPhoto": "url",
  "playerFirebaseKey": "uuid"
}
```

#### Buzz History (`sessions/{sessionId}/buzz_times/{trackIndex}`)
Array of all buzzes for a specific track (where `trackIndex` is 1-based).
```json
[
  {
    "team": "team1",
    "teamName": "ÉQUIPE 1",
    "time": 12.5, // Chrono value
    "playerName": "John Doe",
    "songTitle": "Title",
    "songArtist": "Artist",
    "trackNumber": 1,
    "timestamp": serverTimestamp,
    "correct": boolean | null,
    "points": 0,
    "hasPersonalBonus": boolean,
    "basePoints": number,
    "bonusPoints": number
  }
]
```

### Players

#### Session Stats (`sessions/{sessionId}/players_session/{teamKey}/{playerKey}`)
Tracks real-time stats for players in the current session.
```json
{
  "id": "uuid",
  "name": "John Doe",
  "photo": "url",
  "connected": boolean,
  "consecutiveCorrect": number,
  "correctCount": number,
  "buzzCount": number,
  "hasCooldownPending": boolean,
  "cooldownEnd": number // Timestamp
}
```

#### Player Preferences (`sessions/{sessionId}/players_preferences/{playerId}`)
Used in **Spotify AI Mode** to collect player inputs.
```json
{
  "name": "John",
  "age": "25",
  "genres": ["Rock", "Pop"],
  "specialPhrase": "I love 80s",
  "ready": boolean
}
```

#### Player Songs (`sessions/{sessionId}/playerSongs/{playerId}`)
Used to track which songs were added for a specific player (for personal bonuses).
```json
{
  "uris": ["spotify:track:...", ...]
}
```

### Quiz Mode Specifics

#### Quiz State (`sessions/{sessionId}/quiz`)
Controls the Quiz UI on player devices.
```json
{
  "trackNumber": number,
  "answers": [
    { "label": "A", "text": "Answer 1", "isCorrect": boolean },
    { "label": "B", "text": "Answer 2", "isCorrect": boolean },
    ...
  ],
  "correctAnswer": "A",
  "revealed": boolean,
  "nextSongTriggerPlayerId": "uuid" // ID of the player allowed to skip to next song
}
```

#### Quiz Data (`sessions/{sessionId}/quiz_data/{trackNumber}`)
Stores the generated wrong answers for each track.
```json
{
  "correctAnswer": { "title": "...", "artist": "...", "uri": "..." },
  "wrongAnswers": ["Wrong 1", "Wrong 2", "Wrong 3"]
}
```

#### Quiz Answers (`sessions/{sessionId}/quiz_answers/{trackNumber}/{playerId}`)
Stores player answers for the current track.
```json
{
  "playerName": "John",
  "answer": "A",
  "time": 5.2,
  "timestamp": 1234567890,
  "isCorrect": boolean,
  "points": number,
  "songTitle": "...",
  "songArtist": "..."
}
```

#### Leaderboard (`sessions/{sessionId}/quiz_leaderboard`)
Aggregated scores for Quiz Mode.
```json
{
  "playerId": {
    "playerName": "John",
    "totalPoints": 1500,
    "correctAnswers": 3,
    "totalAnswers": 5
  }
}
```

#### Next Song Request (`sessions/{sessionId}/quiz_next_song_request`)
Signal from a player to skip to the next song.
```json
{
  "timestamp": 1234567890,
  "playerName": "John"
}
```

## Data Management Processes

### Initialization
- **Session Creation**: Happens in the setup flow (MasterWizard/MasterFlow).
- **Player Connection**: Players write to `players_session` upon joining.
- **Playlist Loading**:
  - **Spotify Auto**: Playlist ID stored in `playlistId`.
  - **Spotify AI**: Player preferences collected in `players_preferences`, then n8n updates `playlists/{playlistId}` status.

### Real-time Updates
- **Chrono**: The Master component updates `sessions/{sessionId}/chrono` every 100ms when `isPlaying` is true.
- **Buzzer**:
  1. Player writes to `sessions/{sessionId}/buzz`.
  2. Master detects change, pauses game (`isPlaying: false`), and plays sound.
  3. Master writes to `buzz_times` for history.
- **Scoring**:
  - Master calculates points based on `chrono` and `songDuration`.
  - Updates `sessions/{sessionId}/scores`.
  - Updates `buzz_times` entry with result (`correct: true/false`, `points`).

### Cleanup
- **End Game**: Master writes `game_status` and calls `deactivatePreviousSession` (which updates an index of active sessions).
- **Reset**: Specific paths (like `quiz`, `buzz`) are cleared between tracks or games.

## Security Rules (Implicit)
- **Master**: Has full read/write access.
- **Players**: Can write to their specific `players_session` entry, `buzz` node, and `quiz_answers`.
- **Public/TV**: Read-only access to game state (`scores`, `currentSong`, `isPlaying`, etc.).
