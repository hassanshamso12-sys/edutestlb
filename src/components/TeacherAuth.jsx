import React, { useState } from 'react';
import { Lock, User, KeyRound, UserPlus, LogIn, ArrowLeft, AlertCircle } from 'lucide-react';

export default function TeacherAuth({ onLoginSuccess, onBack }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

      onLoginSuccess(data.token, data.username);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not connect to auth server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      
      {/* Back button */}
      <div className="back-btn-container">
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Student Portal
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: '420px' }} className="animate-pop-in">
        {/* Header */}
        <div className="text-center" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(99, 102, 241, 0.08)', border: '1.5px solid rgba(99, 102, 241, 0.2)', padding: '0.5rem 1.2rem', borderRadius: '50px', marginBottom: '1rem', color: 'var(--primary)' }}>
            <Lock size={16} style={{ marginRight: '0.4rem', marginTop: '0.1rem' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>TEACHER VERIFICATION</span>
          </div>
          <h2 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-heading)' }}>
            {isLogin ? 'Teacher Sign In' : 'Create Teacher Account'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.4rem' }}>
            {isLogin 
              ? 'Access your custom exam dashboards and results logging.' 
              : 'Register to host live sessions, build exams, and log grades.'
            }
          </p>
        </div>

        {/* Auth form card */}
        <div className="glass animate-pulse-glow" style={{ padding: '2.5rem', borderRadius: '24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* Username */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                USERNAME
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '2.8rem' }}
                  placeholder="e.g. ProfessorSmith"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
                <User size={16} style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="input-field"
                  style={{ paddingLeft: '2.8rem' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <KeyRound size={16} style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            {/* Confirm Password (only for register) */}
            {!isLogin && (
              <div className="animate-pop-in">
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
                  CONFIRM PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    className="input-field"
                    style={{ paddingLeft: '2.8rem' }}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                  <KeyRound size={16} style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>
            )}

            {error && (
              <div className="animate-shake" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '0.6rem 1rem', borderRadius: '8px', color: 'var(--color-red)', fontSize: '0.85rem', fontWeight: 500 }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <span>Verifying...</span>
                </div>
              ) : isLogin ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><LogIn size={16} /> Sign In</span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><UserPlus size={16} /> Create Account</span>
              )}
            </button>
          </form>

          {/* Toggle link */}
          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isLogin ? "Don't have a teacher account?" : "Already have a teacher account?"}{' '}
            <button 
              className="btn" 
              style={{ padding: 0, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
              onClick={() => {
                setError('');
                setIsLogin(!isLogin);
              }}
              disabled={loading}
            >
              {isLogin ? 'Register now' : 'Sign in here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
