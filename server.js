import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-load questions for all rooms
let questionPool = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/mockQuestions.json'), 'utf8'));
const khaleejiWordsPool = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/khaleejiWords.json'), 'utf8'));
let pixelChallengePool = [];
try {
    pixelChallengePool = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/pixelChallenge.json'), 'utf8'));
} catch (e) {
    console.error("Error loading pixelChallenge.json:", e.message);
}
let drawingWordsPool = [];
try {
    drawingWordsPool = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/drawingWords.json'), 'utf8'));
} catch (e) {
    console.error("Error loading drawingWords.json:", e.message);
}

const ARABIC_LETTERS = [
    'أ', 'ب', 'ت', 'ث', 'ج',
    'ح', 'خ', 'د', 'ذ', 'ر',
    'ز', 'س', 'ش', 'ص', 'ض',
    'ط', 'ظ', 'ع', 'غ', 'ف',
    'ق', 'ك', 'ل', 'م', 'ن',
    'هـ', 'و', 'ي', 'لا', 'ة'
];

function selectJeopardyQuestions(questionsPerCategory) {
    const selectedQuestions = [];
    // Filter out the "الحروف" category specifically used for Huroof game
    const jeopardyPool = questionPool.filter(q => q.category !== 'الحروف');
    const shuffledPool = [...jeopardyPool].sort(() => Math.random() - 0.5);
    const categoryCounts = {};

    shuffledPool.forEach(q => {
        if (!categoryCounts[q.category]) categoryCounts[q.category] = 0;
        if (categoryCounts[q.category] < questionsPerCategory) {
            selectedQuestions.push(q);
            categoryCounts[q.category]++;
        }
    });
    return selectedQuestions;
}

const app = express();
app.use(cors());
app.use(express.json());

// --- Admin API Routes ---
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password';
const ADMIN_TOKEN = 'mock-admin-token-123';

