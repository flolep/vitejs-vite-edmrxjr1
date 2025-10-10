import React, { useState } from 'react';
import Master from './Master.jsx';
import Buzzer from './Buzzer.jsx';

export default function App() {
  const [page, setPage] = useState('home');

  if (page === 'master') return <Master />;
  if (page === 'buzzer') return <Buzzer />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-5xl font-bold mb-8">🎵 BLIND TEST 🎵</h1>
        <div className="space-y-4">
          <button
            onClick={() => setPage('master')}
            className="w-full bg-yellow-600 hover:bg-yellow-700 py-6 rounded-2xl text-2xl font-bold"
          >
            🎮 ANIMATEUR
          </button>
          <button
            onClick={() => setPage('buzzer')}
            className="w-full bg-green-600 hover:bg-green-700 py-6 rounded-2xl text-2xl font-bold"
          >
            📱 JOUEUR
          </button>
        </div>
      </div>
    </div>
  );
}