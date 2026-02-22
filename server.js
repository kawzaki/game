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
function isCorrectAnswer(userInput, actualAnswer) {
    if (!userInput || !actualAnswer) return false;

    // 1. Normalize both strings: lowercase, trim, remove non-alphanumeric (keep Arabic/English)
    const normalize = (str) => str.toLowerCase().trim().replace(/[^\p{L}\p{N}]/gu, '');
    const normUser = normalize(userInput);
    const normActual = normalize(actualAnswer);

    if (normUser === normActual) return true;

    // 2. Numerical check: if both contain numbers and those numbers match
    const extractNumbers = (str) => (str.match(/\d+/g) || []).join('');
    const userNum = extractNumbers(userInput);
    const actualNum = extractNumbers(actualAnswer);
    if (userNum && actualNum && userNum === actualNum) return true;

    // 3. Substring check: if one is a significant part of the other (min 2 chars unless it's a number)
    if (normUser.length >= 2 && (normActual.includes(normUser) || normUser.includes(normActual))) return true;

    return false;
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ roomId, playerName }) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                id: roomId,
                players: [],
                gameStatus: 'lobby',
                questions: questionsData.map(q => ({ ...q })), // Deep copy for each room
                activeQuestion: null,
                selectedCategory: null,
                currentPlayerIndex: 0,
                timer: 30,
                attempts: [],
                feedback: null
            });
        }

        const room = rooms.get(roomId);
        const player = { id: socket.id, name: playerName, score: 0 };
        room.players.push(player);

        io.to(roomId).emit('room_data', room);
        console.log(`${playerName} joined room ${roomId}`);
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
            room.selectedCategory = category;
            room.gameStatus = 'selecting_value';
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('pick_value', ({ roomId, value }) => {
        const room = rooms.get(roomId);
        if (room) {
            const question = room.questions.find(q =>
                q.category === room.selectedCategory &&
                q.value === value &&
                !q.isAnswered
            );
            if (question) {
                room.activeQuestion = question;
                room.gameStatus = 'question';
                room.timer = 15; // Set to 15 seconds for more competitive play
                room.attempts = []; // Keep track of socket IDs that tried
                room.feedback = null;
                io.to(roomId).emit('room_data', room);
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
                room.feedback = { type: 'correct', message: `إجابة صحيحة! ${player?.name} حصل على $${room.activeQuestion.value}.`, answer: room.activeQuestion.answer };
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
            const type = room.feedback.type;
            const attemptsCount = room.attempts ? room.attempts.length : 0;
            const totalPlayers = room.players.length;

            room.feedback = null; // Always clear the feedback

            // If it was just a wrong answer (not everyone failed yet), STAY in the question
            if (type === 'wrong' && attemptsCount < totalPlayers) {
                // Do nothing else, UI will go back to the BUZZ! button
                io.to(roomId).emit('room_data', room);
                return;
            }

            // Otherwise (Correct or Everyone Failed), close the question
            room.activeQuestion = null;
            room.buzzedPlayerId = null;
            room.gameStatus = 'selecting_category';
            room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
            io.to(roomId).emit('room_data', room);
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

            io.to(roomId).emit('room_data', room);
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