const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${ADMIN_TOKEN}`) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ token: ADMIN_TOKEN });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.get('/api/admin/questions', requireAuth, (req, res) => {
    res.json(questionPool);
});

app.post('/api/admin/questions', requireAuth, (req, res) => {
    const newQuestion = { ...req.body, id: `q-${Date.now()}`, isAnswered: false };
    questionPool.push(newQuestion);
    fs.writeFileSync(path.join(__dirname, 'src/data/mockQuestions.json'), JSON.stringify(questionPool, null, 2), 'utf8');
    res.json(newQuestion);
});

app.put('/api/admin/questions/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const index = questionPool.findIndex(q => q.id === id);
    if (index !== -1) {
        questionPool[index] = { ...questionPool[index], ...req.body };
        fs.writeFileSync(path.join(__dirname, 'src/data/mockQuestions.json'), JSON.stringify(questionPool, null, 2), 'utf8');
        res.json(questionPool[index]);
    } else {
        res.status(404).json({ error: 'Question not found' });
    }
});

app.delete('/api/admin/questions/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    questionPool = questionPool.filter(q => q.id !== id);
    fs.writeFileSync(path.join(__dirname, 'src/data/mockQuestions.json'), JSON.stringify(questionPool, null, 2), 'utf8');
    res.json({ success: true });
});
app.get('/api/admin/pixel-challenge', requireAuth, (req, res) => {
    res.json(pixelChallengePool);
});

app.put('/api/admin/pixel-challenge/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const index = pixelChallengePool.findIndex(q => q.id === id);
    if (index !== -1) {
        pixelChallengePool[index] = { ...pixelChallengePool[index], ...req.body };
        fs.writeFileSync(path.join(__dirname, 'src/data/pixelChallenge.json'), JSON.stringify(pixelChallengePool, null, 4), 'utf8');
        res.json(pixelChallengePool[index]);
    } else {
        res.status(404).json({ error: 'Question not found' });
    }
});
// -----------------------


app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve static files from the build folder
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA routing
app.get(/^(?!\/socket\.io|\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e7 // 10MB for drawing strokes
});

// In-memory room storage
const rooms = new Map();
const challengesPath = path.join(__dirname, 'src/data/challenges.json');
let challenges = new Map();

// Persistence helpers
function loadChallenges() {
    try {
        if (fs.existsSync(challengesPath)) {
            const data = JSON.parse(fs.readFileSync(challengesPath, 'utf8'));
            challenges = new Map(Object.entries(data));
            console.log(`[Persistence] Loaded ${challenges.size} challenges from disk`);
        }
    } catch (err) {
        console.error('[Persistence] Error loading challenges:', err);
    }
}

function saveChallenges() {
    try {
        const obj = Object.fromEntries(challenges);
        fs.writeFileSync(challengesPath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
        console.error('[Persistence] Error saving challenges:', err);
    }
}

loadChallenges();

// Cleanup old challenges: 24h old OR answered for more than 1h
setInterval(() => {
    const now = Date.now();
    let deletedCount = 0;
    const expirationMs = 24 * 60 * 60 * 1000; // 24 hours
    const gracePeriodMs = 60 * 60 * 1000;    // 1 hour after answer

    for (const [id, ch] of challenges.entries()) {
        const age = now - ch.createdAt;
        const timeSinceAnswered = ch.answeredAt ? now - ch.answeredAt : null;

        const isTooOld = age > expirationMs;
        const isAnsweredAndDone = ch.isAnswered && timeSinceAnswered && timeSinceAnswered > gracePeriodMs;

        if (isTooOld || isAnsweredAndDone) {
            challenges.delete(id);
            deletedCount++;
        }
    }
    if (deletedCount > 0) {
        console.log(`[Cleanup] Removed ${deletedCount} old challenges`);
        saveChallenges();
    }
}, 10 * 60 * 1000); // Check every 10 mins

function generateChallengeId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function checkHuroofWinner(grid, team) {
    const size = 5;
    const startNodes = [];
    const targetNodes = new Set();

    if (team === 'blue') {
        // Blue (Vertical): Top row to Bottom row
        for (let i = 0; i < size; i++) {
            if (grid[i].ownerTeam === 'blue') startNodes.push(i);
            targetNodes.add(size * (size - 1) + i);
        }
    } else {
        // Red (Horizontal): Left side to Right side
        for (let i = 0; i < size; i++) {
            const idx = i * size;
            if (grid[idx].ownerTeam === 'red') startNodes.push(idx);
            targetNodes.add(i * size + (size - 1));
        }
    }

    if (startNodes.length === 0) return false;

    const queue = [...startNodes];
    const visited = new Set(startNodes);

    while (queue.length > 0) {
        const current = queue.shift();
        if (targetNodes.has(current)) return true;

        const row = Math.floor(current / size);
        const col = current % size;

        // Hexagonal Neighbors (Staggered Row / Pointy Top logic)
        // Odd rows shifted right
        let neighbors = [];
        const isOddRow = row % 2 === 1;

        if (isOddRow) {
            neighbors = [
                { r: row, c: col - 1 }, // Left
                { r: row, c: col + 1 }, // Right
                { r: row - 1, c: col }, // Top-Left
                { r: row - 1, c: col + 1 }, // Top-Right
                { r: row + 1, c: col }, // Bottom-Left
                { r: row + 1, c: col + 1 } // Bottom-Right
            ];
        } else {
            neighbors = [
                { r: row, c: col - 1 }, // Left
                { r: row, c: col + 1 }, // Right
                { r: row - 1, c: col - 1 }, // Top-Left
                { r: row - 1, c: col }, // Top-Right
                { r: row + 1, c: col - 1 }, // Bottom-Left
                { r: row + 1, c: col } // Bottom-Right
            ];
        }

        for (const neighbor of neighbors) {
            if (neighbor.r >= 0 && neighbor.r < size && neighbor.c >= 0 && neighbor.c < size) {
                const nIdx = neighbor.r * size + neighbor.c;
                if (!visited.has(nIdx) && grid[nIdx].ownerTeam === team) {
                    visited.add(nIdx);
                    queue.push(nIdx);
                }
            }
        }
    }

    return false;
}

// Helper for smart answer checking
function isCorrectAnswer(input, correct) {
    if (!input || !correct) return false;
    return normalizeArabic(input) === normalizeArabic(correct);
}

function startQuestionTimer(room, io, roomId) {
    if (room._questionInterval) clearInterval(room._questionInterval);
    
    room._questionInterval = setInterval(() => {
        if (room.gameStatus !== 'question') {
            clearInterval(room._questionInterval);
            return;
        }

        if (room.timer > 0) {
            room.timer--;
            io.to(roomId).emit('room_data', room);
        } else {
            // Timer expired
            if (room.buzzedPlayerId) {
                // Buzzed player timed out
                const player = room.players.find(p => p.id === room.buzzedPlayerId);
                if (player) player.score -= (room.activeQuestion?.value || 0);
                
                if (!room.attempts) room.attempts = [];
                room.attempts.push(room.buzzedPlayerId);
                room.buzzedPlayerId = null;
                
                if (room.attempts.length >= room.players.length) {
                    room.feedback = {
                        type: 'all_wrong',
                        message: `انتهى الوقت! لم يتم الإجابة على السؤال.`,
                        answer: room.correctAnswer
                    };
                    if (room.gameType === 'huroof' && room.huroofHistory && room.huroofHistory.length > 0) {
                        room.huroofHistory[room.huroofHistory.length - 1].answeredBy = "لا أحد";
                    }
                    clearInterval(room._questionInterval);
                } else {
                    room.timer = 5; // Give others a small window to buzz
                }
                io.to(roomId).emit('room_data', room);
            } else {
                // Overall question timeout
                room.feedback = {
                    type: 'all_wrong',
                    message: `انتهى الوقت! لم يتم الإجابة على السؤال.`,
                    answer: room.correctAnswer
                };
                if (room.gameType === 'huroof' && room.huroofHistory && room.huroofHistory.length > 0) {
                    room.huroofHistory[room.huroofHistory.length - 1].answeredBy = "لا أحد";
                }
                io.to(roomId).emit('room_data', room);
                clearInterval(room._questionInterval);
            }
        }
    }, 1000);
}

// Helper for Arabic normalization
function normalizeArabic(text) {
    if (!text) return "";
    return text.trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u0652]/g, "") // Remove harakat
        .toLowerCase();
}

const CATEGORIES_BIN_O_WALAD = [
    { key: 'girl', label: 'بنت' },
    { key: 'boy', label: 'ولد' },
    { key: 'thing', label: 'جماد' },
    { key: 'food', label: 'أكل' },
    { key: 'animal', label: 'حيوان' },
    { key: 'location', label: 'بلاد' }
];

function endGame(room, io, roomId, forfeitingPlayerId = null, winningTeam = null) {
    const players = room.players;
    if (players.length === 0) return;

    let winner;
    let isForfeit = false;

    if (winningTeam) {
        room.gameStatus = 'game_over';
        room.winner = {
            name: winningTeam === 'red' ? 'الفريق الأحمر' : 'الفريق الأزرق',
            score: 0,
            isForfeit: false,
            winningTeam: winningTeam
        };
        room.activeQuestion = null;
        room.feedback = null;
        io.to(roomId).emit('room_data', room);
        return;
    }

    if (forfeitingPlayerId) {
        const others = players.filter(p => p.id !== forfeitingPlayerId);
        if (others.length > 0) {
            const sorted = [...others].sort((a, b) => b.score - a.score);
            winner = sorted[0];
            isForfeit = true;
        } else {
            const sorted = [...players].sort((a, b) => b.score - a.score);
            winner = sorted[0];
        }
    } else {
        const sorted = [...players].sort((a, b) => b.score - a.score);
        winner = sorted[0];
    }

    room.gameStatus = 'game_over';
    room.winner = {
        name: winner.name,
        score: winner.score,
        isForfeit: isForfeit,
        winningTeam: winner.team // Ensure team is included for UI consistency
    };
    room.activeQuestion = null;
    room.feedback = null;

    io.to(roomId).emit('room_data', room);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', (data) => {
        const { roomId, playerName, questionsPerCategory: rawQCount = 10, gameType } = data;
        const questionsPerCategory = Number(rawQCount);
        const requestedGameType = gameType || 'jeopardy';
        socket.join(roomId);

        console.log(`[Join Request] Room: ${roomId}, Player: ${playerName}, Type: ${requestedGameType}`);

        let room = rooms.get(roomId);

        if (!room) {
            console.log(`[Room Create] Creating new room ${roomId} as ${requestedGameType}`);
            let selectedQuestions = [];
            let huroofGrid = null;

            if (requestedGameType === 'jeopardy') {
                selectedQuestions = selectJeopardyQuestions(questionsPerCategory);
            } else if (requestedGameType === 'huroof') {
                // Initialize 5x5 grid for Huroof
                huroofGrid = [];
                for (let i = 0; i < 25; i++) {
                    huroofGrid.push({
                        id: i,
                        letter: ARABIC_LETTERS[i % ARABIC_LETTERS.length],
                        ownerId: null
                    });
                }
            } else if (requestedGameType === 'word_meaning') {
                const shuffledWords = [...khaleejiWordsPool].sort(() => Math.random() - 0.5);
                const pickedWords = shuffledWords.slice(0, questionsPerCategory);
                const allMeanings = khaleejiWordsPool.map(w => w.meaning);
                selectedQuestions = pickedWords.map(w => {
                    const wrongMeanings = allMeanings.filter(m => m !== w.meaning).sort(() => Math.random() - 0.5).slice(0, 3);
                    const options = [w.meaning, ...wrongMeanings].sort(() => Math.random() - 0.5);
                    return {
                        id: `wm-${Date.now()}-${Math.random()}`,
                        category: "معاني الكلمات",
                        value: 100,
                        question: w.word,
                        answer: w.meaning,
                        options: options,
                        isAnswered: false
                    };
                });
            } else if (requestedGameType === 'pixel_challenge') {
                const shuffled = [...pixelChallengePool].sort(() => Math.random() - 0.5);
                // Select 15 questions (10 main + 5 buffer for tie-breakers)
                selectedQuestions = shuffled.slice(0, questionsPerCategory + 5);
            } else if (requestedGameType === 'drawing_challenge') {
                selectedQuestions = [...drawingWordsPool].sort(() => Math.random() - 0.5);
            }

            rooms.set(roomId, {
                id: roomId,
                players: [],
                gameStatus: 'lobby',
                gameType: requestedGameType,
                questions: selectedQuestions.map(q => ({ ...q })),
                huroofGrid: huroofGrid,
                questionsPerCategory: questionsPerCategory,
                activeQuestion: null,
                selectedCategory: null,
                currentPlayerIndex: 0,
                timer: 0,
                attempts: [],
                feedback: null,
                winner: null,
                correctAnswer: null,
                buzzedPlayerId: null,
                // Bent o Walad specific
                roundCount: (requestedGameType === 'bin_o_walad' || requestedGameType === 'word_meaning' || requestedGameType === 'pixel_challenge' || requestedGameType === 'drawing_challenge') ? questionsPerCategory : 0,
                currentRound: 0,
                usedLetters: [],
                currentLetter: null,
                roundSubmissions: {}, // roomId -> { roundIndex -> { playerName -> { girl, boy, thing, food, animal, location } } }
                roundResults: [],
                creatorSocketId: socket.id,
                huroofHistory: [],
                sibaBoard: Array(9).fill(null),
                sibaPhase: 'setup',
                sibaPiecesPlaced: {},
                sibaTurn: null,
                // Drawing Challenge specific
                drawingDrawerIndex: 0,
                drawingCurrentWord: null,
                drawingCategory: null,
                drawingGuesses: {},
                drawingStrokes: []
            });
        }

        room = rooms.get(roomId);
        const existingPlayer = room.players.find(p => p.name === playerName);

        if (existingPlayer) {
            const oldId = existingPlayer.id;
            existingPlayer.id = socket.id;
            // Support rejoining drawer
            if (room.drawingDrawerId === oldId) {
                room.drawingDrawerId = socket.id;
            }
        } else {
            const playerNumber = room.players.length + 1;
            const team = playerNumber % 2 === 1 ? 'red' : 'blue';
            room.players.push({ id: socket.id, name: playerName, score: 0, number: playerNumber, team });
        }

        // Hide word for guessers on join
        if (room.gameType === 'drawing_challenge' && room.gameStatus === 'drawing_active') {
            // If someone joins a solo session, start the timer
            if (room.timer === -1 && room.players.length >= 2) {
                room.timer = 90; 
                console.log(`[Timer Start] Player joined room ${roomId} - Competitive timer active (90s)`);
            }
            
            const savedWord = room.drawingCurrentWord;
            room.drawingCurrentWord = null;
            socket.emit('room_data', room);
            room.drawingCurrentWord = savedWord;
        } else {
            socket.emit('room_data', room);
        }

        io.to(roomId).emit('room_data', room);
        console.log(`[Join] Player ${playerName} joined room ${roomId} (Game: ${gameType})`);
    });

    socket.on('create_room', ({ roomId, gameType, questionsPerCategory: rawQCount = 10 }) => {
        const questionsPerCategory = Number(rawQCount);
        const requestedGameType = gameType || 'jeopardy';
        let room = rooms.get(roomId);

        if (!room) {
            console.log(`[Room Create Early] Room ${roomId} as ${requestedGameType}`);
            let selectedQuestions = [];
            let huroofGrid = null;

            if (requestedGameType === 'jeopardy') {
                selectedQuestions = selectJeopardyQuestions(questionsPerCategory);
            } else if (requestedGameType === 'huroof') {
                huroofGrid = [];
                for (let i = 0; i < 25; i++) {
                    huroofGrid.push({
                        id: i,
                        letter: ARABIC_LETTERS[i % ARABIC_LETTERS.length],
                        ownerId: null
                    });
                }
            } else if (requestedGameType === 'word_meaning') {
                const shuffledWords = [...khaleejiWordsPool].sort(() => Math.random() - 0.5);
                const pickedWords = shuffledWords.slice(0, questionsPerCategory);
                const allMeanings = khaleejiWordsPool.map(w => w.meaning);
                selectedQuestions = pickedWords.map(w => {
                    const wrongMeanings = allMeanings.filter(m => m !== w.meaning).sort(() => Math.random() - 0.5).slice(0, 3);
                    const options = [w.meaning, ...wrongMeanings].sort(() => Math.random() - 0.5);
                    return {
                        id: `wm-${Date.now()}-${Math.random()}`,
                        category: "معاني الكلمات",
                        value: 100,
                        question: w.word,
                        answer: w.meaning,
                        options: options,
                        isAnswered: false
                    };
                });
            } else if (requestedGameType === 'pixel_challenge') {
                const shuffled = [...pixelChallengePool].sort(() => Math.random() - 0.5);
                // Select 15 questions (10 main + 5 buffer for tie-breakers)
                selectedQuestions = shuffled.slice(0, questionsPerCategory + 5);
            } else if (requestedGameType === 'drawing_challenge') {
                selectedQuestions = [...drawingWordsPool].sort(() => Math.random() - 0.5);
            }

            rooms.set(roomId, {
                id: roomId,
                players: [],
                gameStatus: 'lobby',
                gameType: requestedGameType,
                questions: selectedQuestions.map(q => ({ ...q })),
                huroofGrid: huroofGrid,
                questionsPerCategory: questionsPerCategory,
                activeQuestion: null,
                selectedCategory: null,
                currentPlayerIndex: 0,
                timer: 0,
                attempts: [],
                feedback: null,
                winner: null,
                correctAnswer: null,
                buzzedPlayerId: null,
                roundCount: (requestedGameType === 'bin_o_walad' || requestedGameType === 'word_meaning' || requestedGameType === 'pixel_challenge' || requestedGameType === 'drawing_challenge') ? questionsPerCategory : 0,
                currentRound: 0,
                usedLetters: [],
                currentLetter: null,
                roundSubmissions: {},
                roundResults: [],
                creatorSocketId: socket.id,
                huroofHistory: [],
                sibaBoard: Array(9).fill(null),
                sibaPhase: 'setup',
                sibaPiecesPlaced: {},
                sibaTurn: null,
                // Drawing Challenge specific
                drawingDrawerIndex: 0,
                drawingCurrentWord: null,
                drawingCategory: null,
                drawingGuesses: {},
                drawingStrokes: []
            });

            // Note: We don't join the socket to the room yet, 
            // but we can emit to the individual socket that the room is ready
            socket.emit('room_data', rooms.get(roomId));
        }
    });

    socket.on('get_room_status', (roomId) => {
        console.log(`[Status Request] Room: ${roomId}`);
        const room = rooms.get(roomId);
        if (room) {
            socket.emit('room_data', room);
        } else {
            console.log(`[Status Request] Room ${roomId} not found.`);
            // Emit a "not found" state or empty room so client stops loading
            socket.emit('room_data', { id: roomId, players: [], gameStatus: 'lobby', gameType: 'jeopardy', notFound: true });
        }
    });

    socket.on('update_settings', ({ roomId, questionsPerCategory: rawQCount }) => {
        const room = rooms.get(roomId);
        if (room && (room.players[0]?.id === socket.id || room.creatorSocketId === socket.id)) {
            const questionsPerCategory = Number(rawQCount);
            console.log(`[Update Settings] Room: ${roomId}, New count: ${questionsPerCategory}`);
            room.questionsPerCategory = questionsPerCategory;
            if (room.gameType === 'bin_o_walad' || room.gameType === 'pixel_challenge' || room.gameType === 'word_meaning' || room.gameType === 'drawing_challenge') {
                room.roundCount = questionsPerCategory;

                // For Pixel Challenge, re-select questions based on new count
                if (room.gameType === 'pixel_challenge') {
                    const shuffled = [...pixelChallengePool].sort(() => Math.random() - 0.5);
                    room.questions = shuffled.slice(0, questionsPerCategory + 5);
                }
            } else if (room.gameType === 'jeopardy') {
                room.questionsPerCategory = questionsPerCategory;
                // For Jeopardy, we should re-select questions
                room.questions = selectJeopardyQuestions(questionsPerCategory);
            }
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('rejoin_room', ({ roomId, playerName }) => {
        socket.join(roomId);
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.name === playerName);
            if (player) {
                player.id = socket.id;
                console.log(`Player ${playerName} re-joined room ${roomId} with new ID ${socket.id}`);
            }
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('get_active_rooms', () => {
        const activeRooms = [];
        for (const [id, room] of rooms.entries()) {
            if (room.gameStatus !== 'game_over' && room.players.length > 0) {
                activeRooms.push({
                    id: id,
                    gameType: room.gameType,
                    playerCount: room.players.length,
                    creatorName: room.players[0]?.name || 'لاعب غير معروف'
                });
            }
        }
        socket.emit('active_rooms', activeRooms);
    });

    socket.on('start_game', (roomId) => {
        const room = rooms.get(roomId);
        if (room && (room.players[0]?.id === socket.id || room.creatorSocketId === socket.id)) {
            console.log(`[Start Game] Room: ${roomId}, Type: ${room.gameType}`);
            if (room.gameType === 'bin_o_walad') {
                room.gameStatus = 'countdown';
                room.timer = 10;
                room.currentRound = 1;

                const countdownInterval = setInterval(() => {
                    if (room.timer > 0) {
                        room.timer--;
                        io.to(roomId).emit('room_data', room);
                    } else {
                        clearInterval(countdownInterval);
                        startBinOWaladRound(room, io, roomId);
                    }
                }, 1000);
            } else if (room.gameType === 'word_meaning') {
                room.gameStatus = 'countdown';
                room.timer = 5;
                room.currentRound = 1;

                const countdownInterval = setInterval(() => {
                    if (room.timer > 0) {
                        room.timer--;
                        io.to(roomId).emit('room_data', room);
                    } else {
                        clearInterval(countdownInterval);
                        startWordMeaningRound(room, io, roomId);
                    }
                }, 1000);
            } else if (room.gameType === 'pixel_challenge') {
                room.gameStatus = 'countdown';
                room.timer = 3;
                room.currentRound = 1;

                const countdownInterval = setInterval(() => {
                    if (room.timer > 0) {
                        room.timer--;
                        io.to(roomId).emit('room_data', room);
                    } else {
                        clearInterval(countdownInterval);
                        startPixelChallengeRound(room, io, roomId);
                    }
                }, 1000);
            } else if (room.gameType === 'siba') {
                room.gameStatus = 'siba_active';
                room.sibaPhase = 'placement';
                room.sibaTurn = room.players[0]?.id || null;
                room.sibaPiecesPlaced = {};
                room.sibaBoard = Array(9).fill(null);
            } else if (room.gameType === 'drawing_challenge') {
                room.gameStatus = 'countdown';
                room.timer = 3;
                room.currentRound = 1;
                room.drawingDrawerIndex = 0;
                room.drawingGuesses = {};
                room.drawingStrokes = [];

                const countdownInterval = setInterval(() => {
                    if (room.timer > 0) {
                        room.timer--;
                        io.to(roomId).emit('room_data', room);
                    } else {
                        clearInterval(countdownInterval);
                        startDrawingRound(room, io, roomId);
                    }
                }, 1000);
            } else {
                room.gameStatus = room.gameType === 'jeopardy' ? 'selecting_category' : 'selecting_letter';
            }
            io.to(roomId).emit('room_data', room);
        }
    });

    function startBinOWaladRound(room, io, roomId) {
        // Pick random unused letter
        const availableLetters = ARABIC_LETTERS.filter(l => !room.usedLetters.includes(l));
        if (availableLetters.length === 0 || room.currentRound > room.roundCount) {
            endGame(room, io, roomId);
            return;
        }

        const letter = availableLetters[Math.floor(Math.random() * availableLetters.length)];
        room.usedLetters.push(letter);
        room.currentLetter = letter;
        room.gameStatus = 'round_active';
        room.timer = 60;
        room.roundSubmissions[room.currentRound] = {};

        io.to(roomId).emit('room_data', room);

        const roundInterval = setInterval(() => {
            if (room.timer > 0 && room.gameStatus === 'round_active') {
                room.timer--;
                io.to(roomId).emit('room_data', room);
            } else {
                clearInterval(roundInterval);
                if (room.gameStatus === 'round_active') {
                    // Brief grace period for other clients to send partial inputs
                    setTimeout(() => scoreBinOWaladRound(room, io, roomId), 1200);
                }
            }
        }, 1000);
    }

    function scoreBinOWaladRound(room, io, roomId) {
        room.gameStatus = 'round_scoring';
        const currentRound = room.currentRound;
        const submissions = room.roundSubmissions[currentRound] || {};
        const players = room.players;
        const letter = room.currentLetter;

        const roundTotalScores = {}; // playerId -> score this round

        CATEGORIES_BIN_O_WALAD.forEach(cat => {
            const catKey = cat.key;
            const answers = {}; // normalized -> count

            players.forEach(p => {
                const sub = submissions[p.name];
                const rawAnswer = sub ? sub[catKey] : "";
                const normalized = normalizeArabic(rawAnswer);

                // Basic validation: must start with the correct letter and be at least 2 characters long
                if (normalized && rawAnswer.trim().startsWith(letter) && rawAnswer.trim().length > 1) {
                    answers[normalized] = (answers[normalized] || 0) + 1;
                } else {
                    // Invalid or empty
                }
            });

            players.forEach(p => {
                const sub = submissions[p.name];
                const rawAnswer = sub ? sub[catKey] : "";
                const normalized = normalizeArabic(rawAnswer);
                let score = 0;

                if (normalized && rawAnswer.trim().startsWith(letter) && rawAnswer.trim().length > 1) {
                    if (answers[normalized] === 1) {
                        score = 10;
                    } else {
                        score = 5;
                    }
                } else {
                    score = 0;
                }

                p.score += score;
                roundTotalScores[p.id] = (roundTotalScores[p.id] || 0) + score;
            });
        });

        room.roundResults.push({
            round: currentRound,
            letter: letter,
            scores: roundTotalScores,
            submissions: submissions
        });

        io.to(roomId).emit('room_data', room);

        // Wait 7 seconds to show results then start next round or end
        setTimeout(() => {
            if (room.currentRound < room.roundCount) {
                room.currentRound++;
                startBinOWaladRound(room, io, roomId);
            } else {
                endGame(room, io, roomId);
            }
        }, 7000);
    }

    socket.on('submit_round_bin_o_walad', ({ roomId, inputs }) => {
        const room = rooms.get(roomId);
        if (room && room.gameStatus === 'round_active') {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                room.roundSubmissions[room.currentRound][player.name] = inputs;

                // Immediate Finish: As soon as one player hits "Finished", set timer to 0
                room.timer = 0;
            }
            io.to(roomId).emit('room_data', room);
        }
    });

    function startWordMeaningRound(room, io, roomId) {
        if (room.currentRound > room.roundCount) {
            endGame(room, io, roomId);
            return;
        }

        const q = room.questions[room.currentRound - 1];

        const safeQuestion = { ...q };
        delete safeQuestion.answer;
        room.activeQuestion = safeQuestion;
        room.correctAnswer = q.answer;

        room.gameStatus = 'word_meaning_active';
        room.timer = 10;
        room.roundSubmissions = {};
        room.wordMeaningFeedback = {};
        room.feedback = null;

        io.to(roomId).emit('room_data', room);

        const roundInterval = setInterval(() => {
            if (room.timer > 0 && room.gameStatus === 'word_meaning_active') {
                room.timer--;
                io.to(roomId).emit('room_data', room);
            } else {
                clearInterval(roundInterval);
                if (room.gameStatus === 'word_meaning_active') {
                    scoreWordMeaningRound(room, io, roomId);
                }
            }
        }, 1000);
    }

    function scoreWordMeaningRound(room, io, roomId) {
        room.gameStatus = 'word_meaning_scoring';
        const q = room.questions[room.currentRound - 1];

        room.players.forEach(p => {
            const submission = room.roundSubmissions[p.id];
            if (submission && submission.answer === q.answer) {
                // Base 50 + up to 50 for speed (5 points per second left)
                const speedBonus = submission.timeLeft * 5;
                const totalPoints = 50 + speedBonus;
                p.score += totalPoints;

                // Send back the points earned for the UI to display
                if (room.wordMeaningFeedback[p.id]) {
                    room.wordMeaningFeedback[p.id].pointsEarned = totalPoints;
                }
            }
        });

        room.feedback = {
            type: 'info',
            message: `الإجابة الصحيحة هي: ${q.answer}`,
            answer: q.answer
        };

        io.to(roomId).emit('room_data', room);

        setTimeout(() => {
            room.currentRound++;
            room.feedback = null;
            room.activeQuestion = null;
            startWordMeaningRound(room, io, roomId);
        }, 5000); // 5 seconds wait to show score
    }

    socket.on('submit_word_meaning_answer', ({ roomId, answer }) => {
        const room = rooms.get(roomId);
        if (room && room.gameStatus === 'word_meaning_active') {
            const q = room.questions[room.currentRound - 1];
            room.roundSubmissions[socket.id] = { answer, timeLeft: room.timer };

            if (!room.wordMeaningFeedback) room.wordMeaningFeedback = {};
            room.wordMeaningFeedback[socket.id] = { answer, isCorrect: answer === q.answer };

            io.to(roomId).emit('room_data', room);

            if (Object.keys(room.roundSubmissions).length === room.players.length) {
                room.timer = 0;
            }
        }
    });

    function startPixelChallengeRound(room, io, roomId) {
        console.log(`[Pixel Challenge] Starting Round ${room.currentRound}/${room.roundCount} in room ${roomId}`);

        const baseRounds = room.roundCount;
        const maxRounds = baseRounds + 5; // Allow for tie-breakers

        if (room.currentRound > maxRounds || (room.currentRound > baseRounds && !room.isTieBreaker)) {
            console.log(`[Pixel Challenge] Ending game: currentRound ${room.currentRound}, baseRounds ${baseRounds}, isTieBreaker ${room.isTieBreaker}`);
            endGame(room, io, roomId);
            return;
        }

        if (!room.questions || !room.questions[room.currentRound - 1]) {
            console.error(`[Pixel Challenge] Error: No question for round ${room.currentRound} in room ${roomId}!`);
            endGame(room, io, roomId);
            return;
        }

        const q = room.questions[room.currentRound - 1];
        // Shuffle options for each round
        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);

        room.activeQuestion = {
            ...q,
            options: shuffledOptions
        };
        delete room.activeQuestion.answer;

        room.gameStatus = 'pixel_active';
        room.timer = 13;
        room.roundSubmissions = {};
        room.wordMeaningFeedback = {};
        room.feedback = null;

        io.to(roomId).emit('room_data', room);

        // Wait 1.5s before starting the timer to allow for image loading and transitions
        setTimeout(() => {
            const roundInterval = setInterval(() => {
                if (room.timer > 0 && room.gameStatus === 'pixel_active') {
                    room.timer--;
                    io.to(roomId).emit('room_data', room);
                } else {
                    clearInterval(roundInterval);
                    if (room.gameStatus === 'pixel_active') {
                        scorePixelChallengeRound(room, io, roomId);
                    }
                }
            }, 1000);
        }, 1500);
    }

    function scorePixelChallengeRound(room, io, roomId) {
        room.gameStatus = 'pixel_scoring';
        const q = room.questions[room.currentRound - 1];

        room.players.forEach(p => {
            const submission = room.roundSubmissions[p.id];
            if (submission && submission.answer === q.answer) {
                const timeLeft = submission.timeLeft;
                const totalPoints = 50 + (timeLeft * 5);
                p.score += totalPoints;

                if (room.wordMeaningFeedback[p.id]) {
                    room.wordMeaningFeedback[p.id].pointsEarned = totalPoints;
                }
            }
        });

        room.activeQuestion.answer = q.answer;
        room.feedback = {
            type: 'info',
            message: `الإجابة الصحيحة هي: ${q.answer}`,
            answer: q.answer
        };

        io.to(roomId).emit('room_data', room);

        setTimeout(() => {
            room.currentRound++;

            console.log(`[Pixel Challenge] Next Round candidate: ${room.currentRound}. roundCount: ${room.roundCount}, questions: ${room.questions.length}`);

            if (room.currentRound > room.roundCount || room.currentRound > room.questions.length) {
                // Check if there's a tie for first place
                const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
                const isTie = sortedPlayers.length > 1 && sortedPlayers[0].score === sortedPlayers[1].score;

                const baseRounds = room.roundCount;
                const maxRounds = room.questions.length;

                if (isTie && room.currentRound < maxRounds) {
                    room.isTieBreaker = true;
                    console.log(`[Pixel Challenge] Tie detected! Round ${room.currentRound + 1} will be tie-breaker. (Total Qs: ${maxRounds})`);
                } else {
                    console.log(`[Pixel Challenge] Ending game. currentRound: ${room.currentRound}, isTie: ${isTie}`);
                    endGame(room, io, roomId);
                    return;
                }
            }

            room.feedback = null;
            room.activeQuestion = null;
            startPixelChallengeRound(room, io, roomId);
        }, 5000);
    }

    socket.on('submit_pixel_answer', ({ roomId, answer }) => {
        const room = rooms.get(roomId);
        if (room && room.gameStatus === 'pixel_active') {
            const q = room.questions[room.currentRound - 1];
            room.roundSubmissions[socket.id] = { answer, timeLeft: room.timer };

            if (!room.wordMeaningFeedback) room.wordMeaningFeedback = {};
            room.wordMeaningFeedback[socket.id] = { answer, isCorrect: answer === q.answer };

            io.to(roomId).emit('room_data', room);

            if (Object.keys(room.roundSubmissions).length === room.players.length) {
                room.timer = 0;
            }
        }
    });

    socket.on('pick_category', ({ roomId, category }) => {
        const room = rooms.get(roomId);
        if (room) {
            const activePlayer = room.players[room.currentPlayerIndex];
            if (activePlayer && activePlayer.id !== socket.id) return;

            if (room.gameType === 'jeopardy') {
                room.selectedCategory = category;
                room.gameStatus = 'selecting_value';
            } else if (room.gameType === 'huroof') {
                const isLuck = Math.random() < 0.1;
                const player = room.players.find(p => p.id === socket.id);

                if (isLuck && player) {
                    const rewards = [
                        { msg: "تبريكاتنا! ربحت الخلية فوراً مع 200 عملة!", multiplier: 2, claim: true },
                        { msg: "أوه لا! خسرت 100 عملة ولم تحصل على الخلية!", multiplier: -1, claim: false },
                        { msg: "حظ سعيد! ربحت الخلية فوراً مع 100 عملة!", multiplier: 1, claim: true },
                        { msg: "يا للهول! تم خصم نصف رصيدك الحالي!", effect: 'halve', claim: false },
                        { msg: "يا لك من محظوظ! ربحت الخلية وتم مضاعفة رصيدك الحالي!", effect: 'double', claim: true },
                        { msg: "لا ربح ولا خسارة هذه المرة، والخلية لم تُملك.", multiplier: 0, claim: false }
                    ];
                    const randomReward = rewards[Math.floor(Math.random() * rewards.length)];

                    if (randomReward.multiplier !== undefined) {
                        player.score += (100 * randomReward.multiplier);
                    } else if (randomReward.effect === 'halve') {
                        player.score = Math.floor(player.score / 2);
                    } else if (randomReward.effect === 'double') {
                        player.score = player.score * 2;
                    }

                    if (randomReward.claim) {
                        // Claim the letter in the grid for the team
                        room.huroofGrid = room.huroofGrid.map(g =>
                            g.letter === category && g.ownerId === null ? { ...g, ownerId: socket.id, ownerTeam: player.team } : g
                        );
                    }

                    room.huroofHistory.push({
                        letter: category,
                        pickedBy: player.name,
                        question: randomReward.msg,
                        correctAnswer: "-",
                        answeredBy: "حظ"
                    });

                    room.feedback = {
                        type: 'luck',
                        message: `حظ: ${randomReward.msg}`,
                        reward: randomReward
                    };

                    room.activeQuestion = {
                        id: `luck-${Date.now()}`,
                        category: "حظ",
                        question: randomReward.msg,
                        value: 100,
                        isAnswered: true
                    };
                    room.correctAnswer = null;
                    room.selectedCategory = category;
                    room.timer = 15; // Reset timer for consistency
                    room.gameStatus = 'question';
                    startQuestionTimer(room, io, roomId);

                    // Check for team win if claimed
                    if (randomReward.claim && checkHuroofWinner(room.huroofGrid, player.team)) {
                        endGame(room, io, roomId, null, player.team);
                        return;
                    }
                } else {
                    // In Huroof, category is the letter. Pick a question starting with that letter or random if not found.
                    const validPool = questionPool.filter(q => q.answer && q.options);
                    const matchingQuestions = validPool.filter(q =>
                        (q.question && q.question.trim().startsWith(category)) ||
                        (q.answer && q.answer.trim().startsWith(category))
                    );
                    const pool = matchingQuestions.length > 0 ? matchingQuestions : validPool;
                    const question = pool[Math.floor(Math.random() * pool.length)];

                    // Ensure all options start with the same letter for Huroof mode
                    let huroofOptions = [];
                    const correctAnswer = question.answer || "";

                    // Get other answers from the pool that start with the same letter
                    const sameLetterAnswers = [...new Set(questionPool
                        .filter(q => q.answer && q.answer.trim().startsWith(category) && q.answer.trim() !== correctAnswer.trim())
                        .map(q => q.answer.trim())
                    )];

                    if (sameLetterAnswers.length >= 3) {
                        // Pick 3 random wrong answers starting with the same letter
                        const shuffledWrong = sameLetterAnswers.sort(() => 0.5 - Math.random());
                        huroofOptions = [correctAnswer, ...shuffledWrong.slice(0, 3)];
                    } else {
                        // Fallback: Use original options but try to filter them or keep as is
                        huroofOptions = [...question.options];
                    }

                    const shuffledOptions = huroofOptions.sort(() => 0.5 - Math.random());
                    const safeQuestion = { ...question, options: shuffledOptions, value: 100 }; // Huroof constant value
                    delete safeQuestion.answer;

                    room.activeQuestion = safeQuestion;
                    room.correctAnswer = correctAnswer;
                    room.selectedCategory = category; // Store the letter here
                    room.gameStatus = 'question';
                    room.timer = 15;
                    room.attempts = [];
                    room.feedback = null;
                    room.buzzedPlayerId = null;

                    room.huroofHistory.push({
                        letter: category,
                        pickedBy: room.players.find(p => p.id === socket.id)?.name || "Unknown",
                        question: safeQuestion.question,
                        correctAnswer: correctAnswer,
                        answeredBy: null // Will be filled when answered
                    });
                    room.timer = 15;
                    room.gameStatus = 'question';
                    startQuestionTimer(room, io, roomId);
                }
            }
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('pick_value', ({ roomId, value }) => {
        const room = rooms.get(roomId);
        if (room) {
            const activePlayer = room.players[room.currentPlayerIndex];
            if (activePlayer && activePlayer.id !== socket.id) return;

            const question = room.questions.find(q =>
                q.category === room.selectedCategory &&
                q.value === value &&
                !q.isAnswered
            );

            if (question) {
                const isLuck = question.type === 'luck' || Math.random() < 0.1;
                if (isLuck) {
                    const rewards = [
                        { msg: "تبريكاتنا! ربحت ضعف القيمة!", multiplier: 2 },
                        { msg: "أوه لا! خسرت القيمة!", multiplier: -1 },
                        { msg: "حظ سعيد! ربحت القيمة كاملة!", multiplier: 1 },
                        { msg: "يا للهول! تم خصم نصف رصيدك الحالي!", effect: 'halve' },
                        { msg: "يا لك من محظوظ! تم مضاعفة رصيدك الحالي!", effect: 'double' },
                        { msg: "لا ربح ولا خسارة هذه المرة.", multiplier: 0 }
                    ];
                    const randomReward = rewards[Math.floor(Math.random() * rewards.length)];
                    const player = room.players.find(p => p.id === socket.id);

                    if (player) {
                        if (randomReward.multiplier !== undefined) {
                            player.score += (question.value * randomReward.multiplier);
                        } else if (randomReward.effect === 'halve') {
                            player.score = Math.floor(player.score / 2);
                        } else if (randomReward.effect === 'double') {
                            player.score = player.score * 2;
                        }
                    }

                    room.questions = room.questions.map(q =>
                        q.id === question.id ? { ...q, isAnswered: true } : q
                    );
                    room.feedback = {
                        type: 'luck',
                        message: `حظ: ${randomReward.msg}`,
                        reward: randomReward
                    };
                    const safeQuestion = { ...question };
                    delete safeQuestion.answer;
                    room.activeQuestion = safeQuestion;
                    room.correctAnswer = null;
                    room.timer = 15; // Reset timer for luck questions as well
                    room.gameStatus = 'question';
                    startQuestionTimer(room, io, roomId);
                    io.to(roomId).emit('room_data', room);
                } else {
                    let safeQuestion = { ...question };
                    if (question.options) {
                        const shuffledOptions = [...question.options].sort(() => 0.5 - Math.random());
                        safeQuestion.options = shuffledOptions;
                    }
                    delete safeQuestion.answer;

                    room.activeQuestion = safeQuestion;
                    room.correctAnswer = question.answer;
                    room.gameStatus = 'question';
                    room.timer = 20; // 20 seconds for Jeopardy question
                    room.attempts = [];
                    room.feedback = null;
                    room.buzzedPlayerId = null;
                    startQuestionTimer(room, io, roomId);
                    io.to(roomId).emit('room_data', room);
                }
            }
        }
    });

    socket.on('buzz', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.gameStatus === 'question' && !room.buzzedPlayerId) {
            if (room.attempts && room.attempts.includes(socket.id)) return;
            room.buzzedPlayerId = socket.id;
            room.timer = 10; // 10 seconds to answer once buzzed
            startQuestionTimer(room, io, roomId); // Restart timer for buzzed player
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('submit_answer', ({ roomId, answer }) => {
        const room = rooms.get(roomId);
        if (room && room.activeQuestion && room.buzzedPlayerId === socket.id) {
            const player = room.players.find(p => p.id === socket.id);
            const isCorrect = isCorrectAnswer(answer, room.correctAnswer);

            if (isCorrect) {
                if (room._questionInterval) clearInterval(room._questionInterval);
                if (player) player.score += room.activeQuestion.value;
                room.feedback = { type: 'correct', message: `إجابة صحيحة! ${player?.name} حصل على ${room.activeQuestion.value} عملة.`, answer: room.correctAnswer };

                if (room.gameType === 'jeopardy') {
                    room.questions = room.questions.map(q =>
                        q.id === room.activeQuestion.id ? { ...q, isAnswered: true } : q
                    );
                } else if (room.gameType === 'huroof') {
                    if (room.huroofHistory && room.huroofHistory.length > 0) {
                        room.huroofHistory[room.huroofHistory.length - 1].answeredBy = player?.name || "Unknown";
                    }

                    // Claim the letter in the grid for the team
                    room.huroofGrid = room.huroofGrid.map(g =>
                        g.letter === room.selectedCategory && g.ownerId === null ? { ...g, ownerId: socket.id, ownerTeam: player.team } : g
                    );

                    // Check for team win
                    if (checkHuroofWinner(room.huroofGrid, player.team)) {
                        endGame(room, io, roomId, null, player.team);
                        return; // Game over, stop further processing
                    }
                }
            } else {
                if (player) player.score -= room.activeQuestion.value;
                if (!room.attempts) room.attempts = [];
                room.attempts.push(socket.id);
                room.buzzedPlayerId = null;

                if (room.attempts.length >= room.players.length) {
                    if (room._questionInterval) clearInterval(room._questionInterval);
                    room.feedback = {
                        type: 'all_wrong',
                        message: `عذراً، المحاولات انتهت والإجابات خاطئة.`,
                        answer: room.correctAnswer
                    };
                    if (room.gameType === 'huroof' && room.huroofHistory && room.huroofHistory.length > 0) {
                        room.huroofHistory[room.huroofHistory.length - 1].answeredBy = "لا أحد";
                    }
                    if (room.gameType === 'jeopardy') {
                        room.questions = room.questions.map(q =>
                            q.id === room.activeQuestion.id ? { ...q, isAnswered: true } : q
                        );
                    }
                } else {
                    room.feedback = { type: 'wrong', message: `خطأ! ${player?.name} فقد نقاطاً. بإمكان الآخرين المحاولة الآن!` };
                    room.timer = 5; // Return to pool for others
                    startQuestionTimer(room, io, roomId); // Restart timer for others to buzz
                }
            }
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('answer_question', ({ roomId, isCorrect }) => {
        const room = rooms.get(roomId);
        if (room && room.activeQuestion) {
            // Identity check: If buzzed, only the buzzed player can answer.
            // If NOT buzzed, this is likely a client-side timeout event.
            // With server-side timers, we should probably ignore client timeout events entirely,
            // or at least validate them.

            if (room.buzzedPlayerId && room.buzzedPlayerId !== socket.id) return;

            // If it's a timeout (isCorrect === false) and the server hasn't timed out yet,
            // we ignore it to let the server timer be the source of truth.
            if (!isCorrect && room.timer > 0) return;

            const player = room.players.find(p => p.id === socket.id);

            if (isCorrect) {
                if (room._questionInterval) clearInterval(room._questionInterval);
                if (player) player.score += room.activeQuestion.value;
                room.feedback = { type: 'correct', message: `إجابة صحيحة! ${player?.name} حصل على ${room.activeQuestion.value} عملة.`, answer: room.correctAnswer };

                if (room.gameType === 'jeopardy') {
                    room.questions = room.questions.map(q =>
                        q.id === room.activeQuestion.id ? { ...q, isAnswered: true } : q
                    );
                } else if (room.gameType === 'huroof') {
                    if (room.huroofHistory && room.huroofHistory.length > 0) {
                        room.huroofHistory[room.huroofHistory.length - 1].answeredBy = player?.name || "Unknown";
                    }
                    room.huroofGrid = room.huroofGrid.map(g =>
                        g.letter === room.selectedCategory && g.ownerId === null ? { ...g, ownerId: socket.id, ownerTeam: player.team } : g
                    );
                    if (checkHuroofWinner(room.huroofGrid, player.team)) {
                        endGame(room, io, roomId, null, player.team);
                        return;
                    }
                }
            } else {
                // Timeout or wrong answer from client
                room.feedback = {
                    type: 'all_wrong',
                    message: `انتهى الوقت! لم يتم الإجابة على السؤال.`,
                    answer: room.correctAnswer
                };
                if (room.gameType === 'huroof' && room.huroofHistory && room.huroofHistory.length > 0) {
                    room.huroofHistory[room.huroofHistory.length - 1].answeredBy = "لا أحد";
                }
                if (room.gameType === 'jeopardy') {
                    room.questions = room.questions.map(q =>
                        q.id === room.activeQuestion.id ? { ...q, isAnswered: true } : q
                    );
                }
            }
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('close_feedback', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            room.feedback = null;
            room.activeQuestion = null;
            room.selectedCategory = null;
            room.buzzedPlayerId = null;

            if (room.players.length > 0) {
                if (room.gameType === 'huroof' && room.players.length > 1) {
                    const currentPlayer = room.players[room.currentPlayerIndex];
                    let nextIndex = (room.currentPlayerIndex + 1) % room.players.length;

                    // Keep looking for a player on the opposite team
                    // Fallback to simple modulo if somehow all players are on the same team
                    let foundOpposite = false;
                    for (let i = 0; i < room.players.length; i++) {
                        if (room.players[nextIndex].team !== currentPlayer.team) {
                            foundOpposite = true;
                            break;
                        }
                        nextIndex = (nextIndex + 1) % room.players.length;
                    }
                    room.currentPlayerIndex = nextIndex;
                } else {
                    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
                }
            }

            room.gameStatus = room.gameType === 'jeopardy' ? 'selecting_category' : 'selecting_letter';

            const allAnswered = room.gameType === 'jeopardy' ? room.questions.every(q => q.isAnswered) : room.huroofGrid.every(g => g.ownerId !== null);
            if (allAnswered) {
                endGame(room, io, roomId);
            } else {
                io.to(roomId).emit('room_data', room);
            }
        }
    });

    socket.on('forfeit_game', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || room.gameStatus === 'game_over') return;

        // Only players who actually joined this room may forfeit (blocks late joiners with old links)
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;

        if (room.players.length <= 2) {
            // 2 players: forfeiting player loses, other wins
            endGame(room, io, roomId, socket.id);
        } else {
            // 3+ players: remove this player, game continues
            const leavingPlayer = room.players[playerIndex];
            room.players.splice(playerIndex, 1);
            console.log(`[Forfeit] ${leavingPlayer.name} left room ${roomId} — game continues with ${room.players.length} players`);

            // If drawing challenge and the drawer left, start the next round immediately
            if (room.gameType === 'drawing_challenge' && room.gameStatus === 'drawing_active' && leavingPlayer.id === room.drawingDrawerId) {
                if (room._drawingInterval) { clearInterval(room._drawingInterval); room._drawingInterval = null; }
                room.currentRound++;
                room.drawingDrawerIndex = playerIndex % room.players.length;
                if (room.currentRound > room.roundCount || room.players.length < 2) {
                    endGame(room, io, roomId);
                } else {
                    startDrawingRound(room, io, roomId);
                }
            } else {
                io.to(roomId).emit('room_data', room);
            }
        }
    });

    // =============================================
    // DRAWING CHALLENGE HANDLERS
    // =============================================

    function startDrawingRound(room, io, roomId) {
        if (room.currentRound > room.roundCount) {
            endGame(room, io, roomId);
            return;
        }

        const drawer = room.players[room.drawingDrawerIndex % room.players.length];
        if (!drawer) { endGame(room, io, roomId); return; }

        const wordEntry = room.questions[(room.currentRound - 1) % room.questions.length];
        const word = wordEntry ? wordEntry.word : 'كلمة';
        const category = wordEntry ? wordEntry.category : 'غير معروف';

        room.drawingCurrentWord = word;
        room.drawingCategory = category;
        room.drawingDrawerId = drawer.id;
        room.drawingGuesses = {};
        room.drawingStrokes = [];
        room.gameStatus = 'drawing_active';
        room.timer = room.players.length === 1 ? -1 : 90;
        room.feedback = null;

        console.log(`[Drawing] Round ${room.currentRound}/${room.roundCount} - Drawer: ${drawer.name}, Word: ${word}`);

        // Broadcast room data to EVERYONE but with the word hidden (null)
        const savedWord = room.drawingCurrentWord;
        room.drawingCurrentWord = null;
        // Mask word: preserve spaces and hyphens, turn other chars into underscores
        room.drawingMaskedWord = savedWord.split('').map(char => (char === ' ' || char === '-') ? char : '_').join('');
        io.to(roomId).emit('room_data', room);
        // Restore word on server for guessing logic
        room.drawingCurrentWord = savedWord;

        // Send secret word only to the drawer via a separate event
        const drawerSocket = io.sockets.sockets.get(drawer.id);
        if (drawerSocket) {
            drawerSocket.emit('drawing_your_word', { word });
        }

        const roundInterval = setInterval(() => {
            if (room.gameStatus !== 'drawing_active') {
                clearInterval(roundInterval);
                return;
            }

            if (room.timer === -1) {
                // Solo mode: no timer decrement, just broadcast periodically
                io.to(roomId).emit('drawing_timer', { timer: -1, roomId });
            } else if (room.timer > 0) {
                room.timer--;
                io.to(roomId).emit('drawing_timer', { timer: room.timer, roomId });
            } else {
                clearInterval(roundInterval);
                scoreDrawingRound(room, io, roomId);
            }
        }, 1000);

        // Store interval ref as non-enumerable to prevent socket.io from serializing it in room_data broadcasts
        Object.defineProperty(room, '_drawingInterval', {
            value: roundInterval,
            enumerable: false,
            writable: true,
            configurable: true
        });
    }

    function scoreDrawingRound(room, io, roomId) {
        if (room._drawingInterval) {
            clearInterval(room._drawingInterval);
            room._drawingInterval = null;
        }
        room.gameStatus = 'drawing_scoring';

        const word = room.drawingCurrentWord;
        const guesses = room.drawingGuesses || {};
        const drawerPlayer = room.players.find(p => p.id === room.drawingDrawerId);

        let correctGuessCount = 0;
        room.players.forEach(p => {
            if (p.id === room.drawingDrawerId) return;
            const g = guesses[p.id];
            if (g && g.correct) {
                const pts = 100; // Full points for guesser
                p.score += pts;
                g.pointsEarned = pts;
                correctGuessCount++;
            }
        });

        // Drawer earns 100 pts if someone recognized the word
        if (drawerPlayer && correctGuessCount > 0) {
            const drawerPts = 100; // Full points for artist
            drawerPlayer.score += drawerPts;
            if (guesses[drawerPlayer.id] === undefined) guesses[drawerPlayer.id] = {};
            guesses[drawerPlayer.id].pointsEarned = drawerPts;
        }

        room.drawingGuesses = guesses;
        room.drawingCurrentWord = word; // Reveal word during scoring

        // Broadcast full room with revealed word
        io.to(roomId).emit('room_data', room);

        setTimeout(() => {
            room.currentRound++;
            room.drawingDrawerIndex = (room.drawingDrawerIndex + 1) % room.players.length;
            room.feedback = null;
            room.drawingStrokes = [];

            if (room.currentRound > room.roundCount) {
                endGame(room, io, roomId);
            } else {
                startDrawingRound(room, io, roomId);
            }
        }, 6000);
    }

    // Relay draw strokes to all players in the room
    socket.on('drawing_stroke', ({ roomId, stroke }) => {
        const room = rooms.get(roomId);
        if (!room || room.gameStatus !== 'drawing_active') return;
        if (socket.id !== room.drawingDrawerId) return; // Only drawer can draw
        room.drawingStrokes.push(stroke);
        socket.to(roomId).emit('drawing_stroke', stroke);
    });

    // Drawer clears the canvas
    socket.on('drawing_clear', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || room.gameStatus !== 'drawing_active') return;
        if (socket.id !== room.drawingDrawerId) return;
        room.drawingStrokes = [];
        io.to(roomId).emit('drawing_clear');
    });

    // Player submits a guess
    socket.on('drawing_guess', ({ roomId, guess }) => {
        const room = rooms.get(roomId);
        if (!room || room.gameStatus !== 'drawing_active') return;
        if (socket.id === room.drawingDrawerId) return; // Drawer can't guess their own word

        const existingGuess = room.drawingGuesses[socket.id];
        if (existingGuess && existingGuess.correct) return; // Already guessed correctly

        const player = room.players.find(p => p.id === socket.id);
        
        const normalizeArabic = (s) => {
            if (!s) return '';
            return s.trim()
                .replace(/\s+/g, ' ')
                .replace(/[أإآ]/g, 'ا')
                .replace(/ة/g, 'ه')
                .replace(/ى/g, 'ي')
                .replace(/[ـ\u064B-\u0652]/g, '')
                .toLowerCase();
        };

        const nGuess = normalizeArabic(guess);
        const nWord = normalizeArabic(room.drawingCurrentWord);
        
        // Match if exact, or if guess is a significant part of the word (e.g. "ايفل" in "برج ايفل")
        const isCorrect = nGuess === nWord || 
                          (nGuess.length >= 3 && nWord.includes(nGuess)) ||
                          (nWord.length >= 3 && nGuess.includes(nWord));

        if (isCorrect) {
            room.drawingGuesses[socket.id] = { correct: true, timeLeft: room.timer, guess };
            io.to(roomId).emit('drawing_correct_guess', {
                playerName: player?.name || '?',
            });
            io.to(roomId).emit('room_data', room);

            // Mark challenge as answered if it's a session room
            if (roomId.startsWith('session_')) {
                const challengeId = roomId.replace('session_', '');
                const challenge = challenges.get(challengeId);
                if (challenge) {
                    challenge.isAnswered = true;
                    challenge.answeredAt = Date.now();
                    saveChallenges();
                    console.log(`[Challenge] Marked challenge ${challengeId} as answered`);
                }
            }

            // First correct guess ends the round immediately
            room.timer = 0;
            scoreDrawingRound(room, io, roomId);
        } else {
            room.drawingGuesses[socket.id] = { correct: false, guess };
            // Broadcast wrong guess to all (for the chat log)
            io.to(roomId).emit('drawing_wrong_guess', {
                playerId: socket.id,
                playerName: player?.name || '?',
                guess
            });
        }
    });

    socket.on('drawing_finish_round', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || room.gameType !== 'drawing_challenge' || room.gameStatus !== 'drawing_active') return;
        
        // Only the current drawer can finish the round manually
        if (room.drawingDrawerId !== socket.id) return;

        console.log(`[Drawing] Manual round finish in room ${roomId} by drawer`);
        room.timer = 0;
        scoreDrawingRound(room, io, roomId);
    });

    socket.on('siba_action', ({ roomId, action }) => {
        const room = rooms.get(roomId);
        if (!room || room.gameType !== 'siba' || room.gameStatus === 'game_over') return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Ensure 2 players are present
        if (room.players.length < 2) return;

        // Initialize Siba Turn First Move
        if (!room.sibaTurn) {
            room.sibaTurn = room.players[0].id;
        }

        // Only allow action if it's player's turn
        if (room.sibaTurn !== socket.id) return;

        const { type, from, to } = action;

        // Initialize tracking if empty
        if (!room.sibaPiecesPlaced[socket.id]) {
            room.sibaPiecesPlaced[socket.id] = 0;
        }

        const winLines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8]  // Columns
        ];

        const checkWin = (board) => {
            for (let line of winLines) {
                const [a, b, c] = line;
                if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                    return board[a];
                }
            }
            return null;
        };

        if (room.sibaPhase === 'setup') {
            room.sibaPhase = 'placement';
        }

        if (room.sibaPhase === 'placement' && type === 'place') {
            if (room.sibaPiecesPlaced[socket.id] >= 3) return; // Max 3
            if (room.sibaBoard[to] !== null) return; // Spot taken

            room.sibaBoard[to] = socket.id;
            room.sibaPiecesPlaced[socket.id]++;

            // Check if both players have placed 3 pieces
            const p1 = room.players[0]?.id;
            const p2 = room.players[1]?.id;
            if ((room.sibaPiecesPlaced[p1] || 0) === 3 && (room.sibaPiecesPlaced[p2] || 0) === 3) {
                room.sibaPhase = 'movement';
            }
        } else if (room.sibaPhase === 'movement' && type === 'move') {
            if (room.sibaBoard[from] !== socket.id) return; // Not their piece
            if (room.sibaBoard[to] !== null) return; // Target spot taken

            const adjacencies = {
                0: [1, 3],
                1: [0, 2, 4],
                2: [1, 5],
                3: [0, 4, 6],
                4: [1, 3, 5, 7],
                5: [2, 4, 8],
                6: [3, 7],
                7: [4, 6, 8],
                8: [5, 7]
            };

            if (!adjacencies[from].includes(to)) return; // Invalid move

            room.sibaBoard[from] = null;
            room.sibaBoard[to] = socket.id;
        } else {
            return; // Invalid phase/action combination
        }

        // Check for Win
        const winnerId = checkWin(room.sibaBoard);
        if (winnerId) {
            const winnerPlayer = room.players.find(p => p.id === winnerId);
            winnerPlayer.score += 100; // Give points
            endGame(room, io, roomId, null, null); // Will use highest score
            return; // endGame handles the broadcast
        }

        // Pass turn to next player
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
        room.sibaTurn = room.players[room.currentPlayerIndex].id;

        io.to(roomId).emit('room_data', room);
    });

    socket.on('create_challenge', ({ strokes, word, category }) => {
        try {
            console.log(`[Challenge] Creating challenge for word: ${word}, stroke count: ${strokes?.length || 0}`);
            if (!strokes || strokes.length === 0) {
                return socket.emit('challenge_error', 'يجب عليك الرسم أولاً');
            }
            const id = generateChallengeId();
            const challenge = { 
                id, 
                strokes, 
                word, 
                category, 
                creatorId: socket.id, // Store who created it
                createdAt: Date.now(), 
                isAnswered: false 
            };
            challenges.set(id, challenge);
            saveChallenges();
            socket.emit('challenge_created', challenge);
            console.log(`[Challenge] Created challenge ${id} successfully`);
        } catch (err) {
            console.error('[Challenge] Error creating challenge:', err);
            socket.emit('challenge_error', 'حدث خطأ في إنشاء التحدي');
        }
    });

    socket.on('join_challenge_session', ({ challengeId, playerName }) => {
        const roomId = `session_${challengeId}`;
        const challenge = challenges.get(challengeId);
        let room = rooms.get(roomId);
        if (!room) {
            room = {
                id: roomId,
                gameType: 'drawing_challenge',
                gameStatus: 'drawing_active',
                players: [],
                currentRound: 1,
                roundCount: 999,
                drawingDrawerId: null,
                drawingStrokes: [],
                drawingGuesses: {},
                drawingCurrentWord: challenge ? challenge.word : null,
                drawingCategory: challenge ? challenge.category : null,
                isPrivate: true,
                isSession: true,
                createdAt: Date.now()
            };
            rooms.set(roomId, room);
        }

        // Add player if not already in
        if (!room.players.find(p => p.id === socket.id)) {
            const player = { id: socket.id, name: playerName || 'لاعب', score: 0 };
            room.players.push(player);
        }

        socket.join(roomId);
        io.to(roomId).emit('room_data', room);
        console.log(`[Session] Player joined session ${challengeId}`);
    });

    socket.on('solo_challenge_solved', ({ challengeId, solverName }) => {
        const challenge = challenges.get(challengeId);
        if (challenge) {
            challenge.isAnswered = true;
            challenge.answeredAt = Date.now();
            saveChallenges();

            // Notify the creator if they are still online
            if (challenge.creatorId) {
                const creatorSocket = io.sockets.sockets.get(challenge.creatorId);
                if (creatorSocket) {
                    creatorSocket.emit('challenge_solved_notification', {
                        challengeId,
                        solverName: solverName || 'صديق',
                        word: challenge.word
                    });
                    console.log(`[Challenge] Notified creator ${challenge.creatorId} that challenge ${challengeId} was solved`);
                }
            }
        }
    });

    socket.on('send_session_challenge', ({ roomId, challengeId, playerName }) => {
        console.log(`[Session] Sending challenge ${challengeId} to room ${roomId}`);
        socket.to(roomId).emit('session_challenge_notification', {
            challengeId,
            playerName: playerName || 'صديق'
        });
    });

    socket.on('get_solo_word', () => {
        if (drawingWordsPool.length === 0) return;
        const randomItem = drawingWordsPool[Math.floor(Math.random() * drawingWordsPool.length)];
        
        // Check if player is in a session room
        let sessionRoom = null;
        for (const room of socket.rooms) {
            if (room.startsWith('session_')) {
                sessionRoom = rooms.get(room);
                break;
            }
        }

        if (sessionRoom) {
            sessionRoom.drawingDrawerId = socket.id;
            sessionRoom.drawingStrokes = [];
            sessionRoom.drawingGuesses = {};
            sessionRoom.drawingCurrentWord = randomItem.word;
            sessionRoom.drawingCategory = randomItem.category;
            sessionRoom.gameStatus = 'drawing_active';
            sessionRoom.timer = -1; // Solo/Session is infinite time
            
            // Mask word for others
            sessionRoom.drawingMaskedWord = randomItem.word.split('').map(char => (char === ' ' || char === '-') ? char : '_').join('');
            
            io.to(sessionRoom.id).emit('room_data', sessionRoom);
            console.log(`[Session] Started new round in ${sessionRoom.id} for ${socket.id}`);
        }

        socket.emit('drawing_your_word', { 
            word: randomItem.word, 
            category: randomItem.category,
            isSolo: true 
        });
        console.log(`[Solo/Session] Sent word ${randomItem.word} to ${socket.id}`);
    });

    socket.on('get_challenge', ({ challengeId }) => {
        const challenge = challenges.get(challengeId);
        if (challenge) {
            socket.emit('challenge_data', challenge);
        } else {
            socket.emit('challenge_error', 'التحدي غير موجود أو انتهت صلاحيته');
        }
    });

    socket.on('leave_room', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                console.log(`[Leave] Player ${room.players[playerIndex].name} left room ${roomId}`);
                room.players.splice(playerIndex, 1);
                
                // Update numbers for remaining players
                room.players.forEach((p, idx) => {
                    p.number = idx + 1;
                });

                if (room.players.length > 0) {
                    io.to(roomId).emit('room_data', room);
                } else {
                    console.log(`[Cleanup] Room ${roomId} is empty after leave.`);
                    rooms.delete(roomId);
                }
            }
        }
        socket.leave(roomId);
    });

    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                console.log(`[Disconnect] Player ${room.players[playerIndex].name} left room ${roomId}`);

                // If the player who left was the current player, reset turn or move to next
                if (room.currentPlayerIndex === playerIndex) {
                    room.currentPlayerIndex = 0; // Reset to first available player

                    // If they left during a question/feedback, clear it
                    if (room.gameStatus === 'question' || room.feedback) {
                        room.gameStatus = room.gameType === 'jeopardy' ? 'selecting_category' : 'selecting_letter';
                        room.activeQuestion = null;
                        room.feedback = null;
                        room.selectedCategory = null;
                        room.buzzedPlayerId = null;
                    }
                } else if (room.currentPlayerIndex > playerIndex) {
                    // Shift index back to keep the same relative player
                    room.currentPlayerIndex--;
                }

                room.players.splice(playerIndex, 1);

                // Update numbers for remaining players if needed
                room.players.forEach((p, idx) => {
                    p.number = idx + 1;
                });

                if (room.players.length > 0) {
                    // Sanitize room object to avoid crashing socket.io-parser on Timeout objects
                    const safeRoom = { ...room };
                    for (const key in safeRoom) {
                        if (key.startsWith('_')) delete safeRoom[key];
                    }
                    io.to(roomId).emit('room_data', safeRoom);
                } else {
                    console.log(`[Cleanup] Room ${roomId} is empty, removing.`);
                    rooms.delete(roomId);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
