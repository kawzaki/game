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
    players: any[]; // Individual player objects now include 'team'
    currentPlayerIndex: number;
    questions: Question[];
    huroofGrid: any[] | null;
    activeQuestion: Question | null;
    selectedCategory: string | null;
    buzzedPlayerId: string | null;
    attempts: string[];
    myId: string | null;
    isConnected: boolean;
    feedback: { type: 'correct' | 'wrong' | 'all_wrong' | 'luck'; message: string; answer?: string; reward?: any } | null;
    wordMeaningFeedback?: Record<string, { answer: string; isCorrect: boolean }>;
    gameStatus: 'lobby' | 'selecting_category' | 'selecting_value' | 'selecting_letter' | 'question' | 'game_over' | 'countdown' | 'round_active' | 'round_scoring' | 'word_meaning_active' | 'word_meaning_scoring';
    timer: number;
    winner: { name: string; score: number; isForfeit?: boolean; winningTeam?: 'red' | 'blue' } | null;
    playerName: string | null;
    questionsPerCategory: number;
    gameType: 'jeopardy' | 'huroof' | 'bin_o_walad' | 'word_meaning';
    currentLetter: string | null;
    currentRound: number;
    roundCount: number;
    roundResults: any[];
    roomDataLoading: boolean;

    // Actions
    setRoomId: (id: string) => void;
    setGameType: (type: 'jeopardy' | 'huroof' | 'bin_o_walad' | 'word_meaning') => void;
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
    submitRoundBinOWalad: (roomId: string, inputs: Record<string, string>) => void;
    getRoomStatus: (roomId: string) => void;
    createRoom: (roomId: string, gameType: 'jeopardy' | 'huroof' | 'bin_o_walad' | 'word_meaning', qCount: number) => void;
    submitWordMeaningAnswer: (roomId: string, answer: string) => void;
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
            questions: data.questions || [],
            huroofGrid: data.huroofGrid || null,
            activeQuestion: data.activeQuestion || null,
            selectedCategory: data.selectedCategory,
            buzzedPlayerId: data.buzzedPlayerId,
            attempts: data.attempts || [],
            feedback: data.feedback,
            wordMeaningFeedback: data.wordMeaningFeedback,
            currentPlayerIndex: data.currentPlayerIndex,
            timer: data.timer,
            winner: data.winner,
            questionsPerCategory: data.questionsPerCategory,
            gameType: data.gameType || 'jeopardy',
            currentLetter: data.currentLetter,
            currentRound: data.currentRound,
            roundCount: data.roundCount,
            roundResults: data.roundResults || [],
            myId: socket.id || null,
            isConnected: true,
            roomDataLoading: false
        });
    });

    // Handle reconnections
    socket.on('connect', () => {
        const state = useGameStore.getState();
        if (state.roomId && state.playerName) {
            socket.emit('rejoin_room', { roomId: state.roomId, playerName: state.playerName });
        }
        set({ myId: socket.id || null, isConnected: true });
    });

    socket.on('disconnect', () => {
        set({ isConnected: false });
    });

    return {
        roomId: urlRoomId || null,
        players: [],
        currentPlayerIndex: 0,
        questions: [],
        huroofGrid: null, // Initialize huroofGrid in the store's initial state
        activeQuestion: null,
        selectedCategory: null,
        buzzedPlayerId: null,
        attempts: [],
        myId: null,
        isConnected: socket.connected,
        feedback: null,
        gameStatus: 'lobby',
        timer: 30,
        winner: null,
        playerName: null,
        questionsPerCategory: 10,
        gameType: 'jeopardy',
        currentLetter: null,
        currentRound: 0,
        roundCount: 10,
        roundResults: [],
        roomDataLoading: false,

        setRoomId: (id) => set({ roomId: id }),

        setGameType: (type) => set({ gameType: type }),

        addPlayer: (name, roomId, questionsPerCategory = 10) => {
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
            huroofGrid: null,
            activeQuestion: null,
            selectedCategory: null,
            buzzedPlayerId: null,
            attempts: [],
            feedback: null,
            gameStatus: 'lobby',
            winner: null,
            currentLetter: null,
            currentRound: 0,
            roundResults: []
        }),

        submitRoundBinOWalad: (roomId, inputs) => {
            socket.emit('submit_round_bin_o_walad', { roomId, inputs });
        },

        getRoomStatus: (roomId: string) => {
            set({ roomDataLoading: true });
            socket.emit('get_room_status', roomId);
        },

        createRoom: (roomId: string, gameType: 'jeopardy' | 'huroof' | 'bin_o_walad' | 'word_meaning', questionsPerCategory: number) => {
            socket.emit('create_room', { roomId, gameType, questionsPerCategory });
            set({ roomId, gameType, questionsPerCategory });
        },

        submitWordMeaningAnswer: (roomId, answer) => {
            socket.emit('submit_word_meaning_answer', { roomId, answer });
        }
    };
});
