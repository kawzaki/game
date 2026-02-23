import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore, socket } from './store/useGameStore';
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
  BookOpen,
  ArrowRight,
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

  // Reset local selection when game state changes
  useEffect(() => {
    setLocalSelecting(null);
  }, [gameStatus, selectedCategory, activeQuestion]);

  const forfeit = () => {
    if (confirm('هل أنت متأكد من إنهاء اللعبة مبكراً؟')) {
      socket.emit('forfeit_game', roomId);
    }
  };

  const handlePickCategory = (cat: string) => {
    if (!isMyTurn || !roomId) {
      console.log(`[Selection] Blocked: isMyTurn=${isMyTurn}, roomId=${!!roomId}`);
      return;
    }
    console.log(`[Selection] Picking category: ${cat}`);
    setLocalSelecting(cat);
    pickCategory(roomId, cat);
  };

  const handlePickValue = (val: number) => {
    if (!isMyTurn || !roomId) {
      console.log(`[Selection] Blocked: isMyTurn=${isMyTurn}, roomId=${!!roomId}`);
      return;
    }
    console.log(`[Selection] Picking value: ${val}`);
    setLocalSelecting(val);
    pickValue(roomId, val);
  };

  useEffect(() => {
    // If room is in URL, set it automatically
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = urlParams.get('room');
    if (urlRoom && !roomId) {
      setRoomId(urlRoom);
    }
  }, [roomId, setRoomId]);

  useEffect(() => {
    // Sync document direction with language
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    // Force iOS to allow :active states
    const handleTouch = () => { };
    document.body.addEventListener('touchstart', handleTouch, { passive: true });
    return () => document.body.removeEventListener('touchstart', handleTouch);
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
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(code);
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

  if (gameStatus === 'lobby') {
    return (
      <div className="home-container">
        {/* Header */}
        <header className="home-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
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

        <h1 className="hero-title">هل أنت مستعد <span style={{ color: 'var(--brand-yellow)' }}>للمنافسة؟</span></h1>
        <p className="hero-subtitle">تحد أصدقاءك أو انضم إلى الساحات العالمية لإثبات معرفتك.</p>

        {/* Start Button */}
        <button className="btn-primary-battle" onClick={handleCreateRoom}>
          <Plus size={24} strokeWidth={3} />
          ابدأ منافسة جديدة
        </button>

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
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontSize: '11px', textAlign: 'inherit' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>i</div>
            <span>رابط الدعوة يعمل أيضاً! فقط اضغط وادخل.</span>
          </div>
        </div>

        {/* Grid Options */}
        <div className="action-grid">
          <div className="grid-item">
            <BookOpen size={24} color="var(--brand-yellow)" />
            <span className="grid-label">كيفية اللعب</span>
          </div>
          <div className="grid-item">
            <Layout size={24} color="var(--brand-yellow)" />
            <span className="grid-label">البطولات</span>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="dimmed-section">
          <div className="section-title">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="coming-soon-badge">قريباً</span>
              <h3>أفضل اللاعبين</h3>
            </div>
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
                <ArrowRight size={20} color="var(--text-tertiary)" className="flip-rtl" />
              </div>
            ))}
          </div>
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

              <div style={{ marginBottom: '16px', background: '#f1f5f9', padding: '12px', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: 'bold' }}>عدد الأسئلة لكل فئة</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                  <button onClick={() => setQCount(Math.max(1, qCount - 1))} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', width: '30px' }}>{qCount}</span>
                  <button onClick={() => setQCount(Math.min(50, qCount + 1))} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
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
                  onClick={() => addPlayer(playerName, roomId, qCount)}
                  className={hasJoined ? "btn-secondary" : "btn-primary-battle"}
                  style={{
                    opacity: (!playerName && !hasJoined) ? 0.5 : (hasJoined ? 0.4 : 1),
                    marginBottom: '12px',
                    pointerEvents: hasJoined ? 'none' : 'auto'
                  }}
                >
                  {hasJoined ? "تم الانضمام ✓" : "انضم إلى المنافسة!"}
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

              <button
                disabled={!hasJoined || players.length === 0}
                onClick={() => startGame(roomId)}
                className={hasJoined ? "btn-primary-battle" : "btn-secondary"}
                style={{
                  marginTop: '24px',
                  opacity: hasJoined ? 1 : 0.4,
                  pointerEvents: hasJoined ? 'auto' : 'none'
                }}
              >
                ابدأ اللعب الآن! 🚀
              </button>

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
            <span>البطولات</span>
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
    <div className="game-wrapper" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', paddingBottom: '200px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #eee', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={18} style={{ color: 'var(--accent-gold)' }} />
          <span className="gold-text" style={{ fontSize: '14px' }}>غرفة #{roomId}</span>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? '#10b981' : '#ef4444',
              marginLeft: '8px',
              boxShadow: isConnected ? '0 0 8px #10b981' : '0 0 8px #ef4444'
            }}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8' }}>AR</span>
          <button className="rules-btn">قوانين اللعبة</button>
          {gameStatus !== ('lobby' as any) && gameStatus !== 'game_over' && (
            <button className="btn-forfeit" onClick={forfeit}>إنهاء اللعبة</button>
          )}
        </div>
      </header>

      <main style={{ padding: '16px' }}>
        {gameStatus === 'selecting_category' && (
          <div>
            <div className={`turn-banner ${isMyTurn ? 'my-turn' : 'their-turn'}`} style={{ marginBottom: '16px', padding: '12px', borderRadius: '12px', textAlign: 'center', transition: 'all 0.3s ease' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', opacity: 0.7, marginBottom: '2px' }}>
                {isMyTurn ? 'دورك الآن' : 'بانتظار المنافس'}
              </div>
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
                  style={{
                    height: '80px',
                    textAlign: 'center',
                    opacity: isMyTurn ? 1 : 0.6,
                    cursor: isMyTurn ? 'pointer' : 'not-allowed',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%'
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--royal-blue)' }}>{cat}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {gameStatus === 'selecting_value' && (
          <div>
            <div className={`turn-banner ${isMyTurn ? 'my-turn' : 'their-turn'}`} style={{ marginBottom: '16px', padding: '12px', borderRadius: '12px', textAlign: 'center', transition: 'all 0.3s ease' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', opacity: 0.7, marginBottom: '2px' }}>
                {isMyTurn ? 'دورك الآن' : 'بانتظار المنافس'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '900' }}>
                {isMyTurn ? 'اختر القيمة' : `يقوم ${activePlayerName} بالاختيار...`}
              </div>
            </div>
            <h3 style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--royal-blue)', fontWeight: '900', fontSize: '24px' }}>{selectedCategory}</h3>
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
                    className={`value-button ${isFullyAnswered ? 'tile-answered' : ''} ${!isMyTurn ? 'tile-disabled' : ''} ${localSelecting === val ? 'selecting' : ''}`}
                    onClick={() => !isFullyAnswered && handlePickValue(val)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: isMyTurn ? (isFullyAnswered ? 0.5 : 1) : 0.6,
                      cursor: (isMyTurn && !isFullyAnswered) ? 'pointer' : 'not-allowed',
                      width: '100%',
                      border: 'none',
                      position: 'relative'
                    }}
                  >
                    <Coins size={24} style={{ color: 'var(--accent-gold)' }} />
                    <span className="gold-text">{val}</span>
                    {!isFullyAnswered && totalForValue > 1 && (
                      <span style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        background: 'var(--brand-yellow)',
                        color: 'black',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        fontSize: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '900',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        {totalForValue - answeredCount}
                      </span>
                    )}
                  </motion.button>
                );
              })}
              <button
                className="btn-back-ghost"
                onClick={() => {
                  if (roomId) useGameStore.setState({ gameStatus: 'selecting_category', selectedCategory: null });
                }}
              >
                رجوع
              </button>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {gameStatus === 'question' && activeQuestion && (
          <div className="fixed modal-overlay" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="modal-content"
              dir="rtl"
            >
              <div className="modal-timer">
                <TimerIcon size={18} style={{ color: 'var(--accent-gold)' }} />
                <span>{timer}s</span>
              </div>
              <div className="cat-label">{activeQuestion.category}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', width: '100%' }}>
                <Coins size={28} style={{ color: 'var(--accent-gold)' }} />
                <h3 className="gold-text" style={{ fontSize: '28px', margin: 0 }}>{activeQuestion.value}</h3>
              </div>
              <p className="question-text">{activeQuestion.question}</p>

              <div style={{ marginTop: '20px' }}>
                {feedback ? (
                  <div style={{ padding: '24px', borderRadius: '16px', background: feedback.type === 'correct' ? '#ecfdf5' : '#fef2f2', border: `2px solid ${feedback.type === 'correct' ? '#10b981' : '#ef4444'}` }}>
                    <div style={{ fontSize: '24px', fontWeight: '900', marginBottom: '12px', color: feedback.type === 'correct' ? '#065f46' : feedback.type === 'luck' ? 'var(--royal-blue)' : '#991b1b' }}>
                      {feedback.message}
                    </div>
                    {feedback.answer && (
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#64748b', marginBottom: '16px' }}>
                        الإجابة: {feedback.answer}
                      </div>
                    )}
                    <button
                      onClick={() => roomId && closeFeedback(roomId)}
                      style={{ padding: '12px 32px', background: feedback.type === 'correct' ? '#10b981' : feedback.type === 'luck' ? 'var(--brand-yellow)' : '#ef4444', color: feedback.type === 'luck' ? '#000' : 'white', borderRadius: '12px', fontWeight: '900', border: 'none', cursor: 'pointer' }}
                    >
                      حسناً
                    </button>
                  </div>
                ) : attempts.includes(myId || '') ? (
                  <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
                    <span style={{ color: '#64748b', fontWeight: 'bold' }}>
                      لقد حاولت بالفعل! بانتظار البقية...
                    </span>
                  </div>
                ) : !buzzedPlayerId ? (
                  <motion.button
                    whileTap={{ scale: 0.92, y: 4 }}
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
                      gap: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <Zap size={32} fill="white" />
                    إجابة!
                  </motion.button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {buzzedPlayerId ? (
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#64748b', marginBottom: '4px' }}>
                        {players.find(p => p.id === buzzedPlayerId)?.name} يجيب الآن...
                      </div>
                    ) : (
                      <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--royal-blue)', marginBottom: '4px' }}>بانتظار الضغط على الزر...</div>
                    )}

                    {/* Show options if someone has buzzed */}
                    {buzzedPlayerId && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {activeQuestion.options.map((option, idx) => {
                          const isBuzzedPlayer = buzzedPlayerId === myId;
                          return isBuzzedPlayer ? (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              key={idx}
                              onClick={() => roomId && submitAnswer(roomId, option)}
                              style={{
                                padding: '16px',
                                background: '#f8fafc',
                                border: '2px solid #e2e8f0',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.2s',
                                color: 'var(--text-primary)'
                              }}
                            >
                              {option}
                            </motion.button>
                          ) : (
                            <div
                              key={idx}
                              style={{
                                padding: '16px',
                                background: '#f1f5f9',
                                border: '2px solid #e2e8f0',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                textAlign: 'center',
                                color: '#94a3b8',
                                opacity: 0.7
                              }}
                            >
                              {option}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!buzzedPlayerId && (
                      <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1', textAlign: 'center' }}>
                        <span style={{ color: '#64748b', fontWeight: 'bold' }}>
                          بانتظار أسرع واحد يضغط!
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
        {gameStatus === 'game_over' && winner && (
          <div className="game-over-container">
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              className="winner-card"
            >
              <Trophy size={80} color="var(--accent-gold)" style={{ marginBottom: '16px' }} />
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-tertiary)' }}>
                {winner.isForfeit ? 'لقد انسحب الخصم! الفائز هو:' : 'الفائز هو:'}
              </div>
              <div className="winner-name">{winner.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <Coins size={40} style={{ color: 'var(--accent-gold)' }} />
                <div className="winner-score">{winner.score.toLocaleString()}</div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>ألف مبروك! 🎉</div>
            </motion.div>

            <button
              className="btn-gold"
              style={{ padding: '16px 40px', fontSize: '18px', width: 'auto' }}
              onClick={() => resetRoom()}
            >
              العودة للرئيسية
            </button>
          </div>
        )}
      </AnimatePresence>

      {players.length > 0 && (
        <div className="bottom-hud">
          {/* Row 1: Current Turn */}
          <div className="hud-row-turn">
            <div className="hud-turn-label">دور اللاعب الآن:</div>
            <div className="hud-turn-name">{players[currentPlayerIndex]?.name || '---'}</div>
          </div>

          {/* Row 2: Dynamic Player List */}
          <div className="hud-row-players">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`hud-player-unit ${index === currentPlayerIndex ? 'active' : ''}`}
              >
                <div className="hud-player-name">{player.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Coins size={14} style={{ color: 'var(--accent-gold)' }} />
                  <div className="hud-player-score">{player.score.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
