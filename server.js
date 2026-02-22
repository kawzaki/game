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
const questionsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/mockQuestions.json'), 'utf8'));

const app = express();
app.use(cors());

// Serve static files from the build folder
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA routing - must handle socket.io separately or before
// Using regex to catch everything while ignoring socket.io explicitly
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
        // If someone forfeits, winner is the highest score among OTHERS
        const others = players.filter(p => p.id !== forfeitingPlayerId);
        if (others.length > 0) {
            const sorted = [...others].sort((a, b) => b.score - a.score);
            winner = sorted[0];
            isForfeit = true;
        } else {
            // No one else left? Just use highest score (current default)
            const sorted = [...players].sort((a, b) => b.score - a.score);
            winner = sorted[0];
        }
    } else {
        // Normal game end: highest score wins
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

    socket.on('join_room', ({ roomId, playerName, questionsPerCategory = 5 }) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            // Select a subset of questions based on questionsPerCategory
            const selectedQuestions = [];
            const categories = [...new Set(questionsData.map(q => q.category))];

            categories.forEach(cat => {
                const catQuestions = questionsData.filter(q => q.category === cat);
                const shuffled = catQuestions.sort(() => 0.5 - Math.random());
                selectedQuestions.push(...shuffled.slice(0, questionsPerCategory));
            });

            rooms.set(roomId, {
                id: roomId,
                players: [],
                gameStatus: 'lobby',
                questions: selectedQuestions.map(q => ({ ...q })), // Deep copy for each room
                questionsPerCategory: questionsPerCategory,
                activeQuestion: null,
                selectedCategory: null,
                currentPlayerIndex: 0,
                timer: 0,
                attempts: [],
                feedback: null,
                winner: null
            });
        }

        const room = rooms.get(roomId);
        const existingPlayer = room.players.find(p => p.name === playerName);

        if (existingPlayer) {
            existingPlayer.id = socket.id;
        } else {
            const player = { id: socket.id, name: playerName, score: 0 };
            room.players.push(player);
        }

        io.to(roomId).emit('room_data', room);
        console.log(`${playerName} joined room ${roomId}`);
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
            room.gameStatus = 'selecting_category';
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('pick_category', ({ roomId, category }) => {
        const room = rooms.get(roomId);
        if (room) {
            // Check if it's the player's turn
            const activePlayer = room.players[room.currentPlayerIndex];
            if (activePlayer && activePlayer.id !== socket.id) {
                console.log(`Action blocked: ${socket.id} tried to pick category out of turn.`);
                return;
            }

            room.selectedCategory = category;
            room.gameStatus = 'selecting_value';
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('pick_value', ({ roomId, value }) => {
        const room = rooms.get(roomId);
        if (room) {
            // Check if it's the player's turn
            const activePlayer = room.players[room.currentPlayerIndex];
            if (activePlayer && activePlayer.id !== socket.id) {
                console.log(`Action blocked: ${socket.id} tried to pick value out of turn.`);
                return;
            }

            const question = room.questions.find(q =>
                q.category === room.selectedCategory &&
                q.value === value &&
                !q.isAnswered
            );
            if (question) {
                if (question.type === 'luck') {
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
                    room.selectedCategory = null;
                    room.activeQuestion = null;
                    room.gameStatus = 'selecting_category';
                    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;

                    // Check if all questions are answered
                    const allAnswered = room.questions.every(q => q.isAnswered);
                    if (allAnswered) {
                        endGame(room, io, roomId);
                    } else {
                        io.to(roomId).emit('room_data', room);
                    }
                } else {
                    room.activeQuestion = question;
                    room.gameStatus = 'question';
                    room.timer = 15;
                    room.attempts = [];
                    room.feedback = null;
                    io.to(roomId).emit('room_data', room);
                }
            }
        }
    });

    socket.on('buzz', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.gameStatus === 'question' && !room.buzzedPlayerId) {
            // Check if this socket already tried
            if (room.attempts && room.attempts.includes(socket.id)) return;

            room.buzzedPlayerId = socket.id;
            io.to(roomId).emit('room_data', room);
            console.log(`Player ${socket.id} buzzed in room ${roomId}`);
        }
    });

    socket.on('submit_answer', ({ roomId, answer }) => {
        const room = rooms.get(roomId);
        if (room && room.activeQuestion && room.buzzedPlayerId === socket.id) {
            const player = room.players.find(p => p.id === socket.id);
            const isCorrect = isCorrectAnswer(answer, room.activeQuestion.answer);

            if (isCorrect) {
                if (player) player.score += room.activeQuestion.value;
                room.feedback = { type: 'correct', message: `إجابة صحيحة! ${player?.name} حصل على ${room.activeQuestion.value} عملة.`, answer: room.activeQuestion.answer };
                room.questions = room.questions.map(q =>
                    q.id === room.activeQuestion.id ? { ...q, isAnswered: true } : q
                );
            } else {
                if (player) player.score -= room.activeQuestion.value;
                if (!room.attempts) room.attempts = [];
                room.attempts.push(socket.id);
                room.buzzedPlayerId = null;

                // Check if everyone has tried
                if (room.attempts.length >= room.players.length) {
                    room.feedback = {
                        type: 'all_wrong',
                        message: `عذراً، المحاولات انتهت والإجابات خاطئة.`,
                        answer: room.activeQuestion.answer
                    };
                    room.questions = room.questions.map(q =>
                        q.id === room.activeQuestion.id ? { ...q, isAnswered: true } : q
                    );
                } else {
                    room.feedback = { type: 'wrong', message: `خطأ! ${player?.name} فقد نقاطاً. بإمكان الآخرين المحاولة الآن!` };
                    // Reset timer for the next buzz? Or keep it going? 
                    // Lets keep it simple: reset timer to 10s for the next person
                    room.timer = 10;
                }
            }

            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('close_feedback', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.feedback) {
            room.feedback = null;
            room.activeQuestion = null;
            room.selectedCategory = null;
            room.buzzedPlayerId = null;
            room.gameStatus = 'selecting_category';
            room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;

            // Check if all questions are answered
            const allAnswered = room.questions.every(q => q.isAnswered);
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

    socket.on('answer_question', ({ roomId, isCorrect }) => {
        const room = rooms.get(roomId);
        if (room && room.activeQuestion) {
            // Manual overrides or timeout
            const currentPlayer = room.players[room.currentPlayerIndex];
            if (isCorrect) {
                currentPlayer.score += room.activeQuestion.value;
            }

            room.questions = room.questions.map(q =>
                q.id === room.activeQuestion.id ? { ...q, isAnswered: true } : q
            );

            room.activeQuestion = null;
            room.selectedCategory = null;
            room.buzzedPlayerId = null;
            room.gameStatus = 'selecting_category';
            room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;

            // Check if all questions are answered
            const allAnswered = room.questions.every(q => q.isAnswered);
            if (allAnswered) {
                endGame(room, io, roomId);
            } else {
                io.to(roomId).emit('room_data', room);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove player from all rooms they were in
        rooms.forEach((room, roomId) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                room.players.splice(playerIndex, 1);
                console.log(`${playerName} removed from room ${roomId}`);

                // If room is empty, maybe delete it or just sync
                if (room.players.length === 0) {
                    // Optionally: rooms.delete(roomId);
                } else {
                    io.to(roomId).emit('room_data', room);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
