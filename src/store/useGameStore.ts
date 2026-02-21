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
    selectedCategory: string | null;
    gameStatus: 'lobby' | 'selecting_category' | 'selecting_value' | 'question' | 'ended';
    timer: number;

    // Actions
    addPlayer: (name: string, team?: 'A' | 'B') => void;
    startGame: () => void;
    pickCategory: (category: string) => void;
    pickValue: (value: number) => void;
    answerQuestion: (isCorrect: boolean) => void;
    tickTimer: () => void;
    resetTimer: (seconds: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
    players: [],
    currentPlayerIndex: 0,
    questions: [],
    activeQuestion: null,
    selectedCategory: null,
    gameStatus: 'lobby',
    timer: 30,

    addPlayer: (name, team) => set((state) => ({
        players: [...state.players, { id: Math.random().toString(36).substr(2, 9), name, score: 0, team }]
    })),

    startGame: () => set({ gameStatus: 'selecting_category' }),

    pickCategory: (category) => set({
        selectedCategory: category,
        gameStatus: 'selecting_value'
    }),

    pickValue: (value) => set((state) => {
        const question = state.questions.find(q =>
            q.category === state.selectedCategory &&
            q.value === value &&
            !q.isAnswered
        );
        if (!question) return state;
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
        }

        const updatedQuestions = state.questions.map(q =>
            q.id === state.activeQuestion?.id ? { ...q, isAnswered: true } : q
        );

        return {
            players: updatedPlayers,
            questions: updatedQuestions,
            activeQuestion: null,
            selectedCategory: null,
            gameStatus: 'selecting_category',
            currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length
        };
    }),

    tickTimer: () => set((state) => ({
        timer: state.timer > 0 ? state.timer - 1 : 0
    })),

    resetTimer: (seconds) => set({ timer: seconds }),
}));
