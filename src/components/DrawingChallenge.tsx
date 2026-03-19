import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Eraser, Trash2, Check, Pencil, Palette, Link as LinkIcon, Loader2, Droplets, X, Undo2, Redo2, Highlighter, ChevronRight, Play } from 'lucide-react';
import { isFuzzyMatch } from '../utils/arabicUtils';
import { playSound } from '../utils/soundUtils';

interface DrawingChallengeProps {
    roomId: string;
}

const COLORS = [
    '#000000', '#4b5563', '#ffffff', // Black, Gray, White
    '#ef4444', '#f87171', '#991b1b', // Reds
    '#ffff00', '#f97316', '#fbbf24', '#f59e0b', // Bright Yellow, Oranges/Yellows
    '#22c55e', '#4ade80', '#166534', // Greens
    '#3b82f6', '#60a5fa', '#1e40af', // Blues
    '#8b5cf6', '#a78bfa', '#5b21b6', // Purples
    '#ec4899', '#f472b6', '#9d174d', // Pinks
    '#a16207', '#d97706', '#713f12', // Browns
];

const BRUSH_SIZES = [2, 5, 10, 20, 40];

const DrawingChallenge: React.FC<DrawingChallengeProps> = ({ roomId }) => {
    const {
        gameStatus,
        timer,
        myId,
        players,
        drawingCurrentWord,
        drawingMaskedWord,
        drawingDrawerId,
        drawingGuesses,
        drawingCategory,
        drawingScrambledLetters,
        drawingLiveStrokes = [],
        sendDrawingStroke,
        sendDrawingClear,
        submitDrawingGuess,
        finishDrawingRound,
        createChallenge,
        getSoloWord,
        challengeData,
        challengeLoading,
        isChallengeCreator,
        clearChallengeData,
        joinChallengeSession,
        playerName,
        soloChallengeSolved,
        sendSessionChallenge,
        roomId: currentRoomId
    } = useGameStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawer = myId === drawingDrawerId;

    // Drawing state
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [isEraser, setIsEraser] = useState(false);
    const [isHighlighter, setIsHighlighter] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    
    // Replay State for Challenges
    const [replayIndex, setReplayIndex] = useState(0);
    const [isReplaying, setIsReplaying] = useState(false);
    const [hasStartedReplay, setHasStartedReplay] = useState(false);
    const replayTimerRef = useRef<any>(null);

    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const drawerStrokes = useRef<any[]>([]); // To track drawer strokes locally
    
    // Undo/Redo history
    const [history, setHistory] = useState<any[][]>([]); 
    const [redoStack, setRedoStack] = useState<any[][]>([]);
    const currentStrokeGroup = useRef<any[]>([]);

    // Ink state (for solo play)
    const [ink, setInk] = useState(100);
    const isSoloInkMode = timer === -1;

    // Guess state
    const [guessInput, setGuessInput] = useState('');
    const hasGuessedCorrectly = myId ? drawingGuesses[myId]?.correct : false;

    // Chat log
    const correctGuesses = useGameStore(state => state.drawingCorrectGuesses || []);
    const wrongGuesses = useGameStore(state => state.drawingWrongGuesses || []);
    const chatLog = [
        ...correctGuesses.map(g => ({ ...g, type: 'correct' as const })),
        ...wrongGuesses.map(g => ({ ...g, type: 'wrong' as const }))
    ];

    const [showChallengeModal, setShowChallengeModal] = useState(false);
    const [soloGuessedCorrectly, setSoloGuessedCorrectly] = useState(false);
    const [isSoloArtist, setIsSoloArtist] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    
    // Derived state for the current user's role
    const isArtist = isDrawer || isSoloArtist;

    // Derived state for fallbacks in Session/Solo mode
    const challenge = useGameStore(state => state.challengeData);
    
    // Mask word logic: preserve spaces and hyphens, turn other chars into underscores
    const maskWord = (w: string) => w.split('').map(c => (c === ' ' || c === '-') ? c : '_').join('');
    
    const effectiveMaskedWord = drawingMaskedWord || 
        (isDrawer && drawingCurrentWord ? maskWord(drawingCurrentWord) : 
        (challenge?.word ? maskWord(challenge.word) : ''));
        
    const effectiveScrambledLetters = drawingScrambledLetters.length > 0 ? 
        drawingScrambledLetters : (challenge?.scrambledLetters || []);

    const handleDrawBack = () => {
        // Clear the URL challenge parameter to prevent App.tsx from refetching the old challenge
        const url = new URL(window.location.href);
        const challengeId = url.searchParams.get('challenge');
        if (challengeId) {
            url.searchParams.delete('challenge');
            window.history.replaceState({}, '', url.toString());
            
            // Join the persistent session for back-and-forth play
            joinChallengeSession(challengeId, playerName || 'لاعب');
        }

        setSoloGuessedCorrectly(false);
        setIsSoloArtist(true);
        clearChallengeData();
        getSoloWord();
        setShowChallengeModal(false); 
        setGuessInput('');
        setInk(100);
        drawerStrokes.current = [];
        setHistory([]);
        setRedoStack([]);
        currentStrokeGroup.current = [];
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        getSoloWord();
        clearChallengeData();
    };

    useEffect(() => {
        if (challengeData && isChallengeCreator) {
            setShowChallengeModal(true);
        }
    }, [challengeData, isChallengeCreator]);

    // Reset ink on new round
    useEffect(() => {
        if (isSoloInkMode) {
            setInk(100);
        }
    }, [drawingDrawerId, isSoloInkMode]);

    // Correct-answer flash banner
    const [correctBanner, setCorrectBanner] = useState<{ playerName: string; pts: number } | null>(null);
    const prevCorrectLen = React.useRef(0);
    useEffect(() => {
        if (correctGuesses.length > prevCorrectLen.current) {
            const latest = correctGuesses[correctGuesses.length - 1];
            const pts = Math.round((timer / 90) * 60) + 20;
            setCorrectBanner({ playerName: latest.playerName, pts });
            const t = setTimeout(() => setCorrectBanner(null), 4000);
            prevCorrectLen.current = correctGuesses.length;
            return () => clearTimeout(t);
        }
        prevCorrectLen.current = correctGuesses.length;
    }, [correctGuesses.length, timer]);

    const [wrongBanner, setWrongBanner] = useState(false);

    // Wrong-answer flash banner (Session)
    const prevWrongLen = React.useRef(0);
    useEffect(() => {
        if (wrongGuesses.length > prevWrongLen.current) {
            setWrongBanner(true);
            const t = setTimeout(() => setWrongBanner(false), 2000);
            prevWrongLen.current = wrongGuesses.length;
            return () => clearTimeout(t);
        }
        prevWrongLen.current = wrongGuesses.length;
    }, [wrongGuesses.length]);

    // Reset success state on new round
    useEffect(() => {
        if (drawingDrawerId === myId) {
            setSoloGuessedCorrectly(false);
        }
    }, [drawingDrawerId, players.length, myId]);

    // Sync soloGuessedCorrectly with session state
    useEffect(() => {
        if (hasGuessedCorrectly && !soloGuessedCorrectly) {
            setSoloGuessedCorrectly(true);
            import('canvas-confetti').then(confetti => confetti.default());
        }
    }, [hasGuessedCorrectly, soloGuessedCorrectly]);

    // Clear banner immediately when drawer changes
    useEffect(() => {
        setCorrectBanner(null);
        setWrongBanner(false);
        prevCorrectLen.current = correctGuesses.length;
    }, [drawingDrawerId]);

    // ─── Canvas helpers ──────────────────────────────────────────────
    const getCanvasPos = (e: React.PointerEvent | PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        // Return normalized coordinates (0-1000)
        return {
            x: ((e.clientX - rect.left) / rect.width) * 1000,
            y: ((e.clientY - rect.top) / rect.height) * 1000,
        };
    };

    const drawSegment = useCallback((ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, strokeColor: string, size: number, eraser: boolean, highlighter?: boolean) => {
        const canvas = ctx.canvas;
        if (!canvas) return;

        // Translate normalized coordinates (0-1000) to actual canvas pixels
        const fromX = (from.x / 1000) * canvas.width;
        const fromY = (from.y / 1000) * canvas.height;
        const toX = (to.x / 1000) * canvas.width;
        const toY = (to.y / 1000) * canvas.height;
        
        // Highlighter is naturally wider (2.5x)
        const effectiveSize = (highlighter && !eraser) ? size * 2.5 : size;
        const scaledSize = (effectiveSize / 1000) * canvas.width;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        
        ctx.strokeStyle = eraser ? '#ffffff' : strokeColor;
        ctx.lineWidth = scaledSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (eraser) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
        } else if (highlighter) {
            // "Multiply" mode makes colors darken as they overlap, like real markers
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = 0.5;
        } else {
            // "Darken" prevents the "dotted" joints issue on the same stroke
            ctx.globalCompositeOperation = 'darken';
            ctx.globalAlpha = 1.0; 
            ctx.shadowBlur = scaledSize / 2.5; // Softer, more watercolor-like edge
            ctx.shadowColor = strokeColor;
        }
        
        ctx.stroke();
        ctx.restore();
    }, []);

    // Countdown sound synchronization
    useEffect(() => {
        if (gameStatus === 'countdown' && timer === 3) {
            playSound('countdown');
        }
    }, [gameStatus, timer]);

    // Challenge Replay Logic
    useEffect(() => {
        if (challengeData && !isChallengeCreator && !isArtist && !isReplaying && replayIndex === 0 && hasStartedReplay) {
            setIsReplaying(true);
            const total = challengeData.strokes.length;
            
            // Replay with chunking for performance
            let current = 0;
            const CHUNK_SIZE = 15; // segments per tick
            
            replayTimerRef.current = setInterval(() => {
                current += CHUNK_SIZE;
                if (current >= total) {
                    current = total;
                    if (replayTimerRef.current) clearInterval(replayTimerRef.current);
                    setIsReplaying(false);
                }
                setReplayIndex(current);
            }, 16); // ~60fps
            
            return () => {
                if (replayTimerRef.current) clearInterval(replayTimerRef.current);
            };
        }
    }, [challengeData, isChallengeCreator, isDrawer, isSoloArtist, isReplaying, replayIndex, hasStartedReplay]);

    const skipReplay = () => {
        if (replayTimerRef.current) clearInterval(replayTimerRef.current);
        if (challengeData) {
            setReplayIndex(challengeData.strokes.length);
        }
        setIsReplaying(false);
        setHasStartedReplay(true);
    };

    // Dynamic canvas sizing
    useEffect(() => {
        const updateSize = () => {
            const container = containerRef.current;
            const canvas = canvasRef.current;
            if (!container || !canvas) return;

            const rect = container.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Prioritize local strokes if we ARE the artist, else show challenge or live strokes
                const isArtist = isDrawer || isSoloArtist;
                const isChallengeView = !!challengeData && !isChallengeCreator && !isArtist;
                
                let strokesToDraw = isArtist 
                    ? drawerStrokes.current 
                    : (drawingLiveStrokes.length > 0 ? drawingLiveStrokes : (challengeData?.strokes || []));
                
                // If replaying a challenge, only draw up to the current index
                if (isChallengeView && isReplaying) {
                    strokesToDraw = strokesToDraw.slice(0, replayIndex);
                }

                strokesToDraw.forEach(stroke => {
                    if (stroke.type === 'segment' && stroke.from && stroke.to) {
                        drawSegment(ctx, stroke.from, stroke.to, stroke.color, stroke.size, stroke.eraser, stroke.highlighter);
                    }
                });
            }
        };

        window.addEventListener('resize', updateSize);
        updateSize();
        return () => window.removeEventListener('resize', updateSize);
    }, [gameStatus, drawingLiveStrokes, drawSegment, roomId, challengeData, isDrawer, replayIndex, isReplaying]);

    // Draw incoming strokes live
    useEffect(() => {
        if (isDrawer || roomId === 'solo-challenge' || isReplaying) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas || drawingLiveStrokes.length === 0) return;

        const stroke = drawingLiveStrokes[drawingLiveStrokes.length - 1];
        if (!stroke) return;

        if (stroke.type === 'segment' && stroke.from && stroke.to) {
            drawSegment(ctx, stroke.from, stroke.to, stroke.color, stroke.size, stroke.eraser, stroke.highlighter);
        }
    }, [drawingLiveStrokes, isDrawer, drawSegment, roomId]);

    // ─── Drawer pointer handlers ──────────────────────────────────────
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canDraw = isDrawer || (isSoloArtist && drawingCurrentWord);
        if (!canDraw || (gameStatus !== 'drawing_active' && !isSoloArtist)) return;
        if (isSoloInkMode && ink <= 0) return;
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        setIsDrawing(true);
        lastPos.current = getCanvasPos(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canDraw = isDrawer || (isSoloArtist && drawingCurrentWord);
        if (!canDraw || !isDrawing || (gameStatus !== 'drawing_active' && !isSoloArtist)) return;
        if (isSoloInkMode && ink <= 0) {
            setIsDrawing(false);
            return;
        }

        const pos = getCanvasPos(e);
        const from = lastPos.current!;
        const activeColor = isEraser ? '#ffffff' : color;

        // Ink depletion logic
        if (isSoloInkMode && !isEraser) {
            const dist = Math.sqrt(Math.pow(pos.x - from.x, 2) + Math.pow(pos.y - from.y, 2));
            const consumption = (dist * (brushSize / 10)) / 5000; 
            setInk(prev => Math.max(0, prev - consumption));
        }

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) drawSegment(ctx, from, pos, activeColor, brushSize, isEraser, isHighlighter);

        const stroke = { type: 'segment', from, to: pos, color: activeColor, size: brushSize, eraser: isEraser, highlighter: isHighlighter };
        sendDrawingStroke(roomId, stroke);
        drawerStrokes.current.push(stroke);
        currentStrokeGroup.current.push(stroke);

        lastPos.current = pos;
    };

    const handlePointerUp = () => {
        setIsDrawing(false);
        lastPos.current = null;
        
        // Capture a snapshot of the current group before clearing it
        const finishedGroup = [...currentStrokeGroup.current];
        
        if (finishedGroup.length > 0) {
            setHistory(prev => [...prev, finishedGroup]);
            setRedoStack([]);
            currentStrokeGroup.current = [];
        }
    };

    useEffect(() => {
        if (challengeData && isChallengeCreator && currentRoomId?.startsWith('session_')) {
            sendSessionChallenge(challengeData.id, playerName || 'صديق');
            // We can also show a small local feedback
            setShowChallengeModal(true);
        }
    }, [challengeData, isChallengeCreator, currentRoomId, sendSessionChallenge, playerName]);

    const handleUndo = () => {
        if (history.length === 0) return;
        const newHistory = [...history];
        const lastAction = newHistory.pop()!;
        setRedoStack(prev => [...prev, lastAction]);
        setHistory(newHistory);
        
        // Rebuild flat strokes
        drawerStrokes.current = newHistory.flat();
        
        // Sync with server: Clear and resend all (simpler than complex undo protocol)
        sendDrawingClear(roomId);
        drawerStrokes.current.forEach(s => sendDrawingStroke(roomId, s));
        
        // Redraw canvas
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawerStrokes.current.forEach(s => drawSegment(ctx, s.from, s.to, s.color, s.size, s.eraser, s.highlighter));
        }
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const newRedo = [...redoStack];
        const actionToRestore = newRedo.pop()!;
        setHistory(prev => [...prev, actionToRestore]);
        setRedoStack(newRedo);
        
        // Append to flat strokes
        drawerStrokes.current = [...drawerStrokes.current, ...actionToRestore];
        
        // Sync with server: Resend the restored segments
        actionToRestore.forEach(s => sendDrawingStroke(roomId, s));
        
        // Redraw action on canvas
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            actionToRestore.forEach(s => drawSegment(ctx, s.from, s.to, s.color, s.size, s.eraser, s.highlighter));
        }
    };

    const handleClear = () => {
        if (!showClearConfirm) {
            setShowClearConfirm(true);
            setTimeout(() => setShowClearConfirm(false), 3000);
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        sendDrawingClear(roomId);
        drawerStrokes.current = [];
        setHistory([]);
        setRedoStack([]);
        currentStrokeGroup.current = [];
        if (isSoloInkMode) setInk(100);
        setShowClearConfirm(false);
    };

    const triggerSelection = (char: string) => {
        if (hasGuessedCorrectly || soloGuessedCorrectly) return;
        const newGuess = guessInput.split('');
        const emptyIdx = (effectiveMaskedWord || '').split('').findIndex((c, i) => c !== ' ' && c !== '-' && !newGuess[i]);
        if (emptyIdx !== -1) {
            newGuess[emptyIdx] = char;
            const updatedGuess = newGuess.join('');
            setGuessInput(updatedGuess);
            
            const isFilled = (effectiveMaskedWord || '').split('').every((c, i) => (c === ' ' || c === '-') || newGuess[i]);
            if (isFilled) {
                if (currentRoomId === 'solo-challenge' && challengeData) {
                    if (isFuzzyMatch(updatedGuess, challengeData.word)) {
                        setSoloGuessedCorrectly(true);
                        soloChallengeSolved(challengeData.id, playerName || 'صديق');
                        import('canvas-confetti').then(confetti => confetti.default());
                    } else {
                        setGuessInput('');
                        setWrongBanner(true);
                        setTimeout(() => setWrongBanner(false), 2000);
                    }
                } else {
                    submitDrawingGuess(roomId, updatedGuess);
                    setGuessInput('');
                }
            }
        }
    };




    const handleCreateChallenge = () => {
        if (!drawingCurrentWord || drawerStrokes.current.length === 0) {
            alert('يجب عليك الرسم أولاً!');
            return;
        }
        createChallenge(drawerStrokes.current, drawingCurrentWord, drawingCategory || '');
        
        // If it's a session, we'll handle the sending in useEffect once challengeData arrives
    };

    const handleShareChallenge = async () => {
        if (!challengeData) return;
        const link = `${window.location.origin}${window.location.pathname}?challenge=${challengeData.id}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'تحدى أصدقاءك!',
                    text: 'خمنوا ايش رسمت في هذا اللعبة!',
                    url: link
                });
            } catch (err) {
                console.error('Share failed:', err);
                navigator.clipboard.writeText(link);
                alert('تم نسخ الرابط!');
            }
        } else {
            navigator.clipboard.writeText(link);
            alert('تم نسخ الرابط!');
        }
    };

    // ─── Countdown UI ───────────────────────────────────────────────────
    if (gameStatus === 'countdown') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <motion.div
                    key={timer}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    style={{ fontSize: '120px', fontWeight: 900, color: 'var(--brand-yellow)' }}
                >
                    {timer}
                </motion.div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '20px' }}>استعد للرسم!</div>
            </div>
        );
    }

    // ─── Active drawing round ─────────────────────────────────────────
    if (gameStatus === 'drawing_active' || gameStatus === 'drawing_scoring') {
        const isScoring = gameStatus === 'drawing_scoring';
        const maskedDisplay = drawingMaskedWord ? drawingMaskedWord.split('').map(c => c === ' ' ? '\u00A0\u00A0' : c === '-' ? '-' : '_').join(' ') : '';
        const reversedChatLog = [...chatLog].reverse().slice(0, 10);

        return (
            <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', height: '100dvh', overflow: 'hidden', background: '#f1f5f9', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', overscrollBehavior: 'none' }}>
                <div style={{ height: '70px', zIndex: 30, display: 'flex', flexDirection: 'column', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>تخمين الكلمة في تصنيف:</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '18px', fontWeight: 900, color: '#f59e0b', direction: 'rtl' }}>
                                <Palette size={18} />
                                <span>{drawingCategory || 'تحت الرسم...'}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: 900, color: '#451a03', direction: 'rtl' }}>
                                {isDrawer && !isScoring ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fefce8', padding: '4px 12px', borderRadius: '10px', border: '1px solid #fef08a' }}>
                                        <span style={{ color: '#854d0e' }}>{drawingCurrentWord}</span>
                                        <Pencil size={18} color="#854d0e" />
                                    </div>
                                ) : (
                                    <div style={{ letterSpacing: isScoring ? '2px' : '4px' }}>
                                        {isScoring ? (
                                            <div style={{ fontSize: '16px' }}>
                                                الكلمة: <span style={{ color: '#059669' }}>{drawingCurrentWord}</span>
                                            </div>
                                        ) : (
                                            <div style={{ padding: '4px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                                {maskedDisplay}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {isDrawer && !isScoring && (
                        <div style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                            {/* Action Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                <button onClick={() => { setIsEraser(e => !e); setIsHighlighter(false); }} title="ممحاة" style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid transparent', background: isEraser ? '#fef3c7' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isEraser ? '0 0 0 2px #d97706' : '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <Eraser size={18} color={isEraser ? '#d97706' : '#64748b'} />
                                </button>
                                <button onClick={() => { setIsHighlighter(h => !h); setIsEraser(false); }} title="تحديد (خلف الرسم)" style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid transparent', background: isHighlighter ? '#dcfce7' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isHighlighter ? '0 0 0 2px #10b981' : '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <Highlighter size={18} color={isHighlighter ? '#10b981' : '#64748b'} />
                                </button>
                                <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />
                                <button onClick={handleUndo} disabled={history.length === 0} title="إلغاء الخطوة" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', cursor: history.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: history.length === 0 ? 0.3 : 1 }}>
                                    <Undo2 size={18} color="#64748b" />
                                </button>
                                <button onClick={handleRedo} disabled={redoStack.length === 0} title="إعادة الخطوة" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', cursor: redoStack.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: redoStack.length === 0 ? 0.3 : 1 }}>
                                    <Redo2 size={18} color="#64748b" />
                                </button>
                                <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />
                                <button onClick={handleClear} title="مسح الكل" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1px solid #fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                    <Trash2 size={18} />
                                </button>
                                <div style={{ flex: 1 }} />
                                {/* Brush Sizes Row Inline */}
                                <div style={{ display: 'flex', gap: '4px', background: '#fff', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    {BRUSH_SIZES.map(s => (
                                        <button key={s} onClick={() => setBrushSize(s)} style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid transparent', background: brushSize === s ? '#3b82f6' : 'white', cursor: 'pointer' }}>
                                            <div style={{ width: Math.min(s/3 + 3, 16), height: Math.min(s/3 + 3, 16), borderRadius: '50%', background: brushSize === s ? 'white' : '#64748b' }} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Color Row */}
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 8px', flex: 1, scrollbarWidth: 'none', background: '#fff' }}>
                                {COLORS.map(c => (
                                    <button 
                                        key={c} 
                                        onClick={() => { setColor(c); setIsEraser(false); }} 
                                        style={{ 
                                            width: '28px', 
                                            height: '28px', 
                                            borderRadius: '50%', 
                                            background: c, 
                                            border: (color === c && !isEraser) ? '3px solid #f1f5f9' : '1px solid rgba(0,0,0,0.1)', 
                                            cursor: 'pointer', 
                                            flexShrink: 0, 
                                            boxShadow: (color === c && !isEraser) ? '0 0 0 2px #3b82f6' : 'none',
                                            transform: (color === c && !isEraser) ? 'scale(1.1)' : 'scale(1)',
                                            transition: 'transform 0.1s'
                                        }} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {isSoloInkMode && isDrawer && !isScoring && (
                        <div style={{ padding: '0 8px 4px 8px', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '6px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', flexShrink: 0 }}>
                                    <Droplets size={14} />
                                    <span style={{ fontSize: '11px', fontWeight: 900 }}>حبر المبدع</span>
                                </div>
                                <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', position: 'relative', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                                    <motion.div 
                                        initial={{ width: '100%' }}
                                        animate={{ width: `${ink}%` }}
                                        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                                        style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: ink > 20 ? 'linear-gradient(90deg, #3b82f6, #60a5fa)' : 'linear-gradient(90deg, #ef4444, #f87171)' }} 
                                    />
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', minWidth: '35px', textAlign: 'right' }}>{Math.ceil(ink)}%</span>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, position: 'relative', background: '#fff', overflow: 'hidden' }}>
                        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', background: 'white', cursor: isDrawer && !isScoring ? (isEraser ? 'cell' : 'crosshair') : 'default', touchAction: 'none', paddingBottom: 'env(safe-area-inset-bottom, 20px)' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={handlePointerUp} />
                    <AnimatePresence>
                        {correctBanner && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95, x: '-50%' }} 
                                animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }} 
                                exit={{ opacity: 0, y: -10, x: '-50%' }} 
                                style={{ position: 'absolute', top: '20px', left: '50%', zIndex: 40, padding: '10px 20px', borderRadius: '50px', background: 'rgba(5, 150, 105, 0.95)', color: '#fff', fontWeight: 900, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }} 
                                dir="rtl"
                            >
                                <Check size={18} color="#fff" />
                                {correctBanner.playerName} خمّن الكلمة! +{correctBanner.pts} نقطة 🎉
                            </motion.div>
                        )}
                        {wrongBanner && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.5, x: '-50%', y: '-50%' }} 
                                animate={{ opacity: 1, scale: 1.2, x: '-50%', y: '-50%' }} 
                                exit={{ opacity: 0, scale: 0.5, x: '-50%', y: '-50%' }} 
                                style={{ position: 'absolute', top: '40%', left: '50%', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', pointerEvents: 'none' }}
                            >
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)' }}>
                                    <X size={48} color="#fff" strokeWidth={3} />
                                </div>
                                <span style={{ color: '#ef4444', fontWeight: 900, fontSize: '24px', textShadow: '0 2px 10px rgba(255,255,255,0.8)', textAlign: 'center' }}>خطأ، حاول مرة أخرى!</span>
                            </motion.div>
                        )}

                        {soloGuessedCorrectly && !isDrawer && !isScoring && players.length === 1 && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                                <motion.div 
                                    initial={{ scale: 0.8, opacity: 0, y: 20 }} 
                                    animate={{ scale: 1, opacity: 1, y: 0 }} 
                                    style={{ 
                                        background: 'white', 
                                        padding: '30px', 
                                        borderRadius: '24px', 
                                        textAlign: 'center', 
                                        maxWidth: '350px', 
                                        width: '100%', 
                                        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                                        border: '2px solid #10b981'
                                    }}
                                >
                                    <div style={{ fontSize: '60px', marginBottom: '10px' }}>🎉</div>
                                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#065f46', marginBottom: '8px' }}>إجابة صحيحة!</div>
                                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#f59e0b', marginBottom: '4px' }}>
                                        {drawingCategory}
                                    </div>
                                    <div style={{ fontSize: '20px', color: '#374151', marginBottom: '24px' }}>
                                        الكلمة هي: <span style={{ color: '#059669', fontWeight: 900 }}>{drawingCurrentWord}</span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <button 
                                            onClick={handleDrawBack}
                                            style={{ 
                                                width: '100%', 
                                                padding: '16px', 
                                                borderRadius: '14px', 
                                                background: '#000', 
                                                color: '#fff', 
                                                border: 'none', 
                                                fontWeight: 900, 
                                                fontSize: '16px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Pencil size={20} />
                                            رد التحدي (ارسم له)
                                        </button>
                                        
                                        <button 
                                            onClick={() => setSoloGuessedCorrectly(false)}
                                            style={{ 
                                                width: '100%', 
                                                padding: '12px', 
                                                borderRadius: '14px', 
                                                background: '#f1f5f9', 
                                                color: '#64748b', 
                                                border: 'none', 
                                                fontWeight: 'bold', 
                                                fontSize: '14px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            بقاء في هذه الصفحة
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                <div style={{ height: isDrawer ? '130px' : '30dvh', zIndex: 30, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, boxShadow: '0 -10px 30px rgba(0,0,0,0.05)' }}>
                    {!isScoring && chatLog.length > 0 && (
                        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '8px', maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <AnimatePresence>
                                {reversedChatLog.map((entry, idx) => (
                                    <motion.div key={`${entry.playerName}-${idx}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }} dir="rtl">
                                        {entry.type === 'correct' ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                                                <Check size={12} />
                                                <span style={{ fontSize: '12px' }}>{entry.playerName} خمّن!</span>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563', padding: '2px 8px', background: '#fff', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                                                <span style={{ color: '#64748b', fontSize: '12px' }}>{entry.playerName}:</span>
                                                <span style={{ fontWeight: 600, fontSize: '12px' }}>{(entry as any).guess}</span>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
                        {!isDrawer && !isScoring && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>

                                {/* Answer Slots */}
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', direction: 'rtl' }}>
                                    {(effectiveMaskedWord || '').split('').map((char, idx) => {
                                        if (char === ' ' || char === '-') {
                                            return <div key={idx} style={{ width: '20px' }} />;
                                        }
                                        const selectedChar = guessInput[idx] || '';
                                        return (
                                            <motion.button
                                                key={idx}
                                                // Drag to remove
                                                drag={!!selectedChar}
                                                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                                                dragElastic={0.5}
                                                onDragEnd={(_, info) => {
                                                    // If dragged a significant amount (e.g. 50px away), remove it
                                                    if (Math.abs(info.offset.y) > 60 || Math.abs(info.offset.x) > 60) {
                                                        const newGuess = guessInput.split('');
                                                        newGuess[idx] = '';
                                                        setGuessInput(newGuess.join(''));
                                                    }
                                                }}
                                                whileHover={selectedChar ? { scale: 1.05 } : {}}
                                                whileTap={selectedChar ? { scale: 0.95 } : {}}
                                                onClick={() => {
                                                    if (!selectedChar) return;
                                                    const newGuess = guessInput.split('');
                                                    newGuess[idx] = '';
                                                    setGuessInput(newGuess.join(''));
                                                }}
                                                style={{
                                                    width: '42px',
                                                    height: '48px',
                                                    borderRadius: '10px',
                                                    border: selectedChar ? '2px solid #fbbf24' : '2px dashed #fbbf24',
                                                    background: selectedChar ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '24px',
                                                    fontWeight: 900,
                                                    color: '#1e293b',
                                                    boxShadow: selectedChar ? '0 4px 6px rgba(0,0,0,0.05)' : 'none',
                                                    cursor: selectedChar ? 'pointer' : 'default',
                                                    lineHeight: 1,
                                                    zIndex: selectedChar ? 10 : 1
                                                }}
                                            >
                                                {selectedChar}
                                            </motion.button>
                                        );
                                    })}
                                </div>

                                {/* Letter Bank */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', width: '100%', maxWidth: '420px', margin: '0 auto' }}>
                                    {effectiveScrambledLetters.map((char, idx) => {
                                        const totalInBank = effectiveScrambledLetters.filter(c => c === char).length;
                                        const usedInGuess = guessInput.split('').filter(c => c === char).length;
                                        const isUsed = usedInGuess >= totalInBank;

                                        return (
                                            <div key={`${char}-${idx}`} style={{ position: 'relative', width: '100%', height: '46px' }}>
                                                {/* Background placeholder */}
                                                <div style={{ position: 'absolute', inset: 0, borderRadius: '10px', background: '#e2e8f0', zIndex: 0 }} />
                                                
                                                {!isUsed && (
                                                    <motion.button
                                                        // Drag to select
                                                        drag
                                                        dragSnapToOrigin={true}
                                                        dragElastic={0.1}
                                                        dragConstraints={{ left: -100, right: 100, top: -400, bottom: 100 }}
                                                        onDragEnd={(_, info) => {
                                                            // Detect drop over slots area
                                                            // We use a approximate threshold for the viewport
                                                            if (info.point.y < window.innerHeight * 0.75) {
                                                                triggerSelection(char);
                                                            }
                                                        }}
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        whileDrag={{ scale: 1.2, zIndex: 100, opacity: 0.9 }}
                                                        disabled={!!hasGuessedCorrectly}
                                                        onClick={() => triggerSelection(char)}
                                                        style={{
                                                            position: 'relative',
                                                            zIndex: 1,
                                                            width: '100%',
                                                            height: '46px',
                                                            borderRadius: '10px',
                                                            background: 'var(--brand-yellow)',
                                                            border: 'none',
                                                            color: '#000',
                                                            fontSize: '20px',
                                                            fontWeight: 900,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                                            lineHeight: 1
                                                        }}
                                                    >
                                                        {char}
                                                    </motion.button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {isDrawer && !isScoring && (
                            <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                                <button onClick={handleCreateChallenge} disabled={challengeLoading} title="وضع التحدي" style={{ flex: 1, padding: '10px 20px', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 'bold', fontSize: '14px', gap: '8px' }}>
                                    {currentRoomId?.startsWith('session_') ? <Check size={16} /> : <LinkIcon size={16} />}
                                    تحدى صديق
                                </button>
                                {isSoloInkMode && (
                                    <button onClick={() => finishDrawingRound(roomId)} style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--brand-yellow)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold', fontSize: '14px', gap: '8px', flex: 1 }}>
                                        <Check size={16} />
                                        الكلمة التالية
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {isScoring && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(4px)', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} style={{ padding: '32px', borderRadius: '24px', background: '#fff', border: '2px solid #10b981', textAlign: 'center', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.1)', maxWidth: '500px', width: '100%' }}>
                            <div style={{ fontWeight: 900, fontSize: '24px', marginBottom: '16px', color: '#065f46' }}>نهاية الجولة!</div>
                            <div style={{ fontSize: '18px', marginBottom: '24px', color: '#475569' }}>الكلمة كانت: <span style={{ color: '#059669', fontWeight: 900 }}>{drawingCurrentWord}</span></div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                                {players.map(p => {
                                    const g = drawingGuesses[p.id];
                                    const pts = g?.pointsEarned;
                                    const isDrawerP = p.id === drawingDrawerId;
                                    return (
                                        <div key={p.id} style={{ padding: '10px 20px', borderRadius: '14px', fontWeight: 'bold', fontSize: '15px', background: pts ? '#dcfce7' : '#f8fafc', border: pts ? '1px solid #86efac' : '1px solid #e2e8f0', color: pts ? '#166534' : '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>{p.name}</span>{isDrawerP && <span>🎨</span>}
                                            <span style={{ minWidth: '32px', height: '32px', borderRadius: '50%', background: pts ? '#bbf7d0' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>+{pts || 0}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                )}

                <AnimatePresence>
                    {(soloGuessedCorrectly && (roomId === 'solo-challenge' || currentRoomId?.startsWith('session_'))) && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0, y: 20 }} 
                                animate={{ scale: 1, opacity: 1, y: 0 }} 
                                style={{ 
                                    background: 'white', 
                                    padding: '30px', 
                                    borderRadius: '24px', 
                                    textAlign: 'center', 
                                    maxWidth: '350px', 
                                    width: '100%', 
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                                    border: '2px solid #10b981'
                                }}
                            >
                                <div style={{ fontSize: '60px', marginBottom: '10px' }}>🎉</div>
                                <div style={{ fontSize: '24px', fontWeight: 900, color: '#065f46', marginBottom: '8px' }}>إجابة صحيحة!</div>
                                <div style={{ fontSize: '14px', fontWeight: 900, color: '#f59e0b', marginBottom: '4px' }}>
                                    {drawingCategory || challengeData?.category}
                                </div>
                                <div style={{ fontSize: '20px', color: '#374151', marginBottom: '24px' }}>
                                    الكلمة هي: <span style={{ color: '#059669', fontWeight: 900 }}>{drawingCurrentWord || challengeData?.word}</span>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <button 
                                        onClick={handleDrawBack}
                                        style={{ 
                                            width: '100%', 
                                            padding: '16px', 
                                            borderRadius: '14px', 
                                            background: '#000', 
                                            color: '#fff', 
                                            border: 'none', 
                                            fontWeight: 900, 
                                            fontSize: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '10px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Pencil size={20} />
                                        رد التحدي (ارسم له)
                                    </button>
                                    
                                    <button 
                                        onClick={() => setSoloGuessedCorrectly(false)}
                                        style={{ 
                                            width: '100%', 
                                            padding: '12px', 
                                            borderRadius: '14px', 
                                            background: '#f1f5f9', 
                                            color: '#64748b', 
                                            border: 'none', 
                                            fontWeight: 'bold', 
                                            fontSize: '14px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        بقاء في هذه الصفحة
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {showChallengeModal && challengeData && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: 'white', padding: '24px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                                <div style={{ fontSize: '18px', fontWeight: 900, marginBottom: '12px' }}>تم إنشاء التحدي! 🎉</div>
                                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>ارسل هذا الرابط لصديقك ليعرف ماذا رسمت!</p>
                                <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '10px', fontSize: '11px', wordBreak: 'break-all', marginBottom: '20px', cursor: 'pointer', border: '1px dashed #cbd5e1' }} onClick={handleShareChallenge}>
                                    {window.location.origin}{window.location.pathname}?challenge={challengeData.id}
                                    <div style={{ marginTop: '8px', color: '#3b82f6', fontWeight: 'bold', fontSize: '12px' }}>
                                        {typeof navigator.share === 'function' ? 'اضغط للمشاركة' : 'اضغط للنسخ'}
                                    </div>
                                </div>
                                <button onClick={() => { setShowChallengeModal(false); clearChallengeData(); }} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'var(--brand-yellow)', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>إغلاق</button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    if ((roomId === 'solo-challenge' && challengeData) || isSoloArtist) {
        // If we are a solo artist OR viewing a challenge
        const isActuallySoloArtist = isSoloArtist || (challengeData && drawingCurrentWord);
        
        if (isActuallySoloArtist) {
            // RENDER DRAWING UI (Reuse the active drawing round UI logic or similar)
            // For simplicity, we can reuse most of the drawing logic here
            // or just render the standard drawing_active view if we tweak the conditions.
        }

        const soloMasked = (challengeData?.word || '').split('').map(c => c === ' ' ? '\u00A0\u00A0' : '_').join(' ');
        
        // Let's adjust the logic: If we have a drawingCurrentWord and we are in solo-challenge room, we are drawing.
        if (drawingCurrentWord && (roomId === 'solo-challenge' || isSoloArtist)) {
             // Standard Drawing UI for Solo Artist
             return (
                <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100dvh', background: '#f1f5f9', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', overscrollBehavior: 'none' }}>
                    <div style={{ height: '70px', zIndex: 30, display: 'flex', flexDirection: 'column', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', width: '100%' }}>
                            {drawingCategory && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 900, color: '#f59e0b', direction: 'rtl' }}>
                                    <Palette size={16} />
                                    <span>{drawingCategory}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: 900, color: '#451a03', direction: 'rtl' }}>
                                <span style={{ color: '#059669' }}>{drawingCurrentWord}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, position: 'relative', background: 'white', overflow: 'hidden', touchAction: 'none' }}>
                        <canvas
                            ref={canvasRef}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                            style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
                        />
                    </div>

                    <div style={{ zIndex: 30, background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                            {/* Action Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                <button onClick={() => { setIsEraser(e => !e); setIsHighlighter(false); }} title="ممحاة" style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid transparent', background: isEraser ? '#fef3c7' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isEraser ? '0 0 0 2px #d97706' : '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <Eraser size={18} color={isEraser ? '#d97706' : '#64748b'} />
                                </button>
                                <button onClick={() => { setIsHighlighter(h => !h); setIsEraser(false); }} title="تحديد (خلف الرسم)" style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid transparent', background: isHighlighter ? '#dcfce7' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isHighlighter ? '0 0 0 2px #10b981' : '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <Highlighter size={18} color={isHighlighter ? '#10b981' : '#64748b'} />
                                </button>
                                <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />
                                <button onClick={handleUndo} disabled={history.length === 0} title="إلغاء الخطوة" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', cursor: history.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: history.length === 0 ? 0.3 : 1 }}>
                                    <Undo2 size={18} color="#64748b" />
                                </button>
                                <button onClick={handleRedo} disabled={redoStack.length === 0} title="إعادة الخطوة" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', cursor: redoStack.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: redoStack.length === 0 ? 0.3 : 1 }}>
                                    <Redo2 size={18} color="#64748b" />
                                </button>
                                <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }} />
                                <button onClick={handleClear} title="مسح الكل" style={{ 
                                    minWidth: showClearConfirm ? '80px' : '36px', 
                                    height: '36px', 
                                    padding: showClearConfirm ? '0 8px' : '0',
                                    borderRadius: '10px', 
                                    background: showClearConfirm ? '#fee2e2' : 'white', 
                                    border: '1px solid #fee2e2', 
                                    cursor: 'pointer', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    color: '#ef4444',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    gap: '4px'
                                }}>
                                    {showClearConfirm ? (
                                        <>
                                            <Trash2 size={16} />
                                            <span style={{ fontSize: '11px', fontWeight: 900 }}>تأكيد؟</span>
                                        </>
                                    ) : (
                                        <Trash2 size={18} />
                                    )}
                                </button>
                                <div style={{ flex: 1 }} />
                                {/* Brush Sizes Inline */}
                                <div style={{ display: 'flex', gap: '4px', background: '#fff', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    {BRUSH_SIZES.map(s => (
                                        <button key={s} onClick={() => setBrushSize(s)} style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid transparent', background: brushSize === s ? '#3b82f6' : 'white', cursor: 'pointer' }}>
                                            <div style={{ width: Math.min(s/3 + 3, 16), height: Math.min(s/3 + 3, 16), borderRadius: '50%', background: brushSize === s ? 'white' : '#64748b' }} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Color Row */}
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 8px', scrollbarWidth: 'none', background: '#fff' }}>
                                {COLORS.map(c => (
                                    <button 
                                        key={c} 
                                        onClick={() => { setColor(c); setIsEraser(false); }} 
                                        style={{ 
                                            width: '28px', 
                                            height: '28px', 
                                            borderRadius: '50%', 
                                            background: c, 
                                            border: (color === c && !isEraser) ? '3px solid #f1f5f9' : '1px solid rgba(0,0,0,0.1)', 
                                            cursor: 'pointer', 
                                            flexShrink: 0, 
                                            boxShadow: (color === c && !isEraser) ? '0 0 0 2px #3b82f6' : 'none',
                                            transform: (color === c && !isEraser) ? 'scale(1.1)' : 'scale(1)',
                                            transition: 'transform 0.1s'
                                        }} 
                                    />
                                ))}
                            </div>
                        </div>

                        <div style={{ padding: '12px' }}>
                            <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '8px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                                <motion.div animate={{ width: `${ink}%` }} style={{ height: '100%', background: ink > 20 ? 'linear-gradient(90deg, #3b82f6, #60a5fa)' : 'linear-gradient(90deg, #ef4444, #f87171)' }} />
                            </div>

                            <button 
                                onClick={handleCreateChallenge} 
                                disabled={challengeLoading} 
                                style={{ 
                                    width: '100%', 
                                    padding: '10px 20px', 
                                    borderRadius: '14px', 
                                    background: 'var(--brand-yellow)', 
                                    border: 'none', 
                                    fontWeight: 900, 
                                    fontSize: '15px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    gap: '8px', 
                                    boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)' 
                                }}
                            >
                                {challengeLoading ? <Loader2 size={18} className="animate-spin" /> : (currentRoomId?.startsWith('session_') ? <Check size={18} /> : <LinkIcon size={18} />)}
                                تحدى صديق
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {showChallengeModal && challengeData && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: 'white', padding: '24px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                                    <div style={{ fontSize: '18px', fontWeight: 900, marginBottom: '12px' }}>تم إنشاء التحدي! 🎉</div>
                                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>ارسل هذا الرابط لصديقك ليعرف ماذا رسمت!</p>
                                    <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '10px', fontSize: '11px', wordBreak: 'break-all', marginBottom: '20px', cursor: 'pointer', border: '1px dashed #cbd5e1' }} onClick={handleShareChallenge}>
                                        {window.location.origin}{window.location.pathname}?challenge={challengeData.id}
                                        <div style={{ marginTop: '8px', color: '#3b82f6', fontWeight: 'bold', fontSize: '12px' }}>
                                            {typeof navigator.share === 'function' ? 'اضغط للمشاركة' : 'اضغط للنسخ'}
                                        </div>
                                    </div>
                                    <button onClick={() => { setShowChallengeModal(false); clearChallengeData(); }} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'var(--brand-yellow)', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>إغلاق</button>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
             );
        }

        return (
            <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100dvh', background: '#f1f5f9', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', overscrollBehavior: 'none' }}>
                <div style={{ height: '54px', flexShrink: 0, background: 'white', padding: '0 16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#f59e0b' }}>{challengeData?.category}</div>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#451a03' }}>
                        {soloGuessedCorrectly ? <span style={{ color: '#059669' }}>{challengeData?.word}</span> : soloMasked}
                    </div>
                </div>
                <div style={{ flex: 1, position: 'relative', background: 'white', overflow: 'hidden' }}>
                    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
                    
                    {/* Play Button Overlay */}
                    {challengeData && !isChallengeCreator && !isArtist && !hasStartedReplay && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)', zIndex: 50 }}>
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setHasStartedReplay(true)}
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '50%',
                                    background: 'var(--brand-yellow)',
                                    border: 'none',
                                    boxShadow: '0 10px 40px rgba(251, 191, 36, 0.5)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    gap: '8px'
                                }}
                            >
                                <Play size={48} color="#000" fill="#000" style={{ marginRight: '-4px' }} />
                                <span style={{ fontWeight: 900, fontSize: '14px', color: '#000' }}>شاهد الرسمة</span>
                            </motion.button>
                        </div>
                    )}
                    <AnimatePresence>
                        {soloGuessedCorrectly && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                                <motion.div 
                                    initial={{ scale: 0.8, opacity: 0, y: 20 }} 
                                    animate={{ scale: 1, opacity: 1, y: 0 }} 
                                    style={{ 
                                        background: 'white', 
                                        padding: '30px', 
                                        borderRadius: '24px', 
                                        textAlign: 'center', 
                                        maxWidth: '350px', 
                                        width: '100%', 
                                        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                                        border: '2px solid #10b981'
                                    }}
                                >
                                    <div style={{ fontSize: '60px', marginBottom: '10px' }}>🎉</div>
                                    <div style={{ fontSize: '24px', fontWeight: 900, color: '#065f46', marginBottom: '8px' }}>إجابة صحيحة!</div>
                                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#f59e0b', marginBottom: '4px' }}>
                                        {challengeData?.category}
                                    </div>
                                    <div style={{ fontSize: '20px', color: '#374151', marginBottom: '24px' }}>
                                        الكلمة هي: <span style={{ color: '#059669', fontWeight: 900 }}>{challengeData?.word}</span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <button 
                                            onClick={handleDrawBack}
                                            style={{ 
                                                width: '100%', 
                                                padding: '16px', 
                                                borderRadius: '14px', 
                                                background: '#000', 
                                                color: '#fff', 
                                                border: 'none', 
                                                fontWeight: 900, 
                                                fontSize: '16px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Pencil size={20} />
                                            رد التحدي (ارسم له)
                                        </button>
                                        
                                        <button 
                                            onClick={() => setSoloGuessedCorrectly(false)}
                                            style={{ 
                                                width: '100%', 
                                                padding: '12px', 
                                                borderRadius: '14px', 
                                                background: '#f1f5f9', 
                                                color: '#64748b', 
                                                border: 'none', 
                                                fontWeight: 'bold', 
                                                fontSize: '14px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            بقاء في هذه الصفحة
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
                <div style={{ minHeight: '35dvh', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 30, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, boxShadow: '0 -10px 30px rgba(0,0,0,0.05)' }}>
                    {soloGuessedCorrectly ? (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', fontWeight: 900, fontSize: '20px' }}>
                            تم التخمين بنجاح! 🎉
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                            {/* Answer Slots */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', direction: 'rtl' }}>
                                {(effectiveMaskedWord || '').split('').map((char, idx) => {
                                    if (char === ' ' || char === '-') {
                                        return <div key={idx} style={{ width: '20px' }} />;
                                    }
                                    const selectedChar = guessInput[idx] || '';
                                    return (
                                        <motion.button
                                            key={idx}
                                            drag={!!selectedChar}
                                            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                                            dragElastic={0.5}
                                            onDragEnd={(_, info) => {
                                                if (Math.abs(info.offset.y) > 60 || Math.abs(info.offset.x) > 60) {
                                                    const newGuess = guessInput.split('');
                                                    newGuess[idx] = '';
                                                    setGuessInput(newGuess.join(''));
                                                }
                                            }}
                                            onClick={() => {
                                                if (!selectedChar) return;
                                                const newGuess = guessInput.split('');
                                                newGuess[idx] = '';
                                                setGuessInput(newGuess.join(''));
                                            }}
                                            style={{
                                                width: '42px',
                                                height: '48px',
                                                borderRadius: '10px',
                                                border: selectedChar ? '2px solid #fbbf24' : '2px dashed #fbbf24',
                                                background: selectedChar ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '24px',
                                                fontWeight: 900,
                                                color: '#1e293b'
                                            }}
                                        >
                                            {selectedChar}
                                        </motion.button>
                                    );
                                })}
                            </div>

                            {/* Letter Bank */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', width: '100%', maxWidth: '420px', margin: '0 auto' }}>
                                {effectiveScrambledLetters.map((char, idx) => {
                                    const totalInBank = effectiveScrambledLetters.filter(c => c === char).length;
                                    const usedInGuess = guessInput.split('').filter(c => c === char).length;
                                    const isUsed = usedInGuess >= totalInBank;

                                    return (
                                        <div key={`${char}-${idx}`} style={{ position: 'relative', width: '100%', height: '46px' }}>
                                            <div style={{ position: 'absolute', inset: 0, borderRadius: '10px', background: '#e2e8f0', zIndex: 0 }} />
                                            {!isUsed && (
                                                <motion.button
                                                    drag
                                                    dragSnapToOrigin={true}
                                                    dragElastic={0.1}
                                                    onDragEnd={(_, info) => {
                                                        if (info.point.y < window.innerHeight * 0.75) {
                                                            triggerSelection(char);
                                                        }
                                                    }}
                                                    onClick={() => triggerSelection(char)}
                                                    style={{
                                                        position: 'relative',
                                                        zIndex: 1,
                                                        width: '100%',
                                                        height: '46px',
                                                        borderRadius: '10px',
                                                        background: 'var(--brand-yellow)',
                                                        border: 'none',
                                                        color: '#000',
                                                        fontSize: '20px',
                                                        fontWeight: 900,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {char}
                                                </motion.button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {/* Skip Replay Button */}
                    {isReplaying && (
                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={skipReplay}
                            style={{
                                position: 'absolute',
                                bottom: '20px',
                                right: '20px',
                                padding: '12px 20px',
                                background: 'rgba(255,255,255,0.9)',
                                backdropFilter: 'blur(8px)',
                                border: '2px solid var(--brand-blue)',
                                borderRadius: '12px',
                                color: 'var(--brand-blue)',
                                fontWeight: 'bold',
                                fontSize: '14px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                cursor: 'pointer',
                                zIndex: 100,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            whileTap={{ scale: 0.95 }}
                        >
                            انتقل للرسمة النهائية
                            <ChevronRight size={18} />
                        </motion.button>
                    )}
                </div>
            </div>
        );
    }

    return null;
};

export default DrawingChallenge;