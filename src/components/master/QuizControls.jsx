import React, { useEffect, useRef } from 'react';

/**
 * Composant pour les contrôles du mode Quiz
 * Affiche les 4 réponses proposées et permet de révéler la bonne réponse
 * Révèle automatiquement quand tous les joueurs ont répondu
 */
export default function QuizControls({
  quizAnswers,
  correctAnswerIndex,
  playerAnswers,
  allPlayers,
  isPlaying,
  onReveal,
  onPause,
  isRevealed
}) {
  const hasAutoRevealed = useRef(false);

  // Auto-révéler quand tous les joueurs ont répondu
  useEffect(() => {
    if (isRevealed || hasAutoRevealed.current) return;
    if (!allPlayers || allPlayers.length === 0) return;
    if (!playerAnswers || playerAnswers.length === 0) return;

    const totalPlayers = allPlayers.length;
    const totalAnswers = playerAnswers.length;

    console.log(`📊 Quiz: ${totalAnswers}/${totalPlayers} joueurs ont répondu`);

    // Tous les joueurs ont répondu !
    if (totalAnswers >= totalPlayers && totalPlayers > 0) {
      console.log('✅ Tous les joueurs ont répondu, révélation automatique...');
      hasAutoRevealed.current = true;

      // Arrêter la musique
      if (isPlaying && onPause) {
        onPause();
      }

      // Révéler la réponse
      if (onReveal) {
        onReveal();
      }
    }
  }, [playerAnswers, allPlayers, isRevealed, isPlaying, onReveal, onPause]);

  // Reset le flag quand on change de chanson
  useEffect(() => {
    if (!isRevealed) {
      hasAutoRevealed.current = false;
    }
  }, [isRevealed]);

  if (!quizAnswers || quizAnswers.length === 0) {
    return (
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <p style={{ textAlign: 'center', opacity: 0.7 }}>
          Aucune question générée pour cette chanson
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: '0.75rem',
      padding: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      {/* Titre */}
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: '600',
        marginBottom: '1rem',
        textAlign: 'center'
      }}>
        🎯 Questions (QCM)
      </h3>

      {/* Les 4 réponses */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        {quizAnswers.map((answer, index) => {
          const label = String.fromCharCode(65 + index); // A, B, C, D
          const isCorrect = index === correctAnswerIndex;
          const playersWhoAnswered = playerAnswers.filter(p => p.answer === label).length;

          return (
            <div
              key={index}
              style={{
                padding: '1rem',
                backgroundColor: isRevealed && isCorrect
                  ? 'rgba(16, 185, 129, 0.3)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: isRevealed && isCorrect
                  ? '2px solid #10b981'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.5rem',
                transition: 'all 0.3s'
              }}
            >
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
                color: isRevealed && isCorrect ? '#10b981' : 'white'
              }}>
                {label}
                {isRevealed && isCorrect && ' ✅'}
              </div>
              <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                {answer.artist}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                {answer.title}
              </div>
              {playersWhoAnswered > 0 && (
                <div style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#fbbf24',
                  fontWeight: '500'
                }}>
                  👥 {playersWhoAnswered} joueur{playersWhoAnswered > 1 ? 's' : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bouton Révéler */}
      {!isRevealed && (
        <button
          onClick={onReveal}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: 'rgba(251, 191, 36, 0.3)',
            border: '1px solid #fbbf24',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(251, 191, 36, 0.4)'}
          onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(251, 191, 36, 0.3)'}
        >
          📣 Révéler la réponse
        </button>
      )}

      {/* Nombre de réponses reçues */}
      <div style={{
        marginTop: '1rem',
        textAlign: 'center',
        fontSize: '0.875rem',
        opacity: 0.8
      }}>
        {allPlayers && allPlayers.length > 0 ? (
          <>
            {playerAnswers.length}/{allPlayers.length} joueur{allPlayers.length > 1 ? 's' : ''} {playerAnswers.length > 1 ? 'ont' : 'a'} répondu
            {playerAnswers.length >= allPlayers.length && ' 🎉'}
          </>
        ) : (
          <>
            {playerAnswers.length} réponse{playerAnswers.length > 1 ? 's' : ''} reçue{playerAnswers.length > 1 ? 's' : ''}
          </>
        )}
      </div>
    </div>
  );
}
