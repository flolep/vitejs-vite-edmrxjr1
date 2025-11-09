import { spotifyService } from '../spotifyService';

/**
 * Interface commune pour gérer la lecture audio
 * Abstrait les différences entre MP3 et Spotify
 */

export class MP3PlayerAdapter {
  constructor(audioRef) {
    this.audioRef = audioRef;
    this.type = 'mp3';
  }

  async play() {
    if (this.audioRef.current) {
      await this.audioRef.current.play();
    }
  }

  async pause() {
    if (this.audioRef.current) {
      this.audioRef.current.pause();
    }
  }

  loadTrack(track) {
    if (this.audioRef.current && track.audioUrl) {
      this.audioRef.current.src = track.audioUrl;
      this.audioRef.current.load();
    }
  }

  getDuration() {
    return this.audioRef.current?.duration || 0;
  }

  getCurrentPosition() {
    return this.audioRef.current?.currentTime || 0;
  }
}

export class SpotifyPlayerAdapter {
  constructor(token, deviceId, player) {
    this.token = token;
    this.deviceId = deviceId;
    this.player = player;
    this.type = 'spotify';
    this.currentPosition = 0;
    this.lastPlayedTrack = null;
  }

  async play(track, currentTrackIndex) {
    if (!this.token || !this.deviceId || !track?.spotifyUri) {
      throw new Error('Spotify non initialisé ou track invalide');
    }

    const isNewTrack = this.lastPlayedTrack !== currentTrackIndex;
    const startPosition = isNewTrack ? 0 : this.currentPosition;

    await spotifyService.playTrack(
      this.token,
      this.deviceId,
      track.spotifyUri,
      startPosition
    );

    this.lastPlayedTrack = currentTrackIndex;
  }

  async pause() {
    if (!this.token) {
      throw new Error('Token Spotify non disponible');
    }

    // Sauvegarder la position avant de pauser
    const stateResponse = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    if (stateResponse.ok) {
      const playerState = await stateResponse.json();
      this.currentPosition = playerState.progress_ms;
    }

    await spotifyService.pausePlayback(this.token);
  }

  loadTrack(track) {
    // Pour Spotify, on reset juste la position
    this.currentPosition = 0;
  }

  getDuration() {
    // La durée est déjà fournie dans les métadonnées du track
    return 0; // Sera géré par le state de Spotify
  }

  getCurrentPosition() {
    return this.currentPosition;
  }

  setPosition(position) {
    this.currentPosition = position;
  }

  resetLastTrack() {
    this.lastPlayedTrack = null;
  }
}

/**
 * Factory pour créer le bon adaptateur selon le mode
 */
export function createPlayerAdapter(mode, options = {}) {
  if (mode === 'mp3') {
    return new MP3PlayerAdapter(options.audioRef);
  } else if (mode === 'spotify-auto' || mode === 'spotify-ai') {
    return new SpotifyPlayerAdapter(
      options.token,
      options.deviceId,
      options.player
    );
  }
  throw new Error(`Mode inconnu: ${mode}`);
}
