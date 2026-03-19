import React, { useEffect, useMemo, useState } from 'react';
import { playSound } from './utils/soundUtils';
import { useTranslation } from 'react-i18next';
import { useGameStore, socket } from './store/useGameStore';
import HuroofGame from './components/HuroofGame';
import BentOWalad from './components/BentOWalad';
import WordMeaningGame from './components/WordMeaningGame';
import SibaGame from './components/SibaGame';
import PixelChallenge from './components/PixelChallenge';
import DrawingChallenge from './components/DrawingChallenge';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import Competitions from './components/Competitions';
import { QRScannerModal } from './components/QRScannerModal';
import { VersionChecker } from './components/VersionChecker';
import confetti from 'canvas-confetti';
import {
  Timer as TimerIcon,
  Trophy,
  Zap,
  Plus,
  Home,
  Download,
  User,
  Layout,
  Type,
  Coins,
  Share2,
  QrCode,
  BookOpen,
  Image as ImageIcon,
  Pencil,
  Camera,
  X as CloseIcon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';

const BIN_O_WALAD_CATEGORIES = [
  { key: 'girl', label: 'بنت' },
  { key: 'boy', label: 'ولد' },
  { key: 'thing', label: 'جماد' },
  { key: 'food', label: 'أكل' },
  { key: 'animal', label: 'حيوان' },
  { key: 'location', label: 'بلاد' }
];

const NotificationToast: React.FC = () => {
  const { notification, clearNotification } = useGameStore();

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            x: '-50%',
            zIndex: 10000,
            width: '90%',
            maxWidth: '400px',
            padding: '16px 20px',
            borderRadius: '20px',
            background: '#fff',
            border: `2px solid ${notification.type === 'success' ? '#10b981' : (notification.type === 'error' ? '#ef4444' : '#3b82f6')}`,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            direction: 'rtl'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              background: notification.type === 'success' ? '#ecfdf5' : (notification.type === 'error' ? '#fef2f2' : '#eff6ff'), 
              padding: '8px', 
              borderRadius: '12px' 
            }}>
              {notification.type === 'success' ? <Trophy size={20} color="#10b981" /> : (notification.type === 'error' ? <Zap size={20} color="#ef4444" /> : <Plus size={20} color="#3b82f6" />)}
            </div>
            <span style={{ fontWeight: 900, fontSize: '14px', color: '#1e293b' }}>{notification.message}</span>
          </div>
          <button 
            onClick={clearNotification}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          >
            <CloseIcon size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

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
    currentPlayerIndex,
    selectedCategory,
    feedback,
    winner,
    resetRoom,
    isConnected,
    roundResults,
    createRoom,
    roomDataLoading,
    addPlayer,
    huroofHistory,
    leaveRoom,
    challengeData,
    getChallenge,
    challengeLoading,
    joinChallengeSession,
    playerName: storedPlayerName,
    fetchActiveRooms,
    isServerWakingUp,
  } = useGameStore();

  const [isCreator, setIsCreator] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'competitions' | 'profile'>('home');

  const isMyTurn = players[currentPlayerIndex]?.id === myId;
  const activePlayer = players[currentPlayerIndex];
  const activePlayerName = activePlayer ? `${activePlayer.name} (#${activePlayer.number || currentPlayerIndex + 1})` : '...';

  const [playerName, setPlayerName] = React.useState(storedPlayerName || '');
  
  // Keep local playerName in sync with store (e.g. if loaded from localStorage)
  useEffect(() => {
    if (storedPlayerName && !playerName) {
      setPlayerName(storedPlayerName);
    }
  }, [storedPlayerName]);
  const [joinCode, setJoinCode] = React.useState('');
  const [qCount, setQCount] = React.useState(10);
  const handleQCountChange = (newCount: number) => {
    setQCount(newCount);
    if ((players[0]?.id === myId || isCreator) && roomId) {
      socket.emit('update_settings', { roomId, questionsPerCategory: newCount });
    }
  };
  const prevPlayersCount = React.useRef(0);
  const [newestPlayerId, setNewestPlayerId] = React.useState<string | null>(null);
  useEffect(() => {
    if (players.length > prevPlayersCount.current && prevPlayersCount.current > 0) {
      // New player joined — play ding and highlight
      playSound('ding');
      setNewestPlayerId(players[players.length - 1]?.id || null);
      setTimeout(() => setNewestPlayerId(null), 2500);
    }
    prevPlayersCount.current = players.length;
  }, [players.length]);

  const [localSelecting, setLocalSelecting] = React.useState<string | number | null>(null);


  useEffect(() => {
    setLocalSelecting(null);
  }, [gameStatus, selectedCategory, activeQuestion]);

  // Request Screen Wake Lock
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Screen Wake Lock is active');

          wakeLock.addEventListener('release', () => {
            console.log('Screen Wake Lock was released');
          });
        }
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    };

    // Request on mount
    requestWakeLock();

    // Re-request when document becomes visible again
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock !== null) {
        wakeLock.release().then(() => {
          wakeLock = null;
        });
      }
    };
  }, []);

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
    const urlChallenge = urlParams.get('challenge');

    if (urlRoom && !roomId) {
      setRoomId(urlRoom);
    }

    if (urlChallenge && !challengeData && !challengeLoading) {
      getChallenge(urlChallenge);
      // Removed: joinChallengeSession(urlChallenge, storedPlayerName || playerName || 'لاعب');
      // We only join the session room if the user interacts (e.g. clicks "Challenge Back")
    }
  }, [roomId, setRoomId, challengeData, challengeLoading, getChallenge, storedPlayerName, playerName, joinChallengeSession]);

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);


  useEffect(() => {
    if (feedback) {
      if (feedback.type === 'correct' || feedback.type === 'luck') playSound('correct');
      if (feedback.type === 'wrong') playSound('wrong');
    }
  }, [feedback]);

  useEffect(() => {
    // QUESTION TIMER (Server-managed)
    // We no longer manage the question timer client-side to avoid race conditions.
    // The server emits room_data updates every second which syncs the timer.
    // However, if we're the only player and it's solo, we might need a fallback, 
    // but Jeopardy/Huroof are multiplayer-first.
    
    if (timer === 0 && gameStatus === 'question') {
      playSound('timeout');
      // No need to call answerQuestion(roomId, false) anymore, 
      // the server will handle the timeout and push room_data.
    }
  }, [gameStatus, timer]);

  const finalizeCreateRoom = (type: 'jeopardy' | 'huroof' | 'bin_o_walad' | 'word_meaning' | 'siba' | 'pixel_challenge' | 'drawing_challenge') => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setIsCreator(true);
    createRoom(code, type, qCount);
  };

  const generateInviteLink = () => {
    return `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  };

  const shareInviteLink = async () => {
    const link = generateInviteLink();
    const gameName = gameType === 'jeopardy' ? 'تحدي الأسئلة' : gameType === 'huroof' ? 'لعبة الحروف' : gameType === 'word_meaning' ? 'معاني الكلمات' : gameType === 'siba' ? 'لعبة الصبة' : gameType === 'pixel_challenge' ? 'تحدي الصور' : gameType === 'drawing_challenge' ? 'تحدي الرسم' : 'بنت وولد';

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'تحدى أصدقاءك في تحدي المعلومات!',
          text: `انضم إلي في غرفة ${roomId} لنلعب ${gameName} معاً!`,
          url: link,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(link);
      alert(`تم نسخ رابط الدعوة للعبة ${gameName}!`);
    }
  };

  useEffect(() => {
    if (gameStatus === 'game_over' && winner) {
      if (winner.name === playerName) {
        playSound('game_over_win');
      } else {
        playSound('game_over_lose');
      }
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a3844a', '#D4AF37', '#FFD700']
      });
    }
  }, [gameStatus, winner, myId]);

  const hasJoined = useMemo(() => players.some(p => p.id === myId), [players, myId]);

  // Prevent accidental back navigation or refresh if player is in a room
  useEffect(() => {
    if (!hasJoined) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome
    };

    // Push a state so popstate can intercept the back button
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (confirm('هل أنت متأكد من مغادرة اللعبة؟ ستفقد تقدمك.')) {
        window.history.back(); // Actually go back if they confirm
      } else {
        window.history.pushState(null, '', window.location.href); // Push state again to block further back
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasJoined]);

  // 60-second lobby countdown — auto-starts game for host when timer hits 0
  const [lobbyCountdown, setLobbyCountdown] = React.useState(60);
  useEffect(() => {
    if (!hasJoined || players.length === 0 || gameStatus !== 'lobby') return;
    setLobbyCountdown(60);
    const interval = setInterval(() => {
      setLobbyCountdown(prev => {
        if (prev <= 1) {
          if (players.length > 1) {
            clearInterval(interval);
            if ((isCreator || players[0]?.id === myId) && roomId && gameStatus === 'lobby') startGame(roomId);
            return 0;
          }
          // Nobody else joined yet, restart the countdown
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasJoined, players.length, gameStatus]);

  const getRoomStatus = useGameStore(state => state.getRoomStatus);
  useEffect(() => {
    if (roomId && !hasJoined && isConnected) {
      getRoomStatus(roomId);
    }
  }, [roomId, hasJoined, getRoomStatus, isConnected]);

  const categories = useMemo(() => {
    const cats: Record<string, any[]> = {};
    if (!questions) return cats;
    questions.forEach((q: any) => {
      if (gameType === 'jeopardy' && q.category === 'الحروف') return;
      if (!cats[q.category]) cats[q.category] = [];
      cats[q.category].push(q);
    });
    Object.keys(cats).forEach(k => {
      cats[k].sort((a, b) => a.value - b.value);
    });
    return cats;
  }, [questions]);


  const getGameInstructions = (type: string) => {
    switch (type) {
      case 'jeopardy': return "تحدي الأسئلة: يختار اللاعب الفئة وقيمة السؤال. للإجابة يجب الضغط على الزر أسرع من الخصم. الفائز هو من يجمع أكبر عدد من النقاط.";
      case 'huroof': return "لعبة الحروف: تبدأ من الخلية المركزية. أجب بشكل صحيح لتلوين الخلية بلون فريقك وانتقل للخلية المجاورة. الهدف هو توصيل خط كامل لجهات اللوحة.";
      case 'bin_o_walad': return "بنت وولد: ستظهر رسالة بحرف معين. يجب عليك ملء الفئات المطلوبة بكلمات تبدأ بهذا الحرف وبأسرع وقت.";
      case 'word_meaning': return "معاني الكلمات: سيظهر لك كلمة ومعاني متعددة. اختر المعنى الصحيح. كلما أجبت أسرع، زادت نقاطك التي تكسبها.";
      case 'siba': return "لعبة الصبة: لعبة تكتيكية لشخصين. تتكون من مرحلة وضع 3 قطع ثم تحريكها. الهدف وضع 3 قطع في خط مستقيم.";
      case 'pixel_challenge': return "تحدي الصور: تظهر صورة مشوشة وتتضح تدريجياً. أسرع بالتعرف عليها لاختيار الإجابة الصحيحة وكسب نقاط أكثر.";
      case 'drawing_challenge': return "تحدي الرسم: في كل جولة، لاعب واحد يرسم كلمة سرية على اللوحة. باقي اللاعبين يحاولون تخمين الكلمة — كلما خمّنت أسرع، زادت نقاطك! الرسّام يربح نقاطاً عن كل لاعب خمّن الكلمة.";
      default: return "";
    }
  };

  if (isServerWakingUp) {
    return (
      <>
        <VersionChecker />
        <NotificationToast />
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          <div style={{ position: 'relative' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} style={{ width: '80px', height: '80px', borderRadius: '50%', border: '4px solid #f1f5f9', borderTopColor: 'var(--brand-yellow)' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={32} fill="var(--brand-yellow)" color="var(--brand-yellow)" />
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px', color: '#0f172a' }}>شكراً لصبركم</h2>
            <p style={{ fontSize: '15px', color: '#64748b', maxWidth: '300px', lineHeight: 1.6 }}>جري تشغيل المنصة، شكراً لانتظارك! ☕</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[0, 1, 2].map((i) => (
              <motion.div key={i} animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-yellow)' }} />
            ))}
          </div>
        </motion.div>
      </div>
      </>
    );
  }

  // SOLO CHALLENGE VIEW
  if (challengeData && !roomId) {
    return (
      <div className="game-wrapper" dir="rtl" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <VersionChecker />
        <NotificationToast />
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'white', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pencil size={18} color="var(--brand-yellow)" />
            <span style={{ fontWeight: 900 }}>تحدي المعلومات</span>
          </div>
          <button 
            onClick={() => {
              window.history.replaceState({}, '', window.location.pathname);
              window.location.reload(); // Hard reset to home
            }}
            style={{ background: '#f1f5f9', border: 'none', padding: '6px 14px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}
          >
            الرئيسية
          </button>
        </header>

        <main style={{ padding: 0 }}>
          <DrawingChallenge roomId="solo-challenge" />
        </main>
      </div>
    );
  }

  if (gameStatus === 'lobby') {
    return (
      <div className="home-container">
        <VersionChecker />
        <NotificationToast />
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

        {currentView === 'home' ? (
          <>
            <div className="join-section">
          <span className="join-label">اختر لعبة للتحدي</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
            <button className="btn-primary-battle" onClick={() => finalizeCreateRoom('jeopardy')}>
              <Layout size={24} />
              تحدي الاسئلة
            </button>
            <button className="btn-primary-battle" style={{ background: 'var(--brand-yellow)', color: '#000' }} onClick={() => finalizeCreateRoom('huroof')}>
              <Type size={24} />
              لعبة الحروف
            </button>
            <button className="btn-primary-battle" style={{ background: '#10b981', color: '#fff' }} onClick={() => finalizeCreateRoom('bin_o_walad')}>
              <Layout size={24} />
              بنت وولد
            </button>
            <button className="btn-primary-battle" style={{ background: '#8b5cf6', color: '#fff' }} onClick={() => finalizeCreateRoom('word_meaning')}>
              <BookOpen size={24} />
              معاني الكلمات
            </button>
            <button className="btn-primary-battle" style={{ background: '#f59e0b', color: '#fff' }} onClick={() => finalizeCreateRoom('siba')}>
              <Layout size={24} />
              لعبة الصبة
            </button>
            <button className="btn-primary-battle" style={{ background: '#ec4899', color: '#fff' }} onClick={() => finalizeCreateRoom('pixel_challenge')}>
              <ImageIcon size={24} />
              تحدي الصور
            </button>
            <button className="btn-primary-battle" style={{ background: 'linear-gradient(135deg, #06b6d4, #0ea5e9)', color: '#fff' }} onClick={() => finalizeCreateRoom('drawing_challenge')}>
              <Pencil size={24} />
              تحدي الرسم
            </button>
          </div>
        </div>

        <div className="join-section">
          <span className="join-label">انضم إلى غرفة</span>
          <div className="join-input-wrapper" style={{ position: 'relative' }}>
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
              style={{ paddingLeft: '44px' }}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button
              onClick={() => setShowScanner(true)}
              style={{
                position: 'absolute',
                top: '50%',
                left: '12px', 
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px'
              }}
              title="مسح رمز QR بالكاميرا"
              aria-label="مسح بالكاميرا"
            >
              <Camera size={20} />
            </button>
          </div>
        </div>

        {showScanner && (
          <QRScannerModal
            onClose={() => setShowScanner(false)}
            onScanSuccess={(code) => {
              setJoinCode(code);
              setRoomId(code);
              setShowScanner(false);
            }}
          />
        )}

        {roomId && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="modal-content" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
              <div style={{ background: 'var(--brand-yellow)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Zap size={30} color="#000" fill="#000" />
              </div>
              <h2 style={{ marginBottom: '8px' }}>
                {gameType === 'jeopardy' ? 'غرفة تحدي الأسئلة' : 
                 gameType === 'huroof' ? 'غرفة لعبة الحروف' : 
                 gameType === 'word_meaning' ? 'غرفة معاني الكلمات' : 
                 gameType === 'siba' ? 'غرفة لعبة الصبة' : 
                 gameType === 'pixel_challenge' ? 'غرفة تحدي الصور' : 
                 gameType === 'drawing_challenge' ? 'غرفة تحدي الرسم' : 
                 'غرفة بنت وولد'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '12px 0' }}>
                <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '4px' }}>{roomId}</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={shareInviteLink} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }} title="مشاركة الرابط">
                    <Share2 size={18} />
                  </button>
                  <button onClick={() => setShowQR(true)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }} title="QR Code">
                    <QrCode size={18} />
                  </button>
                </div>
              </div>

              {roomDataLoading ? (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '30px', height: '30px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--brand-yellow)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>جاري جلب معلومات الغرفة...</div>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="أدخل اسمك ..."
                    className="join-input"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', marginBottom: '12px', marginTop: '8px' }}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                  />

                  {(players[0]?.id === myId || isCreator) && (gameType === 'jeopardy' || gameType === 'bin_o_walad' || gameType === 'word_meaning' || gameType === 'pixel_challenge' || gameType === 'drawing_challenge') && (
                    <div style={{ marginBottom: '12px', background: '#f1f5f9', padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        {(gameType === 'jeopardy') ? 'عدد الأسئلة' : 'عدد الجولات'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => handleQCountChange(Math.max(1, qCount - 1))} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #cbd5e1', background: '#fff', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>-</button>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', minWidth: '24px' }}>{qCount}</span>
                        <button onClick={() => handleQCountChange(Math.min(50, qCount + 1))} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #cbd5e1', background: '#fff', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  )}

                  {hasJoined ? (
                    (players[0]?.id === myId || isCreator) ? (
                      <button
                        disabled={players.length === 0}
                        onClick={() => roomId && startGame(roomId)}
                        className="btn-primary-battle"
                        style={{ width: '100%', marginBottom: '8px', background: '#10b981', color: '#fff', position: 'relative', overflow: 'hidden' }}
                      >
                        {/* countdown bar */}
                        {players.length > 0 && lobbyCountdown > 0 && (
                          <motion.div
                            initial={{ width: '100%' }}
                            animate={{ width: `${(lobbyCountdown / 60) * 100}%` }}
                            transition={{ duration: 1, ease: 'linear' }}
                            style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'rgba(0,0,0,0.12)', zIndex: 0 }}
                          />
                        )}
                        <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <Zap size={24} />
                          ابدأ اللعبة!
                          {players.length > 0 && lobbyCountdown > 0 && (
                            <span style={{ fontSize: '13px', fontWeight: 'bold', opacity: 0.8 }}>({lobbyCountdown})</span>
                          )}
                        </span>
                      </button>
                    ) : (
                      <button disabled className="btn-primary-battle" style={{ width: '100%', marginBottom: '8px', opacity: 0.6 }}>
                        تم الانضمام ✓
                      </button>
                    )
                  ) : (
                    <button
                      disabled={!playerName}
                      onClick={() => roomId && addPlayer(playerName, roomId, qCount)}
                      className="btn-primary-battle"
                      style={{ width: '100%', marginBottom: '8px' }}
                    >
                      انضم الآن
                    </button>
                  )}
                </>
              )}

              {/* Players list */}
              {players.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>اللاعبون المتواجدون:</h4>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', justifyContent: 'center' }}>
                    {players.map((p, i) => (
                      <motion.div
                        key={p.id || i}
                        animate={newestPlayerId === p.id ? { scale: [1, 1.15, 1], backgroundColor: ['#eee', '#fde68a', '#eee'] } : {}}
                        transition={{ duration: 0.6, repeat: 2 }}
                        style={{ background: '#eee', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', whiteSpace: 'nowrap' }}
                      >
                        <span style={{ fontWeight: 'bold', marginRight: '4px' }}>#{p.number || (i + 1)}</span>
                        {p.name}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}



              <AnimatePresence>
                {showQR && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowQR(false)}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="modal-content" style={{ background: 'white', padding: '24px', borderRadius: '16px', textAlign: 'center', maxWidth: '300px', width: '100%' }} onClick={e => e.stopPropagation()}>
                      <h3 style={{ marginBottom: '16px' }}>رمز الدعوة للغرفة {roomId}</h3>
                      <div style={{ background: 'white', padding: '16px', borderRadius: '12px', display: 'inline-block' }}>
                        <QRCodeSVG value={generateInviteLink()} size={200} />
                      </div>
                      <button onClick={() => setShowQR(false)} className="btn-primary-battle" style={{ marginTop: '20px', width: '100%' }}>إغلاق</button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!(players[0]?.id === myId || isCreator) && (
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', position: 'relative' }}>
                  {/* countdown badge top-left */}
                  {hasJoined && lobbyCountdown > 0 && (
                    <div style={{
                      position: 'absolute', top: '10px', left: '10px',
                      background: lobbyCountdown <= 5 ? '#ef4444' : 'var(--brand-yellow)',
                      color: lobbyCountdown <= 5 ? '#fff' : '#000',
                      borderRadius: '50%', width: '36px', height: '36px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: '15px'
                    }}>
                      {lobbyCountdown}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--brand-yellow)' }} />
                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--brand-yellow)' }} />
                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--brand-yellow)' }} />
                  </div>
                  <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 'bold' }}>
                    بانتظار المضيف لبدء اللعبة...
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowHowToPlay(true)}
                style={{ marginTop: '16px', background: '#f1f5f9', border: 'none', padding: '10px 16px', borderRadius: '20px', color: '#3b82f6', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%' }}
              >
                <BookOpen size={18} />
                كيفية اللعب
              </button>

              <AnimatePresence>
                {showHowToPlay && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowHowToPlay(false)}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="modal-content" style={{ background: 'white', padding: '24px', borderRadius: '16px', textAlign: 'center', maxWidth: '350px', width: '100%' }} onClick={e => e.stopPropagation()}>
                      <div style={{ background: '#e0f2fe', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#0284c7' }}>
                        <BookOpen size={30} />
                      </div>
                      <h3 style={{ marginBottom: '16px', fontSize: '20px' }}>كيفية اللعب</h3>
                      <p style={{ fontSize: '16px', color: '#475569', lineHeight: '1.6', marginBottom: '24px' }}>
                        {getGameInstructions(gameType || '')}
                      </p>
                      <button onClick={() => setShowHowToPlay(false)} className="btn-primary-battle" style={{ width: '100%' }}>حسناً، فهمت</button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={() => {
                if (roomId) leaveRoom(roomId);
                window.history.replaceState({}, '', window.location.pathname);
              }} style={{ marginTop: '10px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
                العودة لتغيير نوع اللعبة
              </button>

              <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', marginTop: '24px', opacity: 0.5 }}>
                v1.0.1-{__GIT_HASH__}
              </div>
            </div>
          </div>
        )}
          </>
        ) : (
          <Competitions />
        )}

        <nav className="bottom-nav">
          <div className={`nav-item ${currentView === 'home' ? 'active' : ''}`} onClick={() => setCurrentView('home')}><Home size={24} /><span>الرئيسية</span></div>
          <div className={`nav-item ${currentView === 'competitions' ? 'active' : ''}`} onClick={() => { setCurrentView('competitions'); fetchActiveRooms(); }}><Trophy size={24} /><span>المنافسات</span></div>
          <div className="nav-plus"><Plus size={32} strokeWidth={3} /></div>
          <div className="nav-item" onClick={() => window.dispatchEvent(new Event('show-install-prompt'))} style={{ cursor: 'pointer' }}><Download size={24} /><span>تثبيت</span></div>
          <div className={`nav-item ${currentView === 'profile' ? 'active' : ''}`} onClick={() => setCurrentView('profile')}><User size={24} /><span>الملف</span></div>
        </nav>

        <PWAInstallPrompt />
      </div >
    );
  }

  // GAME BOARD RENDERING (Jeopardy or Huroof)
  return (
    <div className="game-wrapper" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: gameType === 'drawing_challenge' && (gameStatus === 'drawing_active' || gameStatus === 'drawing_scoring') ? '0' : '80px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #eee', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={18} style={{ color: 'var(--accent-gold)' }} />
          <span className="gold-text" style={{ fontSize: '14px' }}>غرفة #{roomId}</span>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444' }} />
          {gameType === 'drawing_challenge' && gameStatus !== 'game_over' && (
            <div style={{ marginLeft: '12px', padding: '2px 8px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: timer > 15 ? '#475569' : '#ef4444' }}>
              <TimerIcon size={14} />
              <span style={{ fontWeight: 900, fontSize: '14px' }}>{timer}s</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {hasJoined && (
            <button className="btn-forfeit" onClick={forfeit}>
              {players.length <= 2 ? 'إنهاء اللعبة' : 'مغادرة اللعبة'}
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, padding: gameType === 'drawing_challenge' && (gameStatus === 'drawing_active' || gameStatus === 'drawing_scoring') ? '0' : '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
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
                  {Object.keys(categories).map((cat) => {
                    const isFinished = categories[cat].every(q => q.isAnswered);
                    return (
                      <motion.button
                        whileTap={!isFinished ? { scale: 0.95 } : {}}
                        key={cat}
                        className={`tile-premium ${(!isMyTurn || isFinished) ? 'tile-disabled' : ''} ${localSelecting === cat ? 'selecting' : ''}`}
                        onClick={() => !isFinished && handlePickCategory(cat)}
                        style={{
                          height: '80px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isFinished ? '#e2e8f0' : '#f0fdf4',
                          border: isFinished ? '2px solid #cbd5e1' : '2px solid #bbf7d0',
                          opacity: isFinished ? 0.6 : 1,
                          cursor: isFinished ? 'default' : (isMyTurn ? 'pointer' : 'default')
                        }}
                      >
                        <span style={{ fontSize: '14px', fontWeight: '900', color: isFinished ? '#64748b' : '#166534' }}>{cat}</span>
                        {isFinished && <div style={{ position: 'absolute', top: '4px', right: '8px', fontSize: '10px' }}>✓</div>}
                      </motion.button>
                    );
                  })}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {[100, 200, 300, 400, 500, 600].map((val) => {
                    const catQuestions = categories[selectedCategory || ''] || [];
                    const qForVal = catQuestions.filter(q => q.value === val);
                    const totalForValue = qForVal.length;
                    const answeredCount = qForVal.filter(q => q.isAnswered).length;

                    const isFullyAnswered = answeredCount >= totalForValue && totalForValue > 0;
                    const isMissing = totalForValue === 0;

                    return (
                      <motion.button
                        whileTap={(!isFullyAnswered && !isMissing && isMyTurn) ? { scale: 0.95 } : {}}
                        key={val}
                        className={`value-button ${(isFullyAnswered || isMissing) ? 'tile-answered' : ''} ${(!isMyTurn || isMissing) ? 'tile-disabled' : ''}`}
                        onClick={() => (!isFullyAnswered && !isMissing) && handlePickValue(val)}
                        style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isMissing ? 0.4 : (isFullyAnswered ? 0.6 : 1) }}
                      >
                        <Coins size={28} />
                        <span style={{ fontWeight: 900, fontSize: '24px' }}>{val}</span>
                      </motion.button>
                    );
                  })}
                  <button className="btn-back-ghost" onClick={() => useGameStore.setState({ gameStatus: 'selecting_category', selectedCategory: null })} style={{ gridColumn: 'span 2' }}>رجوع</button>
                </div>
              </div>
            )}
          </>
        ) : gameType === 'bin_o_walad' ? (
          <BentOWalad roomId={roomId || ''} />
        ) : gameType === 'word_meaning' ? (
          <WordMeaningGame roomId={roomId || ''} />
        ) : gameType === 'drawing_challenge' ? (
          <DrawingChallenge roomId={roomId || ''} />
        ) : gameType === 'pixel_challenge' ? (
          <PixelChallenge roomId={roomId || ''} />
        ) : gameType === 'siba' ? (
          <SibaGame />
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
                    whileTap={{ scale: 0.9, backgroundColor: '#f59e0b' }}
                    onClick={() => {
                      if (roomId) {
                        playSound('buzzer');
                        // 100ms delay for visual/sound feedback before server call
                        setTimeout(() => buzz(roomId), 100);
                      }
                    }}
                    className="btn-primary-battle"
                    style={{ height: '80px', fontSize: '32px', transition: 'all 0.1s' }}
                  >
                    إجابة!
                  </motion.button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {buzzedPlayerId === myId ? 'أجب الآن!' : `${players.find(p => p.id === buzzedPlayerId)?.name} يجيب الآن...`}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {activeQuestion.options.map((opt, idx) => {
                        const isAnswering = buzzedPlayerId === myId;
                        return (
                          <button
                            key={idx}
                            disabled={!isAnswering}
                            onClick={() => roomId && submitAnswer(roomId, opt)}
                            style={{
                              padding: '16px',
                              borderRadius: '12px',
                              border: isAnswering ? '2px solid var(--brand-yellow)' : '2px solid #ddd',
                              background: isAnswering ? 'white' : '#f8fafc',
                              fontWeight: 'bold',
                              opacity: isAnswering ? 1 : 0.7,
                              cursor: isAnswering ? 'pointer' : 'not-allowed'
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {gameStatus === 'game_over' && winner && (
          <div className="game-over-overlay" style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="winner-card" style={{ maxWidth: '500px', width: '100%', position: 'relative', background: 'white', padding: '40px 20px', borderRadius: '32px', textAlign: 'center' }}>
              <button
                onClick={() => {
                  resetRoom();
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '14px'
                }}
              >
                <Home size={20} />
                <span>الرئيسية</span>
              </button>

              <Trophy size={80} color={winner.winningTeam === 'blue' ? '#3b82f6' : winner.winningTeam === 'red' ? '#ef4444' : 'var(--accent-gold)'} />
              <div className="winner-name" style={winner.winningTeam ? { color: winner.winningTeam === 'blue' ? '#3b82f6' : '#ef4444' } : {}}>{winner.name}</div>
              {winner.score > 0 && <div className="winner-score">{winner.score.toLocaleString()}</div>}

              {gameType === 'bin_o_walad' && roundResults && roundResults.length > 0 && (
                <div style={{ marginTop: '30px', width: '100%', textAlign: 'right' }}>
                  <h3 style={{ marginBottom: '16px', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>ملخص المباراة</h3>
                  <div style={{ overflowX: 'auto', background: '#f8fafc', borderRadius: '12px', padding: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '8px' }}>الجولة / اللاعب</th>
                          {BIN_O_WALAD_CATEGORIES.map(c => <th key={c.key} style={{ padding: '4px' }}>{c.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {roundResults.map((res, ridx) => (
                          <React.Fragment key={ridx}>
                            <tr style={{ background: '#e2e8f0', fontWeight: 'bold' }}>
                              <td colSpan={BIN_O_WALAD_CATEGORIES.length + 1} style={{ padding: '4px 8px' }}>
                                الجولة {res.round} (حرف {res.letter})
                              </td>
                            </tr>
                            {players.map(p => {
                              const pSub = (res.submissions || {})[p.name] || {};
                              return (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{p.name}</td>
                                  {BIN_O_WALAD_CATEGORIES.map(c => (
                                    <td key={c.key} style={{ padding: '4px' }}>{pSub[c.key] || '-'}</td>
                                  ))}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {gameType === 'huroof' && huroofHistory && huroofHistory.length > 0 && (
                <div style={{ marginTop: '30px', width: '100%', textAlign: 'right' }}>
                  <h3 style={{ marginBottom: '16px', borderBottom: '2px solid #eee', paddingBottom: '8px' }}>سجل الحروف</h3>
                  <div style={{ overflowX: 'auto', background: '#f8fafc', borderRadius: '12px', padding: '8px', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#e2e8f0' }}>
                          <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>الحرف</th>
                          <th style={{ padding: '8px', minWidth: '80px' }}>من اختار</th>
                          <th style={{ padding: '8px' }}>السؤال</th>
                          <th style={{ padding: '8px', minWidth: '80px' }}>الإجابة الصحيحة</th>
                          <th style={{ padding: '8px', minWidth: '80px' }}>من أجاب</th>
                        </tr>
                      </thead>
                      <tbody>
                        {huroofHistory.map((item: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{item.letter}</td>
                            <td style={{ padding: '6px 8px', wordBreak: 'break-word', maxWidth: '120px' }}>{item.pickedBy}</td>
                            <td style={{ padding: '6px 8px', minWidth: '150px' }}>{item.question}</td>
                            <td style={{ padding: '6px 8px', color: '#10b981', fontWeight: 'bold', wordBreak: 'break-word', maxWidth: '120px' }}>{item.correctAnswer}</td>
                            <td style={{ padding: '6px 8px', fontWeight: 'bold', color: item.answeredBy === 'لا أحد' ? '#ef4444' : '#3b82f6', wordBreak: 'break-word', maxWidth: '120px' }}>{item.answeredBy || '...'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button className="btn-gold" style={{ marginTop: '30px' }} onClick={() => {
                resetRoom();
                window.history.replaceState({}, '', window.location.pathname);
              }}>العودة للرئيسية</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {players.length > 0 && !(gameType === 'drawing_challenge' && (gameStatus === 'drawing_active' || gameStatus === 'countdown')) && (
        <div className="bottom-hud">
          <div className="hud-row-players">
            {players.map((p, i) => (
              <div
                key={p.id}
                className={`hud-player-unit ${i === currentPlayerIndex ? 'active' : ''}`}
                style={gameType === 'huroof' ? { borderBottom: `4px solid ${p.team === 'blue' ? '#3b82f6' : '#ef4444'}` } : {}}
              >
                <div className="hud-player-name" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  <span style={{ fontSize: '10px', opacity: 0.8, marginRight: '4px', flexShrink: 0 }}>#{p.number || (i + 1)}</span>
                  <span title={p.name} style={{
                    color: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'][i % 8],
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'inline-block',
                    maxWidth: gameType === 'huroof' ? '35px' : '65px'
                  }}>
                    {p.name}
                  </span>
                  {gameType === 'huroof' && (
                    <span style={{ fontSize: '10px', marginLeft: '4px', color: p.team === 'blue' ? '#3b82f6' : '#ef4444', fontWeight: 'bold', flexShrink: 0 }}>
                      ({p.team === 'blue' ? 'أزرق' : 'أحمر'})
                    </span>
                  )}
                </div>
                <div className="hud-player-score">{p.score}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PWAInstallPrompt />
    </div>
  );
};

export default App;
