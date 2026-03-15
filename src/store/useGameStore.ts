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
    imageUrl?: string;
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
    wordMeaningFeedback?: Record<string, { answer: string; isCorrect: boolean; pointsEarned?: number }>;
    gameStatus: 'lobby' | 'selecting_category' | 'selecting_value' | 'selecting_letter' | 'question' | 'game_over' | 'countdown' | 'round_active' | 'round_scoring' | 'word_meaning_active' | 'word_meaning_scoring' | 'siba_active' | 'pixel_active' | 'pixel_scoring' | 'drawing_active' | 'drawing_scoring';
    timer: number;
    winner: { name: string; score: number; isForfeit?: boolean; winningTeam?: 'red' | 'blue' } | null;
    playerName: string | null;
    questionsPerCategory: number;
    gameType: 'jeopardy' | 'huroof' | 'bin_o_walad' | 'word_meaning' | 'siba' | 'pixel_challenge' | 'drawing_challenge';
    currentLetter: string | null;
    currentRound: number;
    roundCount: number;
    roundResults: any[];
    roomDataLoading: boolean;
    hasJoined: boolean;
    huroofHistory: any[];
    sibaBoard?: (string | null)[];
    sibaPhase?: 'setup' | 'placement' | 'movement';
    sibaPiecesPlaced?: Record<string, number>;
    sibaTurn?: string; // Player ID
    // Drawing Challenge state
    drawingCurrentWord: string | null;  // only set for the current drawer
    drawingMaskedWord: string | null;   // set for guessers (e.g. "___ ____")
    drawingDrawerId: string | null;
    drawingGuesses: Record<string, { correct: boolean; guess?: string; timeLeft?: number; pointsEarned?: number }>;
    drawingCategory: string | null;
    drawingStrokes: any[];              // local canvas strokes (for replay on rejoin)
    drawingLiveStrokes: any[];          // incoming live strokes from server events
    drawingCorrectGuesses: { playerId: string; playerName: string }[];
    drawingWrongGuesses: { playerId: string; playerName: string; guess: string }[];

    // Async Challenge state
    challengeData: { strokes: any[]; word: string; category: string; id: string } | null;
    challengeLoading: boolean;

    // Actions
    setRoomId: (id: string) => void;
    setGameType: (type: 'jeopardy' | 'huroof' | 'bin_o_walad' | 'word_meaning' | 'siba' | 'pixel_challenge' | 'drawing_challenge') => void;
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
    createRoom: (roomId: string, gameType: 'jeopardy' | 'huroof' | 'bin_o_walad' | 'word_meaning' | 'siba' | 'pixel_challenge' | 'drawing_challenge', qCount: number) => void;
    submitWordMeaningAnswer: (roomId: string, answer: string) => void;
    submitPixelAnswer: (roomId: string, answer: string) => void;
    sendDrawingStroke: (roomId: string, stroke: any) => void;
    sendDrawingClear: (roomId: string) => void;
    submitDrawingGuess: (roomId: string, guess: string) => void;
    finishDrawingRound: (roomId: string) => void;
    leaveRoom: (roomId: string) => void;
    createChallenge: (strokes: any[], word: string, category: string) => void;
    getChallenge: (challengeId: string) => void;
    getSoloWord: () => void;
    clearChallengeData: () => void;
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
            huroofHistory: data.huroofHistory || [],
            sibaBoard: data.sibaBoard,
            sibaPhase: data.sibaPhase,
            sibaPiecesPlaced: data.sibaPiecesPlaced,
            sibaTurn: data.sibaTurn,
            drawingCurrentWord: data.drawingCurrentWord ?? null,
            drawingMaskedWord: data.drawingMaskedWord ?? null,
            drawingDrawerId: data.drawingDrawerId ?? null,
            drawingGuesses: data.drawingGuesses ?? {},
            drawingCategory: data.drawingCategory ?? null,
            drawingStrokes: data.drawingStrokes ?? [],
            myId: socket.id || null,
            isConnected: true,
            roomDataLoading: false
        });
    });

    socket.on('challenge_created', (data) => {
        set({ challengeData: data, challengeLoading: false });
    });

    socket.on('challenge_data', (data) => {
        set({ challengeData: data, challengeLoading: false });
    });

    socket.on('challenge_error', (error) => {
        console.error("Challenge error:", error);
        alert(error); // Show error to user
        useGameStore.setState({ challengeLoading: false });
    });

    // Drawing Challenge live events
    socket.on('drawing_stroke', (stroke: any) => {
        useGameStore.setState(state => ({
            drawingLiveStrokes: [...(state.drawingLiveStrokes || []), stroke]
        }));
    });
    socket.on('drawing_clear', () => {
        useGameStore.setState({ drawingLiveStrokes: [] });
    });
    socket.on('drawing_timer', ({ timer }: { timer: number }) => {
        useGameStore.setState({ timer });
    });
    socket.on('drawing_correct_guess', (payload: { playerId: string; playerName: string }) => {
        useGameStore.setState(state => ({
            drawingCorrectGuesses: [...(state.drawingCorrectGuesses || []), payload]
        }));
    });
    // Drawer receives their secret word via this dedicated event (not in room_data)
    socket.on('drawing_your_word', ({ word, category }: { word: string; category?: string }) => {
        useGameStore.setState({ 
            drawingCurrentWord: word,
            drawingCategory: category || null 
        });
    });
    socket.on('drawing_wrong_guess', (payload: { playerId: string; playerName: string; guess: string }) => {
        useGameStore.setState(state => ({
            drawingWrongGuesses: [...(state.drawingWrongGuesses || []), payload]
        }));
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
        huroofHistory: [],
        roomDataLoading: false,
        hasJoined: false,
        sibaBoard: Array(9).fill(null),
        sibaPhase: 'setup',
        sibaPiecesPlaced: {},
        sibaTurn: undefined,
        drawingCurrentWord: null,
        drawingMaskedWord: null,
        drawingDrawerId: null,
        drawingGuesses: {},
        drawingCategory: null,
        drawingStrokes: [],
        drawingLiveStrokes: [],
        drawingCorrectGuesses: [],
        drawingWrongGuesses: [],
        challengeData: null,
        challengeLoading: false,

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
            hasJoined: false,
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
            roundResults: [],
            huroofHistory: [],
            sibaBoard: Array(9).fill(null),
            sibaPhase: 'setup',
            sibaPiecesPlaced: {},
            sibaTurn: undefined,
            drawingCurrentWord: null,
            drawingMaskedWord: null,
            drawingDrawerId: null,
            drawingGuesses: {},
            drawingCategory: null,
            drawingStrokes: [],
            drawingLiveStrokes: [],
            drawingCorrectGuesses: [],
            drawingWrongGuesses: []
        }),

        submitRoundBinOWalad: (roomId, inputs) => {
            socket.emit('submit_round_bin_o_walad', { roomId, inputs });
        },

        getRoomStatus: (roomId: string) => {
            set({ roomDataLoading: true });
            socket.emit('get_room_status', roomId);
        },

        createRoom: (roomId: string, gameType: 'jeopardy' | 'huroof' | 'bin_o_walad' | 'word_meaning' | 'siba' | 'pixel_challenge' | 'drawing_challenge', questionsPerCategory: number) => {
            socket.emit('create_room', { roomId, gameType, questionsPerCategory });
            set({ roomId, gameType, questionsPerCategory });
        },

        submitWordMeaningAnswer: (roomId, answer) => {
            socket.emit('submit_word_meaning_answer', { roomId, answer });
        },
        submitPixelAnswer: (roomId, answer) => {
            socket.emit('submit_pixel_answer', { roomId, answer });
        },
        sendDrawingStroke: (roomId, stroke) => {
            socket.emit('drawing_stroke', { roomId, stroke });
        },
        sendDrawingClear: (roomId) => {
            socket.emit('drawing_clear', { roomId });
        },
        submitDrawingGuess: (roomId, guess) => {
            socket.emit('drawing_guess', { roomId, guess });
        },
        finishDrawingRound: (roomId) => {
            socket.emit('drawing_finish_round', roomId);
        },
        leaveRoom: (roomId) => {
            socket.emit('leave_room', { roomId });
            const reset = useGameStore.getState().resetRoom;
            reset();
        },
        createChallenge: (strokes, word, category) => {
            set({ challengeLoading: true });
            socket.emit('create_challenge', { strokes, word, category });
            
            // Safety timeout: if server doesn't respond in 10s, reset loading
            setTimeout(() => {
                const currentState = useGameStore.getState();
                if (currentState.challengeLoading) {
                    console.warn("Challenge creation timed out");
                    set({ challengeLoading: false });
                    alert("نعتذر، حدث تأخير في إنشاء الرابط. يرجى المحاولة مرة أخرى.");
                }
            }, 10000);
        },
        getChallenge: (challengeId) => {
            set({ challengeLoading: true });
            socket.emit('get_challenge', { challengeId });
        },
        getSoloWord: () => {
            socket.emit('get_solo_word');
        },
        clearChallengeData: () => set({ challengeData: null })
    };
});
