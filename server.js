import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'service-account.json');
let adminApp;

try {
  if (fs.existsSync(serviceAccountPath)) {
    adminApp = initializeApp({
      credential: cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')))
    });
    console.log('Firebase Admin initialized with local service-account.json.');
  } else {
    adminApp = initializeApp({
      projectId: 'examify-a4aa2'
    });
    console.log('Firebase Admin initialized with Application Default Credentials (ADC).');
  }
} catch (e) {
  console.error('Firebase Admin initialization error:', e);
}

const db = getFirestore();

// Helper to hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Authentication Middleware
async function authenticateTeacher(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Malformed token' });
  }

  const parts = token.split('_');
  const username = parts[0];
  
  try {
    const docRef = db.collection('examify_teachers').doc(username.toLowerCase().trim());
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.teacherUsername = doc.data().username;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(500).json({ error: 'Internal server error checking credentials' });
  }
}

// 1. Auth REST Endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const normalizedUsername = username.trim();
  const docId = normalizedUsername.toLowerCase();

  try {
    const docRef = db.collection('examify_teachers').doc(docId);
    const doc = await docRef.get();
    if (doc.exists) {
      return res.status(400).json({ error: 'Username is already registered' });
    }

    const newTeacher = {
      username: normalizedUsername,
      passwordHash: hashPassword(password)
    };
    
    await docRef.set(newTeacher);

    const token = `${newTeacher.username}_${Date.now()}`;
    res.json({ success: true, token, username: newTeacher.username });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register teacher' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const docId = username.trim().toLowerCase();

  try {
    const docRef = db.collection('examify_teachers').doc(docId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const teacher = doc.data();
    const inputHash = hashPassword(password);
    if (teacher.passwordHash !== inputHash) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = `${teacher.username}_${Date.now()}`;
    res.json({ success: true, token, username: teacher.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// 2. Exams REST Endpoints (Protected)
app.get('/api/exams', authenticateTeacher, async (req, res) => {
  try {
    const snapshot = await db.collection('examify_exams')
      .where('createdBy', '==', req.teacherUsername)
      .get();
    
    const exams = [];
    snapshot.forEach(doc => {
      exams.push(doc.data());
    });
    res.json(exams);
  } catch (err) {
    console.error('Get exams error:', err);
    res.status(500).json({ error: 'Failed to retrieve exams' });
  }
});

app.post('/api/exams', authenticateTeacher, async (req, res) => {
  const newExam = req.body;
  
  if (!newExam.id) {
    newExam.id = 'exam_' + Date.now();
  }

  newExam.createdBy = req.teacherUsername;

  try {
    const docRef = db.collection('examify_exams').doc(newExam.id);
    const doc = await docRef.get();
    
    if (doc.exists) {
      if (doc.data().createdBy !== req.teacherUsername) {
        return res.status(403).json({ error: 'You do not own this exam' });
      }
    }

    await docRef.set(newExam);
    res.json({ success: true, exam: newExam });
  } catch (err) {
    console.error('Save exam error:', err);
    res.status(500).json({ error: 'Failed to save exam' });
  }
});

app.delete('/api/exams/:id', authenticateTeacher, async (req, res) => {
  try {
    const docRef = db.collection('examify_exams').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    if (doc.data().createdBy !== req.teacherUsername) {
      return res.status(403).json({ error: 'You do not own this exam' });
    }

    await docRef.delete();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete exam error:', err);
    res.status(500).json({ error: 'Failed to delete exam' });
  }
});

// 3. Results REST Endpoints (Protected)
app.get('/api/results', authenticateTeacher, async (req, res) => {
  try {
    const snapshot = await db.collection('examify_results')
      .where('hostUsername', '==', req.teacherUsername)
      .get();
    
    const results = [];
    snapshot.forEach(doc => {
      results.push(doc.data());
    });
    
    // Sort results by date descending (newest first)
    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(results);
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ error: 'Failed to retrieve results log' });
  }
});

// Serve frontend in production (serve dist folder dynamically when present)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-Memory Game State
const rooms = new Map();

function generatePIN() {
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(pin));
  return pin;
}

// Emits progress breakdown to host
function sendHostProgressUpdate(pin) {
  const room = rooms.get(pin);
  if (!room) return;

  const playerProgress = Object.values(room.players).map(p => ({
    nickname: p.nickname,
    currentQuestionIndex: p.currentQuestionIndex,
    score: p.score,
    streak: p.streak,
    correctCount: p.correctCount,
    answerSubmitted: p.answerSubmitted,
    finished: p.finished || false
  }));

  io.to(room.hostId).emit('host-progress-update', {
    players: playerProgress,
    totalQuestions: room.questions.length
  });
}

// Emits specific question directly to a single student socket
function sendQuestionToStudent(socketId, pin, questionIndex) {
  const room = rooms.get(pin);
  if (!room) return;
  const player = room.players[socketId];
  if (!player) return;

  player.currentQuestionIndex = questionIndex;
  player.answerSubmitted = false;
  player.answerIndex = -1;
  player.answerTime = 0;

  const question = room.questions[questionIndex];
  const studentQuestion = {
    index: questionIndex,
    totalQuestions: room.questions.length,
    question: question.question,
    options: question.options,
    image: question.image,
    timeLimit: question.timeLimit
  };

  io.to(socketId).emit('student-question-start', studentQuestion);
  sendHostProgressUpdate(pin);
}

async function finishGame(pin) {
  const room = rooms.get(pin);
  if (!room) return;

  room.status = 'FINISHED';
  
  const sortedPlayers = Object.values(room.players)
    .sort((a, b) => b.score - a.score);

  const podium = {
    first: sortedPlayers[0] ? { nickname: sortedPlayers[0].nickname, score: sortedPlayers[0].score } : null,
    second: sortedPlayers[1] ? { nickname: sortedPlayers[1].nickname, score: sortedPlayers[1].score } : null,
    third: sortedPlayers[2] ? { nickname: sortedPlayers[2].nickname, score: sortedPlayers[2].score } : null
  };

  // Save results logs
  try {
    const resultId = 'session_' + Date.now();
    const resultRecord = {
      id: resultId,
      pin: room.pin,
      quizId: room.examId,
      title: room.title,
      date: new Date().toISOString(),
      hostUsername: room.hostUsername,
      playersCount: sortedPlayers.length,
      players: sortedPlayers.map(p => ({
        nickname: p.nickname,
        score: p.score,
        correctCount: p.correctCount,
        totalQuestions: room.questions.length
      }))
    };
    
    await db.collection('examify_results').doc(resultId).set(resultRecord);
    console.log(`Saved exam results for PIN ${pin} to Firestore`);
  } catch (e) {
    console.error('Failed to log exam results to Firestore:', e);
  }

  io.to(pin).emit('game-over', { podium });
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Host Room Create
  socket.on('host-game', async ({ quizId, token }) => {
    if (!token) {
      socket.emit('error-msg', { message: 'Authentication token missing.' });
      return;
    }
    const hostUsername = token.split('_')[0];
    
    try {
      const docRef = db.collection('examify_teachers').doc(hostUsername.toLowerCase().trim());
      const doc = await docRef.get();
      if (!doc.exists) {
        socket.emit('error-msg', { message: 'Invalid host credentials.' });
        return;
      }

      const examDocRef = db.collection('examify_exams').doc(quizId);
      const examDoc = await examDocRef.get();
      if (!examDoc.exists) {
        socket.emit('error-msg', { message: 'Exam not found.' });
        return;
      }
      const exam = examDoc.data();

      const pin = generatePIN();
      const roomState = {
        pin,
        examId: exam.id,
        title: exam.title,
        hostId: socket.id,
        hostUsername,
        status: 'LOBBY',
        questions: exam.questions,
        currentQuestionIndex: -1,
        players: {}
      };

      rooms.set(pin, roomState);
      socket.join(pin);
      
      socket.emit('game-created', { pin, title: exam.title });
      console.log(`Game created with PIN ${pin} by host ${hostUsername}`);
    } catch (err) {
      console.error('Socket host-game error:', err);
      socket.emit('error-msg', { message: 'Server database error during room setup.' });
    }
  });

  // 2. Student Joins Room
  socket.on('join-game', ({ pin, nickname }) => {
    const cleanPin = pin.trim();
    const room = rooms.get(cleanPin);

    if (!room) {
      socket.emit('join-error', { message: 'Exam room not found. Check the PIN!' });
      return;
    }
    if (room.status !== 'LOBBY') {
      socket.emit('join-error', { message: 'This exam has already started!' });
      return;
    }

    const nameExists = Object.values(room.players).some(p => p.nickname.toLowerCase() === nickname.trim().toLowerCase());
    if (nameExists) {
      socket.emit('join-error', { message: 'Nickname is already taken in this exam!' });
      return;
    }

    room.players[socket.id] = {
      id: socket.id,
      nickname: nickname.trim(),
      score: 0,
      streak: 0,
      correctCount: 0,
      currentQuestionIndex: -1,
      answerSubmitted: false,
      answerIndex: -1,
      answerTime: 0,
      lastCorrect: false,
      finished: false
    };

    socket.join(cleanPin);
    socket.emit('join-success', { pin: cleanPin, nickname: nickname.trim() });
    
    io.to(room.hostId).emit('player-list-update', Object.values(room.players).map(p => p.nickname));
    console.log(`Student ${nickname} joined room ${cleanPin}`);
  });

  // 3. Host Starts Game (Student-paced launch)
  socket.on('start-game', ({ pin }) => {
    const room = rooms.get(pin);
    if (!room || room.hostId !== socket.id) return;

    room.status = 'IN_PROGRESS';
    io.to(pin).emit('game-starting');

    setTimeout(() => {
      // Trigger question 1 for all joined players
      Object.keys(room.players).forEach(pId => {
        sendQuestionToStudent(pId, pin, 0);
      });
      // Notify host dashboard that everyone is in progress
      io.to(room.hostId).emit('host-game-started');
    }, 3200);
  });

  // 4. Student Answers Question
  socket.on('submit-answer', ({ pin, answerIndex, timeSpent }) => {
    const room = rooms.get(pin);
    if (!room || room.status !== 'IN_PROGRESS') return;

    const player = room.players[socket.id];
    if (!player || player.answerSubmitted) return;

    player.answerSubmitted = true;
    player.answerIndex = answerIndex;
    player.answerTime = timeSpent;

    const question = room.questions[player.currentQuestionIndex];
    const isCorrect = answerIndex === question.correctAnswer;
    
    player.lastCorrect = isCorrect;
    let pointsEarned = 0;

    if (isCorrect) {
      const ratio = Math.min(1, timeSpent / question.timeLimit);
      const scoreModifier = 1 - (ratio / 2);
      pointsEarned = Math.round(question.points * scoreModifier);
      
      player.streak++;
      player.correctCount++;
      player.score += pointsEarned;
    } else {
      player.streak = 0;
    }

    player.lastPointsEarned = pointsEarned;

    // Send individual correctness feedback immediately
    socket.emit('student-question-results', {
      correct: isCorrect,
      pointsEarned,
      score: player.score,
      streak: player.streak,
      correctAnswerIndex: question.correctAnswer
    });

    sendHostProgressUpdate(pin);
  });

  // 5. Student Requests Next Question
  socket.on('request-student-next-question', ({ pin }) => {
    const room = rooms.get(pin);
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;

    const nextIndex = player.currentQuestionIndex + 1;
    if (nextIndex < room.questions.length) {
      sendQuestionToStudent(socket.id, pin, nextIndex);
    } else {
      // Completed last question
      player.finished = true;
      socket.emit('student-finished');
      sendHostProgressUpdate(pin);

      // Verify if all connected students completed the exam
      const allFinished = Object.values(room.players).every(p => p.finished);
      if (allFinished) {
        io.to(room.hostId).emit('all-players-finished');
      }
    }
  });

  // 6. Host Ends Game Early / Displays Podium
  socket.on('end-game-early', ({ pin }) => {
    const room = rooms.get(pin);
    if (!room || room.hostId !== socket.id) return;

    finishGame(pin);
  });

  // 7. Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    for (const [pin, room] of rooms.entries()) {
      if (room.hostId === socket.id) {
        io.to(pin).emit('host-disconnected');
        rooms.delete(pin);
        console.log(`Room ${pin} deleted because host disconnected`);
        break;
      }

      if (room.players[socket.id]) {
        const nickname = room.players[socket.id].nickname;
        delete room.players[socket.id];
        
        io.to(room.hostId).emit('player-list-update', Object.values(room.players).map(p => p.nickname));
        
        if (room.status === 'IN_PROGRESS') {
          sendHostProgressUpdate(pin);
          
          // Check if remaining players are finished
          const activePlayers = Object.values(room.players);
          if (activePlayers.length > 0) {
            const allFinished = activePlayers.every(p => p.finished);
            if (allFinished) {
              io.to(room.hostId).emit('all-players-finished');
            }
          }
        }
        console.log(`Player ${nickname} left room ${pin}`);
        break;
      }
    }
  });
});

