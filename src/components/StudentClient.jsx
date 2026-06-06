import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, Award, Zap, LogOut, CheckCircle2, XCircle, Clock, RotateCcw, ArrowRight } from 'lucide-react';
import { audio } from '../utils/audio';

export default function StudentClient({ socket, pin, nickname, onExit }) {
  const [gameState, setGameState] = useState('LOBBY'); // LOBBY, COUNTDOWN, QUESTION, SUBMITTED, FEEDBACK, FINISHED_WAIT, PODIUM, DISCONNECTED
  const [countdown, setCountdown] = useState(3);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timer, setTimer] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(-1); // will hold option index, string, or array
  const [shortAnswerVal, setShortAnswerVal] = useState('');
  const [matchingPairs, setMatchingPairs] = useState({});
  const [selectedLeftIdx, setSelectedLeftIdx] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [personalScore, setPersonalScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [podiumPlace, setPodiumPlace] = useState(null);
  const questionStartTime = useRef(0);

  const shapes = [
    <div className="shape-triangle" style={{ borderBottomColor: 'white' }}></div>,
    <div className="shape-diamond"></div>,
    <div className="choice-shape shape-circle">
      <div style={{ width: '18px', height: '18px', border: '3px solid white', borderRadius: '50%' }}></div>
    </div>,
    <div className="choice-shape shape-square">
      <div style={{ width: '18px', height: '18px', border: '3px solid white' }}></div>
    </div>
  ];
  const optionColors = ['option-red', 'option-blue', 'option-yellow', 'option-green'];

  // Socket listener hook
  useEffect(() => {
    audio.startLobbyMusic();

    socket.on('game-starting', () => {
      audio.stopLobbyMusic();
      setGameState('COUNTDOWN');
      setCountdown(3);

      const countInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('student-question-start', (questionData) => {
      setCurrentQuestion(questionData);
      setTimer(questionData.timeLimit);
      setSelectedAnswer(-1);
      setShortAnswerVal('');
      setMatchingPairs({});
      setSelectedLeftIdx(null);
      setGameState('QUESTION');
      questionStartTime.current = Date.now();
      audio.playQuestionStart();
    });

    socket.on('student-question-results', (results) => {
      setFeedback(results);
      setPersonalScore(results.score);
      setStreak(results.streak);
      setGameState('FEEDBACK');
      
      if (results.correct) {
        audio.playCorrect();
      } else {
        audio.playIncorrect();
      }
    });

    socket.on('student-finished', () => {
      setGameState('FINISHED_WAIT');
    });

    socket.on('game-over', ({ podium }) => {
      audio.stopLobbyMusic();
      let place = null;
      if (podium.first?.nickname === nickname) place = 1;
      else if (podium.second?.nickname === nickname) place = 2;
      else if (podium.third?.nickname === nickname) place = 3;
      else place = 'Completed';

      setPodiumPlace(place);
      setGameState('PODIUM');
      audio.playVictory();
    });

    socket.on('host-disconnected', () => {
      audio.stopLobbyMusic();
      setGameState('DISCONNECTED');
    });

    return () => {
      socket.off('game-starting');
      socket.off('student-question-start');
      socket.off('student-question-results');
      socket.off('student-finished');
      socket.off('game-over');
      socket.off('host-disconnected');
      audio.stopLobbyMusic();
    };
  }, [socket, nickname]);

  // Client-Side ticking timer loop for the active question
  useEffect(() => {
    if (gameState !== 'QUESTION' || !currentQuestion) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSelectAnswer(-1); // Auto-submit timeout
          return 0;
        }
        if (prev <= 6) {
          audio.playTick(); // Ticking noise for last 5 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, currentQuestion]);

  const handleSelectAnswer = (index) => {
    if (selectedAnswer !== -1 || gameState !== 'QUESTION') return;

    setSelectedAnswer(index);
    setGameState('SUBMITTED');
    audio.playAnswerSubmitted();

    const timeSpent = (Date.now() - questionStartTime.current) / 1000;
    socket.emit('submit-answer', { 
      pin, 
      answerIndex: index, 
      timeSpent: parseFloat(Math.min(currentQuestion.timeLimit, timeSpent).toFixed(2))
    });
  };

  const handleRequestNext = () => {
    setGameState('SUBMITTED'); // Show lock screen during socket response delay
    socket.emit('request-student-next-question', { pin });
  };

  // 1. Lobby Waiting
  if (gameState === 'LOBBY') {
    return (
      <div className="glass container text-center animate-pop-in animate-pulse-glow" style={{ padding: '3rem 2rem', maxWidth: '500px', margin: '8% auto' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', fontFamily: 'var(--font-heading)' }}>You're In!</h2>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Nickname: <strong style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>{nickname}</strong>
        </div>
        <div className="animate-pulse" style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-muted)' }}>
          Waiting for host to start the exam...
        </div>
        <div style={{ marginTop: '3rem' }}>
          <button className="btn btn-secondary" onClick={onExit}>
            <LogOut size={16} /> Exit Lobby
          </button>
        </div>
      </div>
    );
  }

  // 2. Countdown
  if (gameState === 'COUNTDOWN') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Exam starting in
        </div>
        <div className="animate-pulse" style={{ fontSize: '8rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--primary)' }}>
          {countdown > 0 ? countdown : 'Go!'}
        </div>
      </div>
    );
  }

  // 3. Question Screen (Self-paced timer)
  if (gameState === 'QUESTION' && currentQuestion) {
    return (
      <div className="app-container" style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Question {currentQuestion.index + 1} of {currentQuestion.totalQuestions}
            </div>
            <h3 style={{ fontSize: '1.2rem', marginTop: '0.2rem' }}>{nickname}</h3>
          </div>
          <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '50px', borderColor: timer <= 5 ? 'var(--color-red)' : 'var(--border-color)', animation: timer <= 5 ? 'shake 0.2s infinite' : 'none' }}>
            <Clock size={16} className={timer <= 5 ? 'animate-pulse' : ''} style={{ color: timer <= 5 ? 'var(--color-red)' : 'var(--primary)' }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.2rem', color: timer <= 5 ? 'var(--color-red)' : 'white' }}>
              {timer}s
            </span>
          </div>
        </div>

        {/* Question text & image */}
        <div className="glass" style={{ margin: '1.5rem 0 1rem 0', padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', minHeight: '110px', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, lineHeight: 1.4 }}>
            {currentQuestion.question}
          </h2>
          {currentQuestion.image && (
            <div style={{ maxHeight: '160px', width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '0.25rem', border: '1px solid var(--border-color)' }}>
              <img src={currentQuestion.image} alt="Question Context" style={{ maxHeight: '150px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px' }} />
            </div>
          )}
        </div>

        {/* Choices / Inputs */}
        {(currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false' || !currentQuestion.type) && (
          <div className="game-grid">
            {currentQuestion.options?.map((option, idx) => (
              <button
                key={idx}
                className={`option-card ${optionColors[idx]}`}
                onClick={() => handleSelectAnswer(idx)}
              >
                <div className="choice-shape-wrapper" style={{ width: '40px', display: 'flex', justifyContent: 'center' }}>
                  {shapes[idx]}
                </div>
                <span style={{ fontSize: '1.2rem' }}>{option}</span>
              </button>
            ))}
          </div>
        )}

        {currentQuestion.type === 'short_answer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Type your answer here..."
              value={shortAnswerVal}
              onChange={(e) => setShortAnswerVal(e.target.value)}
              style={{ fontSize: '1.4rem', padding: '1.25rem', textAlign: 'center' }}
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!shortAnswerVal.trim()) return;
                handleSelectAnswer(shortAnswerVal.trim());
              }}
              style={{ width: '100%', padding: '1.25rem', fontSize: '1.2rem' }}
            >
              Submit Answer
            </button>
          </div>
        )}

        {currentQuestion.type === 'matching' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '700px', margin: '0 auto' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Select a left item, then select a matching right item.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Left Side */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {currentQuestion.leftItems.map((leftItem, idx) => {
                  const matchedRight = matchingPairs[idx];
                  const isSelected = selectedLeftIdx === idx;
                  return (
                    <button
                      type="button"
                      key={idx}
                      className="glass-interactive"
                      onClick={() => setSelectedLeftIdx(idx)}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        textAlign: 'left',
                        fontSize: '0.95rem',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.1)' : matchedRight ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.1)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{leftItem}</strong>
                        {matchedRight && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-green)' }}>
                            ➔ {matchedRight}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Side */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {currentQuestion.rightItems.map((rightItem, idx) => {
                  const isMatched = Object.values(matchingPairs).includes(rightItem);
                  return (
                    <button
                      type="button"
                      key={idx}
                      className="glass-interactive"
                      disabled={selectedLeftIdx === null}
                      onClick={() => {
                        const newMatches = { ...matchingPairs };
                        Object.keys(newMatches).forEach(k => {
                          if (newMatches[k] === rightItem) delete newMatches[k];
                        });
                        newMatches[selectedLeftIdx] = rightItem;
                        setMatchingPairs(newMatches);
                        setSelectedLeftIdx(null);
                      }}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        textAlign: 'left',
                        fontSize: '0.95rem',
                        opacity: selectedLeftIdx === null ? 0.6 : 1,
                        border: '1px solid var(--border-color)',
                        background: isMatched ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.15)'
                      }}
                    >
                      <span style={{ color: isMatched ? 'var(--text-muted)' : 'white' }}>
                        {rightItem} {isMatched && '(Matched)'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setMatchingPairs({});
                  setSelectedLeftIdx(null);
                }}
                style={{ flex: 1 }}
              >
                Reset
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const matchesArray = currentQuestion.leftItems.map((_, idx) => matchingPairs[idx] || null);
                  handleSelectAnswer(matchesArray);
                }}
                style={{ flex: 2 }}
              >
                Submit Matches
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <span>Exam PIN: {pin}</span>
          <span>Score: {personalScore} pts</span>
        </div>
      </div>
    );
  }

  // 4. Submitted Locked Wait
  if (gameState === 'SUBMITTED') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }} className="animate-pop-in">
        <div className="glass animate-pulse-glow" style={{ padding: '3rem', borderRadius: '50%', width: '250px', height: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--primary)' }}>
          <div className="animate-pulse" style={{ width: '32px', height: '32px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <h3 style={{ fontSize: '1.2rem', textAlign: 'center', marginTop: '1.5rem' }}>Loading next stage...</h3>
        </div>
      </div>
    );
  }

  // 5. Question Results Feedback (Self-paced, Next button present)
  if (gameState === 'FEEDBACK' && feedback) {
    const isCorrect = feedback.correct;
    const isLast = currentQuestion && (currentQuestion.index + 1 >= currentQuestion.totalQuestions);
    
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh', 
        background: isCorrect 
          ? 'linear-gradient(180deg, var(--bg-main) 0%, rgba(16, 185, 129, 0.15) 100%)'
          : 'linear-gradient(180deg, var(--bg-main) 0%, rgba(244, 63, 94, 0.12) 100%)',
        padding: '2rem'
      }} className="animate-pop-in">
        
        {isCorrect ? (
          <div className="glass" style={{ borderColor: 'var(--color-green)', padding: '2.5rem 3rem', borderRadius: '24px', textAlign: 'center', maxWidth: '450px', width: '100%' }}>
            <div style={{ display: 'inline-flex', background: 'rgba(16, 185, 129, 0.15)', padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
              <CheckCircle2 size={54} style={{ color: 'var(--color-green)' }} />
            </div>
            <h2 style={{ fontSize: '2.5rem', color: 'var(--color-green)', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>CORRECT!</h2>
            <div style={{ fontSize: '1.3rem', fontWeight: 600, color: 'white', marginBottom: '1.5rem' }}>
              +{feedback.pointsEarned} Points
            </div>

            {feedback.streak > 1 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', padding: '0.5rem 1.2rem', borderRadius: '50px', color: 'white', fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem', boxShadow: '0 4px 10px rgba(245, 158, 11, 0.4)' }} className="animate-pulse">
                <Zap size={16} fill="white" />
                <span>ANSWER STREAK: {feedback.streak}!</span>
              </div>
            )}
          </div>
        ) : (
          <div className="glass" style={{ borderColor: 'var(--color-red)', padding: '2.5rem 3rem', borderRadius: '24px', textAlign: 'center', maxWidth: '450px', width: '100%' }}>
            <div style={{ display: 'inline-flex', background: 'rgba(244, 63, 94, 0.15)', padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
              <XCircle size={54} style={{ color: 'var(--color-red)' }} />
            </div>
            <h2 style={{ fontSize: '2.5rem', color: 'var(--color-red)', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>INCORRECT</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              The correct answer was: <strong style={{ color: 'white' }}>
                {currentQuestion.options[feedback.correctAnswerIndex]}
              </strong>
            </p>
            {feedback.streak > 0 && (
              <p style={{ color: 'var(--color-yellow)', fontSize: '0.9rem', fontWeight: 500 }}>
                Answer streak lost
              </p>
            )}
          </div>
        )}

        <div className="glass" style={{ marginTop: '1.5rem', display: 'flex', gap: '2.5rem', padding: '1rem 2.2rem', borderRadius: '50px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TOTAL SCORE</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{feedback.score} pts</div>
          </div>
        </div>

        {/* Proceed to Next question manually */}
        <button 
          className="btn btn-primary animate-pulse-glow" 
          style={{ marginTop: '2rem', padding: '0.9rem 2.5rem', gap: '0.5rem', fontSize: '1.1rem' }}
          onClick={handleRequestNext}
        >
          {isLast ? 'Finish Exam' : 'Next Question'} <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  // 6. Waiting for Teacher after completing the exam
  if (gameState === 'FINISHED_WAIT') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '2rem' }} className="animate-pop-in">
        <div className="glass animate-pulse-glow" style={{ padding: '3.5rem 2.5rem', borderRadius: '24px', textAlign: 'center', maxWidth: '480px', width: '100%', border: '1.5px solid var(--primary)' }}>
          <Award size={64} style={{ color: 'var(--primary)', marginBottom: '1.5rem', display: 'inline-block' }} className="animate-float" />
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Exam Completed!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.05rem', lineHeight: 1.5 }}>
            Congratulations, you have finished all questions. Please keep this tab open and look at the teacher's projector screen.
          </p>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>YOUR FINAL SCORE</div>
            <strong style={{ fontSize: '1.6rem', color: 'white' }}>{personalScore} pts</strong>
          </div>
        </div>
      </div>
    );
  }

  // 7. Final Podium Placement Screen
  if (gameState === 'PODIUM') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh', 
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, var(--bg-main) 70%)',
        padding: '2rem'
      }} className="animate-pop-in">
        <div className="glass animate-pulse-glow" style={{ padding: '3.5rem 3rem', borderRadius: '24px', textAlign: 'center', maxWidth: '480px', width: '100%', border: '2px solid var(--primary)' }}>
          <Award size={72} style={{ color: '#f59e0b', marginBottom: '1.5rem', display: 'inline-block' }} className="animate-float" />
          
          <h2 style={{ fontSize: '2.2rem', marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Official Standings</h2>
          
          <div style={{ fontSize: '1.4rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {podiumPlace === 1 || podiumPlace === 2 || podiumPlace === 3 ? (
              <span>You finished on the podium in <strong style={{ color: '#f59e0b', fontSize: '1.8rem' }}>#{podiumPlace}</strong> place! 🎉</span>
            ) : (
              <span>You completed the exam! 👏</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', margin: '2rem 0', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Final Score</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>{personalScore}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nickname</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{nickname}</div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={onExit}>
            Leave Exam
          </button>
        </div>
      </div>
    );
  }

  // 8. Disconnected
  if (gameState === 'DISCONNECTED') {
    return (
      <div className="glass animate-shake" style={{ padding: '3.5rem 2rem', borderRadius: '24px', textAlign: 'center', maxWidth: '450px', margin: '10% auto', border: '1px solid var(--color-red)' }}>
        <XCircle size={60} style={{ color: 'var(--color-red)', marginBottom: '1.5rem' }} />
        <h2 style={{ fontSize: '2rem', color: 'var(--color-red)', marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Connection Lost</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.05rem', lineHeight: 1.5 }}>
          The host closed the exam or you disconnected from the session.
        </p>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onExit}>
          <RotateCcw size={16} /> Rejoin / Go Back
        </button>
      </div>
    );
  }

  return null;
}
