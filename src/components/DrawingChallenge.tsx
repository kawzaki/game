import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Eraser, Trash2, Check, Pencil, Palette } from 'lucide-react';

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
        drawingMaskedWord,
        drawingDrawerId,
        drawingGuesses,
        drawingCategory,
        drawingLiveStrokes = [],
        sendDrawingStroke,
        sendDrawingClear,
        submitDrawingGuess,
    } = useGameStore();

    const containerRef = useRef<HTMLDivElement>(null);
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

    // Correct-answer flash banner
    const [correctBanner, setCorrectBanner] = useState<{ playerName: string; pts: number } | null>(null);
    const prevCorrectLen = React.useRef(0);
    useEffect(() => {
        if (correctGuesses.length > prevCorrectLen.current) {
            const latest = correctGuesses[correctGuesses.length - 1];
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
            ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
            : 'https://assets.mixkit.co/active_storage/sfx/1084/1084-preview.mp3';
        const audio = new Audio(src);
        audio.volume = 0.5;
        audio.play().catch(() => { });
    }, [timer, gameStatus]);

    // Dynamic canvas sizing
    useEffect(() => {
        const updateSize = () => {
            const container = containerRef.current;
            const canvas = canvasRef.current;
            if (!container || !canvas) return;

            const rect = container.getBoundingClientRect();
            // Store previous drawing if needed, but we draw from state anyway
            canvas.width = rect.width;
            canvas.height = rect.height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Re-fill white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Re-draw all strokes from history
                drawingLiveStrokes.forEach(stroke => {
                    if (stroke.type === 'segment' && stroke.from && stroke.to) {
                        drawSegment(ctx, stroke.from, stroke.to, stroke.color, stroke.size, stroke.eraser);
                    }
                });
            }
        };

        window.addEventListener('resize', updateSize);
        updateSize();
        return () => window.removeEventListener('resize', updateSize);
    }, [gameStatus, drawingLiveStrokes, drawSegment]);

    // Draw incoming strokes live
    useEffect(() => {
        if (isDrawer) return; // Drawer already drew locally
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

    const handleGuessSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!guessInput.trim() || hasGuessedCorrectly || gameStatus !== 'drawing_active') return;
        submitDrawingGuess(roomId, guessInput.trim());
        setGuessInput('');
    };

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

        // Mask display logic (fix for dash count)
        const maskedDisplay = drawingMaskedWord ? drawingMaskedWord.split('').map(c => c === ' ' ? '\u00A0\u00A0' : c === '-' ? '-' : '_').join(' ') : '';

        const reversedChatLog = [...chatLog].reverse().slice(0, 10);

        return (
            <div 
                ref={containerRef}
                style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%', 
                    maxWidth: '100vw',
                    height: 'calc(100vh - 64px)', 
                    overflow: 'hidden',
                    background: '#f1f5f9'
                }}
            >
                {/* 2. Top Bar: Word, Tools and Scrollable Palette */}
                <div style={{
                    zIndex: 30,
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    borderBottom: '1px solid #e2e8f0',
                    flexShrink: 0
                }}>
                    {/* Row 1: Word & Category */}
                    <div style={{
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '10px 16px',
                        width: '100%'
                    }}>
                        {drawingCategory && (
                            <div style={{ 
                                display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '13px', fontWeight: 900, color: '#f59e0b',
                                direction: 'rtl'
                            }}>
                                <Palette size={16} />
                                <span>{drawingCategory}</span>
                            </div>
                        )}
                        
                        <div style={{ 
                            display: 'flex', alignItems: 'center', gap: '8px',
                            fontSize: '20px', 
                            fontWeight: 900, color: '#451a03',
                            direction: 'rtl'
                        }}>
                            {isDrawer && !isScoring ? (
                                <>
                                    <span>{drawingCurrentWord}</span>
                                    <Pencil size={18} color="#f59e0b" />
                                </>
                            ) : (
                                <div style={{ letterSpacing: isScoring ? '2px' : '4px' }}>
                                    {isScoring
                                        ? <span>الكلمة: <span style={{ color: '#059669' }}>{drawingCurrentWord}</span></span>
                                        : maskedDisplay
                                    }
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Tools & Color Palette (Drawer Only) */}
                    {isDrawer && !isScoring && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '6px 12px',
                            background: '#f8fafc',
                            borderTop: '1px solid #f1f5f9'
                        }}>
                            {/* Brush sizes, Eraser, Clear */}
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                <button
                                    onClick={() => setIsEraser(e => !e)}
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '8px', border: '1px solid transparent',
                                        background: isEraser ? '#fef3c7' : 'white', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: isEraser ? '0 0 0 2px #d97706' : '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    <Eraser size={16} color={isEraser ? '#d97706' : '#64748b'} />
                                </button>
                                <button
                                    onClick={handleClear}
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '8px',
                                        background: 'white', border: '1px solid #fee2e2', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444'
                                    }}
                                >
                                    <Trash2 size={16} />
                                </button>

                                <div style={{ width: '1px', height: '20px', background: '#e2e8f0', margin: '0 2px' }} />

                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {BRUSH_SIZES.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { setBrushSize(s); setIsEraser(false); }}
                                            style={{
                                                width: '26px', height: '26px', borderRadius: '6px', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center', border: '1px solid transparent',
                                                background: (!isEraser && brushSize === s) ? '#3b82f6' : 'white', cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}
                                        >
                                            <div style={{ 
                                                width: Math.min(s/2 + 2, 12), 
                                                height: Math.min(s/2 + 2, 12), 
                                                borderRadius: '50%', 
                                                background: (!isEraser && brushSize === s) ? 'white' : color 
                                            }} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />

                            {/* Scrollable Color Palette */}
                            <div style={{ 
                                display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px 0',
                                scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch'
                            }}>
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => { setColor(c); setIsEraser(false); }}
                                        style={{
                                            width: '24px', height: '24px', borderRadius: '50%',
                                            background: c, border: (!isEraser && color === c) ? '2px solid #fff' : '1px solid rgba(0,0,0,0.1)',
                                            cursor: 'pointer', flexShrink: 0,
                                            boxShadow: (!isEraser && color === c) ? '0 0 0 2px #3b82f6' : 'none'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 1. Canvas Area - Flex Grow */}
                <div style={{
                    flex: 1,
                    position: 'relative',
                    background: '#fff',
                    overflow: 'hidden'
                }}>
                    <canvas
                        ref={canvasRef}
                        style={{ 
                            position: 'absolute',
                            inset: 0,
                            width: '100%', 
                            height: '100%', 
                            display: 'block', 
                            cursor: isDrawer && !isScoring ? (isEraser ? 'cell' : 'crosshair') : 'default',
                            touchAction: 'none'
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    />

                    {/* Correct-answer flash banner - Absolute over canvas middle */}
                    <AnimatePresence>
                        {correctBanner && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10 }}
                                style={{
                                    position: 'absolute',
                                    top: '20px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 40,
                                    padding: '10px 20px', borderRadius: '50px',
                                    background: 'rgba(5, 150, 105, 0.95)',
                                    color: '#fff',
                                    fontWeight: 900, fontSize: '14px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                    whiteSpace: 'nowrap'
                                }}
                                dir="rtl"
                            >
                                <Check size={18} color="#fff" />
                                {correctBanner.playerName} خمّن الكلمة! +{correctBanner.pts} نقطة 🎉
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 4. Bottom Area: Guesses and Input */}
                <div style={{
                    zIndex: 30,
                    background: '#fff',
                    borderTop: '1px solid #e2e8f0',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    flexShrink: 0
                }}>
                    {/* Guesses Log - Reversed (Recent at top) */}
                    {!isScoring && chatLog.length > 0 && (
                        <div style={{
                            background: '#f8fafc',
                            borderRadius: '10px',
                            padding: '8px',
                            maxHeight: '100px', 
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                        }}>
                            <AnimatePresence>
                                {reversedChatLog.map((entry, idx) => (
                                    <motion.div
                                        key={`${entry.playerName}-${idx}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{
                                            fontSize: '13px', fontWeight: 'bold',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                        dir="rtl"
                                    >
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

                    {/* Guesser Input */}
                    {!isDrawer && !isScoring && (
                        <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <input
                                type="text"
                                value={guessInput}
                                onChange={e => setGuessInput(e.target.value)}
                                disabled={!!hasGuessedCorrectly}
                                placeholder={hasGuessedCorrectly ? '✅ تم التخمين!' : 'تخمين...'}
                                style={{
                                    flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '15px',
                                    border: hasGuessedCorrectly ? '2px solid #10b981' : '1px solid #e2e8f0',
                                    background: hasGuessedCorrectly ? '#f0fdf4' : '#fff',
                                    outline: 'none', textAlign: 'right', fontFamily: 'inherit'
                                }}
                                dir="rtl"
                                autoComplete="off"
                            />
                            <button
                                type="submit"
                                disabled={!!hasGuessedCorrectly || !guessInput.trim()}
                                style={{
                                    padding: '10px 16px', borderRadius: '10px', fontWeight: 900, fontSize: '14px',
                                    background: 'var(--brand-yellow)', border: 'none', cursor: 'pointer',
                                    opacity: (hasGuessedCorrectly || !guessInput.trim()) ? 0.5 : 1
                                }}
                            >
                                أرسل
                            </button>
                        </form>
                    )}
                </div>

                {/* Scoring reveal banner Overlay */}
                {isScoring && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 30,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            style={{
                                padding: '32px', borderRadius: '24px', background: '#fff',
                                border: '2px solid #10b981', textAlign: 'center', 
                                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.1)',
                                maxWidth: '500px', width: '100%'
                            }}
                        >
                            <div style={{ fontWeight: 900, fontSize: '24px', marginBottom: '16px', color: '#065f46' }}>
                                نهاية الجولة!
                            </div>
                            <div style={{ fontSize: '18px', marginBottom: '24px', color: '#475569' }}>
                                الكلمة كانت: <span style={{ color: '#059669', fontWeight: 900 }}>{drawingCurrentWord}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                                {players.map(p => {
                                    const g = drawingGuesses[p.id];
                                    const pts = g?.pointsEarned;
                                    const isDrawerP = p.id === drawingDrawerId;
                                    return (
                                        <div key={p.id} style={{
                                            padding: '10px 20px', borderRadius: '14px', fontWeight: 'bold', fontSize: '15px',
                                            background: pts ? '#dcfce7' : '#f8fafc',
                                            border: pts ? '1px solid #86efac' : '1px solid #e2e8f0',
                                            color: pts ? '#166534' : '#64748b',
                                            display: 'flex', alignItems: 'center', gap: '8px'
                                        }}>
                                            <span>{p.name}</span>
                                            {isDrawerP && <span>🎨</span>}
                                            <span style={{ 
                                                minWidth: '32px', height: '32px', borderRadius: '50%', 
                                                background: pts ? '#bbf7d0' : '#e2e8f0',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '12px'
                                            }}>
                                                +{pts || 0}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                )}
                {/* Host hint if scoring */}
                {isScoring && currentRound < roundCount && (
                    <div style={{ 
                        position: 'absolute',
                        bottom: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        textAlign: 'center', 
                        color: '#94a3b8', 
                        fontSize: '13px',
                        zIndex: 40
                    }}>
                        سيرسم الدور {drawerPlayer?.name === players[players.indexOf(drawerPlayer!) + 1]?.name ? players[players.indexOf(drawerPlayer!) + 1]?.name : (players[(players.indexOf(drawerPlayer!) + 1) % players.length]?.name)} في الجولة التالية
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default DrawingChallenge;
