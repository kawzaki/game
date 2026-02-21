import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from './store/useGameStore';
import mockQuestions from './data/mockQuestions.json';
import { Globe, Trophy, Timer as TimerIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    gameStatus,
    players,
    questions,
    activeQuestion,
    timer,
    startGame,
    selectQuestion,
    answerQuestion,
    tickTimer,
    addPlayer,
    currentPlayerIndex
  } = useGameStore();

  // Initialize questions
  useEffect(() => {
    useGameStore.setState({ questions: mockQuestions as any });
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (gameStatus === 'question' && timer > 0) {
      interval = setInterval(() => tickTimer(), 1000);
    } else if (timer === 0 && gameStatus === 'question') {
      // Auto-fail or pass turn logic
      answerQuestion(false);
    }
    return () => clearInterval(interval);
  }, [gameStatus, timer]);

  const toggleLanguage = () => {
    const nextLng = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(nextLng);
    document.documentElement.dir = nextLng === 'ar' ? 'rtl' : 'ltr';
  };

  const currentPlayer = players[currentPlayerIndex];

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold gold-gradient-text uppercase tracking-wider">
          {t('welcome')}
        </h1>
        <div className="flex gap-4">
          <button onClick={toggleLanguage} className="btn-primary flex items-center gap-2">
            <Globe size={18} />
            {i18n.language === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {gameStatus === 'lobby' && (
          <div className="premium-card p-12 text-center max-w-md mx-auto">
            <Trophy className="mx-auto mb-6 text-yellow-500" size={64} />
            <h2 className="text-2xl mb-8">{t('start_game')}</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter Name"
                className="w-full p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addPlayer((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <div className="flex flex-wrap gap-2 justify-center">
                {players.map(p => (
                  <span key={p.id} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {p.name}
                  </span>
                ))}
              </div>
              {players.length > 0 && (
                <button onClick={startGame} className="btn-primary w-full mt-4">
                  {t('start_game')}
                </button>
              )}
            </div>
          </div>
        )}

        {gameStatus === 'playing' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {questions.map((q) => (
              <motion.div
                key={q.id}
                whileHover={!q.isAnswered ? { scale: 1.05 } : {}}
                className={`premium-card p-8 text-center cursor-pointer transition-all ${q.isAnswered ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:border-gold'
                  }`}
                onClick={() => !q.isAnswered && selectQuestion(q.id)}
              >
                <div className="text-sm text-muted mb-2">{t('category')}: {q.category}</div>
                <div className="text-3xl font-bold gold-gradient-text">${q.value}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* HUD for Scores during game */}
        {gameStatus !== 'lobby' && (
          <div className="fixed bottom-8 left-8 right-8 flex justify-between items-center premium-card px-8 py-4">
            <div className="flex gap-4">
              {players.map((p, idx) => (
                <div key={p.id} className={`p-2 rounded ${idx === currentPlayerIndex ? 'border-2 border-gold font-bold' : ''}`}>
                  {p.name}: <span className="text-green-600">${p.score}</span>
                </div>
              ))}
            </div>
            <div className="text-muted italic">{t('wait_turn')}: {currentPlayer?.name}</div>
          </div>
        )}
      </main>

      {/* Question Modal */}
      <AnimatePresence>
        {gameStatus === 'question' && activeQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="premium-card bg-white p-8 md:p-12 max-w-2xl w-full text-center relative"
            >
              <div className="absolute top-4 right-4 flex items-center gap-2 text-xl font-bold text-blue-900">
                <TimerIcon />
                <span>{timer}s</span>
              </div>

              <h3 className="text-lg text-muted mb-4 uppercase tracking-widest">{activeQuestion.category} - ${activeQuestion.value}</h3>
              <p className="text-3xl font-bold mb-12 min-h-[100px] flex items-center justify-center">
                {activeQuestion.question}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => answerQuestion(true)}
                  className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl font-bold"
                >
                  {t('correct')}
                </button>
                <button
                  onClick={() => answerQuestion(false)}
                  className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-xl font-bold"
                >
                  {t('incorrect')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
