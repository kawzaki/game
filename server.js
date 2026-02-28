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
const questionPool = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/mockQuestions.json'), 'utf8'));
const khaleejiWordsPool = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/khaleejiWords.json'), 'utf8'));

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
    const shuffledPool = [...questionPool].sort(() => Math.random() - 0.5);
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

// Serve static files from the build folder
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA routing
app.get(/^(?!\/socket\.io).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// In-memory room storage
const rooms = new Map();

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
        isForfeit: isForfeit
    };
    room.activeQuestion = null;
    room.feedback = null;

    io.to(roomId).emit('room_data', room);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', (data) => {
        const { roomId, playerName, questionsPerCategory = 10, gameType } = data;
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
                roundCount: (requestedGameType === 'bin_o_walad' || requestedGameType === 'word_meaning') ? questionsPerCategory : 0,
                currentRound: 0,
                usedLetters: [],
                currentLetter: null,
                roundSubmissions: {}, // roomId -> { roundIndex -> { playerName -> { girl, boy, thing, food, animal, location } } }
                roundResults: [],
                creatorSocketId: socket.id,
                huroofHistory: []
            });
        }

        room = rooms.get(roomId);
        const existingPlayer = room.players.find(p => p.name === playerName);

        if (existingPlayer) {
            existingPlayer.id = socket.id;
        } else {
            const playerNumber = room.players.length + 1;
            const team = playerNumber % 2 === 1 ? 'red' : 'blue';
            room.players.push({ id: socket.id, name: playerName, score: 0, number: playerNumber, team });
        }

        io.to(roomId).emit('room_data', room);
        console.log(`[Join] Player ${playerName} joined room ${roomId} (Game: ${gameType})`);
    });

    socket.on('create_room', ({ roomId, gameType, questionsPerCategory = 10 }) => {
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
                roundCount: (requestedGameType === 'bin_o_walad' || requestedGameType === 'word_meaning') ? questionsPerCategory : 0,
                currentRound: 0,
                usedLetters: [],
                currentLetter: null,
                roundSubmissions: {},
                roundResults: [],
                creatorSocketId: socket.id,
                huroofHistory: []
            });

            // Note: We don't join the socket to the room yet, 
            // but we can emit to the individual socket that the room is ready
            socket.emit('room_data', rooms.get(roomId));
        }
    });

    socket.on('get_room_status', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            socket.emit('room_data', room);
        }
    });

    socket.on('update_settings', ({ roomId, questionsPerCategory }) => {
        const room = rooms.get(roomId);
        if (room && (room.players[0]?.id === socket.id || room.creatorSocketId === socket.id)) {
            room.questionsPerCategory = questionsPerCategory;
            if (room.gameType === 'bin_o_walad') {
                room.roundCount = questionsPerCategory;
            } else if (room.gameType === 'jeopardy') {
                // For Jeopardy, we might need to re-select questions, 
                // but usually this is set at creation. 
                // However, let's just update the value for UI sync for now.
                room.questionsPerCategory = questionsPerCategory;
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
            const answer = room.roundSubmissions[p.id];
            if (answer === q.answer) {
                p.score += 100;
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
            room.roundSubmissions[socket.id] = answer;

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
                    room.gameStatus = 'question';

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
                const isLuck = Math.random() < 0.1;
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
                    room.gameStatus = 'question';
                    io.to(roomId).emit('room_data', room);
                } else {
                    const shuffledOptions = [...question.options].sort(() => 0.5 - Math.random());
                    const safeQuestion = { ...question, options: shuffledOptions };
                    delete safeQuestion.answer;

                    room.activeQuestion = safeQuestion;
                    room.correctAnswer = question.answer;
                    room.gameStatus = 'question';
                    room.timer = 15;
                    room.attempts = [];
                    room.feedback = null;
                    room.buzzedPlayerId = null;
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
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('submit_answer', ({ roomId, answer }) => {
        const room = rooms.get(roomId);
        if (room && room.activeQuestion && room.buzzedPlayerId === socket.id) {
            const player = room.players.find(p => p.id === socket.id);
            const isCorrect = isCorrectAnswer(answer, room.correctAnswer);

            if (isCorrect) {
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
                    room.timer = 10;
                }
            }
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('answer_question', ({ roomId, isCorrect }) => {
        const room = rooms.get(roomId);
        if (room && room.activeQuestion) {
            const player = room.players.find(p => p.id === socket.id);

            if (isCorrect) {
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
        if (room && room.gameStatus !== 'game_over') {
            endGame(room, io, roomId, socket.id);
        }
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
                    io.to(roomId).emit('room_data', room);
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
