import React from 'react';

/**
 * Écran de capture photo (selfie)
 * Gère l'affichage de la caméra et la confirmation de la photo
 * Utilisé par BuzzerTeam et BuzzerQuiz
 */
export function PhotoScreen({
  videoRef,
  canvasRef,
  photoData,
  onTakePhoto,
  onRetake,
  onConfirm,
  onSkip,
  isConfirming = false,
  error = '',
  debugPanel = null
}) {
  return (
    <div className="bg-gradient flex-center">
      {debugPanel}
      <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
        <h1 className="title">📸 Prenez un selfie</h1>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            color: '#ef4444'
          }}>
            {error}
          </div>
        )}

        {!photoData ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                maxWidth: '400px',
                borderRadius: '1rem',
                marginBottom: '1rem',
                transform: 'scaleX(-1)' // Effet miroir
              }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <button
              onClick={onTakePhoto}
              className="btn btn-green"
              style={{ width: '100%', padding: '1.5rem', fontSize: '1.5rem' }}
            >
              📸 Prendre la photo
            </button>

            <button
              onClick={onSkip}
              className="btn btn-gray"
              style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}
            >
              Passer sans photo
            </button>
          </>
        ) : (
          <>
            <img
              src={photoData}
              alt="Votre selfie"
              style={{
                width: '100%',
                maxWidth: '400px',
                borderRadius: '1rem',
                marginBottom: '1rem'
              }}
            />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={onRetake}
                className="btn btn-yellow"
                style={{ flex: 1, padding: '1.5rem' }}
              >
                🔄 Reprendre
              </button>

              <button
                onClick={onConfirm}
                className="btn btn-green"
                style={{ flex: 1, padding: '1.5rem' }}
                disabled={isConfirming}
              >
                {isConfirming ? '⏳ Sauvegarde...' : '✅ Confirmer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
