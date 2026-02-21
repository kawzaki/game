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
    <div className="game-wrapper" style={{ minHeight: '100vh', paddingBottom: '140px' }}>

      {/* Mini Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #eee', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={18} style={{ color: 'var(--accent-gold)' }} />
          <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--royal-blue)' }}>ROOM #1234</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={toggleLanguage} style={{ background: 'none', border: 'none', fontSize: '10px', fontWeight: 'bold', color: '#94a3b8' }}>
            {i18n.language === 'ar' ? 'EN' : 'AR'}
          </button>
          <button className="btn-rules" style={{ padding: '4px 10px', fontSize: '10px' }}>Rules</button>
        </div>
      </header>

      <main style={{ padding: '16px' }}>
        {gameStatus === 'lobby' && (
          <div className="lobby-card">
            <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', color: 'var(--royal-blue)' }}>{t('welcome')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Your Name" className="input-premium" onKeyDown={(e) => {
                if (e.key === 'Enter') { addPlayer((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; }
              }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
                {players.map(p => <span key={p.id} style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>{p.name}</span>)}
              </div>
              {players.length > 0 && (
                <button onClick={startGame} className="btn-start" style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-bright))', color: 'white', border: 'none', fontWeight: '900', cursor: 'pointer' }}>
                  {t('start_game')}
                </button>
              )}
            </div>
          </div>
        )}

        {gameStatus === 'playing' && (
          <div className="board-container no-scrollbar">
            {Object.entries(categories).map(([catName, qList], catIdx) => (
              <div key={catName} className="category-column">
                <div className="category-header">
                  <div className="cat-label">CAT {catIdx + 1}</div>
                  <div className="cat-name">{catName}</div>
                </div>

                {qList.map(q => (
                  <div
                    key={q.id}
                    className={`tile-premium ${q.isAnswered ? 'tile-answered' : ''}`}
                    onClick={() => !q.isAnswered && selectQuestion(q.id)}
                  >
                    {q.isAnswered ? (
                      <CheckCircle2 size={16} style={{ opacity: 0.3 }} />
                    ) : (
                      <span className="gold-text">${q.value}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* QUESTION MODAL */}
      <AnimatePresence>
        {gameStatus === 'question' && activeQuestion && (
          <div className="fixed modal-overlay" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content text-center">
              <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '18px', fontWeight: '900' }}>
                <TimerIcon size={18} style={{ color: 'var(--accent-gold)', marginRight: '4px' }} />
                <span>{timer}s</span>
              </div>
              <div className="cat-label" style={{ marginBottom: '8px' }}>{activeQuestion.category}</div>
              <h3 className="gold-text" style={{ fontSize: '32px', marginBottom: '16px' }}>${activeQuestion.value}</h3>
              <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '24px', lineHeight: '1.4' }}>{activeQuestion.question}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button onClick={() => answerQuestion(true)} style={{ padding: '12px', background: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5', borderRadius: '12px', fontWeight: '900' }}>CORRECT</button>
                <button onClick={() => answerQuestion(false)} style={{ padding: '12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: '12px', fontWeight: '900' }}>WRONG</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      {gameStatus !== 'lobby' && (
        <>
          <div className="hud-container no-scrollbar">
            {players.map((p, idx) => (
              <div key={p.id} className={`score-card ${idx === currentPlayerIndex ? 'active' : ''}`}>
                <div className="label" style={{ fontSize: '10px' }}>PLAYER {idx + 1}</div>
                <div className="value">${p.score.toLocaleString()}</div>
              </div>
            ))}
          </div>
          <nav className="bottom-nav">
            <div className="nav-item active"><LayoutGrid size={18} /><span>Board</span></div>
            <div className="nav-item"><Users size={18} /><span>Players</span></div>
            <div className="nav-item"><MessageSquare size={18} /><span>Chat</span></div>
          </nav>
        </>
      )}
    </div>
  );
};

export default App;
