import React, { useState } from 'react';
import { HelpCircle, Award, CheckCircle2, XCircle, ArrowLeft, ArrowRight, Send, AlertCircle, FileText } from 'lucide-react';
import { audio } from '../utils/audio';

const loadPdfJs = () => {
  return new Promise((resolve) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    document.head.appendChild(script);
  });
};

export default function StudentStaticClient({ exam, nickname, onExit }) {
  const [shuffledQuestions, setShuffledQuestions] = useState(() => {
    const questionsWithIndex = exam.questions.map((q, idx) => ({
      ...q,
      originalIndex: idx
    }));
    if (exam.randomizeQuestions) {
      const array = [...questionsWithIndex];
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
    return questionsWithIndex;
  });

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState(Array(exam.questions.length).fill(null));
  
  // Matching active selection state: { leftIndex: rightItemString }
  const [matchingPairs, setMatchingPairs] = useState(() =>
    shuffledQuestions.map(q => q.type === 'matching' ? {} : null)
  );
  const [selectedLeftIdx, setSelectedLeftIdx] = useState(null);

  // Submission / Results states
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState(20);

  const currentQuestion = shuffledQuestions[currentQIndex];
  const isLastQuestion = currentQIndex === shuffledQuestions.length - 1;

  React.useEffect(() => {
    if (!exam.isTimed || results) return;
    setTimeLeft(currentQuestion?.timeLimit || 20);
  }, [currentQIndex, exam.isTimed, results]);

  React.useEffect(() => {
    if (!exam.isTimed || results) return;
    if (timeLeft <= 0) {
      if (isLastQuestion) {
        handleSubmitExam();
      } else {
        setCurrentQIndex(prev => prev + 1);
      }
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, exam.isTimed, results, isLastQuestion]);

  // PDF Rendering States
  const [pdfRendering, setPdfRendering] = useState(false);
  const pdfContainerRef = React.useRef(null);

  React.useEffect(() => {
    if (exam.pdfUrl && pdfContainerRef.current) {
      setPdfRendering(true);
      loadPdfJs().then(pdfjsLib => {
        return pdfjsLib.getDocument({ url: exam.pdfUrl }).promise;
      }).then(async (pdf) => {
        if (!pdfContainerRef.current) return;
        pdfContainerRef.current.innerHTML = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement('canvas');
          canvas.style.width = '100%';
          canvas.style.marginBottom = '1.5rem';
          canvas.style.borderRadius = '8px';
          canvas.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');
          await page.render({ canvasContext: context, viewport }).promise;
          if (pdfContainerRef.current) {
            pdfContainerRef.current.appendChild(canvas);
          }
        }
        setPdfRendering(false);
      }).catch(err => {
        console.error('Error rendering PDF for student:', err);
        setPdfRendering(false);
      });
    }
  }, [exam.pdfUrl, results]);

  const optionColors = ['option-red', 'option-blue', 'option-yellow', 'option-green'];
  
  const handleSelectMC = (optIdx) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion.originalIndex] = optIdx;
    setAnswers(newAnswers);
  };

  const handleShortAnswerChange = (val) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion.originalIndex] = val;
    setAnswers(newAnswers);
  };

  const handleMatchClickLeft = (leftIdx) => {
    setSelectedLeftIdx(leftIdx);
  };

  const handleMatchClickRight = (rightItem) => {
    if (selectedLeftIdx === null) return;

    const currentMatches = { ...matchingPairs[currentQIndex] };
    
    // Remove if this rightItem is already matched elsewhere to keep 1-to-1 matching
    Object.keys(currentMatches).forEach(key => {
      if (currentMatches[key] === rightItem) {
        delete currentMatches[key];
      }
    });

    currentMatches[selectedLeftIdx] = rightItem;

    const newMatchingPairs = [...matchingPairs];
    newMatchingPairs[currentQIndex] = currentMatches;
    setMatchingPairs(newMatchingPairs);

    // Save formatted answer: list of right items in order of left items
    const rightItemsInLeftOrder = currentQuestion.leftItems.map((_, idx) => currentMatches[idx] || null);
    const newAnswers = [...answers];
    newAnswers[currentQuestion.originalIndex] = rightItemsInLeftOrder;
    setAnswers(newAnswers);

    setSelectedLeftIdx(null);
  };

  const handleClearMatches = () => {
    const newMatchingPairs = [...matchingPairs];
    newMatchingPairs[currentQIndex] = {};
    setMatchingPairs(newMatchingPairs);

    const newAnswers = [...answers];
    newAnswers[currentQuestion.originalIndex] = null;
    setAnswers(newAnswers);
    setSelectedLeftIdx(null);
  };

  const handleSubmitExam = async () => {
    // Validate if at least one question is answered (or warn if not all are answered)
    const unansweredCount = answers.filter(a => a === null || a === '').length;
    if (unansweredCount > 0) {
      if (!confirm(`You have ${unansweredCount} unanswered questions. Are you sure you want to submit?`)) {
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/exams/static/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: exam.id,
          nickname,
          answers
        })
      });

      if (!res.ok) {
        throw new Error('Failed to submit exam answers.');
      }

      const data = await res.json();
      setResults(data);
      if (data.score > 0) {
        audio.playVictory();
      } else {
        audio.playIncorrect();
      }
    } catch (err) {
      console.error(err);
      setError('Connection error submitting answers. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Result summary page
  if (results) {
    const accuracy = Math.round((results.correctCount / results.totalQuestions) * 100);
    return (
      <div className="app-container animate-pop-in" style={{ maxWidth: '800px', paddingBottom: '4rem' }}>
        <div className="glass text-center" style={{ padding: '3rem', borderRadius: '24px', marginBottom: '2rem', border: '2px solid var(--primary)' }}>
          <Award size={64} style={{ color: '#f59e0b', marginBottom: '1rem' }} className="animate-float" />
          <h2 style={{ fontSize: '2.4rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>Exam Summary</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            Well done, <strong style={{ color: 'white' }}>{nickname}</strong>! You completed <strong>{exam.title}</strong>.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', margin: '2.5rem 0' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SCORE</div>
              <strong style={{ fontSize: '1.6rem', color: 'white' }}>{results.score} pts</strong>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CORRECT</div>
              <strong style={{ fontSize: '1.6rem', color: 'var(--color-green)' }}>{results.correctCount} / {results.totalQuestions}</strong>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ACCURACY</div>
              <strong style={{ fontSize: '1.6rem', color: 'var(--primary)' }}>{accuracy}%</strong>
            </div>
          </div>

          <button className="btn btn-primary" onClick={onExit} style={{ padding: '0.8rem 2.5rem' }}>
            Back to Landing
          </button>
        </div>

        {/* Detailed Breakdown */}
        <h3 style={{ fontSize: '1.4rem', marginBottom: '1rem', color: '#fff' }}>Question Breakdown</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {exam.questions.map((q, idx) => {
            const fb = results.feedback.find(f => f.index === idx);
            const isCorrect = fb?.correct;
            const studentAns = answers[idx];

            return (
              <div key={idx} className="glass" style={{ padding: '1.5rem', borderLeft: `6px solid ${isCorrect ? 'var(--color-green)' : 'var(--color-red)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '1.1rem', color: 'white', fontWeight: 600 }}>
                    {idx + 1}. {q.question}
                  </h4>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '4px', background: isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', color: isCorrect ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                {/* Sub-details depending on question type */}
                <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  {q.type === 'matching' ? (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Matches:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '0.5rem' }}>
                        {q.leftItems.map((leftItem, leftIdx) => {
                          const correctRight = fb.correctAnswer.find(p => p.left === leftItem)?.right;
                          const studentRight = studentAns ? studentAns[leftIdx] : 'None';
                          const isPairCorrect = studentRight === correctRight;
                          return (
                            <div key={leftIdx} style={{ fontSize: '0.9rem' }}>
                              <span>{leftItem} ➔ </span>
                              <strong style={{ color: isPairCorrect ? 'var(--color-green)' : 'var(--color-red)' }}>
                                {studentRight || 'Unmatched'}
                              </strong>
                              {!isPairCorrect && (
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                  (Correct: {correctRight})
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        Your Answer:{' '}
                        <strong style={{ color: isCorrect ? 'var(--color-green)' : 'var(--color-red)' }}>
                          {q.type === 'multiple_choice' || q.type === 'true_false'
                            ? q.options[studentAns] || 'None'
                            : studentAns || 'None'}
                        </strong>
                      </div>
                      {!isCorrect && (
                        <div style={{ marginTop: '0.25rem' }}>
                          Correct Answer:{' '}
                          <strong style={{ color: 'var(--color-green)' }}>
                            {q.type === 'multiple_choice' || q.type === 'true_false'
                              ? q.options[fb.correctAnswer]
                              : fb.correctAnswer}
                          </strong>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. Taking static exam page
  return (
    <div className="app-container" style={{ maxWidth: exam.pdfUrl ? '1400px' : '800px', minHeight: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Self-Paced Exam</span>
          <h2 style={{ fontSize: '1.6rem', color: '#fff', marginTop: '0.2rem' }}>{exam.title}</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Taking as: </span>
          <strong style={{ color: 'var(--primary)' }}>{nickname}</strong>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
            Question {currentQIndex + 1} of {shuffledQuestions.length}
          </div>
          {exam.isTimed && (
            <div style={{ fontSize: '1rem', color: timeLeft <= 5 ? 'var(--color-red)' : 'var(--accent)', fontWeight: 700, marginTop: '0.25rem' }}>
              Time Left: {timeLeft}s
            </div>
          )}
        </div>
      </div>

      {/* Grid Layout for PDF Reference + Taker Interface */}
      <div className="builder-layout" style={{
        display: 'grid',
        gridTemplateColumns: exam.pdfUrl ? '1.2fr 1fr' : '1fr',
        gap: '1.5rem',
        width: '100%',
        flex: 1
      }}>
        
        {/* PDF Reference Panel */}
        {exam.pdfUrl && (
          <div className="glass" style={{ padding: '1.5rem', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fff' }}>
                <FileText size={16} style={{ color: 'var(--primary)' }} /> Exam PDF Reference
              </h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }} ref={pdfContainerRef}>
              {pdfRendering && (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ width: '30px', height: '30px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }}></div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rendering exam pages...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Question Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>

      {/* Question Quick Navigation Grid */}
      {exam.allowNavigation && (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem', justifyContent: 'center' }}>
          {shuffledQuestions.map((_, idx) => {
            const isCurrent = currentQIndex === idx;
            const q = shuffledQuestions[idx];
            const isAnswered = answers[q.originalIndex] !== null && answers[q.originalIndex] !== '';
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentQIndex(idx)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isCurrent
                    ? 'var(--primary)'
                    : isAnswered
                    ? 'rgba(99, 102, 241, 0.25)'
                    : 'rgba(0,0,0,0.15)',
                  color: isCurrent ? 'white' : isAnswered ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Panel */}
      <div className="glass" style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '300px' }}>
        
        {/* Question Prompt */}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
            {currentQuestion.type ? currentQuestion.type.replace('_', ' ') : 'Multiple Choice'}
          </span>
          <h3 style={{ fontSize: '1.4rem', color: 'white', marginTop: '0.4rem', lineHeight: '1.4' }}>
            {currentQuestion.question}
          </h3>
          {currentQuestion.image && (
            <div style={{ marginTop: '1rem', maxHeight: '200px', overflow: 'hidden', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '0.5rem', border: '1px solid var(--border-color)' }}>
              <img src={currentQuestion.image} alt="Context" style={{ maxHeight: '185px', maxWidth: '100%', objectFit: 'contain' }} />
            </div>
          )}
        </div>

        {/* Input/Answer options rendering based on question type */}
        <div style={{ flex: 1 }}>
          {/* A. Multiple Choice or True/False */}
          {(currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false' || !currentQuestion.type) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem' }}>
              {currentQuestion.options?.map((opt, idx) => {
                const isSelected = answers[currentQuestion.originalIndex] === idx;
                return (
                  <button
                    key={idx}
                    className="glass-interactive"
                    onClick={() => handleSelectMC(idx)}
                    style={{
                      width: '100%',
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(15, 23, 42, 0.4)'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', color: isSelected ? 'white' : 'var(--text-secondary)', fontWeight: 500 }}>
                      {opt}
                    </span>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: '2px solid var(--border-color)',
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'white' }}></div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* B. Short Answer */}
          {currentQuestion.type === 'short_answer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Type your answer below:</label>
              <input
                type="text"
                className="input-field"
                placeholder="Your answer..."
                value={answers[currentQuestion.originalIndex] || ''}
                onChange={(e) => handleShortAnswerChange(e.target.value)}
                style={{ fontSize: '1.2rem', padding: '1rem 1.5rem' }}
              />
            </div>
          )}

          {/* C. Matching */}
          {currentQuestion.type === 'matching' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Instructions: Select a left item, then click a matching right item.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Left Side Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>LEFT ITEMS</div>
                  {currentQuestion.leftItems.map((leftItem, idx) => {
                    const matchedRight = matchingPairs[currentQIndex]?.[idx];
                    const isSelected = selectedLeftIdx === idx;
                    return (
                      <button
                        key={idx}
                        className="glass-interactive"
                        onClick={() => handleMatchClickLeft(idx)}
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
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-green)', background: 'rgba(16,185,129,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                              ➔ {matchedRight}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right Side Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>RIGHT ITEMS</div>
                  {currentQuestion.rightItems.map((rightItem, idx) => {
                    const isAlreadyMatched = Object.values(matchingPairs[currentQIndex] || {}).includes(rightItem);
                    return (
                      <button
                        key={idx}
                        className="glass-interactive"
                        disabled={selectedLeftIdx === null}
                        onClick={() => handleMatchClickRight(rightItem)}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '8px',
                          textAlign: 'left',
                          fontSize: '0.95rem',
                          opacity: selectedLeftIdx === null ? 0.6 : 1,
                          border: '1px solid var(--border-color)',
                          background: isAlreadyMatched ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.15)'
                        }}
                      >
                        <span style={{ color: isAlreadyMatched ? 'var(--text-muted)' : 'white' }}>
                          {rightItem} {isAlreadyMatched && '(Matched)'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button className="btn btn-secondary" onClick={handleClearMatches} style={{ marginTop: '0.5rem', alignSelf: 'flex-start', padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                Reset Matches
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div style={{ display: 'flex', justifyContent: exam.allowNavigation ? 'space-between' : 'flex-end', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
        {exam.allowNavigation && (
          <button
            className="btn btn-secondary"
            disabled={currentQIndex === 0}
            onClick={() => setCurrentQIndex(prev => prev - 1)}
            style={{ padding: '0.6rem 1.5rem' }}
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}

        {error && (
          <div style={{ color: 'var(--color-red)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {isLastQuestion ? (
          <button
            className="btn btn-primary"
            onClick={handleSubmitExam}
            disabled={submitting}
            style={{ padding: '0.6rem 2rem' }}
          >
            {submitting ? 'Submitting...' : 'Submit Exam'} <Send size={16} style={{ marginLeft: '0.3rem' }} />
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => setCurrentQIndex(prev => prev + 1)}
            style={{ padding: '0.6rem 1.8rem' }}
          >
            Next <ArrowRight size={16} />
          </button>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
