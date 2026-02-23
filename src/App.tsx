import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore, socket } from './store/useGameStore';
import HuroofGame from './components/HuroofGame';
import confetti from 'canvas-confetti';
import {
  Timer as TimerIcon,
  Trophy,
  Zap,
  Plus,
  Home,
  Clock,
  User,
  Layout,
  Type,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
  const { i18n } = useTranslation();
  const {
    roomId,
    myId,
    setRoomId,
    gameStatus,
    gameType,
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
    currentPlayerIndex,
    selectedCategory,
    feedback,
    winner,
    resetRoom,
    isConnected
  } = useGameStore();

  const isMyTurn = players[currentPlayerIndex]?.id === myId;
  const activePlayerName = players[currentPlayerIndex]?.name || '...';

  const [playerName, setPlayerName] = React.useState('');
  const [joinCode, setJoinCode] = React.useState('');
  const [qCount, setQCount] = React.useState(10);
  const [localSelecting, setLocalSelecting] = React.useState<string | number | null>(null);
  const [gameSelectionMode, setGameSelectionMode] = React.useState(false);

  // Sync local selection when game state changes
  useEffect(() => {
    setLocalSelecting(null);
  }, [gameStatus, selectedCategory, activeQuestion]);

  // Sync qCount with server data (important for guests)
  const questionsPerCategoryServer = useGameStore(state => (state as any).questionsPerCategory);
  useEffect(() => {
    if (questionsPerCategoryServer && players[0]?.id !== myId) {
      setQCount(questionsPerCategoryServer);
    }
  }, [questionsPerCategoryServer, players, myId]);

  const forfeit = () => {
    if (confirm('هل أنت متأكد من إنهاء اللعبة مبكراً؟')) {
      socket.emit('forfeit_game', roomId);
    }
  };

  const handlePickCategory = (cat: string) => {
    if (!isMyTurn || !roomId) return;
    setLocalSelecting(cat);
    pickCategory(roomId, cat);
  };

  const handlePickValue = (val: number) => {
    if (!isMyTurn || !roomId) return;
    setLocalSelecting(val);
    pickValue(roomId, val);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = urlParams.get('room');
    if (urlRoom && !roomId) {
      setRoomId(urlRoom);
    }
  }, [roomId, setRoomId]);

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

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

  const handleCreateRoom = () => {
    setGameSelectionMode(true);
  };

  const setGameTypeLocal = useGameStore(state => (state as any).setGameType);
  const finalizeCreateRoom = (type: 'jeopardy' | 'huroof') => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGameTypeLocal(type);
    setRoomId(code);
    setGameSelectionMode(false);
  };

  const generateInviteLink = () => {
    return `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(generateInviteLink());
    alert('Invite link copied!');
  };

  useEffect(() => {
    if (gameStatus === 'game_over' && winner) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a3844a', '#D4AF37', '#FFD700']
      });
    }
  }, [gameStatus, winner]);

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

  const hasJoined = useMemo(() => players.some(p => p.id === myId), [players, myId]);

  // UI RENDERING STARTS HERE

  if (gameSelectionMode) {
    return (
      <div className="home-container">
        <header className="home-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: '18px' }}>اختر اللعبة</span>
          </div>
        </header>
        <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button className="btn-primary-battle" onClick={() => finalizeCreateRoom('jeopardy')}>
            <Layout size={24} />
            لعبة جيباردي (العادية)
          </button>
          <button className="btn-primary-battle" style={{ background: 'var(--brand-yellow)', color: '#000' }} onClick={() => finalizeCreateRoom('huroof')}>
            <Type size={24} />
            لعبة الحروف (Huroof)
          </button>
          <button className="btn-secondary" style={{ marginTop: '20px' }} onClick={() => setGameSelectionMode(false)}>
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  if (gameStatus === 'lobby') {
    return (
      <div className="home-container">
        <header className="home-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: '18px' }}>تحدي المعلومات</span>
            <Zap size={20} fill="var(--brand-yellow)" color="var(--brand-yellow)" />
          </div>
        </header>

        <div className="hero-card">
          <div className="hero-card-inner">
            <Trophy size={60} color="#000" strokeWidth={3} />
          </div>
        </div>

        <h1 className="hero-title">هل أنت مستعد <span style={{ color: 'var(--brand-yellow)' }}>للمنافسة؟</span></h1>
        <p className="hero-subtitle">تحد أصدقاءك لإثبات معرفتك في مختلف الألعاب.</p>

        <button className="btn-primary-battle" onClick={handleCreateRoom}>
          <Plus size={24} strokeWidth={3} />
          ابدأ منافسة جديدة
        </button>

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
              placeholder="أدخل رمز الغرفة"
              className="join-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        {roomId && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="modal-content" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
              <div style={{ background: 'var(--brand-yellow)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Zap size={30} color="#000" fill="#000" />
              </div>
              <h2 style={{ marginBottom: '8px' }}>الغرفة جاهزة!</h2>
              <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '4px', margin: '12px 0' }}>{roomId}</div>

              <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                نوع اللعبة: <strong>{gameType === 'jeopardy' ? 'جيباردي' : 'لعبة الحروف'}</strong>
              </div>

              {gameType === 'jeopardy' && (
                <div style={{ marginBottom: '16px', background: '#f1f5f9', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: 'bold' }}>عدد الأسئلة لكل فئة</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                    {players[0]?.id === myId ? (
                      <>
                        <button onClick={() => setQCount(Math.max(1, qCount - 1))} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #cbd5e1' }}>-</button>
                        <span style={{ fontSize: '18px', fontWeight: 'bold', width: '30px' }}>{qCount}</span>
                        <button onClick={() => setQCount(Math.min(50, qCount + 1))} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #cbd5e1' }}>+</button>
                      </>
                    ) : (
                      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{qCount}</span>
                    )}
                  </div>
                </div>
              )}

              <input
                type="text"
                placeholder="أدخل اسمك ..."
                className="join-input"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', marginBottom: '12px' }}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
              <button
                disabled={!playerName || hasJoined}
                onClick={() => {
                  socket.emit('join_room', { roomId, playerName, questionsPerCategory: qCount, gameType });
                }}
                className={hasJoined ? "btn-secondary" : "btn-primary-battle"}
                style={{
                  opacity: (!playerName && !hasJoined) ? 0.5 : (hasJoined ? 0.4 : 1),
                  marginBottom: '12px',
                  pointerEvents: hasJoined ? 'none' : 'auto'
                }}
              >
                {hasJoined ? "تم الانضمام ✓" : "انضم الآن!"}
              </button>
              <button onClick={copyInviteLink} style={{ background: 'transparent', border: '1px solid #ccc', padding: '12px', borderRadius: '12px', width: '100%' }}>
                🔗 نسخ رابط الدعوة
              </button>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ marginBottom: '8px' }}>اللاعبون المتواجدون:</h4>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {players.map((p, i) => (
                    <div key={i} style={{ background: '#eee', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>{p.name}</div>
                  ))}
                </div>
              </div>

              <button
                disabled={!hasJoined || players.length === 0}
                onClick={() => startGame(roomId)}
                className="btn-primary-battle"
                style={{ marginTop: '20px' }}
              >
                ابدأ اللعب! 🚀
              </button>
              <button onClick={() => setRoomId('')} style={{ marginTop: '10px', background: 'none', border: 'none', color: '#999' }}>إلغاء</button>
            </div>
          </div>
        )}

        <nav className="bottom-nav">
          <div className="nav-item active"><Home size={24} /><span>الرئيسية</span></div>
          <div className="nav-item"><Trophy size={24} /><span>البطولات</span></div>
          <div className="nav-plus"><Plus size={32} strokeWidth={3} /></div>
          <div className="nav-item"><Clock size={24} /><span>السجل</span></div>
          <div className="nav-item"><User size={24} /><span>الملف</span></div>
        </nav>
      </div>
    );
  }

  // GAME BOARD RENDERING (Jeopardy or Huroof)
  return (
    <div className="game-wrapper" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', paddingBottom: '200px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #eee', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={18} style={{ color: 'var(--accent-gold)' }} />
          <span className="gold-text" style={{ fontSize: '14px' }}>غرفة #{roomId}</span>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-forfeit" onClick={forfeit}>إنهاء اللعبة</button>
        </div>
      </header>

      <main style={{ padding: '16px' }}>
        {gameType === 'jeopardy' ? (
          /* JEOPARDY BOARD */
          <>
            {(gameStatus === 'selecting_category') && (
              <div>
                <div className={`turn-banner ${isMyTurn ? 'my-turn' : 'their-turn'}`} style={{ marginBottom: '16px', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '900' }}>
                    {isMyTurn ? 'اختر الفئة' : `يقوم ${activePlayerName} بالاختيار...`}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {Object.keys(categories).map((cat) => (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      key={cat}
                      className={`tile-premium ${!isMyTurn ? 'tile-disabled' : ''} ${localSelecting === cat ? 'selecting' : ''}`}
                      onClick={() => handlePickCategory(cat)}
                      style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: '900' }}>{cat}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {(gameStatus === 'selecting_value') && (
              <div>
                <div className={`turn-banner ${isMyTurn ? 'my-turn' : 'their-turn'}`} style={{ marginBottom: '16px', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '900' }}>
                    {isMyTurn ? 'اختر القيمة' : `يقوم ${activePlayerName} بالاختيار...`}
                  </div>
                </div>
                <h3 style={{ textAlign: 'center', marginBottom: '24px' }}>{selectedCategory}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '12px' }}>
                  {[100, 200, 300, 400, 500].map((val) => {
                    const catQuestions = categories[selectedCategory || ''] || [];
                    const answeredCount = catQuestions.filter(q => q.value === val && q.isAnswered).length;
                    const totalForValue = catQuestions.filter(q => q.value === val).length;
                    const isFullyAnswered = answeredCount >= totalForValue && totalForValue > 0;
                    return (
                      <motion.button
                        whileTap={(!isFullyAnswered && isMyTurn) ? { scale: 0.95 } : {}}
                        key={val}
                        className={`value-button ${isFullyAnswered ? 'tile-answered' : ''} ${!isMyTurn ? 'tile-disabled' : ''}`}
                        onClick={() => !isFullyAnswered && handlePickValue(val)}
                        style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Coins size={20} />
                        <span style={{ fontWeight: 900 }}>{val}</span>
                      </motion.button>
                    );
                  })}
                  <button className="btn-back-ghost" onClick={() => useGameStore.setState({ gameStatus: 'selecting_category', selectedCategory: null })}>رجوع</button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* HUROOF BOARD */
          <HuroofGame roomId={roomId || ''} />
        )}
      </main>

      <AnimatePresence>
        {gameStatus === 'question' && activeQuestion && (
          <div className="fixed modal-overlay" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content" dir="rtl">
              <div className="modal-timer">
                <TimerIcon size={18} />
                <span>{timer}s</span>
              </div>
              <div className="cat-label">{activeQuestion.category}</div>
              <h3 style={{ fontSize: '28px' }}>{activeQuestion.value}</h3>
              <p className="question-text">{activeQuestion.question}</p>

              <div style={{ marginTop: '20px' }}>
                {feedback ? (
                  <div style={{
                    padding: '24px',
                    borderRadius: '16px',
                    background: feedback.type === 'correct' ? '#ecfdf5' : (feedback.type === 'luck' ? '#fffbeb' : '#fef2f2'),
                    border: feedback.type === 'correct' ? '2px solid #10b981' : (feedback.type === 'luck' ? '2px solid #f59e0b' : '2px solid #ef4444')
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: '900', marginBottom: '12px', color: feedback.type === 'correct' ? '#065f46' : (feedback.type === 'luck' ? '#92400e' : '#991b1b') }}>{feedback.message}</div>
                    {feedback.answer && <div style={{ marginBottom: '16px', fontWeight: 'bold' }}>الإجابة: {feedback.answer}</div>}
                    <button onClick={() => roomId && closeFeedback(roomId)} className="btn-primary-battle">حسناً</button>
                  </div>
                ) : attempts.includes(myId || '') ? (
                  <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px' }}>حاولت بالفعل، انتظر الآخرين...</div>
                ) : !buzzedPlayerId ? (
                  <motion.button
                    whileTap={{ scale: 0.92, y: 4 }}
                    onClick={() => roomId && (playBuzzerSound(), buzz(roomId))}
                    className="btn-primary-battle"
                    style={{ height: '80px', fontSize: '32px' }}
                  >
                    إجابة!
                  </motion.button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {buzzedPlayerId === myId ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {activeQuestion.options.map((opt, idx) => (
                          <button key={idx} onClick={() => roomId && submitAnswer(roomId, opt)} style={{ padding: '16px', borderRadius: '12px', border: '2px solid #ddd' }}>{opt}</button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '18px' }}>{players.find(p => p.id === buzzedPlayerId)?.name} يجيب الآن...</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {gameStatus === 'game_over' && winner && (
          <div className="game-over-container">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="winner-card">
              <Trophy size={80} color="var(--accent-gold)" />
              <div className="winner-name">{winner.name}</div>
              <div className="winner-score">{winner.score.toLocaleString()}</div>
              <button className="btn-gold" style={{ marginTop: '20px' }} onClick={() => resetRoom()}>العودة للرئيسية</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {players.length > 0 && (
        <div className="bottom-hud">
          <div className="hud-row-players">
            {players.map((p, i) => (
              <div key={p.id} className={`hud-player-unit ${i === currentPlayerIndex ? 'active' : ''}`}>
                <div className="hud-player-name">{p.name}</div>
                <div className="hud-player-score">{p.score}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
