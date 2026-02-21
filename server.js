import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Serve static files from the build folder
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA routing - must handle socket.io separately or before
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) return next();
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

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ roomId, playerName }) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                id: roomId,
                players: [],
                gameStatus: 'lobby',
                questions: [],
                activeQuestion: null,
                selectedCategory: null,
                currentPlayerIndex: 0,
                timer: 30
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
                room.timer = 30;
                io.to(roomId).emit('room_data', room);
            }
        }
    });

    socket.on('answer_question', ({ roomId, isCorrect }) => {
        const room = rooms.get(roomId);
        if (room && room.activeQuestion) {
            const currentPlayer = room.players[room.currentPlayerIndex];
            if (isCorrect) {
                currentPlayer.score += room.activeQuestion.value;
            }

            room.questions = room.questions.map(q =>
                q.id === room.activeQuestion.id ? { ...q, isAnswered: true } : q
            );

            room.activeQuestion = null;
            room.selectedCategory = null;
            room.gameStatus = 'selecting_category';
            room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;

            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('sync_questions', ({ roomId, questions }) => {
        const room = rooms.get(roomId);
        if (room && room.questions.length === 0) {
            room.questions = questions;
            io.to(roomId).emit('room_data', room);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Cleanup room players if needed
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
