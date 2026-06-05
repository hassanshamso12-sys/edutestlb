import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Sparkles, User, KeyRound } from 'lucide-react';
import StudentClient from './components/StudentClient';
import TeacherDashboard from './components/TeacherDashboard';
import TeacherHost from './components/TeacherHost';
import TeacherAuth from './components/TeacherAuth';
import { audio } from './utils/audio';
import './App.css'; 

export default function App() {
  const [role, setRole] = useState('INIT'); // INIT, LANDING, STUDENT_GAME, TEACHER_AUTH, TEACHER_DASHBOARD, TEACHER_HOST
  
  // Student inputs
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  
  // Game sockets & auth details
  const [socket, setSocket] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [joining, setJoining] = useState(false);
  const [activeHostQuizId, setActiveHostQuizId] = useState(null);

  // Authenticated Teacher states
  const [teacherToken, setTeacherToken] = useState(null);
  const [teacherUsername, setTeacherUsername] = useState('');

  // Standalone Routing on mount
  useEffect(() => {
    const path = window.location.pathname;
    const storedToken = localStorage.getItem('teacher_token');
    const storedUser = localStorage.getItem('teacher_username');

    if (path === '/teacher') {
      if (storedToken && storedUser) {
        setTeacherToken(storedToken);
        setTeacherUsername(storedUser);
        setRole('TEACHER_DASHBOARD');
      } else {
        setRole('TEACHER_AUTH');
      }
    } else {
      setRole('LANDING');
    }
  }, []);

  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  // Auth Success Handlers
  const handleLoginSuccess = (token, username) => {
    localStorage.setItem('teacher_token', token);
    localStorage.setItem('teacher_username', username);
    setTeacherToken(token);
    setTeacherUsername(username);
    setRole('TEACHER_DASHBOARD');
  };

  const handleLogout = () => {
    localStorage.removeItem('teacher_token');
    localStorage.removeItem('teacher_username');
    setTeacherToken(null);
    setTeacherUsername('');
    setRole('TEACHER_AUTH');
  };

  // Student Join Room Logic
  const handleStudentJoin = (e) => {
    e.preventDefault();
    if (!pin.trim() || !nickname.trim()) {
      setErrorMessage('Please fill in both fields!');
      return;
    }
    setErrorMessage('');
    setJoining(true);

    const newSocket = io();
    
    newSocket.on('connect', () => {
      newSocket.emit('join-game', { pin, nickname });
    });

    newSocket.on('join-success', ({ pin: joinedPin, nickname: joinedName }) => {
      setSocket(newSocket);
      setPin(joinedPin);
      setNickname(joinedName);
      setRole('STUDENT_GAME');
      setJoining(false);
    });

    newSocket.on('join-error', ({ message }) => {
      setErrorMessage(message);
      newSocket.disconnect();
      setJoining(false);
    });

    newSocket.on('connect_error', () => {
      setErrorMessage('Unable to connect to exam server. Is the server running?');
      newSocket.disconnect();
      setJoining(false);
    });
  };

  const handleExitStudent = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setPin('');
    setNickname('');
    setRole('LANDING');
  };

  // Host Launch Live Exam Logic
  const handleHostExam = (quizId) => {
    const newSocket = io();
    setSocket(newSocket);
    setActiveHostQuizId(quizId);
    setRole('TEACHER_HOST');
  };

  const handleExitHost = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setActiveHostQuizId(null);
    setRole('TEACHER_DASHBOARD');
  };

  // Initial routing placeholder
  if (role === 'INIT') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="animate-pulse" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
          Loading Examify...
        </div>
      </div>
    );
  }

  // 1. Student Landing Join Page (No links to teacher portal)
  if (role === 'LANDING') {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh', position: 'relative' }}>
        
        {/* Decorative Floating Bubbles */}
        <div className="animate-float" style={{ position: 'absolute', top: '15%', left: '10%', width: '120px', height: '120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)', zIndex: -1 }}></div>
        <div className="animate-float" style={{ position: 'absolute', bottom: '15%', right: '10%', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(217, 70, 239, 0.12) 0%, transparent 70%)', zIndex: -1, animationDelay: '2s' }}></div>

        {/* Brand Header */}
        <div className="text-center" style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(99, 102, 241, 0.08)', border: '1.5px solid rgba(99, 102, 241, 0.2)', padding: '0.6rem 1.5rem', borderRadius: '50px', marginBottom: '1.5rem' }}>
            <Sparkles size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>ONLINE EXAM ROOM</span>
          </div>
          <h1 style={{ fontSize: '3.8rem', fontWeight: 900, fontFamily: 'var(--font-heading)', background: 'linear-gradient(135deg, #fff 20%, var(--primary) 60%, var(--accent) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em' }}>
            Examify
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.5rem', maxWidth: '350px' }}>
            Enter the game PIN and nickname provided by your teacher to join.
          </p>
        </div>

        {/* PIN Join Card */}
        <div className="glass animate-pop-in animate-pulse-glow" style={{ padding: '2.5rem', maxWidth: '400px', width: '100%', borderRadius: '24px', border: '1.5px solid var(--border-color)' }}>
          <form onSubmit={handleStudentJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* PIN */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem' }}>
                <KeyRound size={14} style={{ color: 'var(--primary)' }} />
                <span>EXAM PIN</span>
              </div>
              <input
                type="text"
                className="input-field"
                placeholder="6-Digit Code"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} 
                disabled={joining}
                style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.1em' }}
              />
            </div>

            {/* Nickname */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem' }}>
                <User size={14} style={{ color: 'var(--accent)' }} />
                <span>YOUR NICKNAME</span>
              </div>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. JohnDoe"
                maxLength={15}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={joining}
                style={{ textAlign: 'center', fontWeight: 600 }}
              />
            </div>

            {errorMessage && (
              <div style={{ color: 'var(--color-red)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 500, background: 'rgba(244, 63, 94, 0.08)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }} className="animate-shake">
                {errorMessage}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '0.5rem' }}
              disabled={joining}
            >
              {joining ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <span>Connecting...</span>
                </div>
              ) : 'Join Exam'}
            </button>
          </form>
        </div>

        <div style={{ position: 'absolute', bottom: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Examify Engine v1.1.0 • Live Gamified Exams
        </div>
      </div>
    );
  }

  // 2. Teacher Credentials Gate
  if (role === 'TEACHER_AUTH') {
    return (
      <TeacherAuth 
        onLoginSuccess={handleLoginSuccess} 
        onBack={() => {
          // Change route history back to '/' and update state
          window.history.pushState({}, '', '/');
          setRole('LANDING');
        }} 
      />
    );
  }

  // 3. Play Game Screen
  if (role === 'STUDENT_GAME' && socket) {
    return <StudentClient socket={socket} pin={pin} nickname={nickname} onExit={handleExitStudent} />;
  }

  // 4. Authenticated Teacher Dashboard
  if (role === 'TEACHER_DASHBOARD') {
    return (
      <TeacherDashboard 
        teacherToken={teacherToken}
        teacherUsername={teacherUsername}
        onHostExam={handleHostExam} 
        onLogout={handleLogout}
        onBack={() => {
          window.history.pushState({}, '', '/');
          setRole('LANDING');
        }} 
      />
    );
  }

  // 5. Host screen
  if (role === 'TEACHER_HOST' && socket) {
    return (
      <TeacherHost 
        socket={socket} 
        quizId={activeHostQuizId} 
        teacherToken={teacherToken}
        onExit={handleExitHost} 
      />
    );
  }

  return null;
}
