import React from 'react';

export default function ScoreDisplay({ scores, buzzedTeam }) {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: '1rem', 
      marginBottom: '2rem' 
    }}>
      {/* Équipe 1 */}
      <div style={{
        backgroundColor: buzzedTeam === 'team1' ? 'rgba(220, 38, 38, 0.3)' : 'rgba(220, 38, 38, 0.2)',
        borderRadius: '1rem',
        padding: '1.5rem',
        textAlign: 'center',
        transition: 'background-color 0.3s'
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          🔴 ÉQUIPE 1
        </h2>
        <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>
          {scores.team1}
        </div>
      </div>
      
      {/* Équipe 2 */}
      <div style={{
        backgroundColor: buzzedTeam === 'team2' ? 'rgba(37, 99, 235, 0.3)' : 'rgba(37, 99, 235, 0.2)',
        borderRadius: '1rem',
        padding: '1.5rem',
        textAlign: 'center',
        transition: 'background-color 0.3s'
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          🔵 ÉQUIPE 2
        </h2>
        <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>
          {scores.team2}
        </div>
      </div>
    </div>
  );
}