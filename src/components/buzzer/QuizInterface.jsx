// Interface Quiz pour le Buzzer (Mode Quiz)
import React from 'react';

export function QuizInterface({
  selectedPlayer,
  playerName,
  quizQuestion,
  selectedAnswer,
  hasAnswered,
  isPlaying,
  onAnswerSelect,
  onChangeTeam,
  loadPersonalStats,
  showStats,
  setShowStats,
  personalStats
}) {
  if (!quizQuestion) {
    return (
      <div className="bg-gradient flex-center">
        <div className="text-center">
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎯 Mode Quiz</h2>
          <p style={{ opacity: 0.8 }}>
            {isPlaying ? 'Génération de la question...' : 'En attente du démarrage...'}
          </p>
        </div>
      </div>
    );
  }

  const { answers, revealed, trackNumber } = quizQuestion;

  // 🎲 Mélanger les positions visuelles des réponses (stable par chanson)
  // Utilise le trackNumber comme seed pour avoir toujours le même ordre pendant la question
  const shuffledAnswers = React.useMemo(() => {
    if (!answers) return [];

    // Créer un array avec les réponses et leur index original
    const answersWithIndex = answers.map((answer, idx) => ({ answer, originalIndex: idx }));

    // Mélanger en utilisant le trackNumber comme seed simple
    const shuffled = [...answersWithIndex].sort((a, b) => {
      // Hash simple basé sur trackNumber + index pour avoir un ordre déterministe
      const hashA = (trackNumber * 1000 + a.originalIndex * 13) % 100;
      const hashB = (trackNumber * 1000 + b.originalIndex * 13) % 100;
      return hashA - hashB;
    });

    return shuffled.map(item => item.answer);
  }, [answers, trackNumber]);

  // Trouver si la réponse du joueur est correcte
  const playerAnswerData = shuffledAnswers?.find(a => a.label === selectedAnswer);
  const isCorrect = playerAnswerData?.isCorrect;

  return (
    <div className="bg-gradient flex-center">
      {/* Bouton de statistiques personnelles */}
      <button
        onClick={loadPersonalStats}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '1.5rem',
          zIndex: 100
        }}
        title="Mes statistiques"
      >
        📊
      </button>

      <div className="text-center mb-8" style={{ width: '100%', maxWidth: '600px' }}>
        {selectedPlayer?.photo && (
          <img
            src={selectedPlayer.photo}
            alt={selectedPlayer.name}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              objectFit: 'cover',
              margin: '0 auto 0.5rem',
              border: '3px solid #fbbf24'
            }}
          />
        )}
        <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem', opacity: 0.9 }}>
          {selectedPlayer?.name || playerName}
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          🎯 MODE QUIZ
        </h1>

        {/* Instructions */}
        {!hasAnswered && !revealed && (
          <p style={{ fontSize: '1.125rem', opacity: 0.8, marginBottom: '2rem' }}>
            {isPlaying ? 'Quelle est cette chanson ?' : 'En attente...'}
          </p>
        )}
        {hasAnswered && !revealed && (
          <p style={{ fontSize: '1.125rem', opacity: 0.8, marginBottom: '2rem', color: '#fbbf24' }}>
            ✓ Réponse enregistrée : {selectedAnswer}
          </p>
        )}
        {revealed && (
          <p style={{ fontSize: '1.125rem', opacity: 0.8, marginBottom: '2rem', color: isCorrect ? '#10b981' : '#ef4444' }}>
            {isCorrect ? '✅ Bonne réponse !' : '❌ Mauvaise réponse'}
          </p>
        )}

        {/* Grille des 4 réponses */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          {shuffledAnswers && shuffledAnswers.map((answer) => {
            const isSelected = selectedAnswer === answer.label;
            const showCorrect = revealed && answer.isCorrect;
            const showWrong = revealed && isSelected && !answer.isCorrect;

            let backgroundColor = '#4b5563';
            let borderColor = '#6b7280';
            let cursor = 'pointer';
            let opacity = 1;

            if (hasAnswered) {
              cursor = 'not-allowed';
              opacity = 0.7;
            }

            if (isSelected && !revealed) {
              backgroundColor = '#fbbf24';
              borderColor = '#f59e0b';
            }

            if (showCorrect) {
              backgroundColor = '#10b981';
              borderColor = '#059669';
              opacity = 1;
            }

            if (showWrong) {
              backgroundColor = '#ef4444';
              borderColor = '#dc2626';
              opacity = 1;
            }

            return (
              <button
                key={answer.label}
                onClick={() => !hasAnswered && onAnswerSelect(answer.label)}
                disabled={hasAnswered}
                style={{
                  backgroundColor,
                  border: `3px solid ${borderColor}`,
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor,
                  opacity,
                  transition: 'all 0.2s',
                  minHeight: '100px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                  {answer.label}
                </div>
                <div style={{ fontSize: '0.875rem', lineHeight: '1.2' }}>
                  {answer.text}
                </div>
              </button>
            );
          })}
        </div>

        {!isPlaying && !hasAnswered && (
          <div className="mt-8" style={{ fontSize: '0.875rem', opacity: 0.7 }}>
            ⏸️ Attendez que l'animateur lance la musique...
          </div>
        )}
      </div>

      <button onClick={onChangeTeam} className="btn btn-gray mt-8">
        Changer d'équipe
      </button>

      {/* Modale des statistiques personnelles */}
      {showStats && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
          onClick={() => setShowStats(false)}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              borderRadius: '1.5rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              color: 'white'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '2rem',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              📊 Mes Statistiques (Quiz)
            </h2>

            {/* Résumé des stats Quiz */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                padding: '1rem',
                borderRadius: '0.75rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#60a5fa' }}>
                  {personalStats.correctAnswers || 0}
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.5rem' }}>
                  Bonnes réponses
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                padding: '1rem',
                borderRadius: '0.75rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24' }}>
                  {personalStats.totalPoints || 0}
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.5rem' }}>
                  Points totaux
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowStats(false)}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#3b82f6',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
