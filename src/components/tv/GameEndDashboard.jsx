import React from 'react';

const COLORS = {
  bg: 'linear-gradient(145deg, #0b1220 0%, #0f2444 50%, #0b1220 100%)',
  surface: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.1)',
  accent: '#fbbf24',
  playerColors: ['#639922', '#378ADD', '#BA7517', '#E24B4A', '#1D9E75', '#D85A30', '#9333ea', '#06b6d4']
};

const medals = ['🥇', '🥈', '🥉'];

function getInitials(name) {
  return (name || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Tableau de bord fin de partie Quiz — affiché sur l'écran TV
 * Reçoit les données en props depuis TV.jsx (déjà en mémoire)
 * car Firebase bloque la lecture après active=false
 */
export default function GameEndDashboard({
  leaderboard = [],
  tracksPlayed = 0,
  totalTracks = 0,
  playerCount = 0
}) {
  if (leaderboard.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', opacity: 0.7 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <div>Aucun joueur n'a répondu</div>
        </div>
      </div>
    );
  }

  const maxScore = leaderboard[0]?.totalPoints || 1;
  const totalCorrect = leaderboard.reduce((s, p) => s + (p.correctAnswers || 0), 0);
  const totalAnswers = leaderboard.reduce((s, p) => s + (p.totalAnswers || p.correctAnswers || 0), 0);
  const globalAccuracy = totalAnswers > 0 ? Math.round(totalCorrect / totalAnswers * 100) : 0;

  const Bar = ({ value, max, color, label, suffix }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <div style={{ width: '90px', fontSize: '12px', opacity: 0.6, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, (value / (max || 1)) * 100)}%`, background: color, height: '100%', borderRadius: '4px', transition: 'width 0.8s ease' }} />
      </div>
      <div style={{ width: '60px', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}{suffix || ''}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, color: 'white', padding: '2rem 3rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 700, color: COLORS.accent, margin: 0 }}>🏁 Partie terminée</h1>
          <div style={{ fontSize: '1.5rem', opacity: 0.7, marginTop: '0.5rem' }}>
            🏆 {leaderboard[0].playerName} remporte la partie !
          </div>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'Chansons jouées', value: tracksPlayed || totalTracks, icon: '🎵' },
            { label: 'Joueurs', value: playerCount || leaderboard.length, icon: '👥' },
            { label: 'Taux de réussite', value: `${globalAccuracy}%`, icon: '🎯' },
            { label: 'Total points', value: leaderboard.reduce((s, p) => s + p.totalPoints, 0), icon: '⭐' },
          ].map((kpi, i) => (
            <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{kpi.icon}</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: COLORS.accent }}>{kpi.value}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Classement */}
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.5rem' }}>
          <div style={{ fontSize: '1rem', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Classement final</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leaderboard.map((player, i) => {
              const color = COLORS.playerColors[i % COLORS.playerColors.length];
              return (
                <div key={player.playerName || i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px', background: i === 0 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: i === 0 ? '1px solid rgba(251,191,36,0.25)' : '1px solid transparent' }}>
                  <span style={{ fontSize: '2rem', minWidth: '2.5rem', textAlign: 'center' }}>{medals[i] || `${i + 1}.`}</span>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, flexShrink: 0 }}>{getInitials(player.playerName)}</div>
                  <div style={{ minWidth: '120px' }}>
                    <div style={{ fontWeight: 600, fontSize: '1.15rem' }}>{player.playerName}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{player.correctAnswers || 0} bonne{(player.correctAnswers || 0) > 1 ? 's' : ''} réponse{(player.correctAnswers || 0) > 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ flex: 1, padding: '0 16px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '6px', height: '16px', overflow: 'hidden' }}>
                      <div style={{ width: `${(player.totalPoints / maxScore) * 100}%`, background: color, height: '100%', borderRadius: '6px', transition: 'width 1s ease' }} />
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.35rem', color: i === 0 ? COLORS.accent : 'white', minWidth: '90px', textAlign: 'right' }}>{player.totalPoints} pts</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Graphiques 2 colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* Scores */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ fontSize: '1rem', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>⭐ Points totaux</div>
            {leaderboard.map((p, i) => (
              <Bar key={p.playerName} label={p.playerName} value={p.totalPoints} max={maxScore} color={COLORS.playerColors[i % COLORS.playerColors.length]} suffix=" pts" />
            ))}
          </div>

          {/* Bonnes réponses */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ fontSize: '1rem', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>🎯 Bonnes réponses</div>
            {leaderboard.map((p, i) => (
              <Bar key={p.playerName} label={p.playerName} value={p.correctAnswers || 0} max={Math.max(...leaderboard.map(x => x.correctAnswers || 0), 1)} color={COLORS.playerColors[i % COLORS.playerColors.length]} suffix={` / ${tracksPlayed || totalTracks}`} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
