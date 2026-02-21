import { create } from 'zustand';

interface Player {
    id: string;
    name: string;
    score: number;
    team?: 'A' | 'B';
}

interface Question {
    id: string;
    category: string;
    value: number;
    question: string;
    answer: string;
    isAnswered: boolean;
}

interface GameState {
    players: Player[];
    currentPlayerIndex: number;
    questions: Question[];
    activeQuestion: Question | null;
    gameStatus: 'lobby' | 'playing' | 'question' | 'ended';
    timer: number;

    // Actions
    addPlayer: (name: string, team?: 'A' | 'B') => void;
    startGame: () => void;
    selectQuestion: (questionId: string) => void;
    answerQuestion: (isCorrect: boolean) => void;
    tickTimer: () => void;
    resetTimer: (seconds: number) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
    players: [],
    currentPlayerIndex: 0,
    questions: [], // Will be populated from a mock or API
    activeQuestion: null,
    gameStatus: 'lobby',
    timer: 30,

    addPlayer: (name, team) => set((state) => ({
        players: [...state.players, { id: Math.random().toString(36).substr(2, 9), name, score: 0, team }]
    })),

    startGame: () => set({ gameStatus: 'playing' }),

    selectQuestion: (questionId) => set((state) => {
        const question = state.questions.find(q => q.id === questionId);
        if (!question || question.isAnswered) return state;
        return {
            activeQuestion: question,
            gameStatus: 'question',
            timer: 30
        };
    }),

    answerQuestion: (isCorrect) => set((state) => {
        if (!state.activeQuestion) return state;

        const updatedPlayers = [...state.players];
        const currentPlayer = updatedPlayers[state.currentPlayerIndex];

        if (isCorrect) {
            currentPlayer.score += state.activeQuestion.value;
        } else {
            // Logic for passing to others could go here
        }

        const updatedQuestions = state.questions.map(q =>
            q.id === state.activeQuestion?.id ? { ...q, isAnswered: true } : q
        );

        return {
            players: updatedPlayers,
            questions: updatedQuestions,
            activeQuestion: null,
            gameStatus: 'playing',
            // Switch turn (simple sequential for now, can be optimized)
            currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length
        };
    }),

    tickTimer: () => set((state) => ({
        timer: state.timer > 0 ? state.timer - 1 : 0
    })),

    resetTimer: (seconds) => set({ timer: seconds }),
}));
