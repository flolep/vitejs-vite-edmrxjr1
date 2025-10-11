import React, { useState } from 'react';
import Master from './Master';
import Buzzer from './Buzzer';
import TV from './TV';

export default function App() {
  const [page, setPage] = useState('home');

  if (page === 'master') return <Master />;
  if (page === 'buzzer') return <Buzzer />;
  if (page === 'tv') return <TV />;

  return (
    <div className="bg-gradient flex-center">
      <div className="text-center" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
        <h1 className="title">🎵 BLIND TEST 🎵</h1>
        <div className="space-y">
          <button onClick={() => setPage('master')} className="btn btn-yellow" style={{ width: '100%', padding: '1.5rem', fontSize: '1.5rem' }}>
            🎮 ANIMATEUR
          </button>
          <button onClick={() => setPage('buzzer')} className="btn btn-green" style={{ width: '100%', padding: '1.5rem', fontSize: '1.5rem' }}>
            📱 JOUEUR
          </button>
          <button onClick={() => setPage('tv')} className="btn btn-purple" style={{ width: '100%', padding: '1.5rem', fontSize: '1.5rem' }}>
            📺 ÉCRAN TV
          </button>
        </div>
      </div>
    </div>
  );
}