import React, { useState, useEffect, useRef } from 'react';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';

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

export default function GameEndDashboard({ sessionId, playMode }) {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [playlist, setPlaylist] = useState([]);
  const [totalTracksPlayed, setTotalTracksPlayed] = useState(0);
  const [gameTimestamp, setGameTimestamp] = useState(null);
  const chartRefs = useRef({});

  useEffect(() => {
    if (!sessionId) return;

    const loadData = async () => {
      try {
        const [lbSnap, qaSnap, plSnap, ctSnap, gsSnap] = await Promise.all([
          get(ref(database, `sessions/${sessionId}/quiz_leaderboard`)),
          get(ref(database, `sessions/${sessionId}/quiz_answers`)),
          get(ref(database, `sessions/${sessionId}/playlist`)),
          get(ref(database, `sessions/${sessionId}/currentTrackNumber`)),
          get(ref(database, `sessions/${sessionId}/game_status`))
        ]);

        const lb = lbSnap.val() || {};
        setLeaderboard(Object.values(lb).sort((a, b) => b.totalPoints - a.totalPoints));
        setQuizAnswers(qaSnap.val() || {});
        setPlaylist(plSnap.val() || []);
        setTotalTracksPlayed(ctSnap.val() || 0);
        setGameTimestamp(gsSnap.val()?.timestamp || null);
      } catch (e) {
        console.error('❌ Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>⏳</div>
          <div style={{ fontSize: '1.2rem', opacity: 0.7 }}>Chargement du tableau de bord...</div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', opacity: 0.7 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <div>Données insuffisantes pour le tableau de bord</div>
        </div>
      </div>
    );
  }

  // === CALCULS ===
  const maxScore = leaderboard[0]?.totalPoints || 1;

  // Stats par joueur depuis quiz_answers
  const playerStats = {};
  let fastestBuzz = null;
  let fastestBuzzTrack = null;
  const trackResults = {};

  Object.entries(quizAnswers).forEach(([trackNum, answers]) => {
    const trackAnswers = Object.entries(answers || {});
    let correctCount = 0;
    trackAnswers.forEach(([playerId, answer]) => {
      if (!playerStats[playerId]) {
        playerStats[playerId] = { times: [], correct: 0, total: 0, playerName: answer.playerName };
      }
      playerStats[playerId].times.push(answer.time || 0);
      playerStats[playerId].total += 1;
      if (answer.isCorrect) {
        playerStats[playerId].correct += 1;
        correctCount += 1;
      }
      if (answer.time && (!fastestBuzz || answer.time < fastestBuzz.time)) {
        fastestBuzz = { time: answer.time, playerName: answer.playerName, playerId };
        fastestBuzzTrack = parseInt(trackNum);
      }
    });
    trackResults[trackNum] = { total: trackAnswers.length, correct: correctCount };
  });

  // Buzz moyen par joueur
  const avgBuzzByPlayer = leaderboard.map(p => {
    const stats = Object.entries(playerStats).find(([, s]) => s.playerName === p.playerName);
    const times = stats ? stats[1].times : [];
    return { name: p.playerName, avg: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0 };
  });

  // Précision par joueur
  const accuracyByPlayer = leaderboard.map(p => {
    const stats = Object.entries(playerStats).find(([, s]) => s.playerName === p.playerName);
    if (!stats) return { name: p.playerName, pct: 0 };
    return { name: p.playerName, pct: stats[1].total > 0 ? Math.round(stats[1].correct / stats[1].total * 100) : 0 };
  });

  // Taux de réussite global
  const totalCorrect = Object.values(playerStats).reduce((s, p) => s + p.correct, 0);
  const totalAnswers = Object.values(playerStats).reduce((s, p) => s + p.total, 0);
  const globalAccuracy = totalAnswers > 0 ? Math.round(totalCorrect / totalAnswers * 100) : 0;

  // Chanson la plus difficile
  let hardestTrack = null;
  let hardestRate = 101;
  Object.entries(trackResults).forEach(([trackNum, r]) => {
    const rate = r.total > 0 ? r.correct / r.total * 100 : 100;
    if (rate < hardestRate) {
      hardestRate = rate;
      hardestTrack = parseInt(trackNum);
    }
  });

  // Meilleure série consécutive
  let bestStreak = { count: 0, playerName: '' };
  Object.entries(playerStats).forEach(([, stats]) => {
    // Reconstruct from quiz_answers order
    let currentStreak = 0;
    let maxStreak = 0;
    Object.keys(quizAnswers).sort((a, b) => parseInt(a) - parseInt(b)).forEach(trackNum => {
      const answer = Object.values(quizAnswers[trackNum] || {}).find(a => a.playerName === stats.playerName);
      if (answer?.isCorrect) {
        currentStreak += 1;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });
    if (maxStreak > bestStreak.count) {
      bestStreak = { count: maxStreak, playerName: stats.playerName };
    }
  });

  // Score cumulatif par chanson (pour line chart)
  const cumulativeScores = {};
  leaderboard.forEach(p => { cumulativeScores[p.playerName] = []; });
  const trackNumbers = Object.keys(quizAnswers).sort((a, b) => parseInt(a) - parseInt(b));

  trackNumbers.forEach(trackNum => {
    const answers = quizAnswers[trackNum] || {};
    leaderboard.forEach(p => {
      const prev = cumulativeScores[p.playerName].length > 0
        ? cumulativeScores[p.playerName][cumulativeScores[p.playerName].length - 1]
        : 0;
      const answer = Object.values(answers).find(a => a.playerName === p.playerName);
      cumulativeScores[p.playerName].push(prev + (answer?.points || 0));
    });
  });

  // Barres de progression inline (pas besoin de Chart.js)
  const Bar = ({ value, max, color, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <div style={{ width: '80px', fontSize: '11px', opacity: 0.6, textAlign: 'right', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '18px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(2, (value / (max || 1)) * 100)}%`, background: color, height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ width: '50px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, color: 'white', padding: '2rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: COLORS.accent, margin: 0 }}>🏁 Partie terminée</h1>
          <div style={{ fontSize: '1.2rem', opacity: 0.5, marginTop: '0.5rem' }}>
            {leaderboard[0] && `🏆 ${leaderboard[0].playerName} remporte la partie !`}
          </div>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'Chansons jouées', value: totalTracksPlayed, icon: '🎵' },
            { label: 'Joueurs', value: leaderboard.length, icon: '👥' },
            { label: 'Taux de réussite', value: `${globalAccuracy}%`, icon: '🎯' },
            { label: 'Buzz le plus rapide', value: fastestBuzz ? `${fastestBuzz.time.toFixed(1)}s` : '—', icon: '⚡' },
          ].map((kpi, i) => (
            <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{kpi.icon}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: COLORS.accent }}>{kpi.value}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Classement */}
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Classement final</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {leaderboard.map((player, i) => {
              const color = COLORS.playerColors[i % COLORS.playerColors.length];
              const stats = accuracyByPlayer.find(a => a.name === player.playerName);
              const buzz = avgBuzzByPlayer.find(a => a.name === player.playerName);
              return (
                <div key={player.playerName} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: i === 0 ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', border: i === 0 ? '1px solid rgba(251,191,36,0.25)' : '1px solid transparent' }}>
                  <span style={{ fontSize: '1.5rem', minWidth: '2rem', textAlign: 'center' }}>{medals[i] || `${i + 1}.`}</span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>{getInitials(player.playerName)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{player.playerName}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{stats?.pct || 0}% correct · {buzz?.avg ? buzz.avg.toFixed(1) + 's moy.' : ''}</div>
                  </div>
                  <div style={{ flex: 2, padding: '0 12px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '12px', overflow: 'hidden' }}>
                      <div style={{ width: `${(player.totalPoints / maxScore) * 100}%`, background: color, height: '100%', borderRadius: '4px', transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', color: i === 0 ? COLORS.accent : 'white', minWidth: '70px', textAlign: 'right' }}>{player.totalPoints} pts</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.5, minWidth: '30px', textAlign: 'right' }}>{player.correctAnswers} ✓</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Graphiques 2 colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* Rapidité */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>⚡ Rapidité moyenne</div>
            {avgBuzzByPlayer.map((p, i) => (
              <Bar key={p.name} label={p.name} value={p.avg} max={Math.max(...avgBuzzByPlayer.map(x => x.avg))} color={COLORS.playerColors[i % COLORS.playerColors.length]} />
            ))}
          </div>

          {/* Précision */}
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>🎯 Précision</div>
            {accuracyByPlayer.map((p, i) => (
              <Bar key={p.name} label={p.name} value={p.pct} max={100} color={COLORS.playerColors[i % COLORS.playerColors.length]} />
            ))}
          </div>
        </div>

        {/* Évolution des scores */}
        {trackNumbers.length > 1 && (
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>📈 Évolution des scores</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px' }}>
              {trackNumbers.map((tn, ti) => {
                const maxAtTrack = Math.max(...leaderboard.map(p => cumulativeScores[p.playerName]?.[ti] || 0), 1);
                return (
                  <div key={tn} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', height: '100%', justifyContent: 'flex-end' }}>
                    {leaderboard.slice(0, 4).map((p, pi) => {
                      const val = cumulativeScores[p.playerName]?.[ti] || 0;
                      const finalMax = Math.max(...leaderboard.map(pl => cumulativeScores[pl.playerName]?.[trackNumbers.length - 1] || 0), 1);
                      return (
                        <div key={p.playerName} style={{ width: '100%', height: `${(val / finalMax) * 100}%`, background: COLORS.playerColors[pi], borderRadius: '2px 2px 0 0', minHeight: '1px', opacity: 0.7 }} />
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {leaderboard.slice(0, 4).map((p, i) => (
                <div key={p.playerName} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: COLORS.playerColors[i] }} />
                  {p.playerName}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Records */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.45, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Buzz le plus rapide</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: COLORS.accent }}>{fastestBuzz ? `${fastestBuzz.time.toFixed(1)}s` : '—'}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.25rem' }}>{fastestBuzz?.playerName || ''}</div>
            {fastestBuzzTrack && playlist[fastestBuzzTrack - 1] && (
              <div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '0.25rem' }}>
                {playlist[fastestBuzzTrack - 1]?.artist} - {playlist[fastestBuzzTrack - 1]?.title}
              </div>
            )}
          </div>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔥</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.45, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Meilleure série</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: COLORS.accent }}>{bestStreak.count > 0 ? `${bestStreak.count} d'affilée` : '—'}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.25rem' }}>{bestStreak.playerName}</div>
          </div>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💀</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.45, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Chanson la plus difficile</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: COLORS.accent }}>{hardestTrack ? `${Math.round(hardestRate)}%` : '—'}</div>
            {hardestTrack && playlist[hardestTrack - 1] && (
              <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.25rem' }}>
                {playlist[hardestTrack - 1]?.artist} - {playlist[hardestTrack - 1]?.title}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
