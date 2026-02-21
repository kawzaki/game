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
    roomId,
    myId,
    setRoomId,
    gameStatus,
    players,
    questions,
    activeQuestion,
    buzzedPlayerId,
    timer,
    startGame,
    pickCategory,
    pickValue,
    buzz,
    submitAnswer,
    closeFeedback,
    answerQuestion,
    tickTimer,
    addPlayer,
    currentPlayerIndex,
    selectedCategory,
    feedback,
    syncQuestions
  } = useGameStore();

  const [localAnswer, setLocalAnswer] = React.useState('');

  useEffect(() => {
    // Reset local answer when question or buzzer status changes
    setLocalAnswer('');
  }, [activeQuestion, buzzedPlayerId]);

  useEffect(() => {
    // Default Room ID if not set
    if (!roomId) setRoomId('1234');
  }, [roomId]);

  useEffect(() => {
    useGameStore.setState({ questions: mockQuestions as any });
  }, []);

  useEffect(() => {
    let interval: any;
    if (gameStatus === 'question' && timer > 0) {
      interval = setInterval(() => tickTimer(), 1000);
    } else if (timer === 0 && gameStatus === 'question') {
      if (roomId) answerQuestion(roomId, false);
    }
    return () => clearInterval(interval);
  }, [gameStatus, timer, roomId]);

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
          <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--royal-blue)' }}>ROOM #{roomId}</span>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  id="player-name-input"
                  placeholder="Your Name"
                  className="input-premium"
                  style={{ flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value;
                      if (val.trim() && roomId) { addPlayer(val, roomId); (e.target as HTMLInputElement).value = ''; }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('player-name-input') as HTMLInputElement;
                    if (input.value.trim() && roomId) { addPlayer(input.value, roomId); input.value = ''; }
                  }}
                  className="btn-rules"
                  style={{ padding: '0 20px', height: '48px', fontSize: '14px' }}
                >
                  JOIN
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
                {players.map(p => <span key={p.id} style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>{p.name}</span>)}
              </div>
              {players.length > 0 && (
                <button
                  onClick={() => {
                    if (roomId) {
                      syncQuestions(roomId, mockQuestions as any);
                      startGame(roomId);
                    }
                  }}
                  className="btn-start"
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-bright))', color: 'white', border: 'none', fontWeight: '900', cursor: 'pointer' }}
                >
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
                onClick={() => roomId && pickCategory(roomId, cat)}
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
                    onClick={() => !isAnswered && roomId && pickValue(roomId, val)}
                  >
                    <span className="gold-text">${val}</span>
                  </div>
                );
              })}
              <button
                onClick={() => {
                  if (roomId) useGameStore.setState({ gameStatus: 'selecting_category', selectedCategory: null });
                }}
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

              <div style={{ marginTop: '20px' }}>
                {feedback ? (
                  <div style={{ padding: '24px', borderRadius: '16px', background: feedback.type === 'correct' ? '#ecfdf5' : '#fef2f2', border: `2px solid ${feedback.type === 'correct' ? '#10b981' : '#ef4444'}` }}>
                    <div style={{ fontSize: '24px', fontWeight: '900', marginBottom: '12px', color: feedback.type === 'correct' ? '#065f46' : '#991b1b' }}>
                      {feedback.message}
                    </div>
                    {feedback.answer && (
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#64748b', marginBottom: '16px' }}>
                        ANSWER: {feedback.answer}
                      </div>
                    )}
                    <button
                      onClick={() => roomId && closeFeedback(roomId)}
                      style={{ padding: '12px 32px', background: feedback.type === 'correct' ? '#10b981' : '#ef4444', color: 'white', borderRadius: '12px', fontWeight: '900', border: 'none', cursor: 'pointer' }}
                    >
                      OKAY
                    </button>
                  </div>
                ) : !buzzedPlayerId ? (
                  <button
                    onClick={() => roomId && buzz(roomId)}
                    style={{ width: '100%', padding: '20px', background: 'var(--accent-gold)', color: 'white', borderRadius: '16px', fontSize: '24px', fontWeight: '900', border: 'none', boxShadow: '0 8px 0 #a3844a' }}
                  >
                    BUZZ!
                  </button>
                ) : buzzedPlayerId === myId ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--royal-blue)', marginBottom: '4px' }}>YOUR TURN TO ANSWER!</div>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Type your answer..."
                      className="input-premium"
                      value={localAnswer}
                      onChange={(e) => setLocalAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && roomId) submitAnswer(roomId, localAnswer);
                      }}
                    />
                    <button
                      onClick={() => roomId && submitAnswer(roomId, localAnswer)}
                      style={{ padding: '14px', background: 'var(--royal-blue)', color: 'white', borderRadius: '12px', fontWeight: '900', border: 'none' }}
                    >
                      SUBMIT ANSWER
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
                    <span style={{ color: '#64748b', fontWeight: 'bold' }}>
                      {players.find(p => p.id === buzzedPlayerId)?.name} is answering...
                    </span>
                  </div>
                )}
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
