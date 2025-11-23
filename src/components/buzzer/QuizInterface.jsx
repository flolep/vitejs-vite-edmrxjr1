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
  loadPersonalStats,
  showStats,
  setShowStats,
  personalStats,
  onNextSong // Fonction pour passer à la chanson suivante
}) {
  if (!quizQuestion) {
    return (
      <div className="buzzer-quiz-container">
        <div className="buzzer-quiz-content">
          <h1 className="buzzer-quiz-title">BUZZER</h1>
          <p className="buzzer-quiz-subtitle">
            {isPlaying ? 'Génération de la question...' : 'En attente du démarrage...'}
          </p>
        </div>
      </div>
    );
  }

  const { answers, revealed, trackNumber, correctAnswer, totalTracks, nextSongTriggerPlayerId } = quizQuestion;

  // Vérifier si c'est ce joueur qui peut déclencher la chanson suivante
  const playerId = selectedPlayer?.id || `temp_${playerName}`;
  const canTriggerNextSong = revealed && nextSongTriggerPlayerId === playerId;

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

  // Trouver la bonne réponse pour l'affichage
  const correctAnswerData = shuffledAnswers?.find(a => a.isCorrect);

  // Déterminer l'état actuel
  const getDataState = () => {
    if (revealed) {
      return isCorrect ? 'revealed-correct' : 'revealed-wrong';
    }
    if (hasAnswered) {
      return 'selected';
    }
    return 'playing';
  };

  const dataState = getDataState();

  // Messages d'état selon le design
  const getStatusMessage = () => {
    if (revealed) {
      if (isCorrect) {
        return 'Bonne réponse ! +120 pts';
      }
      return 'Mauvaise réponse · 0 pt';
    }
    if (hasAnswered) {
      return 'Tu as buzzé · En attente de la bonne réponse...';
    }
    if (isPlaying) {
      return 'La chanson est en cours · La question se termine bientôt';
    }
    return 'En attente du démarrage...';
  };

  // Sous-titre sous BUZZER
  const getSubtitle = () => {
    if (revealed && correctAnswerData) {
      return `La bonne réponse était ${correctAnswerData.text}`;
    }
    if (hasAnswered) {
      return 'Ta réponse est enregistrée';
    }
    return 'Touchez une réponse pour buzzer';
  };

  // Message en bas
  const getBottomMessage = () => {
    if (revealed) {
      if (isCorrect) {
        return { text: 'Bravo, tu avais la bonne réponse', color: '#22c55e', dot: '#22c55e' };
      }
      return {
        text: `Tu avais choisi ${selectedAnswer}, la bonne réponse était ${correctAnswerData?.label || '?'}`,
        color: '#ef4444',
        dot: '#ef4444'
      };
    }
    if (hasAnswered) {
      return { text: `Ta réponse ${selectedAnswer} est verrouillée`, color: '#fbbf24', dot: '#fbbf24' };
    }
    return { text: 'Aucune réponse choisie pour l\'instant', color: 'rgba(255,255,255,0.6)', dot: null };
  };

  const bottomMessage = getBottomMessage();

  return (
    <div className="buzzer-quiz-container">
      {/* Bouton de statistiques personnelles */}
      <button
        onClick={loadPersonalStats}
        className="buzzer-quiz-stats-btn"
        title="Mes statistiques"
      >
        📊
      </button>

      {/* Header avec question et joueur */}
      <div className="buzzer-quiz-header">
        <div className="buzzer-quiz-header-pill">
          Question {(trackNumber || 0) + 1} / {totalTracks || 10} · Mode Quiz
        </div>
        <div className="buzzer-quiz-header-player">
          {selectedPlayer?.photo ? (
            <img
              src={selectedPlayer.photo}
              alt={selectedPlayer.name}
              onClick={canTriggerNextSong ? onNextSong : undefined}
              className={`buzzer-quiz-avatar ${canTriggerNextSong ? 'can-trigger' : ''}`}
            />
          ) : (
            <div className="buzzer-quiz-avatar-placeholder">
              {(selectedPlayer?.name || playerName || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="buzzer-quiz-player-info">
            <span className="buzzer-quiz-player-name">{selectedPlayer?.name || playerName}</span>
            <span className="buzzer-quiz-player-role">Joueur</span>
          </div>
        </div>
      </div>

      {/* Badge de notification pour passer à la suite */}
      {canTriggerNextSong && (
        <div className="buzzer-quiz-next-badge" onClick={onNextSong}>
          👇 Cliquez pour continuer
        </div>
      )}

      {/* Message d'état */}
      <div className={`buzzer-quiz-status buzzer-quiz-status--${dataState}`}>
        {getStatusMessage()}
      </div>

      {/* Titre BUZZER */}
      <h1 className="buzzer-quiz-title">BUZZER</h1>

      {/* Sous-titre */}
      <p className="buzzer-quiz-subtitle">{getSubtitle()}</p>

      {/* Grille des 4 réponses */}
      <div className="buzzer-quiz-answers-grid">
        {shuffledAnswers && shuffledAnswers.map((answer) => {
          const isSelected = selectedAnswer === answer.label;
          const showCorrect = revealed && answer.isCorrect;
          const showWrong = revealed && isSelected && !answer.isCorrect;

          let cardClass = 'buzzer-quiz-answer-card';
          if (isSelected && !revealed) cardClass += ' buzzer-quiz-answer-card--selected';
          if (showCorrect) cardClass += ' buzzer-quiz-answer-card--correct';
          if (showWrong) cardClass += ' buzzer-quiz-answer-card--wrong';
          if (hasAnswered && !revealed && !isSelected) cardClass += ' buzzer-quiz-answer-card--disabled';

          return (
            <button
              key={answer.label}
              onClick={() => !hasAnswered && onAnswerSelect(answer.label)}
              disabled={hasAnswered}
              className={cardClass}
            >
              <div className={`buzzer-quiz-answer-letter ${showCorrect ? 'buzzer-quiz-answer-letter--correct' : ''} ${showWrong ? 'buzzer-quiz-answer-letter--wrong' : ''}`}>
                {answer.label}
              </div>
              <div className="buzzer-quiz-answer-artist">
                {answer.artist || answer.text?.split(' - ')[0] || answer.text}
              </div>
              <div className="buzzer-quiz-answer-song">
                {answer.song || answer.text?.split(' - ')[1] || ''}
              </div>
            </button>
          );
        })}
      </div>

      {/* Message en bas */}
      <div className="buzzer-quiz-bottom-message">
        {bottomMessage.dot && (
          <span
            className="buzzer-quiz-bottom-dot"
            style={{ backgroundColor: bottomMessage.dot }}
          />
        )}
        <span style={{ color: bottomMessage.color }}>{bottomMessage.text}</span>
      </div>

      {/* Modale des statistiques personnelles */}
      {showStats && (
        <div className="buzzer-quiz-modal-overlay" onClick={() => setShowStats(false)}>
          <div className="buzzer-quiz-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="buzzer-quiz-modal-title">📊 Mes Statistiques (Quiz)</h2>

            {/* Résumé des stats Quiz */}
            <div className="buzzer-quiz-stats-grid">
              <div className="buzzer-quiz-stat-card buzzer-quiz-stat-card--blue">
                <div className="buzzer-quiz-stat-value">
                  {personalStats.correctAnswers || 0}
                </div>
                <div className="buzzer-quiz-stat-label">
                  Bonnes réponses
                </div>
              </div>

              <div className="buzzer-quiz-stat-card buzzer-quiz-stat-card--yellow">
                <div className="buzzer-quiz-stat-value">
                  {personalStats.totalPoints || 0}
                </div>
                <div className="buzzer-quiz-stat-label">
                  Points totaux
                </div>
              </div>
            </div>

            <button onClick={() => setShowStats(false)} className="buzzer-quiz-modal-close-btn">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Styles intégrés */}
      <style>{`
        .buzzer-quiz-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          position: relative;
        }

        .buzzer-quiz-stats-btn {
          position: fixed;
          top: 1rem;
          right: 1rem;
          background-color: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1.5rem;
          z-index: 100;
          transition: all 0.2s;
        }

        .buzzer-quiz-stats-btn:hover {
          background-color: rgba(0, 0, 0, 0.5);
          transform: scale(1.05);
        }

        .buzzer-quiz-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          max-width: 600px;
          margin-bottom: 1rem;
          gap: 1rem;
        }

        .buzzer-quiz-header-pill {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.875rem;
          white-space: nowrap;
        }

        .buzzer-quiz-header-player {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          padding: 0.5rem 1rem 0.5rem 0.5rem;
          border-radius: 2rem;
        }

        .buzzer-quiz-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .buzzer-quiz-avatar.can-trigger {
          border: 3px solid #ef4444;
          cursor: pointer;
          animation: pulse 1.5s infinite;
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.6);
        }

        .buzzer-quiz-avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.25rem;
        }

        .buzzer-quiz-player-info {
          display: flex;
          flex-direction: column;
        }

        .buzzer-quiz-player-name {
          font-weight: 600;
          font-size: 0.9rem;
        }

        .buzzer-quiz-player-role {
          font-size: 0.75rem;
          opacity: 0.7;
        }

        .buzzer-quiz-next-badge {
          background: #ef4444;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 1rem;
          font-size: 0.875rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
          cursor: pointer;
          animation: pulse 1.5s infinite;
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }

        .buzzer-quiz-status {
          font-size: 0.9rem;
          opacity: 0.9;
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .buzzer-quiz-status--revealed-correct {
          color: #86efac;
        }

        .buzzer-quiz-status--revealed-wrong {
          color: #fca5a5;
        }

        .buzzer-quiz-status--selected {
          color: #fde68a;
        }

        .buzzer-quiz-title {
          font-size: 3rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0 0 0.5rem 0;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .buzzer-quiz-subtitle {
          font-size: 1rem;
          opacity: 0.9;
          margin: 0 0 1.5rem 0;
          text-align: center;
          max-width: 300px;
        }

        .buzzer-quiz-answers-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          width: 100%;
          max-width: 400px;
          margin-bottom: 1.5rem;
        }

        .buzzer-quiz-answer-card {
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          padding: 1rem;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          min-height: 120px;
        }

        .buzzer-quiz-answer-card:hover:not(:disabled) {
          background: rgba(30, 41, 59, 0.9);
          transform: translateY(-2px);
        }

        .buzzer-quiz-answer-card--selected {
          border: 3px solid #fbbf24;
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
        }

        .buzzer-quiz-answer-card--correct {
          background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
          border-color: #22c55e;
        }

        .buzzer-quiz-answer-card--wrong {
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
          border-color: #ef4444;
        }

        .buzzer-quiz-answer-card--disabled {
          opacity: 0.5;
        }

        .buzzer-quiz-answer-card:disabled {
          cursor: not-allowed;
        }

        .buzzer-quiz-answer-letter {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.1rem;
          margin-bottom: 0.75rem;
          border: 2px solid rgba(255, 255, 255, 0.2);
        }

        .buzzer-quiz-answer-letter--correct {
          background: #166534;
          border-color: #22c55e;
        }

        .buzzer-quiz-answer-letter--wrong {
          background: #991b1b;
          border-color: #ef4444;
        }

        .buzzer-quiz-answer-artist {
          font-weight: 600;
          font-size: 0.95rem;
          line-height: 1.2;
          margin-bottom: 0.25rem;
        }

        .buzzer-quiz-answer-song {
          font-size: 0.8rem;
          opacity: 0.7;
          line-height: 1.2;
        }

        .buzzer-quiz-bottom-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          padding: 0.75rem 1rem;
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          border-radius: 1rem;
        }

        .buzzer-quiz-bottom-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .buzzer-quiz-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          text-align: center;
        }

        /* Modal styles */
        .buzzer-quiz-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 2rem;
        }

        .buzzer-quiz-modal {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-radius: 1.5rem;
          padding: 2rem;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .buzzer-quiz-modal-title {
          font-size: 1.75rem;
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .buzzer-quiz-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .buzzer-quiz-stat-card {
          padding: 1rem;
          border-radius: 0.75rem;
          text-align: center;
        }

        .buzzer-quiz-stat-card--blue {
          background: rgba(59, 130, 246, 0.2);
        }

        .buzzer-quiz-stat-card--yellow {
          background: rgba(251, 191, 36, 0.2);
        }

        .buzzer-quiz-stat-value {
          font-size: 2.5rem;
          font-weight: bold;
        }

        .buzzer-quiz-stat-card--blue .buzzer-quiz-stat-value {
          color: #60a5fa;
        }

        .buzzer-quiz-stat-card--yellow .buzzer-quiz-stat-value {
          color: #fbbf24;
        }

        .buzzer-quiz-stat-label {
          font-size: 0.875rem;
          opacity: 0.8;
          margin-top: 0.5rem;
        }

        .buzzer-quiz-modal-close-btn {
          width: 100%;
          padding: 0.75rem;
          background-color: #3b82f6;
          border: none;
          border-radius: 0.5rem;
          color: white;
          font-weight: bold;
          cursor: pointer;
          font-size: 1rem;
          transition: background-color 0.2s;
        }

        .buzzer-quiz-modal-close-btn:hover {
          background-color: #2563eb;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @media (max-width: 400px) {
          .buzzer-quiz-title {
            font-size: 2.5rem;
          }

          .buzzer-quiz-answers-grid {
            gap: 0.5rem;
          }

          .buzzer-quiz-answer-card {
            padding: 0.75rem;
            min-height: 100px;
          }

          .buzzer-quiz-header {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
