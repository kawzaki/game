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
    <div className="min-h-screen bg-transparent pb-40">

      {/* Small Header for mobile */}
      <header className="px-4 py-3 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Trophy className="text-gold h-5 w-5" style={{ color: 'var(--accent-gold)' }} />
          <h1 className="text-sm font-black tracking-tight text-royal-blue uppercase">Room #1234</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleLanguage} className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
            <Globe size={12} />
            {i18n.language === 'ar' ? 'EN' : 'AR'}
          </button>
          <button className="btn-rules !px-3 !py-1 !text-[10px]">
            <HelpCircle size={12} /> Rules
          </button>
        </div>
      </header>

      <main className="p-2 md:p-6">
        {gameStatus === 'lobby' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lobby-card">
            <h2 className="text-2xl font-black mb-4 text-royal-blue">{t('welcome')}</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Your Name" className="input-premium" onKeyDown={(e) => {
                if (e.key === 'Enter') { addPlayer((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; }
              }} />
              <div className="flex flex-wrap gap-1 justify-center">
                {players.map(p => <span key={p.id} className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold">{p.name}</span>)}
              </div>
              {players.length > 0 && (
                <button onClick={startGame} className="w-full py-3 bg-gold text-white rounded-xl font-black uppercase tracking-widest shadow-gold" style={{ background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-bright))' }}>
                  {t('start_game')}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {gameStatus === 'playing' && (
          <div className="flex flex-row overflow-x-auto pb-8 gap-3 snap-x no-scrollbar">
            {Object.entries(categories).map(([catName, qList], catIdx) => (
              <div key={catName} className="flex-none w-[160px] md:w-[200px] snap-start flex flex-col gap-3">
                <div className="category-header">
                  <div className="cat-label">CAT {catIdx + 1}</div>
                  <div className="cat-name">{catName}</div>
                </div>

                <div className="flex flex-col gap-3">
                  {qList.map(q => (
                    <motion.div
                      key={q.id}
                      whileHover={!q.isAnswered ? { scale: 1.05 } : {}}
                      className={`tile-premium ${q.isAnswered ? 'tile-answered' : ''}`}
                      onClick={() => !q.isAnswered && selectQuestion(q.id)}
                    >
                      {q.isAnswered ? (
                        <CheckCircle2 size={24} className="text-slate-300" />
                      ) : (
                        <span className="text-xl font-black gold-text">${q.value}</span>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="modal-content relative text-center">
              <div className="absolute top-4 right-4 flex items-center gap-1 text-lg font-black text-royal-blue">
                <TimerIcon size={20} className="text-gold" style={{ color: 'var(--accent-gold)' }} />
                <span>{timer}s</span>
              </div>
              <div className="cat-label mb-2">{activeQuestion.category}</div>
              <h3 className="text-3xl font-black gold-text mb-6">${activeQuestion.value}</h3>
              <p className="text-xl font-bold text-royal-blue mb-8 leading-tight">{activeQuestion.question}</p>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={() => answerQuestion(true)} className="py-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl font-black text-sm uppercase">Correct</button>
                <button onClick={() => answerQuestion(false)} className="py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-black text-sm uppercase">Wrong</button>
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
              <div key={p.id} className={`score-card ${idx === currentPlayerIndex ? 'active' : ''}`}>
                <div className="label">PLAYER {idx + 1}</div>
                <div className="value">${p.score.toLocaleString()}</div>
              </div>
            ))}
          </div>
          <nav className="bottom-nav">
            <div className="nav-item active"><LayoutGrid size={20} /><span>Board</span></div>
            <div className="nav-item"><Users size={20} /><span>Players</span></div>
            <div className="nav-item"><MessageSquare size={20} /><span>Chat</span></div>
          </nav>
        </>
      )}
    </div>
  );
};

export default App;
