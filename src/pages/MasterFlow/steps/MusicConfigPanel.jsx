import React, { useState } from 'react';

/**
 * Panel droit : Configuration de la source musicale
 * 3 options : MP3 local, Spotify Playlist, Spotify IA
 */
export default function MusicConfigPanel({
  onMusicConfigured,
  spotifyToken,
  onSpotifyConnect
}) {
  const [selectedSource, setSelectedSource] = useState(null); // 'mp3' | 'spotify-auto' | 'spotify-ai'
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Handler pour MP3
  const handleMP3Upload = (event) => {
    const files = Array.from(event.target.files);
    setIsUploading(true);

    // Simuler upload (dans la vraie implémentation, utiliser le système existant)
    setTimeout(() => {
      setUploadedFiles(files);
      setIsUploading(false);

      // Notifier le parent
      onMusicConfigured('mp3', {
        files,
        playlist: files.map((file, index) => ({
          title: file.name,
          uri: URL.createObjectURL(file),
          duration: 30 // Valeur par défaut
        }))
      });
    }, 500);
  };

  // Handler pour Spotify Auto
  const handleSpotifyAuto = () => {
    setSelectedSource('spotify-auto');
    // Pour l'instant, on considère que c'est configuré
    // Dans la vraie implémentation, ouvrir le sélecteur de playlist
    onMusicConfigured('spotify-auto', {
      playlistId: null // À remplir avec le sélecteur
    });
  };

  // Handler pour Spotify IA
  const handleSpotifyAI = () => {
    setSelectedSource('spotify-ai');
    // La playlist sera générée avec les préférences des joueurs
    onMusicConfigured('spotify-ai', {
      willGenerateFromPreferences: true
    });
  };

  return (
    <div style={{
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      border: '2px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '1.5rem',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    }}>
      {/* Titre */}
      <div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🎵 Configuration musicale
        </h2>
        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
          Choisissez la source de musique pour votre partie
        </p>
      </div>

      {/* Options de source musicale */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {/* Option 1: MP3 Local */}
        <div
          style={{
            backgroundColor: selectedSource === 'mp3'
              ? 'rgba(16, 185, 129, 0.2)'
              : 'rgba(0, 0, 0, 0.2)',
            border: selectedSource === 'mp3'
              ? '2px solid #10b981'
              : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            transition: 'all 0.2s'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ fontSize: '2rem' }}>📂</div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: 'bold',
                marginBottom: '0.25rem'
              }}>
                MP3 Local
              </h3>
              <p style={{
                fontSize: '0.85rem',
                opacity: 0.8,
                marginBottom: '0.75rem'
              }}>
                Uploadez vos propres fichiers MP3
              </p>

              {/* Input file */}
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                backgroundColor: 'rgba(16, 185, 129, 0.3)',
                border: '1px solid #10b981',
                borderRadius: '0.5rem',
                color: 'white',
                fontSize: '0.9rem',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                opacity: isUploading ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isUploading) {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
              }}
              >
                <input
                  type="file"
                  accept="audio/mp3,audio/mpeg"
                  multiple
                  onChange={handleMP3Upload}
                  disabled={isUploading}
                  style={{ display: 'none' }}
                />
                {isUploading ? '⏳ Upload...' : '📤 Choisir fichiers MP3'}
              </label>

              {/* Liste fichiers uploadés */}
              {uploadedFiles.length > 0 && (
                <div style={{
                  marginTop: '0.75rem',
                  fontSize: '0.85rem',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '0.5rem'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                    ✅ {uploadedFiles.length} fichier(s) uploadé(s)
                  </div>
                  <div style={{ opacity: 0.7 }}>
                    {uploadedFiles.slice(0, 3).map(file => file.name).join(', ')}
                    {uploadedFiles.length > 3 && `, +${uploadedFiles.length - 3} autres`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Option 2: Spotify Playlist existante */}
        <div
          style={{
            backgroundColor: selectedSource === 'spotify-auto'
              ? 'rgba(30, 215, 96, 0.2)'
              : 'rgba(0, 0, 0, 0.2)',
            border: selectedSource === 'spotify-auto'
              ? '2px solid #1ed760'
              : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            transition: 'all 0.2s'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '2rem' }}>🎧</div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: 'bold',
                marginBottom: '0.25rem'
              }}>
                Spotify - Playlist existante
              </h3>
              <p style={{
                fontSize: '0.85rem',
                opacity: 0.8,
                marginBottom: '0.75rem'
              }}>
                Sélectionnez une playlist Spotify
              </p>

              {!spotifyToken ? (
                <button
                  onClick={onSpotifyConnect}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: '#1ed760',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: 'black',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1fdf64';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#1ed760';
                  }}
                >
                  🔗 Connecter Spotify
                </button>
              ) : (
                <button
                  onClick={handleSpotifyAuto}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: 'rgba(30, 215, 96, 0.3)',
                    border: '1px solid #1ed760',
                    borderRadius: '0.5rem',
                    color: 'white',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(30, 215, 96, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(30, 215, 96, 0.3)';
                  }}
                >
                  ✅ Utiliser Spotify
                </button>
              )}

              {selectedSource === 'spotify-auto' && (
                <div style={{
                  marginTop: '0.75rem',
                  fontSize: '0.85rem',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '0.5rem',
                  color: '#1ed760'
                }}>
                  ✅ Spotify configuré (sélecteur de playlist à implémenter)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Option 3: Spotify IA */}
        <div
          style={{
            backgroundColor: selectedSource === 'spotify-ai'
              ? 'rgba(124, 58, 237, 0.2)'
              : 'rgba(0, 0, 0, 0.2)',
            border: selectedSource === 'spotify-ai'
              ? '2px solid #7c3aed'
              : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            transition: 'all 0.2s'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '2rem' }}>🤖</div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '1.1rem',
                fontWeight: 'bold',
                marginBottom: '0.25rem'
              }}>
                Spotify - Playlist générée par IA
              </h3>
              <p style={{
                fontSize: '0.85rem',
                opacity: 0.8,
                marginBottom: '0.75rem'
              }}>
                L'IA génère une playlist basée sur les préférences des joueurs
              </p>

              {!spotifyToken ? (
                <button
                  onClick={onSpotifyConnect}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: '#1ed760',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: 'black',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1fdf64';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#1ed760';
                  }}
                >
                  🔗 Connecter Spotify
                </button>
              ) : (
                <button
                  onClick={handleSpotifyAI}
                  style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: 'rgba(124, 58, 237, 0.3)',
                    border: '1px solid #7c3aed',
                    borderRadius: '0.5rem',
                    color: 'white',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.3)';
                  }}
                >
                  🚀 Utiliser l'IA
                </button>
              )}

              {selectedSource === 'spotify-ai' && (
                <div style={{
                  marginTop: '0.75rem',
                  fontSize: '0.85rem',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '0.5rem',
                  color: '#7c3aed'
                }}>
                  ✅ IA activée - La playlist sera générée avec les préférences des joueurs
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info complémentaire */}
      {!selectedSource && (
        <div style={{
          fontSize: '0.85rem',
          opacity: 0.7,
          padding: '0.75rem',
          backgroundColor: 'rgba(251, 191, 36, 0.2)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '0.5rem',
          textAlign: 'center'
        }}>
          ⚠️ Sélectionnez une source musicale pour continuer
        </div>
      )}
    </div>
  );
}
