import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from './store/useGameStore';
import mockQuestions from './data/mockQuestions.json';
import {
  Timer as TimerIcon,
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
    pickCategory,
    pickValue,
    answerQuestion,
    tickTimer,
    addPlayer,
    currentPlayerIndex,
    selectedCategory
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
    const cats: Record<string, any[]> = {};
    questions.forEach((q: any) => {
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

        {gameStatus === 'selecting_category' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {Object.keys(categories).map((cat) => (
              <div
                key={cat}
                className="tile-premium"
                onClick={() => pickCategory(cat)}
                style={{ height: '80px', textAlign: 'center' }}
              >
                <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--royal-blue)' }}>{cat}</span>
              </div>
            ))}
          </div>
        )}

        {gameStatus === 'selecting_value' && (
          <div>
            <h3 style={{ textAlign: 'center', marginBottom: '16px', color: 'var(--royal-blue)', fontWeight: '900' }}>{selectedCategory}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '10px' }}>
              {[100, 200, 300, 400, 500].map((val) => {
                const isAnswered = categories[selectedCategory || '']?.find(q => q.value === val)?.isAnswered;
                return (
                  <div
                    key={val}
                    className={`tile-premium ${isAnswered ? 'tile-answered' : ''}`}
                    onClick={() => !isAnswered && pickValue(val)}
                  >
                    <span className="gold-text">${val}</span>
                  </div>
                );
              })}
              <button
                onClick={() => useGameStore.setState({ gameStatus: 'selecting_category', selectedCategory: null })}
                style={{ marginTop: '10px', background: 'none', border: '1px solid #ddd', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}
              >
                BACK
              </button>
            </div>
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

      {/* NEW FOOTER HUD */}
      {gameStatus !== 'lobby' && players.length > 0 && (
        <div className="bottom-hud">
          {/* Active Player Slot */}
          <div className="hud-player-slot active">
            <div className="hud-label">TURN: {players[currentPlayerIndex]?.team ? `TEAM ${players[currentPlayerIndex].team}` : 'PLAYER'}</div>
            <div className="hud-name">{players[currentPlayerIndex]?.name}</div>
            <div className="hud-score">${players[currentPlayerIndex]?.score.toLocaleString()}</div>
          </div>

          <div className="hud-vs">VS</div>

          {/* Opponent Slot - Shows the highest scoring opponent */}
          {(() => {
            const opponent = [...players]
              .filter((_, idx) => idx !== currentPlayerIndex)
              .sort((a, b) => b.score - a.score)[0] || players[0];

            return (
              <div className="hud-player-slot" style={{ textAlign: 'right' }}>
                <div className="hud-label">OPPONENT</div>
                <div className="hud-name">{opponent?.name || '---'}</div>
                <div className="hud-score">${opponent?.score.toLocaleString() || '0'}</div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default App;
