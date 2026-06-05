import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Play, ArrowLeft, PlusCircle, Check, HelpCircle, Save, Info, Sparkles, LogOut, FileText, Image, Globe, RefreshCw, X, Calendar, Award, BarChart3, Users } from 'lucide-react';

export default function TeacherDashboard({ teacherToken, teacherUsername, onHostExam, onLogout, onBack }) {
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('EXAMS'); // EXAMS, RESULTS

  // Exam Creator States
  const [isEditing, setIsEditing] = useState(false);
  const [examId, setExamId] = useState(null);
  const [examTitle, setExamTitle] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [questions, setQuestions] = useState([]);

  // Active Question Form States
  const [currentQIndex, setCurrentQIndex] = useState(-1); // -1 for new question
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [timeLimit, setTimeLimit] = useState(20);
  const [points, setPoints] = useState(1000);
  const [questionImage, setQuestionImage] = useState(''); // Base64 or URL

  // Results Details Modal State
  const [viewingResultDetail, setViewingResultDetail] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    if (activeTab === 'EXAMS') {
      await fetchExams();
    } else {
      await fetchResults();
    }
  };

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/exams', {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });
      if (!res.ok) throw new Error('Failed to fetch exams.');
      const data = await res.json();
      setExams(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to backend server. Make sure it is running!');
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/results', {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });
      if (!res.ok) throw new Error('Failed to fetch exam results.');
      const data = await res.json();
      // Sort results by date descending
      setResults(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not fetch historical results from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewExam = () => {
    setExamId('exam_' + Date.now());
    setExamTitle('');
    setExamDescription('');
    setQuestions([]);
    resetQuestionForm();
    setIsEditing(true);
  };

  const handleEditExam = (exam) => {
    setExamId(exam.id);
    setExamTitle(exam.title);
    setExamDescription(exam.description || '');
    setQuestions(exam.questions || []);
    resetQuestionForm();
    setIsEditing(true);
  };

  const resetQuestionForm = () => {
    setCurrentQIndex(-1);
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectAnswer(0);
    setTimeLimit(20);
    setPoints(1000);
    setQuestionImage('');
  };

  const handleDeleteExam = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this exam?')) return;

    try {
      const res = await fetch(`/api/exams/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });
      if (res.ok) {
        setExams(prev => prev.filter(exam => exam.id !== id));
      } else {
        alert('Failed to delete. Ownership validation failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete exam.');
    }
  };

  // Image Selector File Handler (converts to Base64)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert('Image file size must be less than 500KB to ensure smooth transfers.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setQuestionImage(reader.result); // Save Base64 Data URL
    };
    reader.readAsDataURL(file);
  };

  const handleAddOrUpdateQuestion = () => {
    if (!questionText.trim()) {
      alert('Question prompt cannot be empty.');
      return;
    }
    if (options.some(opt => !opt.trim())) {
      alert('All 4 choices must have text.');
      return;
    }

    const questionObj = {
      question: questionText.trim(),
      options: options.map(o => o.trim()),
      correctAnswer,
      timeLimit: parseInt(timeLimit),
      points: parseInt(points),
      image: questionImage // Base64 data URL or external HTTP URL
    };

    if (currentQIndex === -1) {
      setQuestions(prev => [...prev, questionObj]);
    } else {
      const updated = [...questions];
      updated[currentQIndex] = questionObj;
      setQuestions(updated);
    }

    resetQuestionForm();
  };

  const handleLoadQuestionToForm = (idx) => {
    const q = questions[idx];
    setCurrentQIndex(idx);
    setQuestionText(q.question);
    setOptions([...q.options]);
    setCorrectAnswer(q.correctAnswer);
    setTimeLimit(q.timeLimit);
    setPoints(q.points);
    setQuestionImage(q.image || '');
  };

  const handleDeleteQuestion = (idx, e) => {
    e.stopPropagation();
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    if (currentQIndex === idx) {
      resetQuestionForm();
    }
  };

  const handleSaveExam = async () => {
    if (!examTitle.trim()) {
      alert('Exam title is required.');
      return;
    }
    if (questions.length === 0) {
      alert('Please add at least one question.');
      return;
    }

    const examData = {
      id: examId,
      title: examTitle.trim(),
      description: examDescription.trim(),
      questions
    };

    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${teacherToken}`
        },
        body: JSON.stringify(examData)
      });

      if (res.ok) {
        setIsEditing(false);
        fetchExams();
      } else {
        alert('Failed to save exam to server. Validate your session.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to save exam.');
    }
  };

  // Option colors for input cards
  const optionInputBorders = [
    'rgba(244, 63, 94, 0.4)',
    'rgba(14, 165, 233, 0.4)',
    'rgba(245, 158, 11, 0.4)',
    'rgba(16, 185, 129, 0.4)'
  ];

  if (isEditing) {
    return (
      <div className="app-container" style={{ maxWidth: '1200px' }}>
        {/* Header */}
        <div className="responsive-header-builder" style={{ marginBottom: '2rem' }}>
          <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
            <ArrowLeft size={16} /> Cancel
          </button>
          <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)' }}>
            Exam Builder <Sparkles size={20} style={{ color: 'var(--accent)', display: 'inline-block' }} />
          </h2>
          <button className="btn btn-primary" onClick={handleSaveExam}>
            <Save size={16} /> Save Exam
          </button>
        </div>

        {/* Builder Layout Grid */}
        <div className="builder-layout">
          
          {/* Left Panel: Exam Meta and Questions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Info size={16} style={{ color: 'var(--primary)' }} /> Exam Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Exam Title</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. History Midterm"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Description</label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="Provide exam details or guidelines..."
                    value={examDescription}
                    onChange={(e) => setExamDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Questions List */}
            <div className="glass" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Questions ({questions.length})</span>
                {questions.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--color-red)' }}>* Add a question</span>}
              </h3>
              
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.5rem' }}>
                {questions.length === 0 ? (
                  <div style={{ textCenter: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', textAlign: 'center', border: '1.5px dashed var(--border-color)', borderRadius: '8px' }}>
                    <HelpCircle size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)' }} />
                    <p>No questions added yet.</p>
                  </div>
                ) : (
                  questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="glass-interactive"
                      style={{ 
                        padding: '0.9rem 1.2rem', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        borderColor: currentQIndex === idx ? 'var(--primary)' : 'var(--border-color)',
                        background: currentQIndex === idx ? 'rgba(99, 102, 241, 0.08)' : 'rgba(17, 24, 39, 0.4)'
                      }}
                      onClick={() => handleLoadQuestionToForm(idx)}
                    >
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong>{idx + 1}. </strong>
                        {q.image && <Image size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                        <span style={{ fontSize: '0.95rem' }}>{q.question}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          {q.timeLimit}s
                        </span>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.3rem', borderRadius: '4px' }}
                          onClick={(e) => handleDeleteQuestion(idx, e)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button className="btn btn-secondary" style={{ marginTop: '1rem', width: '100%' }} onClick={resetQuestionForm}>
                <PlusCircle size={16} /> New Question Form
              </button>
            </div>
          </div>

          {/* Right Panel: Question Form Editor */}
          <div className="glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              {currentQIndex === -1 ? 'Add New Question' : `Edit Question #${currentQIndex + 1}`}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Question Text */}
              <div>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Question Prompt</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Which country hosted the 2024 Olympics?"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                />
              </div>

              {/* Image Upload/Link Box */}
              <div>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Question Image (Optional)
                </label>
                <div className="upload-grid">
                  {/* File Upload / Link options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {/* Local File input trigger */}
                      <label className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center' }}>
                        <Image size={14} style={{ marginRight: '0.3rem' }} /> Upload File
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleImageUpload}
                        />
                      </label>
                    </div>
                    {/* URL text fallback */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="input-field"
                        style={{ paddingLeft: '2.2rem', fontSize: '0.85rem', padding: '0.5rem' }}
                        placeholder="Or paste external image URL..."
                        value={questionImage && !questionImage.startsWith('data:') ? questionImage : ''}
                        onChange={(e) => setQuestionImage(e.target.value)}
                      />
                      <Globe size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  {/* Thumbnail Preview */}
                  <div className="glass" style={{ height: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    {questionImage ? (
                      <>
                        <img 
                          src={questionImage} 
                          alt="Question Preview" 
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                        />
                        <button 
                          type="button" 
                          className="btn btn-danger" 
                          style={{ position: 'absolute', top: '2px', right: '2px', padding: '0.15rem', borderRadius: '50%' }}
                          onClick={() => setQuestionImage('')}
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No image uploaded</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Choices Inputs */}
              <div>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  Answer Choices (Check correct option on left)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {options.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(idx)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: correctAnswer === idx ? 'none' : '2px solid var(--border-color)',
                          background: correctAnswer === idx ? 'linear-gradient(135deg, var(--primary), var(--accent))' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          flexShrink: 0
                        }}
                      >
                        {correctAnswer === idx && <Check size={16} color="white" />}
                      </button>
                      
                      <input
                        type="text"
                        className="input-field"
                        style={{ 
                          borderColor: optionInputBorders[idx],
                          background: correctAnswer === idx ? 'rgba(255,255,255,0.03)' : ''
                        }}
                        placeholder={`Choice ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...options];
                          updated[idx] = e.target.value;
                          setOptions(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Configurations */}
              <div className="two-col-grid">
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Time Limit</label>
                  <select
                    className="input-field"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                  >
                    <option value="5">5 Seconds</option>
                    <option value="10">10 Seconds</option>
                    <option value="15">15 Seconds</option>
                    <option value="20">20 Seconds</option>
                    <option value="30">30 Seconds</option>
                    <option value="60">60 Seconds</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Base Points</label>
                  <select
                    className="input-field"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                  >
                    <option value="500">500 points (Easy)</option>
                    <option value="1000">1000 points (Normal)</option>
                    <option value="2000">2000 points (Hard/Double)</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={resetQuestionForm}
                >
                  Clear Form
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1.5 }}
                  onClick={handleAddOrUpdateQuestion}
                >
                  {currentQIndex === -1 ? 'Add to Exam' : 'Update Question'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ maxWidth: '1080px' }}>
      
      {/* Top Navigation */}
      <div className="dashboard-nav" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            Exit Panel
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Logged in as: <strong style={{ color: 'var(--primary)' }}>{teacherUsername}</strong>
          </span>
        </div>
        
        {/* Tab Selection */}
        <div className="glass" style={{ display: 'flex', padding: '0.25rem', borderRadius: '10px' }}>
          <button 
            className="btn" 
            style={{ 
              padding: '0.4rem 1.2rem', 
              fontSize: '0.9rem',
              borderRadius: '8px',
              background: activeTab === 'EXAMS' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'EXAMS' ? 'white' : 'var(--text-secondary)'
            }}
            onClick={() => setActiveTab('EXAMS')}
          >
            <FileText size={14} style={{ marginRight: '0.3rem' }} /> My Exams
          </button>
          <button 
            className="btn" 
            style={{ 
              padding: '0.4rem 1.2rem', 
              fontSize: '0.9rem',
              borderRadius: '8px',
              background: activeTab === 'RESULTS' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'RESULTS' ? 'white' : 'var(--text-secondary)'
            }}
            onClick={() => setActiveTab('RESULTS')}
          >
            <BarChart3 size={14} style={{ marginRight: '0.3rem' }} /> Exam Results
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {activeTab === 'EXAMS' && (
            <button className="btn btn-primary" onClick={handleCreateNewExam}>
              <Plus size={16} /> Create Exam
            </button>
          )}
          <button className="btn btn-danger" onClick={onLogout} style={{ padding: '0.6rem 1rem' }} title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="glass" style={{ borderColor: 'var(--color-red)', padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--color-red)' }}>
          <Info size={20} />
          <span>{error}</span>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '0.3rem 1rem', fontSize: '0.8rem' }} onClick={fetchData}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="text-center" style={{ padding: '5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <span style={{ color: 'var(--text-secondary)' }}>Syncing folder resources...</span>
        </div>
      ) : (
        <div>
          {/* TAB 1: EXAMS VIEW */}
          {activeTab === 'EXAMS' && (
            <div>
              {exams.length === 0 ? (
                <div className="glass text-center" style={{ padding: '5rem 2rem' }}>
                  <HelpCircle size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1.5rem' }} className="animate-float" />
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No exams created yet</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto' }}>
                    Start by creating your first interactive quiz. Only you will have access to see and host it.
                  </p>
                  <button className="btn btn-primary" onClick={handleCreateNewExam}>
                    <Plus size={16} /> Create First Exam
                  </button>
                </div>
              ) : (
                <div className="exam-cards-grid">
                  {exams.map((exam) => (
                    <div
                      key={exam.id}
                      className="glass-interactive"
                      style={{ 
                        padding: '1.5rem', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'space-between',
                        minHeight: '210px',
                        borderColor: 'rgba(255,255,255,0.06)'
                      }}
                      onClick={() => handleEditExam(exam)}
                    >
                      <div>
                        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: '#fff' }}>{exam.title}</h3>
                        <p style={{ 
                          fontSize: '0.9rem', 
                          color: 'var(--text-secondary)', 
                          marginBottom: '1rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          height: '4.2em',
                          lineHeight: '1.4'
                        }}>
                          {exam.description || 'No description provided.'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {exam.questions?.length || 0} Questions
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '0.5rem 0.8rem' }}
                            title="Delete Exam"
                            onClick={(e) => handleDeleteExam(exam.id, e)}
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.5rem 1.2rem', gap: '0.4rem' }}
                            onClick={() => onHostExam(exam.id)}
                          >
                            <Play size={16} fill="white" /> Host Live
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HISTORICAL EXAM RESULTS */}
          {activeTab === 'RESULTS' && (
            <div>
              {results.length === 0 ? (
                <div className="glass text-center" style={{ padding: '5rem 2rem' }}>
                  <BarChart3 size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1.5rem' }} className="animate-float" />
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No results recorded yet</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                    Once you start and complete a live exam with joined student players, session data logs will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {results.map((res) => {
                    const formattedDate = new Date(res.date).toLocaleDateString(undefined, { 
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                    });

                    // Calculate average score
                    const avgScore = res.players.length > 0 
                      ? Math.round(res.players.reduce((sum, p) => sum + p.score, 0) / res.players.length)
                      : 0;

                    // Find Winner name
                    const winner = res.players.length > 0 
                      ? res.players.sort((a,b) => b.score - a.score)[0].nickname
                      : 'N/A';

                    return (
                      <div 
                        key={res.id} 
                        className="glass-interactive results-row-grid" 
                        style={{ padding: '1.25rem 2rem', borderColor: 'var(--border-color)', cursor: 'pointer' }}
                        onClick={() => setViewingResultDetail(res)}
                      >
                        <div>
                          <h4 style={{ fontSize: '1.15rem', color: '#fff' }}>{res.title}</h4>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                            <Calendar size={12} /> {formattedDate} • PIN: {res.pin}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Users size={16} style={{ color: 'var(--primary)' }} />
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>STUDENTS</div>
                            <strong style={{ fontSize: '1rem' }}>{res.playersCount} Joined</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <BarChart3 size={16} style={{ color: 'var(--accent)' }} />
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AVG SCORE</div>
                            <strong style={{ fontSize: '1rem' }}>{avgScore} pts</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Award size={16} style={{ color: '#f59e0b' }} />
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOP SCORE</div>
                            <strong style={{ fontSize: '1rem', color: '#f59e0b' }}>{winner}</strong>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                            View Detail
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* RESULTS DETAIL OVERLAY MODAL */}
      {viewingResultDetail && (
        <div className="modal-backdrop animate-pop-in">
          <div className="glass modal-content animate-pulse-glow">
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session Report Log</span>
                <h3 style={{ fontSize: '1.6rem', color: 'white', marginTop: '0.2rem' }}>{viewingResultDetail.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Hosted on {new Date(viewingResultDetail.date).toLocaleString()} • Game PIN: {viewingResultDetail.pin}
                </p>
              </div>
              <button className="btn btn-danger" style={{ padding: '0.4rem', borderRadius: '50%' }} onClick={() => setViewingResultDetail(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Content - Player list breakdown */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
              
              {/* Summary Stats */}
              <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL PARTICIPANTS</div>
                  <strong style={{ fontSize: '1.3rem', color: 'white' }}>{viewingResultDetail.players.length}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CLASS AVERAGE</div>
                  <strong style={{ fontSize: '1.3rem', color: 'var(--primary)' }}>
                    {viewingResultDetail.players.length > 0
                      ? Math.round(viewingResultDetail.players.reduce((sum, p) => sum + p.score, 0) / viewingResultDetail.players.length)
                      : 0} pts
                  </strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AVG ACCURACY</div>
                  <strong style={{ fontSize: '1.3rem', color: 'var(--color-green)' }}>
                    {viewingResultDetail.players.length > 0
                      ? Math.round(
                          (viewingResultDetail.players.reduce((sum, p) => sum + p.correctCount, 0) / 
                          (viewingResultDetail.players.length * viewingResultDetail.players[0].totalQuestions)) * 100
                        )
                      : 0}%
                  </strong>
                </div>
              </div>

              {/* Student Grades Table */}
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'white' }}>Student Scoreboard & Grades</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {viewingResultDetail.players
                  .sort((a,b) => b.score - a.score)
                  .map((player, index) => {
                    const ratio = player.totalQuestions > 0 ? (player.correctCount / player.totalQuestions) : 0;
                    const accuracy = Math.round(ratio * 100);

                    return (
                      <div 
                        key={index} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '0.8rem 1.2rem', 
                          background: index === 0 ? 'rgba(245, 158, 11, 0.06)' : 'rgba(255,255,255,0.02)',
                          border: index === 0 ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid var(--border-color)',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: index === 0 ? '#f59e0b' : 'var(--text-secondary)', width: '25px' }}>
                            #{index + 1}
                          </span>
                          <span style={{ fontWeight: 600, color: 'white' }}>{player.nickname}</span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ACCURACY</div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: accuracy >= 70 ? 'var(--color-green)' : accuracy >= 40 ? 'var(--color-yellow)' : 'var(--color-red)' }}>
                              {player.correctCount} / {player.totalQuestions} ({accuracy}%)
                            </span>
                          </div>
                          
                          <div style={{ textAlign: 'right', minWidth: '90px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>FINAL SCORE</div>
                            <strong style={{ fontSize: '1rem', color: 'white' }}>{player.score} pts</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setViewingResultDetail(null)}>
                Close Report
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