// Auto-seed Firestore on boot
async function seedDefaultExams() {
  try {
    const snapshot = await db.collection('examify_exams').limit(1).get();
    if (snapshot.empty) {
      console.log('examify_exams collection is empty. Seeding default exams...');
      const localExamsFile = path.join(__dirname, 'exams.json');
      let defaultExams = [];
      if (fs.existsSync(localExamsFile)) {
        defaultExams = JSON.parse(fs.readFileSync(localExamsFile, 'utf8'));
      }
      
      if (defaultExams.length === 0) {
        defaultExams = [
          {
            id: "exam_default_1",
            title: "General Knowledge Quiz",
            description: "A quick, fun general knowledge quiz with base points and timers.",
            createdBy: "hassan",
            questions: [
              {
                question: "Which planet is known as the Red Planet?",
                options: ["Earth", "Mars", "Jupiter", "Venus"],
                correctAnswer: 1,
                timeLimit: 15,
                points: 1000
              },
              {
                question: "What is the capital city of France?",
                options: ["London", "Rome", "Berlin", "Paris"],
                correctAnswer: 3,
                timeLimit: 15,
                points: 1000
              }
            ]
          }
        ];
      }

      for (const exam of defaultExams) {
        await db.collection('examify_exams').doc(exam.id).set(exam);
        console.log(`Seeded exam: ${exam.title}`);
      }
      console.log('Seeding completed successfully.');
    } else {
      console.log('examify_exams contains existing data. Skipping seed.');
    }
  } catch (e) {
    console.error('Error seeding default exams:', e);
  }
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
  await seedDefaultExams();
});
