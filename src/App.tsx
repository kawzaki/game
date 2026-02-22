import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from './store/useGameStore';
import {
  Timer as TimerIcon,
  Trophy,
  Zap,
  Settings,
  Plus,
  Home,
  Clock,
  User,
  Layout,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
  const { i18n } = useTranslation();
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
  const [joinCode, setJoinCode] = React.useState('');

  useEffect(() => {
    // If room is in URL, set it automatically
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = urlParams.get('room');
    if (urlRoom && !roomId) {
      setRoomId(urlRoom);
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

  const playBuzzerSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1084/1084-preview.mp3');
    audio.play().catch(e => console.error("Audio play failed:", e));
  };

  const toggleLanguage = () => {
    const nextLng = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(nextLng);
    document.documentElement.dir = nextLng === 'ar' ? 'rtl' : 'ltr';
  };

  const handleCreateRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(code);
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
      <div className="home-container" dir="rtl">
        {/* Header */}
        <header className="home-header">
          <Settings size={24} color="var(--text-secondary)" />
          <div className="live-indicator">
            <span className="live-dot"></span>
            <span className="live-text">1.2 ألف مباشر</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 900, fontSize: '18px' }}>تحدي المعلومات</span>
            <Zap size={20} fill="var(--brand-yellow)" color="var(--brand-yellow)" />
          </div>
        </header>

        {/* Hero Section */}
        <div className="hero-card">
          <div className="hero-card-inner">
            <Trophy size={60} color="#000" strokeWidth={3} />
          </div>
          <div className="floating-settings">
            <Layout size={20} color="var(--brand-yellow)" />
          </div>
        </div>

        <h1 className="hero-title">هل أنت مستعد<span style={{ color: 'var(--brand-yellow)' }}> للمعركة؟</span></h1>
        <p className="hero-subtitle">تحد أصدقاءك أو انضم إلى الساحات العالمية لإثبات معرفتك.</p>

        {/* Join Section */}
        <div className="join-section">
          <span className="join-label">انضم إلى مباراة</span>
          <div className="join-input-wrapper">
            <button
              onClick={() => joinCode && setRoomId(joinCode)}
              className="join-submit-btn"
            >
              انضم
            </button>
            <input
              type="text"
              placeholder="أدخل رمز الغرفة (مثال: 99-TRV)"
              className="join-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontSize: '11px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>i</div>
            رابط الدعوة يعمل أيضاً! فقط اضغط وادخل.
          </div>
        </div>

        {/* Start Button */}
        <button className="btn-primary-battle" onClick={handleCreateRoom}>
          <Plus size={24} strokeWidth={3} />
          ابدأ معركة جديدة
        </button>

        {/* Grid Options */}
        <div className="action-grid">
          <div className="grid-item">
            <BookOpen size={24} color="var(--brand-yellow)" />
            <span className="grid-label">كيفية اللعب</span>
          </div>
          <div className="grid-item">
            <Layout size={24} color="var(--brand-yellow)" />
            <span className="grid-label">الدوريات</span>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="section-title">
          <h3>أفضل اللاعبين</h3>
          <a href="#" className="btn-view-all">عرض الكل</a>
        </div>

        <div className="leaderboard-list">
          {[
            { name: 'Alex Storm', rate: '98%', rank: 1, avatar: 'https://i.pravatar.cc/150?u=alex' },
            { name: 'Sarah Logic', rate: '94%', rank: 2, avatar: 'https://i.pravatar.cc/150?u=sarah' },
            { name: 'Dev_Mind', rate: '91%', rank: 3, avatar: 'https://i.pravatar.cc/150?u=dev' }
          ].map(player => (
            <div key={player.rank} className="player-card">
              <span className="rank">{player.rank}</span>
              <img src={player.avatar} alt={player.name} className="avatar" />
              <div className="player-info">
                <div className="player-name">{player.name}</div>
                <div className="player-stats">معدل الذكاء: {player.rate}</div>
              </div>
              <ArrowRight size={20} color="var(--text-tertiary)" />
            </div>
          ))}
        </div>

        {/* Room Ready State (if roomId is set) */}
        {roomId && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="modal-content" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
              <div style={{ background: 'var(--brand-yellow)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Zap size={30} color="#000" fill="#000" />
              </div>
              <h2 style={{ marginBottom: '8px' }}>الغرفة جاهزة!</h2>
              <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '4px', margin: '12px 0' }}>{roomId}</div>

              <div style={{ marginBottom: '24px' }}>
                <input
                  type="text"
                  placeholder="أدخل اسمك المستعار..."
                  className="join-input"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', marginBottom: '12px' }}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
                <button
                  disabled={!playerName}
                  onClick={() => addPlayer(playerName, roomId)}
                  className="btn-primary-battle"
                  style={{ opacity: !playerName ? 0.5 : 1 }}
                >
                  انضم إلى المنافسة!
                </button>
                <button
                  onClick={copyInviteLink}
                  style={{ background: 'transparent', border: '1px solid var(--text-tertiary)', color: 'var(--text-secondary)', padding: '12px', borderRadius: '12px', width: '100%' }}
                >
                  🔗 نسخ رابط الدعوة
                </button>
              </div>

              <div className="player-list">
                <h4 style={{ marginBottom: '12px' }}>اللاعبون ({players.length})</h4>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {players.map((p, i) => (
                    <div key={i} style={{ background: '#f1f5f9', color: 'var(--text-secondary)', border: '1px solid rgba(0,0,0,0.05)', padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', fontSize: '13px' }}>
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>

              {players.length > 0 && (
                <button
                  onClick={() => startGame(roomId)}
                  className="btn-primary-battle"
                  style={{ marginTop: '24px' }}
                >
                  ابدأ اللعب الآن! 🚀
                </button>
              )}

              <button
                onClick={() => setRoomId('')}
                style={{ marginTop: '12px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Version */}
        <footer className="version-footer">
          2
        </footer>

        {/* Bottom Nav */}
        <nav className="bottom-nav">
          <div className="nav-item active">
            <Home size={24} />
            <span>الرئيسية</span>
          </div>
          <div className="nav-item">
            <Trophy size={24} />
            <span>الدوريات</span>
          </div>
          <div className="nav-plus">
            <Plus size={32} strokeWidth={3} />
          </div>
          <div className="nav-item">
            <Clock size={24} />
            <span>السجل</span>
          </div>
          <div className="nav-item">
            <User size={24} />
            <span>الملف الشخصي</span>
          </div>
        </nav>
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
                    onClick={() => {
                      if (roomId) {
                        playBuzzerSound();
                        buzz(roomId);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '24px',
                      background: 'var(--accent-gold)',
                      color: 'white',
                      borderRadius: '16px',
                      fontSize: '32px',
                      fontWeight: '900',
                      border: 'none',
                      boxShadow: '0 8px 0 #a3844a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px'
                    }}
                  >
                    <Zap size={32} fill="white" />
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

      {players.length > 0 && (
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
