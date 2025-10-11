import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, Upload } from 'lucide-react';
import { database } from './firebase';
import { ref, onValue, remove } from 'firebase/database';

export default function BlindTestMaster() {
  const [playlist, setPlaylist] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [buzzedTeam, setBuzzedTeam] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const audioRef = useRef(null);

  // Écouter les buzz via Firebase
  useEffect(() => {
    const buzzRef = ref(database, 'buzz');
    
    const unsubscribe = onValue(buzzRef, (snapshot) => {
      const buzzData = snapshot.val();
      if (buzzData && isPlaying) {
        setBuzzedTeam(buzzData.team);
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        setDebugInfo(`🔔 ${buzzData.team === 'team1' ? 'ÉQUIPE 1' : 'ÉQUIPE 2'} a buzzé !`);
        
        // Nettoyer le buzz après traitement
        remove(buzzRef);
      }
    });

    return () => unsubscribe();
  }, [isPlaying]);

  const handleManualAdd = () => {
    const newTrack = {
      title: 'En attente de fichier...',
      artist: '',
      audioUrl: null,
      revealed: false
    };
    setPlaylist([...playlist, newTrack]);
  };

  const handleAudioForTrack = (index, file) => {
    setDebugInfo(`Chargement de ${file.name}...`);
    
    // Parser le nom du fichier pour extraire artiste et titre
    // Format attendu: "Artiste - Titre.mp3"
    const fileName = file.name.replace(/\.(mp3|wav|ogg|m4a)$/i, '');
    let title = fileName;
    let artist = '';
    
    if (fileName.includes(' - ')) {
      const parts = fileName.split(' - ');
      artist = parts[0].trim();
      title = parts[1].trim();
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const updatedPlaylist = [...playlist];
      updatedPlaylist[index].audioUrl = e.target.result;
      updatedPlaylist[index].fileName = file.name;
      updatedPlaylist[index].title = title;
      updatedPlaylist[index].artist = artist;
      setPlaylist(updatedPlaylist);
      setDebugInfo(`✓ ${file.name} chargé (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    };
    reader.onerror = () => {
      setDebugInfo(`❌ Erreur lecture fichier ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const togglePlay = () => {
    const track = playlist[currentTrack];
    if (!track?.audioUrl) {
      setDebugInfo('❌ Pas d\'URL audio');
      return;
    }

    if (!audioRef.current) {
      setDebugInfo('❌ Référence audio manquante');
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setDebugInfo('⏸️ Pause');
    } else {
      setDebugInfo('▶️ Tentative de lecture...');
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setDebugInfo('✓ Lecture en cours');
        })
        .catch(error => {
          setDebugInfo('❌ Erreur: ' + error.message);
          console.error('Erreur play:', error);
        });
    }
    setBuzzedTeam(null);
  };

  const nextTrack = () => {
    if (currentTrack < playlist.length - 1) {
      if (audioRef.current) audioRef.current.pause();
      setCurrentTrack(currentTrack + 1);
      setIsPlaying(false);
      setBuzzedTeam(null);
    }
  };

  const prevTrack = () => {
    if (currentTrack > 0) {
      if (audioRef.current) audioRef.current.pause();
      setCurrentTrack(currentTrack - 1);
      setIsPlaying(false);
      setBuzzedTeam(null);
    }
  };

  const revealAnswer = () => {
    const updatedPlaylist = [...playlist];
    updatedPlaylist[currentTrack].revealed = true;
    setPlaylist(updatedPlaylist);
  };

  const addPoint = (team) => {
    setScores({ ...scores, [team]: scores[team] + 1 });
    setBuzzedTeam(null);
  };

  const simulateBuzz = (team) => {
    if (isPlaying) {
      setBuzzedTeam(team);
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const currentSong = playlist[currentTrack];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-6 text-yellow-300">
          🎵 BLIND TEST 🎵
        </h1>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`bg-red-600 rounded-xl p-4 text-center transition ${buzzedTeam === 'team1' ? 'ring-4 ring-yellow-400' : ''}`}>
            <h2 className="text-xl font-bold mb-2">ÉQUIPE 1</h2>
            <div className="text-5xl font-bold mb-2">{scores.team1}</div>
            {buzzedTeam === 'team1' ? (
              <button 
                onClick={() => addPoint('team1')}
                className="bg-green-500 px-4 py-2 rounded-lg font-bold hover:bg-green-600"
              >
                + 1 Point
              </button>
            ) : (
              <button 
                onClick={() => simulateBuzz('team1')}
                className="bg-white/20 px-4 py-2 rounded-lg text-sm hover:bg-white/30"
              >
                Tester Buzz
              </button>
            )}
          </div>
          
          <div className={`bg-blue-600 rounded-xl p-4 text-center transition ${buzzedTeam === 'team2' ? 'ring-4 ring-yellow-400' : ''}`}>
            <h2 className="text-xl font-bold mb-2">ÉQUIPE 2</h2>
            <div className="text-5xl font-bold mb-2">{scores.team2}</div>
            {buzzedTeam === 'team2' ? (
              <button 
                onClick={() => addPoint('team2')}
                className="bg-green-500 px-4 py-2 rounded-lg font-bold hover:bg-green-600"
              >
                + 1 Point
              </button>
            ) : (
              <button 
                onClick={() => simulateBuzz('team2')}
                className="bg-white/20 px-4 py-2 rounded-lg text-sm hover:bg-white/30"
              >
                Tester Buzz
              </button>
            )}
          </div>
        </div>

        <button 
          onClick={() => setScores({ team1: 0, team2: 0 })}
          className="mb-4 bg-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-600"
        >
          Reset Scores
        </button>

        {/* Ajouter des morceaux */}
        {playlist.length === 0 && (
          <div className="bg-white/10 rounded-xl p-6 mb-6 text-center">
            <h3 className="text-xl font-bold mb-3">Créer la playlist</h3>
            <button
              onClick={handleManualAdd}
              className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-bold"
            >
              + Ajouter un morceau
            </button>
          </div>
        )}

        {/* Player */}
        {playlist.length > 0 && currentSong && (
          <div className="bg-white/10 rounded-xl p-6 mb-6">
            <div className="mb-4">
              <h3 className="text-xl font-bold mb-2">
                Morceau {currentTrack + 1} / {playlist.length}
              </h3>
              {currentSong.revealed ? (
                <div className="bg-green-500/30 p-3 rounded-lg">
                  <div className="font-bold text-xl">{currentSong.title}</div>
                  {currentSong.artist && (
                    <div className="opacity-80">{currentSong.artist}</div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 text-lg">🎵 Mystère...</div>
              )}
              
              {!currentSong.audioUrl && (
                <div className="mt-3">
                  <label className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg cursor-pointer inline-flex items-center gap-2">
                    <Upload size={16} />
                    Charger le MP3
                    <input 
                      type="file" 
                      accept="audio/*"
                      onChange={(e) => e.target.files[0] && handleAudioForTrack(currentTrack, e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            <audio 
              ref={audioRef}
              src={currentSong.audioUrl || ''}
              onEnded={() => setIsPlaying(false)}
              onLoadedData={() => setDebugInfo('✓ Audio chargé et prêt')}
              onLoadedMetadata={() => setDebugInfo('✓ Métadonnées chargées')}
              onCanPlay={() => setDebugInfo('✓ Peut être lu')}
              onError={(e) => {
                const audio = e.target;
                let errorMsg = '❌ Erreur: ';
                if (audio.error) {
                  switch(audio.error.code) {
                    case 1: errorMsg += 'Chargement abandonné'; break;
                    case 2: errorMsg += 'Erreur réseau'; break;
                    case 3: errorMsg += 'Format non supporté'; break;
                    case 4: errorMsg += 'Source non disponible'; break;
                    default: errorMsg += 'Erreur inconnue';
                  }
                }
                setDebugInfo(errorMsg);
                console.error('Audio error:', audio.error);
              }}
              preload="auto"
              controls
              className="w-full mb-3"
            />

            {debugInfo && (
              <div className="mb-3 text-center text-sm bg-black/30 p-2 rounded">
                {debugInfo}
              </div>
            )}

            <div className="flex gap-3 justify-center items-center">
              <button
                onClick={prevTrack}
                disabled={currentTrack === 0}
                className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:opacity-50 p-3 rounded-full"
              >
                <SkipForward size={20} className="rotate-180" />
              </button>

              <button
                onClick={togglePlay}
                disabled={!currentSong.audioUrl}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 p-5 rounded-full"
              >
                {isPlaying ? <Pause size={28} /> : <Play size={28} />}
              </button>
              
              <button
                onClick={nextTrack}
                disabled={currentTrack >= playlist.length - 1}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-800 disabled:opacity-50 p-3 rounded-full"
              >
                <SkipForward size={20} />
              </button>

              <button
                onClick={revealAnswer}
                disabled={currentSong.revealed}
                className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-500 px-5 py-3 rounded-lg font-bold"
              >
                Révéler
              </button>
            </div>
          </div>
        )}

        {/* Liste */}
        {playlist.length > 0 && (
          <div className="bg-white/10 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Playlist ({playlist.length})</h3>
              <button
                onClick={handleManualAdd}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-bold"
              >
                + Ajouter
              </button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {playlist.map((track, index) => (
                <div 
                  key={index}
                  className={`bg-white/5 p-3 rounded-lg flex justify-between items-center ${index === currentTrack ? 'ring-2 ring-yellow-400' : ''}`}
                >
                  <div className="flex-1">
                    <div className="font-bold">
                      {index + 1}. {track.revealed ? track.title : '???'}
                    </div>
                    {track.revealed && track.artist && (
                      <div className="text-sm opacity-70">{track.artist}</div>
                    )}
                    <div className={`text-xs ${track.audioUrl ? 'text-green-400' : 'text-red-400'}`}>
                      {track.audioUrl ? '✓ Audio chargé' : '⚠️ Pas d\'audio'}
                    </div>
                  </div>
                  {!track.audioUrl && (
                    <label className="bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded cursor-pointer text-sm">
                      MP3
                      <input 
                        type="file" 
                        accept="audio/*"
                        onChange={(e) => e.target.files[0] && handleAudioForTrack(index, e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
