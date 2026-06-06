import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Play, ArrowLeft, PlusCircle, Check, HelpCircle, Save, Info, Sparkles, LogOut, FileText, Image, Globe, RefreshCw, X, Calendar, Award, BarChart3, Users, Download } from 'lucide-react';

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

const parseExamQuestions = (text) => {
  const lines = text.split('\n');
  const questionsList = [];
  let currentQuestion = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const questionMatch = trimmed.match(/^(?:Q|Question)?\s*(\d+)[.)\]:-]\s*(.+)/i);
    const optionMatch = trimmed.match(/^([A-D])\s*[.)\]:-]\s*(.+)/i);

    if (questionMatch) {
      if (currentQuestion) {
        questionsList.push(currentQuestion);
      }
      currentQuestion = {
        question: questionMatch[2].trim(),
        options: [],
        correctAnswer: 0,
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000
      };
    } else if (optionMatch && currentQuestion) {
      currentQuestion.options.push(optionMatch[2].trim());
    } else if (currentQuestion) {
      // Append text if it doesn't look like option keys
      if (!trimmed.match(/^[A-D]\s*[.)\]:-]/i)) {
        currentQuestion.question += ' ' + trimmed;
      }
    }
  });

  if (currentQuestion) {
    questionsList.push(currentQuestion);
  }

  return questionsList.map(q => {
    while (q.options.length < 4) q.options.push('');
    if (q.options.length > 4) q.options = q.options.slice(0, 4);
    return q;
  });
};

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
  const [examType, setExamType] = useState('live'); // 'live' or 'static'
  const [staticPin, setStaticPin] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfBase64, setPdfBase64] = useState('');
  const [isTimed, setIsTimed] = useState(true);
  const [allowNavigation, setAllowNavigation] = useState(true);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);

  // PDF Viewer states
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfRendering, setPdfRendering] = useState(false);

  // Active Question Form States
  const [currentQIndex, setCurrentQIndex] = useState(-1); // -1 for new question
  const [questionType, setQuestionType] = useState('multiple_choice'); // multiple_choice, true_false, short_answer, matching
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(0); // number or string
  const [matchPairs, setMatchPairs] = useState([{ left: '', right: '' }, { left: '', right: '' }]);
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
      setResults(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not fetch historical results from server.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResult = async (id) => {
    if (!confirm('Are you sure you want to delete this result record? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/results/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });
      if (res.ok) {
        setResults(prev => prev.filter(r => r.id !== id));
        if (viewingResultDetail?.id === id) {
          setViewingResultDetail(null);
        }
      } else {
        alert('Failed to delete results from database.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to delete result.');
    }
  };

  const handleDownloadCSV = (res) => {
    const headers = ['Student Name', 'Score (Points)', 'Correct Answers', 'Total Questions', 'Percentage (%)'];
    const rows = res.players.map(player => {
      const ratio = player.totalQuestions > 0 ? (player.correctCount / player.totalQuestions) : 0;
      const accuracy = Math.round(ratio * 100);
      return [
        `"${player.nickname.replace(/"/g, '""')}"`,
        player.score,
        player.correctCount,
        player.totalQuestions,
        accuracy
      ];
    });

    const csvContent = [
      `"Exam Report: ${res.title.replace(/"/g, '""')}"`,
      `"Date: ${new Date(res.date).toLocaleString()}"`,
      `"PIN: ${res.pin}"`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const cleanTitle = res.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.setAttribute('download', `report_${cleanTitle}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateNewExam = () => {
    setExamId('exam_' + Date.now());
    setExamTitle('');
    setExamDescription('');
    setQuestions([]);
    setExamType('live');
    setStaticPin('');
    setPdfUrl('');
    setPdfBase64('');
    setIsTimed(true);
    setAllowNavigation(true);
    setRandomizeQuestions(false);
    setShowPdfViewer(false);
    resetQuestionForm();
    setIsEditing(true);
  };

  const handleEditExam = (exam) => {
    setExamId(exam.id);
    setExamTitle(exam.title);
    setExamDescription(exam.description || '');
    setQuestions(exam.questions || []);
    setExamType(exam.examType || 'live');
    setStaticPin(exam.staticPin || '');
    setPdfUrl(exam.pdfUrl || '');
    setPdfBase64('');
    setIsTimed(exam.isTimed !== undefined ? exam.isTimed : true);
    setAllowNavigation(exam.allowNavigation !== undefined ? exam.allowNavigation : true);
    setRandomizeQuestions(exam.randomizeQuestions !== undefined ? exam.randomizeQuestions : false);
    setShowPdfViewer(!!exam.pdfUrl);
    resetQuestionForm();
    setIsEditing(true);
  };

  const resetQuestionForm = () => {
    setCurrentQIndex(-1);
    setQuestionType('multiple_choice');
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectAnswer(0);
    setMatchPairs([{ left: '', right: '' }, { left: '', right: '' }]);
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

  // Image Selector File Handler (uploads to storage and gets url)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image file size must be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data })
        });
        if (res.ok) {
          const data = await res.json();
          setQuestionImage(data.url);
        } else {
          alert('Failed to upload image to server.');
        }
      } catch (err) {
        console.error(err);
        alert('Error uploading image.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddOrUpdateQuestion = () => {
    if (!questionText.trim()) {
      alert('Question prompt cannot be empty.');
      return;
    }

    let questionObj = {
      type: questionType,
      question: questionText.trim(),
      timeLimit: parseInt(timeLimit),
      points: parseInt(points),
      image: questionImage
    };

    if (questionType === 'multiple_choice') {
      if (options.some(opt => !opt.trim())) {
        alert('All 4 choices must have text.');
        return;
      }
      questionObj.options = options.map(o => o.trim());
      questionObj.correctAnswer = parseInt(correctAnswer);
    } else if (questionType === 'true_false') {
      questionObj.options = ['True', 'False'];
      questionObj.correctAnswer = parseInt(correctAnswer);
    } else if (questionType === 'short_answer') {
      if (!String(correctAnswer).trim()) {
        alert('Please specify the correct answer text.');
        return;
      }
      questionObj.correctAnswer = String(correctAnswer).trim();
    } else if (questionType === 'matching') {
      if (matchPairs.some(p => !p.left.trim() || !p.right.trim())) {
        alert('All matching pairs must have both left and right values.');
        return;
      }
      questionObj.matchPairs = matchPairs.map(p => ({ left: p.left.trim(), right: p.right.trim() }));
    }

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
    setQuestionType(q.type || 'multiple_choice');
    setQuestionText(q.question);
    if (q.options) {
      setOptions([...q.options]);
    } else {
      setOptions(['', '', '', '']);
    }
    setCorrectAnswer(q.correctAnswer);
    if (q.matchPairs) {
      setMatchPairs([...q.matchPairs]);
    } else {
      setMatchPairs([{ left: '', right: '' }, { left: '', right: '' }]);
    }
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
      examType,
      staticPin,
      pdfUrl,
      isTimed,
      allowNavigation,
      randomizeQuestions,
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

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('PDF size must be less than 5MB.');
      return;
    }

    setPdfParsing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      setPdfBase64(base64Data);
      setShowPdfViewer(true);

      // Upload in parallel
      fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data })
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setPdfUrl(data.url);
      })
      .catch(err => {
        console.error('Failed to save PDF to persistent storage:', err);
      });

      try {
        const arrayBuffer = base64ToArrayBuffer(base64Data);
        setTimeout(async () => {
          if (pdfContainerRef.current) {
            setPdfRendering(true);
            await renderPdfPages(arrayBuffer, pdfContainerRef.current);
            setPdfRendering(false);
          }
        }, 100);

        const text = await extractPdfText(arrayBuffer);
        const parsedQ = parseExamQuestions(text);
        if (parsedQ.length > 0 && confirm(`We automatically detected ${parsedQ.length} questions in this PDF. Would you like to import them as drafts?`)) {
          setQuestions(parsedQ);
        }
      } catch (err) {
        console.error('PDF parsing error:', err);
        alert('Could not parse PDF text, but you can still view it while building your exam.');
      } finally {
        setPdfParsing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64.split(',')[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const extractPdfText = async (pdfData) => {
    const pdfjsLib = await loadPdfJs();
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const renderPdfPages = async (pdfData, containerEl) => {
    const pdfjsLib = await loadPdfJs();
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    
    containerEl.innerHTML = '';
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
      containerEl.appendChild(canvas);
    }
  };

  const pdfContainerRef = React.useRef(null);

  useEffect(() => {
    if (showPdfViewer && pdfContainerRef.current) {
      if (pdfBase64) {
        const arrayBuffer = base64ToArrayBuffer(pdfBase64);
        setPdfRendering(true);
        renderPdfPages(arrayBuffer, pdfContainerRef.current).then(() => {
          setPdfRendering(false);
        });
      } else if (pdfUrl) {
        setPdfRendering(true);
        fetch(pdfUrl)
          .then(res => res.arrayBuffer())
          .then(arrayBuffer => {
            return renderPdfPages(arrayBuffer, pdfContainerRef.current);
          })
          .then(() => {
            setPdfRendering(false);
          })
          .catch(err => {
            console.error('Error loading PDF from URL:', err);
            setPdfRendering(false);
          });
      }
    }
  }, [showPdfViewer, pdfBase64, pdfUrl]);

  if (isEditing) {
    return (
      <div className="app-container" style={{ maxWidth: '1400px' }}>
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
        <div className="builder-layout" style={{
          display: 'grid',
          gridTemplateColumns: showPdfViewer ? '1fr 1fr 1.2fr' : '1.2fr 1.5fr',
          gap: '1.5rem',
          maxWidth: '100%',
          transition: 'all 0.3s ease'
        }}>
          
          {/* 0. PDF Viewer panel */}
          {showPdfViewer && (
            <div className="glass" style={{ padding: '1.5rem', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={16} style={{ color: 'var(--primary)' }} /> Exam PDF Reference
                </h3>
                <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => setShowPdfViewer(false)}>
                  Hide
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }} ref={pdfContainerRef}>
                {pdfRendering && (
                  <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                    <div style={{ width: '30px', height: '30px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }}></div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rendering pages...</span>
                  </div>
                )}
              </div>
            </div>
          )}

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

                {/* Exam Mode Toggle */}
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Exam Delivery Mode</label>
                  <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '8px' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        fontSize: '0.85rem',
                        background: examType === 'live' ? 'var(--primary)' : 'transparent',
                        color: 'white',
                        borderRadius: '6px'
                      }}
                      onClick={() => setExamType('live')}
                    >
                      Live Exam
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        fontSize: '0.85rem',
                        background: examType === 'static' ? 'var(--primary)' : 'transparent',
                        color: 'white',
                        borderRadius: '6px'
                      }}
                      onClick={() => setExamType('static')}
                    >
                      Self-Paced
                    </button>
                  </div>
                </div>

                {/* Advanced Exam Toggles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0, 0, 0, 0.15)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Timed Exam (Countdown)</span>
                    <input
                      type="checkbox"
                      checked={isTimed}
                      onChange={(e) => setIsTimed(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Allow Back & Forth Navigation</span>
                    <input
                      type="checkbox"
                      checked={allowNavigation}
                      onChange={(e) => setAllowNavigation(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Randomize Question Order</span>
                    <input
                      type="checkbox"
                      checked={randomizeQuestions}
                      onChange={(e) => setRandomizeQuestions(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>
                </div>

                {examType === 'static' && staticPin && (
                  <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1.5px solid rgba(99, 102, 241, 0.2)', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>ACTIVE STUDENT PIN (VALID 24H)</div>
                    <strong style={{ fontSize: '1.5rem', color: 'white', letterSpacing: '0.05em' }}>{staticPin}</strong>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Students join by entering this PIN on the home page.
                    </div>
                  </div>
                )}

                {/* PDF Upload widget */}
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Source PDF (Optional)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <label className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center' }}>
                      {(pdfBase64 || pdfUrl) ? 'Change PDF' : 'Upload Exam PDF'}
                      <input
                        type="file"
                        accept="application/pdf"
                        style={{ display: 'none' }}
                        onChange={handlePdfUpload}
                      />
                    </label>
                    {(pdfBase64 || pdfUrl) && !showPdfViewer && (
                      <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => setShowPdfViewer(true)}>
                        Show PDF
                      </button>
                    )}
                    {(pdfBase64 || pdfUrl) && (
                      <button type="button" className="btn btn-danger" style={{ padding: '0.5rem', borderRadius: '8px' }} onClick={() => { setPdfBase64(''); setPdfUrl(''); setShowPdfViewer(false); }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {pdfParsing && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.3rem' }} className="animate-pulse">
                      Analyzing and extracting text from PDF...
                    </div>
                  )}
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
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', border: '1.5px dashed var(--border-color)', borderRadius: '8px' }}>
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
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.3rem', borderRadius: '4px', color: 'var(--text-muted)' }}>
                          {q.type ? q.type.substring(0, 5) : 'mc'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          {q.timeLimit}s
                        </span>
                        <button
                          type="button"
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
              {/* Question Type Selection */}
              <div>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Question Type</label>
                <select
                  className="input-field"
                  value={questionType}
                  onChange={(e) => {
                    const type = e.target.value;
                    setQuestionType(type);
                    if (type === 'true_false') {
                      setOptions(['True', 'False']);
                      setCorrectAnswer(0);
                    } else if (type === 'multiple_choice') {
                      setOptions(['', '', '', '']);
                      setCorrectAnswer(0);
                    } else {
                      setOptions([]);
                      setCorrectAnswer('');
                    }
                  }}
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="matching">Matching Pairs</option>
                </select>
              </div>

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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No image</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Conditional Question Fields depending on Type */}

              {/* A. Multiple Choice */}
              {questionType === 'multiple_choice' && (
                <div>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    Answer Choices (Check correct option circle)
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
                            border: parseInt(correctAnswer) === idx ? 'none' : '2px solid var(--border-color)',
                            background: parseInt(correctAnswer) === idx ? 'linear-gradient(135deg, var(--primary), var(--accent))' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                        >
                          {parseInt(correctAnswer) === idx && <Check size={16} color="white" />}
                        </button>
                        
                        <input
                          type="text"
                          className="input-field"
                          style={{ 
                            borderColor: optionInputBorders[idx],
                            background: parseInt(correctAnswer) === idx ? 'rgba(255,255,255,0.03)' : ''
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
              )}

              {/* B. True/False */}
              {questionType === 'true_false' && (
                <div>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    Select Correct Value
                  </label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    {['True', 'False'].map((val, idx) => {
                      const isSelected = parseInt(correctAnswer) === idx;
                      return (
                        <button
                          type="button"
                          key={idx}
                          className="btn"
                          onClick={() => setCorrectAnswer(idx)}
                          style={{
                            flex: 1,
                            background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                            border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            color: 'white'
                          }}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* C. Short Answer */}
              {questionType === 'short_answer' && (
                <div>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    Correct Answer Text (Case-Insensitive matching)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Paris"
                    value={String(correctAnswer)}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                  />
                </div>
              )}

              {/* D. Matching */}
              {questionType === 'matching' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Matching Pairs</label>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                      onClick={() => setMatchPairs([...matchPairs, { left: '', right: '' }])}
                    >
                      + Add Pair
                    </button>
                  </div>
                  {matchPairs.map((pair, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Left item"
                        value={pair.left}
                        onChange={(e) => {
                          const updated = [...matchPairs];
                          updated[idx].left = e.target.value;
                          setMatchPairs(updated);
                        }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>➔</span>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Right matching item"
                        value={pair.right}
                        onChange={(e) => {
                          const updated = [...matchPairs];
                          updated[idx].right = e.target.value;
                          setMatchPairs(updated);
                        }}
                      />
                      {matchPairs.length > 2 && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '0.5rem', borderRadius: '8px' }}
                          onClick={() => setMatchPairs(matchPairs.filter((_, pIdx) => pIdx !== idx))}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

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
                    <option value="500">500 points</option>
                    <option value="1000">1000 points</option>
                    <option value="2000">2000 points</option>
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

                        <div style={{ textAlign: 'right', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            onClick={() => setViewingResultDetail(res)}
                          >
                            View Detail
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem', borderRadius: '8px' }}
                            title="Download Report (CSV)"
                            onClick={() => handleDownloadCSV(res)}
                          >
                            <Download size={14} />
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.4rem', borderRadius: '8px' }}
                            title="Delete Record"
                            onClick={() => handleDeleteResult(res.id)}
                          >
                            <Trash2 size={14} />
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
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                  onClick={() => handleDownloadCSV(viewingResultDetail)}
                >
                  <Download size={14} /> Download Report
                </button>
                <button 
                  className="btn btn-danger" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
                  onClick={() => handleDeleteResult(viewingResultDetail.id)}
                >
                  <Trash2 size={14} /> Delete
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} onClick={() => setViewingResultDetail(null)}>
                  <X size={18} />
                </button>
              </div>
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
