import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from './store/useGameStore';
import mockQuestions from './data/mockQuestions.json';
import {
  Globe,
  HelpCircle,
  CheckCircle2,
  Timer as TimerIcon,
  LayoutGrid,
  Users,
  MessageSquare,
  Trophy
} from 'lucide-react';
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

  useEffect(() => {
    useGameStore.setState({ questions: mockQuestions as any });
  }, []);

  useEffect(() => {
    let interval: any;
    if (gameStatus === 'question' && timer > 0) {
      interval = setInterval(() => tickTimer(), 1000);
    } else if (timer === 0 && gameStatus === 'question') {
      answerQuestion(false);
    }
    return () => clearInterval(interval);
  }, [gameStatus, timer]);

  const toggleLanguage = () => {
    const nextLng = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(nextLng);
    document.documentElement.dir = nextLng === 'ar' ? 'rtl' : 'ltr';
  };

  const categories = useMemo(() => {
    const cats: Record<string, typeof questions> = {};
    questions.forEach(q => {
      if (!cats[q.category]) cats[q.category] = [];
      cats[q.category].push(q);
    });
    Object.keys(cats).forEach(k => {
      cats[k].sort((a, b) => a.value - b.value);
    });
    return cats;
  }, [questions]);

  return (
    <div className="min-h-screen pb-48">

      {/* Header */}
      <header className="px-8 py-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-gold to-gold-bright p-2 rounded-lg shadow-gold">
            <Trophy className="text-white h-6 w-6" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-royal-blue uppercase">
            Game Room #1234
          </h1>
        </div>
        <div className="flex gap-4">
          <button onClick={toggleLanguage} className="text-slate-400 hover:text-royal-blue flex items-center gap-2 text-xs uppercase font-black transition-colors">
            <Globe size={14} />
            {i18n.language === 'ar' ? 'English' : 'العربية'}
          </button>
          <button className="btn-rules">
            <HelpCircle size={18} />
            {t('rules', 'Rules')}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {gameStatus === 'lobby' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lobby-card"
          >
            <h2 className="text-3xl font-black mb-2 text-royal-blue">{t('welcome')}</h2>
            <p className="text-slate-400 mb-10 font-medium">Join the competition</p>
            <div className="space-y-6">
              <input
                type="text"
                placeholder="Enter Your Name"
                className="input-premium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addPlayer((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <div className="flex flex-wrap gap-2 justify-center mb-8">
                {players.map(p => (
                  <span key={p.id} className="bg-slate-100 border border-slate-200 text-slate-700 px-5 py-2 rounded-full text-sm font-bold shadow-sm">
                    {p.name}
                  </span>
                ))}
              </div>
              {players.length > 0 && (
                <button
                  onClick={startGame}
                  className="w-full py-5 bg-gradient-to-r from-gold to-gold-bright text-white rounded-2xl font-black uppercase tracking-widest shadow-gold hover:scale-[1.02] transition-transform active:scale-95"
                  style={{ background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-bright))' }}
                >
                  {t('start_game')}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {gameStatus === 'playing' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {Object.entries(categories).map(([catName, qList], catIdx) => (
              <div key={catName} className="flex flex-col gap-6">
                <div className="category-header">
                  <div className="cat-label">CAT {catIdx + 1}</div>
                  <div className="cat-name">{catName}</div>
                </div>

                <div className="space-y-6">
                  {qList.map(q => (
                    <motion.div
                      key={q.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: catIdx * 0.1 + (q.value / 1000) }}
                      whileHover={!q.isAnswered ? { scale: 1.05 } : {}}
                      className={`tile-premium ${q.isAnswered ? 'tile-answered' : ''}`}
                      onClick={() => !q.isAnswered && selectQuestion(q.id)}
                    >
                      {q.isAnswered ? (
                        <CheckCircle2 size={32} className="text-slate-300" />
                      ) : (
                        <span className="text-3xl font-black gold-text">${q.value}</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* QUESTION MODAL */}
      <AnimatePresence>
        {gameStatus === 'question' && activeQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50, rotateX: 20 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              className="modal-content p-12 max-w-2xl w-full text-center relative"
            >
              <div className="absolute top-8 right-8 flex items-center gap-2 text-2xl font-black text-royal-blue">
                <TimerIcon size={28} className="text-gold" style={{ color: 'var(--accent-gold)' }} />
                <span>{timer}s</span>
              </div>

              <div className="cat-label text-sm mb-4">{activeQuestion.category}</div>
              <h3 className="text-5xl font-black gold-text mb-12">${activeQuestion.value}</h3>

              <p className="text-3xl font-bold leading-tight text-royal-blue mb-16 px-4">
                {activeQuestion.question}
              </p>

              <div className="grid grid-cols-2 gap-6 w-full">
                <button
                  onClick={() => answerQuestion(true)}
                  className="py-5 bg-emerald-50 text-emerald-600 border-2 border-emerald-100 rounded-2xl font-black uppercase tracking-wider hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm"
                >
                  {t('correct')}
                </button>
                <button
                  onClick={() => answerQuestion(false)}
                  className="py-5 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-2xl font-black uppercase tracking-wider hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm"
                >
                  {t('incorrect')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      {gameStatus !== 'lobby' && (
        <>
          <div className="hud-container">
            {players.map((p, idx) => (
              <motion.div
                key={p.id}
                layout
                className={`score-card ${idx === currentPlayerIndex ? 'active' : ''}`}
              >
                <div className="label">
                  {p.team ? `TEAM ${p.team}` : `PLAYER ${idx + 1}`}
                </div>
                <div className="value">
                  {p.score < 0 ? '-' : ''}${Math.abs(p.score).toLocaleString()}
                </div>
              </motion.div>
            ))}
          </div>

          <nav className="bottom-nav">
            <div className="nav-item active">
              <LayoutGrid size={24} />
              <span>Board</span>
            </div>
            <div className="nav-item">
              <Users size={24} />
              <span>Players</span>
            </div>
            <div className="nav-item">
              <MessageSquare size={24} />
              <span>Chat</span>
            </div>
          </nav>
        </>
      )}
    </div>
  );
};

export default App;
