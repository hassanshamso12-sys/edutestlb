import React, { useState, useEffect, useRef } from 'react';
import { Play, ArrowRight, Home, Users, HelpCircle, Award, Volume2, VolumeX, Crown, CheckCircle2, Trophy, BarChart3 } from 'lucide-react';
import { audio } from '../utils/audio';

export default function TeacherHost({ socket, quizId, teacherToken, onExit }) {
  const [pin, setPin] = useState('');
  const [title, setTitle] = useState('');
  const [gameState, setGameState] = useState('INIT'); // INIT, LOBBY, COUNTDOWN, IN_PROGRESS, FINISHED
  const [players, setPlayers] = useState([]); // Lobby list
  const [playersProgress, setPlayersProgress] = useState([]); // Live tracker details
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [allFinished, setAllFinished] = useState(false);
  const [podium, setPodium] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const countdownRef = useRef(3);
  const [countdownText, setCountdownText] = useState('3');

  useEffect(() => {
    // 1. Host registers exam room
    socket.emit('host-game', { quizId, token: teacherToken });

    socket.on('game-created', ({ pin, title }) => {
      setPin(pin);
      setTitle(title);
      setGameState('LOBBY');
      if (soundEnabled) {
        audio.startLobbyMusic();
      }
    });

    socket.on('error-msg', ({ message }) => {
      alert('Lobby error: ' + message);
      onExit();
    });

    socket.on('player-list-update', (playerNames) => {
      setPlayers(playerNames);
    });

    socket.on('game-starting', () => {
      audio.stopLobbyMusic();
      setGameState('COUNTDOWN');
      countdownRef.current = 3;
      setCountdownText('3');

      const countInterval = setInterval(() => {
        countdownRef.current--;
        if (countdownRef.current === 0) {
          setCountdownText('Go!');
        } else if (countdownRef.current < 0) {
          clearInterval(countInterval);
        } else {
          setCountdownText(countdownRef.current.toString());
        }
      }, 1000);
    });

    socket.on('host-game-started', () => {
      setGameState('IN_PROGRESS');
    });

    // Handle real-time player progression updates
    socket.on('host-progress-update', ({ players, totalQuestions }) => {
      setPlayersProgress(players);
      setTotalQuestions(totalQuestions);
    });

    socket.on('all-players-finished', () => {
      setAllFinished(true);
    });

    socket.on('game-over', ({ podium }) => {
      setPodium(podium);
      setGameState('FINISHED');
      audio.playVictory();
      triggerConfetti();
    });

    return () => {
      socket.off('game-created');
      socket.off('error-msg');
      socket.off('player-list-update');
      socket.off('game-starting');
      socket.off('host-game-started');
      socket.off('host-progress-update');
      socket.off('all-players-finished');
      socket.off('game-over');
      audio.stopLobbyMusic();
    };
  }, [socket, quizId, teacherToken]);

  const toggleSound = () => {
    if (soundEnabled) {
      audio.stopLobbyMusic();
      setSoundEnabled(false);
    } else {
      setSoundEnabled(true);
      if (gameState === 'LOBBY') {
        audio.startLobbyMusic();
      }
    }
  };

  const handleStartGame = () => {
    socket.emit('start-game', { pin });
  };

  const handleEndGame = () => {
    socket.emit('end-game-early', { pin });
  };

  const triggerConfetti = () => {
    const canvas = document.getElementById('confetti');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#f43f5e', '#0ea5e9', '#f59e0b', '#10b981', '#6366f1', '#d946ef'];
    const particles = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        r: Math.random() * 6 + 4,
        d: Math.random() * canvas.height,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
        tiltAngle: 0
      });
    }

    let animationFrameId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, index) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.x += Math.sin(p.tiltAngle);
        p.tilt = Math.sin(p.tiltAngle - index / 3) * 15;

        if (p.y > canvas.height) {
          particles[index] = {
            x: Math.random() * canvas.width,
            y: -20,
            r: p.r,
            d: p.d,
            color: p.color,
            tilt: p.tilt,
            tiltAngleIncremental: p.tiltAngleIncremental,
            tiltAngle: p.tiltAngle
          };
        }

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
      });
      animationFrameId = requestAnimationFrame(draw);
    }
    draw();

    setTimeout(() => {
      cancelAnimationFrame(animationFrameId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 6000);
  };

  // 1. Initializing
  if (gameState === 'INIT') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="animate-pulse" style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>
          Preparing your live exam lobby...
        </div>
      </div>
    );
  }

  // 2. Lobby View
  if (gameState === 'LOBBY') {
    return (
      <div className="app-container" style={{ minHeight: '95vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div className="host-lobby-header">
          <div>
            <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em' }}>Hosting Session</span>
            <h1 style={{ fontSize: '1.8rem', marginTop: '0.2rem' }}>{title}</h1>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={toggleSound}>
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button className="btn btn-secondary" onClick={onExit}>
              Cancel Exam
            </button>
          </div>
        </div>

        <div className="glass animate-pulse-glow" style={{ padding: '2.5rem', margin: '2rem 0', textAlign: 'center', background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
          <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
            Students, join at <strong style={{ color: 'white' }}>localhost:5173</strong>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Enter the Game PIN shown below
          </div>
          <div style={{ fontSize: '4.5rem', fontWeight: 900, letterSpacing: '0.15em', fontFamily: 'var(--font-heading)', color: 'white', background: 'rgba(0,0,0,0.3)', display: 'inline-block', padding: '0.5rem 2.5rem', borderRadius: '12px' }}>
            {pin}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Users size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.3rem' }}>
              Joined Students ({players.length})
            </h2>
          </div>

          {players.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }} className="animate-pulse">
              Waiting for students to join with PIN...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
              {players.map((name, idx) => (
                <div key={idx} className="lobby-nickname">
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-primary animate-pulse-glow" 
            style={{ padding: '1rem 3rem', fontSize: '1.2rem', opacity: players.length === 0 ? 0.7 : 1 }} 
            onClick={handleStartGame}
          >
            <Play size={20} fill="white" /> Start Exam
          </button>
        </div>
      </div>
    );
  }

  // 3. Countdown Screen
  if (gameState === 'COUNTDOWN') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
        <h2 style={{ fontSize: '2rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Get Ready for</h2>
        <h1 style={{ fontSize: '3.5rem', textAlign: 'center', maxWidth: '600px', marginBottom: '3rem', fontFamily: 'var(--font-heading)' }}>
          {title}
        </h1>
        <div style={{ fontSize: '6rem', fontWeight: 900, color: 'var(--primary)' }} className="animate-pulse">
          {countdownText}
        </div>
      </div>
    );
  }

  // 4. Exam Live Progress Monitor
  if (gameState === 'IN_PROGRESS') {
    const finishedCount = playersProgress.filter(p => p.finished).length;
    const totalCount = playersProgress.length;

    return (
      <div className="app-container" style={{ minHeight: '95vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Header */}
        <div className="host-active-header">
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Exam in Progress • PIN: {pin}
            </span>
            <h1 style={{ fontSize: '1.8rem', marginTop: '0.2rem' }}>{title}</h1>
          </div>
          
          <button 
            className={`btn ${allFinished ? 'btn-primary animate-pulse-glow' : 'btn-secondary'}`}
            style={{ padding: '0.9rem 2rem', border: allFinished ? 'none' : '1px solid var(--border-color)' }}
            onClick={handleEndGame}
          >
            {allFinished ? 'Reveal Final Standings' : 'End Session Early'} <ArrowRight size={16} />
          </button>
        </div>

        {/* Live Grid layout */}
        <div className="host-grid" style={{ margin: '2rem 0', flex: 1 }}>
          
          {/* Student Progress List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Users size={18} style={{ color: 'var(--primary)' }} /> Student Progression List
            </h2>
            
            <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', overflowY: 'auto', maxHeight: '420px' }}>
              {playersProgress.length === 0 ? (
                <div style={{ padding: '3rem 1rem', color: 'var(--text-muted)', textAlign: 'center' }} className="animate-pulse">
                  Synchronizing student sessions...
                </div>
              ) : (
                playersProgress.map((player, idx) => {
                  const progressPercentage = totalQuestions > 0 
                    ? ((player.currentQuestionIndex + (player.answerSubmitted ? 1 : 0)) / totalQuestions) * 100 
                    : 0;

                  return (
                    <div 
                      key={idx} 
                      className="glass" 
                      style={{ 
                        padding: '1rem 1.5rem', 
                        background: 'rgba(0,0,0,0.15)', 
                        borderColor: player.finished ? 'var(--color-green)' : 'var(--border-color)',
                        opacity: player.finished ? 0.85 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{player.nickname}</span>
                          {player.finished && (
                            <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-green)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                              Completed
                            </span>
                          )}
                          {player.streak > 1 && (
                            <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                              🔥 {player.streak}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                          {player.score} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>pts</span>
                        </span>
                      </div>

                      {/* Question Index Progress Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', flex: 1, overflow: 'hidden', position: 'relative' }}>
                          <div 
                            style={{ 
                              height: '100%', 
                              background: player.finished ? 'var(--color-green)' : 'linear-gradient(90deg, var(--primary), var(--accent))', 
                              width: `${progressPercentage}%`,
                              transition: 'width 0.5s ease-out' 
                            }}
                          ></div>
                        </div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500, minWidth: '40px', textAlign: 'right' }}>
                          {player.finished ? 'Done' : `Q${player.currentQuestionIndex + 1}/${totalQuestions}`}
                        </span>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Classroom Completion Status stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <BarChart3 size={18} style={{ color: 'var(--accent)' }} /> Classroom Activity Monitor
            </h2>
            
            <div className="glass" style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', flex: 1, justifyContent: 'center' }}>
              
              {/* Radial completion percentage tracker */}
              <div style={{ position: 'relative', width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ position: 'absolute', transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  <circle
                    cx="75"
                    cy="75"
                    r="65"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="75"
                    cy="75"
                    r="65"
                    stroke={allFinished ? 'var(--color-green)' : 'var(--primary)'}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="408.4"
                    strokeDashoffset={totalCount > 0 ? (408.4 - (408.4 * finishedCount) / totalCount) : 408.4}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-heading)' }}>
                    {totalCount > 0 ? Math.round((finishedCount / totalCount) * 100) : 0}%
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Done</span>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <span>{finishedCount}</span>
                  <span style={{ color: 'var(--text-muted)' }}>/</span>
                  <span>{totalCount}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 500, alignSelf: 'center', color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>Students Finished</span>
                </div>
                {allFinished && (
                  <p style={{ color: 'var(--color-green)', fontSize: '0.9rem', marginTop: '0.75rem', fontWeight: 600 }} className="animate-pulse">
                    🏆 All students have completed the exam!
                  </p>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Footer info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1.2rem', color: 'var(--text-muted)' }}>
          <span>Game PIN: {pin}</span>
          <span>Examify Session Monitor</span>
        </div>
      </div>
    );
  }

  // 5. Finished Podium View
  if (gameState === 'FINISHED' && podium) {
    const podiumData = [
      { name: podium.second?.nickname, score: podium.second?.score, place: 2, height: '130px' },
      { name: podium.first?.nickname, score: podium.first?.score, place: 1, height: '200px' },
      { name: podium.third?.nickname, score: podium.third?.score, place: 3, height: '90px' }
    ];

    return (
      <div className="app-container" style={{ minHeight: '95vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
        <canvas id="confetti" className="confetti-canvas"></canvas>

        <div className="host-active-header" style={{ zIndex: 10 }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Exam Complete</span>
            <h1 style={{ fontSize: '1.8rem', marginTop: '0.2rem' }}>Final Results</h1>
          </div>
          <button className="btn btn-secondary" onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Home size={16} /> Exit Host
          </button>
        </div>

        <div className="podium-container" style={{ zIndex: 10 }}>
          {podiumData[0].name && (
            <div className="podium-column-2 animate-pop-in">
              <span style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', textAlign: 'center', width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {podiumData[0].name}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                {podiumData[0].score} pts
              </span>
              <div 
                style={{ 
                  width: '100%', 
                  height: podiumData[0].height, 
                  background: 'linear-gradient(180deg, #94a3b8 0%, rgba(148, 163, 184, 0.2) 100%)',
                  borderRadius: '12px 12px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #cbd5e1',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
                }}
              >
                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white' }}>2</span>
              </div>
            </div>
          )}

          {podiumData[1].name && (
            <div className="podium-column-1 animate-pop-in">
              <Crown size={36} fill="#f59e0b" style={{ color: '#f59e0b', marginBottom: '0.5rem' }} className="animate-float" />
              <span style={{ fontWeight: 800, fontSize: '1.3rem', marginBottom: '0.5rem', textAlign: 'center', width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {podiumData[1].name}
              </span>
              <span style={{ fontSize: '0.95rem', color: 'var(--color-yellow)', marginBottom: '0.5rem', fontWeight: 600 }}>
                {podiumData[1].score} pts
              </span>
              <div 
                style={{ 
                  width: '100%', 
                  height: podiumData[1].height, 
                  background: 'linear-gradient(180deg, #f59e0b 0%, rgba(245, 158, 11, 0.2) 100%)',
                  borderRadius: '12px 12px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #fbbf24',
                  boxShadow: '0 10px 30px rgba(245, 158, 11, 0.3)'
                }}
              >
                <span style={{ fontSize: '3.5rem', fontWeight: 900, color: 'white' }}>1</span>
              </div>
            </div>
          )}

          {podiumData[2].name && (
            <div className="podium-column-3 animate-pop-in">
              <span style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', textAlign: 'center', width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {podiumData[2].name}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                {podiumData[2].score} pts
              </span>
              <div 
                style={{ 
                  width: '100%', 
                  height: podiumData[2].height, 
                  background: 'linear-gradient(180deg, #b45309 0%, rgba(180, 83, 9, 0.2) 100%)',
                  borderRadius: '12px 12px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #d97706',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
                }}
              >
                <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'white' }}>3</span>
              </div>
            </div>
          )}
        </div>

        <div className="glass text-center" style={{ padding: '1.5rem', zIndex: 10, background: 'rgba(0,0,0,0.2)' }}>
          <h2 style={{ fontSize: '1.5rem', color: 'white' }}>Congratulations to all students! 🎓</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>The exam is closed and grades are finalized.</p>
        </div>
      </div>
    );
  }

  return null;
}
