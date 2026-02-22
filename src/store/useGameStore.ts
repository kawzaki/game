import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export const socket: Socket = io();

interface Question {
    id: string;
    category: string;
    value: number;
    question: string;
    answer: string;
    options: string[];
    isAnswered: boolean;
}

interface GameState {
    roomId: string | null;
    players: any[];
    currentPlayerIndex: number;
    questions: Question[];
    activeQuestion: Question | null;
    selectedCategory: string | null;
    buzzedPlayerId: string | null;
    attempts: string[];
    myId: string | null;
    feedback: { type: 'correct' | 'wrong' | 'all_wrong' | 'luck'; message: string; answer?: string; reward?: any } | null;
    gameStatus: 'lobby' | 'selecting_category' | 'selecting_value' | 'question' | 'game_over';
    timer: number;
    winner: { name: string; score: number; isForfeit?: boolean } | null;
    playerName: string | null;

    // Actions
    setRoomId: (id: string) => void;
    addPlayer: (name: string, roomId: string, questionsPerCategory?: number) => void;
    startGame: (roomId: string) => void;
    pickCategory: (roomId: string, category: string) => void;
    pickValue: (roomId: string, value: number) => void;
    buzz: (roomId: string) => void;
    submitAnswer: (roomId: string, answer: string) => void;
    closeFeedback: (roomId: string) => void;
    answerQuestion: (roomId: string, isCorrect: boolean) => void;
    tickTimer: () => void;
    resetTimer: (seconds: number) => void;
    resetRoom: () => void;
}

export const useGameStore = create<GameState>((set) => {
    // Detect room from URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomId = urlParams.get('room');

    // Listen for room updates
    socket.on('room_data', (data) => {
        set({
            players: data.players,
            gameStatus: data.gameStatus,
            questions: data.questions,
            activeQuestion: data.activeQuestion,
            selectedCategory: data.selectedCategory,
            buzzedPlayerId: data.buzzedPlayerId,
            attempts: data.attempts || [],
            feedback: data.feedback,
            currentPlayerIndex: data.currentPlayerIndex,
            timer: data.timer,
            winner: data.winner,
            myId: socket.id || null
        });
    });

    // Handle reconnections
    socket.on('connect', () => {
        const state = useGameStore.getState();
        if (state.roomId && state.playerName) {
            socket.emit('rejoin_room', { roomId: state.roomId, playerName: state.playerName });
        }
        set({ myId: socket.id || null });
    });

    return {
        roomId: urlRoomId || null,
        players: [],
        currentPlayerIndex: 0,
        questions: [],
        activeQuestion: null,
        selectedCategory: null,
        buzzedPlayerId: null,
        attempts: [],
        myId: null,
        feedback: null,
        gameStatus: 'lobby',
        timer: 30,
        winner: null,
        playerName: null,

        setRoomId: (id) => set({ roomId: id }),

        addPlayer: (name, roomId, questionsPerCategory = 5) => {
            socket.emit('join_room', { roomId, playerName: name, questionsPerCategory });
            set({ roomId, playerName: name });
        },

        startGame: (roomId) => {
            socket.emit('start_game', roomId);
        },

        pickCategory: (roomId, category) => {
            socket.emit('pick_category', { roomId, category });
        },

        pickValue: (roomId, value) => {
            socket.emit('pick_value', { roomId, value });
        },

        buzz: (roomId) => {
            socket.emit('buzz', roomId);
        },

        submitAnswer: (roomId, answer) => {
            socket.emit('submit_answer', { roomId, answer });
        },

        closeFeedback: (roomId) => {
            socket.emit('close_feedback', roomId);
        },

        answerQuestion: (roomId, isCorrect) => {
            socket.emit('answer_question', { roomId, isCorrect });
        },

        tickTimer: () => set((state) => ({
            timer: state.timer > 0 ? state.timer - 1 : 0
        })),

        resetTimer: (seconds) => set({ timer: seconds }),

        resetRoom: () => set({
            roomId: null,
            players: [],
            currentPlayerIndex: 0,
            questions: [],
            activeQuestion: null,
            selectedCategory: null,
            buzzedPlayerId: null,
            attempts: [],
            feedback: null,
            gameStatus: 'lobby',
            winner: null
        })
    };
});
