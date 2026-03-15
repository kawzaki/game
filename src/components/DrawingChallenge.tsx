import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Eraser, Trash2, Check, Pencil } from 'lucide-react';

interface DrawingChallengeProps {
    roomId: string;
}

const COLORS = [
    '#000000', '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
    '#ffffff', '#a16207', '#0e7490', '#64748b'
];

const BRUSH_SIZES = [3, 6, 12, 20];

const DrawingChallenge: React.FC<DrawingChallengeProps> = ({ roomId }) => {
    const {
        gameStatus,
        timer,
        myId,
        players,
        currentRound,
        roundCount,
        drawingCurrentWord,
        drawingWordLength,
        drawingDrawerId,
        drawingGuesses,
        drawingCategory,
        drawingLiveStrokes = [],
        sendDrawingStroke,
        sendDrawingClear,
        submitDrawingGuess,
    } = useGameStore();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawer = myId === drawingDrawerId;
    const drawerPlayer = players.find(p => p.id === drawingDrawerId);

    // Drawing state
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(6);
    const [isEraser, setIsEraser] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const currentStroke = useRef<any[]>([]);

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

    // Correct-answer flash banner (fix 4)
    const [correctBanner, setCorrectBanner] = useState<{ playerName: string; pts: number } | null>(null);
    const prevCorrectLen = React.useRef(0);
    useEffect(() => {
        if (correctGuesses.length > prevCorrectLen.current) {
            const latest = correctGuesses[correctGuesses.length - 1];
            // estimate points: server uses Math.round((timeLeft/80)*60)+20, mirror here with timer
            const pts = Math.round((timer / 80) * 60) + 20;
            setCorrectBanner({ playerName: latest.playerName, pts });
            const t = setTimeout(() => setCorrectBanner(null), 4000);
            prevCorrectLen.current = correctGuesses.length;
            return () => clearTimeout(t);
        }
        prevCorrectLen.current = correctGuesses.length;
    }, [correctGuesses.length]);

    // ─── Canvas helpers ──────────────────────────────────────────────
    const getCanvasPos = (e: React.PointerEvent | PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const drawSegment = useCallback((ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, strokeColor: string, size: number, eraser: boolean) => {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = eraser ? '#ffffff' : strokeColor;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }, []);

    // Countdown tick sound
    useEffect(() => {
        if (gameStatus !== 'countdown') return;
        const src = timer > 0
            ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'   // tick
            : 'https://assets.mixkit.co/active_storage/sfx/1084/1084-preview.mp3';  // go!
        const audio = new Audio(src);
        audio.volume = 0.5;
        audio.play().catch(() => { });
    }, [timer, gameStatus]);

    // Initialise canvas background
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, [gameStatus]);

    // Listen for incoming live strokes (for guessers)
    useEffect(() => {
        if (isDrawer) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas || drawingLiveStrokes.length === 0) return;
        const stroke = drawingLiveStrokes[drawingLiveStrokes.length - 1];
        if (!stroke) return;

        if (stroke.type === 'segment' && stroke.from && stroke.to) {
            drawSegment(ctx, stroke.from, stroke.to, stroke.color, stroke.size, stroke.eraser);
        }
    }, [drawingLiveStrokes, isDrawer, drawSegment]);


    // ─── Drawer pointer handlers ──────────────────────────────────────
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawer || gameStatus !== 'drawing_active') return;
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        setIsDrawing(true);
        lastPos.current = getCanvasPos(e);
        currentStroke.current = [lastPos.current];
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawer || !isDrawing || gameStatus !== 'drawing_active') return;
        const pos = getCanvasPos(e);
        const from = lastPos.current!;
        const activeColor = isEraser ? '#ffffff' : color;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) drawSegment(ctx, from, pos, activeColor, brushSize, isEraser);

        // Send segment to server
        sendDrawingStroke(roomId, { type: 'segment', from, to: pos, color: activeColor, size: brushSize, eraser: isEraser });

        currentStroke.current.push(pos);
        lastPos.current = pos;
    };

    const handlePointerUp = () => {
        setIsDrawing(false);
        lastPos.current = null;
        currentStroke.current = [];
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        sendDrawingClear(roomId);
    };

    // ─── Guess submission ────────────────────────────────────────────
    const handleGuessSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!guessInput.trim() || hasGuessedCorrectly || gameStatus !== 'drawing_active') return;
        submitDrawingGuess(roomId, guessInput.trim());
        setGuessInput('');
    };

    // ─── Blank display for word length ────────────────────────────────
    const wordBlanks = Array(drawingWordLength).fill('_').join(' ');

    // ─── Countdown ────────────────────────────────────────────────────
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

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '800px', margin: '0 auto', padding: '0 8px', boxSizing: 'border-box' }}>
                {/* Round header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: 900, fontSize: '14px', color: '#64748b' }}>
                        الجولة {currentRound} / {roundCount}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Pencil size={14} color="#64748b" />
                        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>
                            {drawerPlayer?.name || '...'}
                        </span>
                    </div>
                </div>

                {/* Main Game Area with Sidebar */}
                <div style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                    
                    {/* Vertical Toolbar - Side of Canvas */}
                    {isDrawer && !isScoring && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px',
                            background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0',
                            width: '50px', flexShrink: 0, height: 'fit-content'
                        }}>
                            {/* Brush sizes */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                {BRUSH_SIZES.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => { setBrushSize(s); setIsEraser(false); }}
                                        style={{
                                            width: '32px', height: '32px', borderRadius: '8px', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', border: '2px solid #e2e8f0',
                                            background: (!isEraser && brushSize === s) ? '#dbeafe' : 'white', cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ width: Math.min(s, 16), height: Math.min(s, 16), borderRadius: '50%', background: color }} />
                                    </button>
                                ))}
                            </div>

                            <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

                            {/* Eraser & Clear */}
                            <button
                                onClick={() => setIsEraser(e => !e)}
                                style={{
                                    width: '32px', height: '32px', borderRadius: '8px', border: '2px solid #e2e8f0',
                                    background: isEraser ? '#fef3c7' : 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title="ممحاة"
                            >
                                <Eraser size={18} />
                            </button>
                            <button
                                onClick={handleClear}
                                style={{
                                    width: '32px', height: '32px', borderRadius: '8px', border: '2px solid #fca5a5',
                                    background: '#fef2f2', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626'
                                }}
                                title="مسح الكل"
                            >
                                <Trash2 size={18} />
                            </button>

                            <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

                            {/* Colors */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => { setColor(c); setIsEraser(false); }}
                                        style={{
                                            width: '24px', height: '24px', borderRadius: '50%',
                                            background: c, border: (!isEraser && color === c) ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                                            cursor: 'pointer', flexShrink: 0,
                                            boxShadow: (!isEraser && color === c) ? '0 0 0 2px white' : 'none'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Canvas and Controls */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                        {/* Word display - SHRUNK */}
                        {isDrawer && !isScoring ? (
                            <div style={{
                                textAlign: 'center', padding: '8px 16px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                                border: '2px solid #f59e0b', fontWeight: 900, fontSize: '20px',
                                color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'
                            }}>
                                <div>✏️ {drawingCurrentWord}</div>
                                {drawingCategory && (
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', borderLeft: '1px solid #f59e0b', paddingLeft: '12px', color: '#b45309', opacity: 0.8 }}>
                                        التصنيف: {drawingCategory}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{
                                textAlign: 'center', padding: '6px 16px', borderRadius: '12px',
                                background: '#f1f5f9', fontWeight: 900, fontSize: '18px',
                                color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'
                            }}>
                                <div style={{ letterSpacing: isScoring ? '2px' : '4px' }}>
                                    {isScoring
                                        ? <span style={{ color: '#1e293b' }}>الكلمة: <span style={{ color: '#059669' }}>{drawingCurrentWord}</span></span>
                                        : wordBlanks
                                    }
                                </div>
                                {!isScoring && drawingCategory && (
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', borderLeft: '1px solid #cbd5e1', paddingLeft: '12px', color: '#64748b', opacity: 0.8, letterSpacing: 'normal' }}>
                                        تلميح: {drawingCategory}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Correct-answer flash banner */}
                        <AnimatePresence>
                            {correctBanner && (
                                <motion.div
                                    initial={{ opacity: 0, y: -12, scale: 0.92 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    style={{
                                        padding: '10px 16px', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                                        border: '1px solid #10b981', textAlign: 'center',
                                        fontWeight: 900, fontSize: '14px', color: '#065f46',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                    dir="rtl"
                                >
                                    <Check size={18} color="#059669" />
                                    {correctBanner.playerName} خمّن الكلمة! +{correctBanner.pts} نقطة 🎉
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Canvas */}
                        <div style={{
                            borderRadius: '16px', overflow: 'hidden', width: '100%', boxSizing: 'border-box',
                            border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            background: '#fff', touchAction: 'none'
                        }}>
                            <canvas
                                ref={canvasRef}
                                width={640}
                                height={440}
                                style={{ width: '100%', display: 'block', cursor: isDrawer && !isScoring ? (isEraser ? 'cell' : 'crosshair') : 'default' }}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            />
                        </div>

                        {/* Guesser input */}
                        {!isDrawer && !isScoring && (
                            <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
                                <input
                                    type="text"
                                    value={guessInput}
                                    onChange={e => setGuessInput(e.target.value)}
                                    disabled={!!hasGuessedCorrectly}
                                    placeholder={hasGuessedCorrectly ? '✅ أحسنت! خمّنت الكلمة!' : 'اكتب تخمينك...'}
                                    style={{
                                        flex: 1, padding: '10px 16px', borderRadius: '12px', fontSize: '15px',
                                        border: hasGuessedCorrectly ? '2px solid #10b981' : '1px solid #e2e8f0',
                                        background: hasGuessedCorrectly ? '#ecfdf5' : 'white',
                                        outline: 'none', textAlign: 'right', fontFamily: 'inherit'
                                    }}
                                    dir="rtl"
                                    autoComplete="off"
                                />
                                <button
                                    type="submit"
                                    disabled={!!hasGuessedCorrectly || !guessInput.trim()}
                                    style={{
                                        padding: '10px 20px', borderRadius: '12px', fontWeight: 900, fontSize: '15px',
                                        background: 'var(--brand-yellow)', border: 'none', cursor: 'pointer',
                                        opacity: (hasGuessedCorrectly || !guessInput.trim()) ? 0.5 : 1
                                    }}
                                >
                                    أرسل
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Scoring reveal banner */}
                {isScoring && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            padding: '16px', borderRadius: '16px', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                            border: '1px solid #10b981', textAlign: 'center'
                        }}
                    >
                        <div style={{ fontWeight: 900, fontSize: '16px', marginBottom: '8px', color: '#065f46' }}>
                            نهاية الجولة! الكلمة كانت: <span style={{ color: '#059669' }}>{drawingCurrentWord}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                            {players.map(p => {
                                const g = drawingGuesses[p.id];
                                const pts = g?.pointsEarned;
                                const isDrawerP = p.id === drawingDrawerId;
                                return (
                                    <div key={p.id} style={{
                                        padding: '6px 12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px',
                                        background: pts ? '#bbf7d0' : '#f1f5f9',
                                        border: pts ? '1px solid #86efac' : '1px solid #e2e8f0'
                                    }}>
                                        {p.name}{isDrawerP ? ' 🎨' : ''}
                                        {pts ? <span style={{ color: '#059669' }}> +{pts} نقطة</span> : <span style={{ color: '#94a3b8' }}> 0</span>}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: '12px', color: '#64748b', fontSize: '13px' }}>
                            الجولة التالية تبدأ تلقائياً...
                        </div>
                    </motion.div>
                )}

                {/* Guess chat log — visible to ALL players */}
                {!isScoring && chatLog.length > 0 && (
                    <div style={{
                        padding: '10px', background: '#f8fafc', borderRadius: '12px',
                        border: '1px solid #e2e8f0', maxHeight: '140px', overflowY: 'auto',
                        display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}>التخمينات</div>
                        <AnimatePresence>
                            {chatLog.slice(-10).map((entry, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{
                                        fontSize: '13px', fontWeight: 'bold',
                                        color: entry.type === 'correct' ? '#059669' : '#64748b',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                    dir="rtl"
                                >
                                    {entry.type === 'correct'
                                        ? <><Check size={14} color="#10b981" /> {entry.playerName} خمّن الكلمة! ✅</>
                                        : <><span style={{ color: '#94a3b8' }}>{entry.playerName}:</span> {(entry as any).guess}</>
                                    }
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {/* Host hint if scoring */}
                {isScoring && currentRound < roundCount && (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        سيرسم الدور {drawerPlayer?.name === players[players.indexOf(drawerPlayer!) + 1]?.name ? players[players.indexOf(drawerPlayer!) + 1]?.name : (players[(players.indexOf(drawerPlayer!) + 1) % players.length]?.name)} في الجولة التالية
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default DrawingChallenge;
