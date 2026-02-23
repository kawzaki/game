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

function checkHuroofWinner(grid, playerId, players) {
    const size = 5;
    const isFirstPlayer = players[0] && players[0].id === playerId;

    // Player 1 (Blue): Top to Bottom
    // Player 2 (Red): Right to Left

    const startNodes = [];
    const targetNodes = new Set();

    if (isFirstPlayer) {
        // Top row (indices 0-4)
        for (let i = 0; i < size; i++) {
            if (grid[i].ownerId === playerId) startNodes.push(i);
            targetNodes.add(size * (size - 1) + i); // Bottom row (20-24)
        }
    } else {
        // Left side (indices 0, 5, 10, 15, 20)
        for (let i = 0; i < size; i++) {
            const idx = i * size;
            if (grid[idx].ownerId === playerId) startNodes.push(idx);
            targetNodes.add(i * size + (size - 1)); // Right side (4, 9, 14, 19, 24)
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

        // Neighbors (Top, Bottom, Left, Right)
        const neighbors = [
            { r: row - 1, c: col },
            { r: row + 1, c: col },
            { r: row, c: col - 1 },
            { r: row, c: col + 1 }
        ];

        for (const neighbor of neighbors) {
            if (neighbor.r >= 0 && neighbor.r < size && neighbor.c >= 0 && neighbor.c < size) {
                const nIdx = neighbor.r * size + neighbor.c;
                if (!visited.has(nIdx) && grid[nIdx].ownerId === playerId) {
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
    return input.trim().toLowerCase() === correct.trim().toLowerCase();
}

function endGame(room, io, roomId, forfeitingPlayerId = null) {
    const players = room.players;
    if (players.length === 0) return;

    let winner;
    let isForfeit = false;

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
                buzzedPlayerId: null
            });
        }

        room = rooms.get(roomId);
        const existingPlayer = room.players.find(p => p.name === playerName);

        if (existingPlayer) {
            existingPlayer.id = socket.id;
        } else {
            const playerNumber = room.players.length + 1;
            room.players.push({ id: socket.id, name: playerName, score: 0, number: playerNumber });
        }

        io.to(roomId).emit('room_data', room);
        console.log(`[Join] Player ${playerName} joined room ${roomId} (Game: ${gameType})`);
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
        if (room) {
            console.log(`[Start Game] Room: ${roomId}, Type: ${room.gameType}`);
            room.gameStatus = room.gameType === 'jeopardy' ? 'selecting_category' : 'selecting_letter';
            io.to(roomId).emit('room_data', room);
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
                // In Huroof, category is the letter. Pick a question starting with that letter or random if not found.
                const matchingQuestions = questionPool.filter(q =>
                    (q.question && q.question.trim().startsWith(category)) ||
                    (q.answer && q.answer.trim().startsWith(category))
                );
                const pool = matchingQuestions.length > 0 ? matchingQuestions : questionPool;
                const question = pool[Math.floor(Math.random() * pool.length)];

                // Ensure all options start with the same letter for Huroof mode
                let huroofOptions = [];
                const correctAnswer = question.answer;

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
                    // Claim the letter in the grid
                    room.huroofGrid = room.huroofGrid.map(g =>
                        g.letter === room.selectedCategory && g.ownerId === null ? { ...g, ownerId: socket.id } : g
                    );

                    // Check for win
                    if (checkHuroofWinner(room.huroofGrid, socket.id, room.players)) {
                        endGame(room, io, roomId);
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
                    room.questions = room.questions.map(q =>
                        q.id === room.activeQuestion.id ? { ...q, isAnswered: true } : q
                    );
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
                    room.huroofGrid = room.huroofGrid.map(g =>
                        g.letter === room.selectedCategory && g.ownerId === null ? { ...g, ownerId: socket.id } : g
                    );
                    if (checkHuroofWinner(room.huroofGrid, socket.id, room.players)) {
                        endGame(room, io, roomId);
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
                room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
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
