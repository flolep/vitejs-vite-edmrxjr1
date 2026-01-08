// Affichage TV pour le mode Quiz
import React from 'react';
import { calculatePoints } from '../../hooks/useScoring';

export function QuizDisplay({
  quizQuestion,
  quizAnswers,
  quizLeaderboard,
  allPlayers,
  isPlaying,
  gameStatus,
  chrono = 0,
  songDuration = 30,
  currentSong = null
}) {
  // Extraire les données du quiz si disponibles
  const { answers, revealed, trackNumber } = quizQuestion || {};

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

        {/* Message d'attente si pas de question */}
        {!quizQuestion && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh'
          }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', opacity: 0.8 }}>
                {isPlaying ? 'Génération de la question...' : 'En attente du démarrage...'}
              </p>
            </div>
          </div>
        )}

        {/* Contenu du quiz (uniquement si question active) */}
        {quizQuestion && (
          <>
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

                {/* Pochette de l'album pour la bonne réponse */}
                {showCorrect && currentSong?.imageUrl && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '1rem'
                  }}>
                    <img
                      src={currentSong.imageUrl}
                      alt={currentSong.title}
                      style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '0.75rem',
                        objectFit: 'cover',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                        border: '3px solid #10b981'
                      }}
                    />
                  </div>
                )}

                <div style={{
                  fontSize: '1.25rem',
                  lineHeight: '1.4',
                  marginBottom: '1rem'
                }}>
                  {answer.text}
                </div>

                {/* Photos des joueurs qui ont répondu - MASQUÉES jusqu'à ce que tous aient répondu */}
                {(allPlayersAnswered || revealed) && playersWithPhotos.length > 0 && (
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

        {/* Pochette maintenant affichée dans la bonne réponse directement */}

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

                    {/* Prénom + temps de réponse (toujours affiché comme une phrase) */}
                    <div style={{ flex: 1, fontSize: '1.25rem' }}>
                      <span style={{ fontWeight: 'bold' }}>{playerAnswer.playerName}</span>
                      <span style={{ opacity: 0.8, fontStyle: 'italic' }}>
                        {' '}a répondu en {playerAnswer.time.toFixed(1)} s
                      </span>
                    </div>

                    {/* Après révélation OU quand tous ont répondu : réponse + correct/incorrect + points */}
                    {(allPlayersAnswered || revealed) ? (
                      <>
                        <div style={{ fontSize: '1.25rem', marginRight: '1rem' }}>
                          → <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>
                            {playerAnswer.answer}
                          </span>
                        </div>
                        <div style={{ fontSize: '1.5rem', marginRight: '1rem' }}>
                          {isCorrect ? '✅' : '❌'}
                        </div>
                        {isCorrect && (
                          <div style={{ fontSize: '1.25rem', color: '#10b981', fontWeight: 'bold' }}>
                            +{calculatePoints(playerAnswer.time, songDuration)} pts
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: '1.1rem', opacity: 0.7, fontStyle: 'italic', color: '#9ca3af' }}>
                        En attente...
                      </div>
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
          </>
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
