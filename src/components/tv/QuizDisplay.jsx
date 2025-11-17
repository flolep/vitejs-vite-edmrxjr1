// Affichage TV pour le mode Quiz
import React from 'react';

/**
 * Calcule les points disponibles selon le système de décompte
 * (copié depuis TV.jsx pour cohérence)
 */
function calculatePoints(chrono, songDuration) {
  const maxPoints = 2500;
  let availablePoints = maxPoints;

  if (chrono <= 5) {
    availablePoints = 2500;
  } else if (chrono < 15) {
    const timeInPhase = chrono - 5;
    const phaseDuration = 10;
    availablePoints = 2000 - (timeInPhase / phaseDuration) * 1000;
  } else {
    const timeAfter15 = chrono - 15;
    const remainingDuration = Math.max(1, songDuration - 15);
    const decayRatio = Math.min(1, timeAfter15 / remainingDuration);
    availablePoints = 500 * (1 - decayRatio);
  }

  return Math.max(0, Math.round(availablePoints));
}

export function QuizDisplay({
  quizQuestion,
  quizAnswers,
  quizLeaderboard,
  allPlayers,
  isPlaying,
  gameStatus,
  chrono = 0,
  songDuration = 30
}) {
  if (!quizQuestion) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        minHeight: '100vh',
        color: 'white',
        padding: '3rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '4rem', marginBottom: '2rem', color: '#fbbf24' }}>
            🎯 MODE QUIZ 🎯
          </h1>
          <p style={{ fontSize: '1.5rem', opacity: 0.8 }}>
            {isPlaying ? 'Génération de la question...' : 'En attente du démarrage...'}
          </p>
        </div>
      </div>
    );
  }

  const { answers, revealed, trackNumber } = quizQuestion;

  // Calculer les points disponibles avec le système de décompte
  const availablePoints = calculatePoints(chrono, songDuration);

  // Couleur des points selon le montant
  let pointsColor = '#10b981'; // vert
  if (availablePoints < 1500) pointsColor = '#f59e0b'; // orange
  if (availablePoints < 750) pointsColor = '#ef4444'; // rouge

  // Détection des paliers
  const isAt5s = chrono >= 4.5 && chrono <= 5.5;
  const isAt15s = chrono >= 14.5 && chrono <= 15.5;
  const isNearCritical = availablePoints < 250;

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

  // Calculer quels joueurs n'ont pas encore répondu
  const respondedPlayerIds = quizAnswers.map(a => a.playerId);
  const nonRespondents = allPlayers.filter(p => !respondedPlayerIds.includes(p.id));

  // Afficher les non-répondants si arrêt/pause/révélé
  const showNonRespondents = !isPlaying || gameStatus === 'stopped' || revealed;

  // Masquer les points quand tous les joueurs ont répondu
  const allPlayersAnswered = allPlayers.length > 0 && quizAnswers.length >= allPlayers.length;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      minHeight: '100vh',
      color: 'white',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex'
    }}>
      {/* Zone principale */}
      <div style={{ flex: 1, marginRight: '2rem' }}>
        {/* Titre */}
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#fbbf24',
          textShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
          marginBottom: '1rem'
        }}>
          🎯 MODE QUIZ
        </h1>

        {/* Décompte des points disponibles + chrono */}
        {!revealed && isPlaying && !allPlayersAnswered && (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '3rem',
              marginBottom: '1rem'
            }}>
              {/* Chrono */}
              <div>
                <h3 style={{
                  fontSize: '1.2rem',
                  marginBottom: '0.5rem',
                  color: '#fbbf24',
                  opacity: 0.9
                }}>
                  ⏱️ TEMPS
                </h3>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 'bold',
                  color: '#60a5fa',
                  lineHeight: 1
                }}>
                  {chrono.toFixed(1)}s
                </div>
              </div>

              {/* Points */}
              <div>
                <h3 style={{
                  fontSize: '1.2rem',
                  marginBottom: '0.5rem',
                  color: '#fbbf24',
                  opacity: 0.9
                }}>
                  💰 POINTS
                </h3>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 'bold',
                  color: pointsColor,
                  lineHeight: 1,
                  textShadow: `0 0 30px ${pointsColor}`,
                  animation: isNearCritical ? 'pulse 0.5s infinite' : 'none'
                }}>
                  {availablePoints}
                </div>
                <div style={{
                  fontSize: '1rem',
                  opacity: 0.6,
                  marginTop: '0.25rem'
                }}>
                  / 2500
                </div>
              </div>
            </div>

            {/* Alertes paliers */}
            {isAt5s && (
              <div style={{
                marginTop: '0.5rem',
                fontSize: '1.2rem',
                color: '#fbbf24',
                fontWeight: 'bold',
                animation: 'pulse 0.5s infinite'
              }}>
                ⚠️ Palier à 5s !
              </div>
            )}

            {isAt15s && (
              <div style={{
                marginTop: '0.5rem',
                fontSize: '1.2rem',
                color: '#ef4444',
                fontWeight: 'bold',
                animation: 'pulse 0.5s infinite'
              }}>
                ⚠️ Palier à 15s !
              </div>
            )}
          </div>
        )}

        {/* Les 4 options de réponse */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          marginBottom: '3rem',
          maxWidth: '1000px',
          margin: '0 auto 3rem'
        }}>
          {shuffledAnswers && shuffledAnswers.map((answer) => {
            const showCorrect = revealed && answer.isCorrect;

            // Trouver les joueurs qui ont choisi cette réponse
            const playersWhoAnswered = quizAnswers.filter(a => a.answer === answer.label);

            // Récupérer les photos depuis allPlayers
            const playersWithPhotos = playersWhoAnswered.map(playerAnswer => {
              const player = allPlayers.find(p => p.name === playerAnswer.playerName);
              return {
                ...playerAnswer,
                photo: player?.photo
              };
            });

            let backgroundColor = 'rgba(75, 85, 99, 0.5)';
            let borderColor = '#6b7280';

            if (showCorrect) {
              backgroundColor = 'rgba(16, 185, 129, 0.5)';
              borderColor = '#10b981';
            }

            return (
              <div
                key={answer.label}
                style={{
                  backgroundColor,
                  border: `4px solid ${borderColor}`,
                  borderRadius: '1.5rem',
                  padding: '2rem',
                  textAlign: 'center',
                  transition: 'all 0.3s',
                  boxShadow: showCorrect ? '0 0 30px rgba(16, 185, 129, 0.6)' : 'none',
                  position: 'relative'
                }}
              >
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 'bold',
                  marginBottom: '1rem',
                  color: showCorrect ? '#10b981' : '#fbbf24'
                }}>
                  {showCorrect && '✅ '}
                  {answer.label}
                </div>
                <div style={{
                  fontSize: '1.25rem',
                  lineHeight: '1.4',
                  marginBottom: '1rem'
                }}>
                  {answer.text}
                </div>

                {/* Photos des joueurs qui ont répondu */}
                {playersWithPhotos.length > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    marginTop: '1rem',
                    flexWrap: 'wrap'
                  }}>
                    {playersWithPhotos.map((player, idx) => (
                      player.photo && (
                        <img
                          key={idx}
                          src={player.photo}
                          alt={player.playerName}
                          title={player.playerName}
                          style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '3px solid white',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                            transition: 'transform 0.2s',
                            animation: 'fadeIn 0.3s ease-in'
                          }}
                        />
                      )
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Classement de la chanson actuelle */}
        {quizAnswers.length > 0 && (
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '1.5rem',
            padding: '2rem',
            maxWidth: '1000px',
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '2rem',
              marginBottom: '1.5rem',
              textAlign: 'center',
              color: '#fbbf24'
            }}>
              📊 Réponses de cette chanson
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {quizAnswers.map((playerAnswer, index) => {
                const isCorrect = playerAnswer.isCorrect;
                const bgColor = revealed
                  ? (isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)')
                  : 'rgba(75, 85, 99, 0.3)';

                return (
                  <div
                    key={playerAnswer.playerId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: bgColor,
                      borderRadius: '1rem',
                      padding: '1rem 1.5rem',
                      border: revealed && isCorrect ? '2px solid #10b981' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', marginRight: '1rem', minWidth: '40px' }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </div>
                    <div style={{ flex: 1, fontSize: '1.25rem', fontWeight: 'bold' }}>
                      {playerAnswer.playerName}
                    </div>

                    {/* Avant révélation : juste "A répondu" */}
                    {!revealed && (
                      <div style={{ fontSize: '1.25rem', opacity: 0.8, fontStyle: 'italic' }}>
                        ✓ A répondu
                      </div>
                    )}

                    {/* Après révélation : réponse + correct/incorrect + points */}
                    {revealed && (
                      <>
                        <div style={{ fontSize: '1.25rem', marginRight: '1.5rem' }}>
                          → <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>
                            {playerAnswer.answer}
                          </span>
                        </div>
                        <div style={{ fontSize: '1.5rem', marginRight: '1rem' }}>
                          {isCorrect ? '✅' : '❌'}
                        </div>
                        {isCorrect && (
                          <div style={{ fontSize: '1.25rem', color: '#10b981', fontWeight: 'bold' }}>
                            +{calculateQuizPoints(playerAnswer.time, index)} pts
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Joueurs n'ayant pas répondu */}
              {showNonRespondents && nonRespondents.length > 0 && nonRespondents.map((player) => (
                <div
                  key={player.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(107, 114, 128, 0.2)',
                    borderRadius: '1rem',
                    padding: '1rem 1.5rem',
                    opacity: 0.6
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginRight: '1rem', minWidth: '40px' }}>
                    -
                  </div>
                  <div style={{ flex: 1, fontSize: '1.25rem' }}>
                    {player.name}
                  </div>
                  <div style={{ fontSize: '1rem', opacity: 0.8, fontStyle: 'italic' }}>
                    (Pas de réponse)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar : Leaderboard général */}
      <div style={{
        width: '350px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '1.5rem',
        padding: '1.5rem',
        maxHeight: '100vh',
        overflow: 'auto'
      }}>
        <h2 style={{
          fontSize: '2rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          color: '#fbbf24'
        }}>
          🏆 Classement général
        </h2>

        {quizLeaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', opacity: 0.6, padding: '2rem 0' }}>
            Aucun score pour l'instant
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {quizLeaderboard.map((player, index) => {
              const medals = ['🥇', '🥈', '🥉'];
              const medal = index < 3 ? medals[index] : `${index + 1}.`;

              return (
                <div
                  key={player.playerId}
                  style={{
                    backgroundColor: index === 0
                      ? 'rgba(251, 191, 36, 0.2)'
                      : 'rgba(75, 85, 99, 0.3)',
                    borderRadius: '1rem',
                    padding: '1rem',
                    border: index === 0 ? '2px solid #fbbf24' : 'none'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{ fontSize: '1.5rem', marginRight: '0.75rem' }}>
                      {medal}
                    </div>
                    <div style={{
                      flex: 1,
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {player.playerName}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1rem',
                    opacity: 0.9
                  }}>
                    <span style={{ color: '#10b981' }}>
                      ✓ {player.correctAnswers} bonnes
                    </span>
                    <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>
                      {player.totalPoints} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Fonction utilitaire pour calculer les points (dupliquée depuis useQuizMode)
function calculateQuizPoints(responseTime, rank) {
  const basePoints = 1000;
  const timeBonus = Math.max(0, 500 - (responseTime * 10));
  const rankBonus = Math.max(0, 500 - (rank * 100));
  return Math.round(basePoints + timeBonus + rankBonus);
}
