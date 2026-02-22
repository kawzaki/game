import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from './store/useGameStore';
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
    attempts,
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
  } = useGameStore();

  const [playerName, setPlayerName] = React.useState('');
  const [showJoinInput, setShowJoinInput] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState('');

  useEffect(() => {
    // If room is in URL, set it automatically
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = urlParams.get('room');
    if (urlRoom && !roomId) {
      setRoomId(urlRoom);
      setShowJoinInput(true);
    }
  }, [roomId, setRoomId]);

  useEffect(() => {
    let interval: any;
    if (gameStatus === 'question' && timer > 0) {
      interval = setInterval(() => tickTimer(), 1000);
    } else if (timer === 0 && gameStatus === 'question') {
      if (roomId) answerQuestion(roomId, false);
    }
    return () => clearInterval(interval);
  }, [gameStatus, timer, roomId, answerQuestion, tickTimer]);

  const toggleLanguage = () => {
    const nextLng = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(nextLng);
    document.documentElement.dir = nextLng === 'ar' ? 'rtl' : 'ltr';
  };

  const handleCreateRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(code);
    setShowJoinInput(true);
  };

  const generateInviteLink = () => {
    return `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(generateInviteLink());
    alert('Invite link copied to clipboard!');
  };

  const categories = useMemo(() => {
    const cats: Record<string, any[]> = {};
    if (!questions) return cats;
    questions.forEach((q: any) => {
      if (!cats[q.category]) cats[q.category] = [];
      cats[q.category].push(q);
    });
    Object.keys(cats).forEach(k => {
      cats[k].sort((a, b) => a.value - b.value);
    });
    return cats;
  }, [questions]);

  if (gameStatus === 'lobby') {
    return (
      <div className="game-container">
        <header className="header-premium">
          <div className="logo">
            <span className="logo-sparkle">✨</span> JEOPARDY <span className="logo-sparkle">✨</span>
          </div>
          <div className="room-id">
            ROOM: {roomId || '---'}
          </div>
        </header>

        <main style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px', textAlign: 'center' }}>
          {!roomId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '40px' }}>
              <h1 style={{ color: 'var(--accent-gold)', fontSize: '32px', fontWeight: '900' }}>WELCOME!</h1>
              <p style={{ color: '#94a3b8' }}>Create a new game or join a friend's room</p>

              <button
                onClick={handleCreateRoom}
                className="btn-gold"
                style={{ padding: '20px', fontSize: '20px' }}
              >
                CREATE NEW GAME
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, height: '1px', background: '#334155' }}></div>
                <span style={{ color: '#475569', fontSize: '14px', fontWeight: 'bold' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: '#334155' }}></div>
              </div>

              {showJoinInput ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="ENTER ROOM CODE"
                    className="input-premium"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px' }}
                  />
                  <button
                    onClick={() => {
                      if (joinCode) setRoomId(joinCode);
                    }}
                    className="btn-primary"
                  >
                    SELECT ROOM
                  </button>
                  <button
                    onClick={() => setShowJoinInput(false)}
                    style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer' }}
                  >
                    ← BACK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowJoinInput(true)}
                  style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '16px', borderRadius: '12px', fontWeight: 'bold' }}
                >
                  JOIN WITH CODE
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="card-premium" style={{ border: '2px solid var(--accent-gold)' }}>
                <h2 style={{ color: 'var(--accent-gold)', marginBottom: '8px' }}>ROOM READY!</h2>
                <div style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '4px', color: 'white', marginBottom: '16px' }}>
                  {roomId}
                </div>
                <button
                  onClick={copyInviteLink}
                  style={{ padding: '8px 16px', background: '#1e293b', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold)', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}
                >
                  🔗 COPY INVITE LINK
                </button>
              </div>

              <div style={{ textAlign: 'right' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '900', color: 'var(--royal-blue)', marginBottom: '8px' }}>
                  اسمك المستعار / YOUR NAME:
                </label>
                <input
                  type="text"
                  placeholder="Enter your name..."
                  className="input-premium"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>

              <button
                disabled={!playerName || !roomId}
                onClick={() => roomId && addPlayer(playerName, roomId)}
                className="btn-gold"
                style={{ opacity: (!playerName || !roomId) ? 0.5 : 1 }}
              >
                JOIN THE COMPETITION!
              </button>

              <div className="player-list">
                <h3>PLAYERS ({players.length})</h3>
                <div className="players-grid">
                  {players.map((p, i) => (
                    <div key={i} className="player-badge">
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>

              {players.length > 0 && (
                <button
                  onClick={() => roomId && startGame(roomId)}
                  className="btn-primary"
                  style={{ marginTop: '20px', padding: '18px' }}
                >
                  START GAME NOW! 🚀
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="game-wrapper" style={{ minHeight: '100vh', paddingBottom: '140px' }}>
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
                ) : attempts.includes(myId || '') ? (
                  <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
                    <span style={{ color: '#64748b', fontWeight: 'bold' }}>
                      You already tried! Waiting for others...
                    </span>
                  </div>
                ) : !buzzedPlayerId ? (
                  <button
                    onClick={() => roomId && buzz(roomId)}
                    style={{ width: '100%', padding: '20px', background: 'var(--accent-gold)', color: 'white', borderRadius: '16px', fontSize: '24px', fontWeight: '900', border: 'none', boxShadow: '0 8px 0 #a3844a' }}
                  >
                    BUZZ!
                  </button>
                ) : buzzedPlayerId === myId ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--royal-blue)', marginBottom: '4px' }}>CHOOSE THE CORRECT OPTION:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {activeQuestion.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => roomId && submitAnswer(roomId, option)}
                          style={{ padding: '16px', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
                          onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-gold)'; e.currentTarget.style.background = '#fffbeb'; }}
                          onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
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

      {gameStatus !== 'lobby' && players.length > 0 && (
        <div className="bottom-hud">
          <div className="hud-player-slot active">
            <div className="hud-label">TURN: {players[currentPlayerIndex]?.name || '---'}</div>
            <div className="hud-score">${players[currentPlayerIndex]?.score.toLocaleString()}</div>
          </div>
          <div className="hud-vs">VS</div>
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
