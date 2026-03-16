import React from 'react';

export default function GameEndScreen({
  scores,
  playMode,
  leaderboard,
  playlistLength,
  tracksPlayed,
  onNewGame
}) {
  const COLORS = {
    bg: 'linear-gradient(145deg, #0b1220 0%, #0f2444 50%, #0b1220 100%)',
    surface: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.1)',
    accent: '#fbbf24',
    success: '#22c55e',
    danger: '#ef4444',
    info: '#3b82f6',
  };

  const getWinner = () => {
    if (playMode === 'team') {
      if (scores.team1 > scores.team2) return { label: '🏆 Équipe 1 gagne !', color: COLORS.danger };
      if (scores.team2 > scores.team1) return { label: '🏆 Équipe 2 gagne !', color: COLORS.info };
      return { label: '🤝 Égalité !', color: COLORS.accent };
    }
    if (playMode === 'quiz' && leaderboard?.length > 0) {
      return { label: `🏆 ${leaderboard[0].playerName} gagne !`, color: COLORS.accent };
    }
    return { label: '🏁 Partie terminée !', color: COLORS.accent };
  };

  const winner = getWinner();
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ maxWidth: '600px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Titre */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏁</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: winner.color, margin: 0 }}>
            {winner.label}
          </h1>
          <div style={{ fontSize: '0.9rem', opacity: 0.5, marginTop: '0.5rem' }}>
            {tracksPlayed} chanson{tracksPlayed > 1 ? 's' : ''} jouée{tracksPlayed > 1 ? 's' : ''} sur {playlistLength}
          </div>
        </div>

        {/* Scores Mode Équipe */}
        {playMode === 'team' && (
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.5rem', display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', background: 'rgba(239,68,68,0.1)', borderRadius: '0.75rem', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.5rem' }}>Équipe 1</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: COLORS.danger }}>{scores.team1}</div>
              {scores.team1 > scores.team2 && <div style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>🏆</div>}
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', background: 'rgba(59,130,246,0.1)', borderRadius: '0.75rem', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.5rem' }}>Équipe 2</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: COLORS.info }}>{scores.team2}</div>
              {scores.team2 > scores.team1 && <div style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>🏆</div>}
            </div>
          </div>
        )}

        {/* Classement Mode Quiz */}
        {playMode === 'quiz' && leaderboard?.length > 0 && (
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Classement final</div>
            {leaderboard.slice(0, 10).map((player, i) => (
              <div key={player.playerId} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: i === 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', border: i === 0 ? '1px solid rgba(251,191,36,0.3)' : '1px solid transparent' }}>
                <span style={{ fontSize: '1.25rem', minWidth: '2rem' }}>{medals[i] || `${i + 1}.`}</span>
                <span style={{ flex: 1, fontWeight: i === 0 ? 600 : 400 }}>{player.playerName}</span>
                <span style={{ fontFamily: 'monospace', color: i === 0 ? COLORS.accent : 'white', fontWeight: 600 }}>{player.totalPoints} pts</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{player.correctAnswers} ✓</span>
              </div>
            ))}
          </div>
        )}

        {/* Bouton Nouvelle partie */}
        <button
          onClick={onNewGame}
          style={{
            padding: '1rem 2rem',
            background: COLORS.success,
            border: 'none',
            borderRadius: '0.75rem',
            color: 'white',
            fontSize: '1.1rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            alignSelf: 'center'
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          🎮 Nouvelle partie
        </button>

      </div>
    </div>
  );
}
