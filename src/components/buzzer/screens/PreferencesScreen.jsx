import React from 'react';

const AVAILABLE_GENRES = [
  'Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Électro',
  'Rap français', 'R&B', 'Reggae', 'Métal', 'Indie',
  'Soul', 'Funk', 'Disco', 'Blues', 'Country'
];

/**
 * Écran de saisie des préférences musicales
 * Âge, genres préférés (max 3), phrase spéciale optionnelle
 * Utilisé par BuzzerTeam et BuzzerQuiz
 */
export function PreferencesScreen({
  playerAge,
  onPlayerAgeChange,
  selectedGenres,
  onToggleGenre,
  specialPhrase,
  onSpecialPhraseChange,
  onSubmit,
  isSubmitting = false,
  error = '',
  debugPanel = null
}) {
  return (
    <div className="bg-gradient flex-center">
      {debugPanel}
      <div className="text-center" style={{ maxWidth: '600px', width: '100%', padding: '2rem' }}>
        <h1 className="title">🎵 Vos Préférences</h1>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
          Parlez-nous de vous !
        </h2>

        {/* Âge */}
        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
          <label style={{
            display: 'block',
            fontSize: '1.1rem',
            marginBottom: '0.5rem',
            fontWeight: 'bold'
          }}>
            🎂 Votre âge
          </label>
          <input
            type="number"
            placeholder="Ex: 25"
            value={playerAge}
            onChange={(e) => onPlayerAgeChange(e.target.value)}
            min="1"
            max="120"
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.2rem',
              borderRadius: '0.75rem',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              textAlign: 'center'
            }}
          />
        </div>

        {/* Genres */}
        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
          <label style={{
            display: 'block',
            fontSize: '1.1rem',
            marginBottom: '0.5rem',
            fontWeight: 'bold'
          }}>
            🎸 Vos 3 genres préférés ({selectedGenres.length}/3)
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '0.75rem'
          }}>
            {AVAILABLE_GENRES.map(genre => {
              const isSelected = selectedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  onClick={() => onToggleGenre(genre)}
                  style={{
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    borderRadius: '0.5rem',
                    border: '2px solid',
                    borderColor: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.3)',
                    backgroundColor: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    transition: 'all 0.2s',
                    opacity: !isSelected && selectedGenres.length >= 3 ? 0.4 : 1
                  }}
                  disabled={!isSelected && selectedGenres.length >= 3}
                >
                  {isSelected ? '✓ ' : ''}{genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Phrase spéciale */}
        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
          <label style={{
            display: 'block',
            fontSize: '1.1rem',
            marginBottom: '0.5rem',
            fontWeight: 'bold'
          }}>
            💬 Votre phrase spéciale (optionnelle)
          </label>
          <textarea
            placeholder="Ex: J'adore chanter sous la douche !"
            value={specialPhrase}
            onChange={(e) => onSpecialPhraseChange(e.target.value)}
            maxLength={200}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              borderRadius: '0.75rem',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
          <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}>
            {specialPhrase.length}/200 caractères
          </div>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div style={{
            color: '#ef4444',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            backgroundColor: '#fee2e2',
            padding: '1rem',
            borderRadius: '0.5rem'
          }}>
            {error}
          </div>
        )}

        {/* Bouton de validation */}
        <button
          onClick={onSubmit}
          disabled={isSubmitting || !playerAge || selectedGenres.length === 0}
          className="btn btn-green"
          style={{
            width: '100%',
            padding: '1.5rem',
            fontSize: '1.25rem',
            opacity: (isSubmitting || !playerAge || selectedGenres.length === 0) ? 0.5 : 1
          }}
        >
          {isSubmitting ? '⏳ Envoi en cours...' : '✅ Valider et continuer'}
        </button>

        <p style={{
          marginTop: '1rem',
          fontSize: '0.875rem',
          opacity: 0.7
        }}>
          Ces informations nous aideront à personnaliser votre expérience musicale ! 🎶
        </p>
      </div>
    </div>
  );
}
