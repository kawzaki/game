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
                    position: 'relative', 
                    width: '100%', 
                    height: 'calc(100vh - 64px)', 
                    overflow: 'hidden',
                    background: '#ffffff'
                }}
            >
                {/* 1. Full-screen Canvas */}
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

                {/* 2. Top Overlay: Word and Category */}
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    zIndex: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '8px',
                    width: 'auto',
                    pointerEvents: 'none'
                }}>
                    <div style={{
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px',
                        padding: '8px 16px',
                        background: 'transparent',
                        width: 'auto',
                        pointerEvents: 'none'
                    }}>
                         {/* Word/Mask */}
                         <div style={{ 
                            display: 'flex', alignItems: 'center', gap: '8px',
                            fontSize: '28px', 
                            fontWeight: 900, color: '#451a03',
                            direction: 'rtl'
                        }}>
                            {isDrawer && !isScoring ? (
                                <>
                                    <span>{drawingCurrentWord}</span>
                                    <Pencil size={24} color="#f59e0b" />
                                </>
                            ) : (
                                <div style={{ letterSpacing: isScoring ? '2px' : '6px' }}>
                                    {isScoring
                                        ? <span>الكلمة: <span style={{ color: '#059669' }}>{drawingCurrentWord}</span></span>
                                        : maskedDisplay
                                    }
                                </div>
                            )}
                        </div>

                        {/* Category with Icon */}
                        {drawingCategory && (
                            <div style={{ 
                                display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '16px', fontWeight: 900, color: '#f59e0b',
                                direction: 'rtl'
                            }}>
                                <Palette size={20} />
                                <span>{drawingCategory}</span>
                            </div>
                        )}
                    </div>

                    {/* Correct-answer flash banner */}
                    <AnimatePresence>
                        {correctBanner && (
                            <motion.div
                                initial={{ opacity: 0, y: -12, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8 }}
                                style={{
                                    padding: '12px 16px', borderRadius: '12px',
                                    background: 'rgba(236, 253, 245, 0.9)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid #10b981', textAlign: 'center',
                                    fontWeight: 900, fontSize: '15px', color: '#065f46',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}
                                dir="rtl"
                            >
                                <Check size={20} color="#059669" />
                                {correctBanner.playerName} خمّن الكلمة! +{correctBanner.pts} نقطة 🎉
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* 3. Left Overlay: Drawing Tools (Drawer Only) */}
                {isDrawer && !isScoring && (
                    <div style={{
                        position: 'absolute',
                        left: '0',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        padding: '20px 8px',
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '0 24px 24px 0',
                        border: '1px solid rgba(226, 232, 240, 0.8)',
                        borderLeft: 'none',
                        width: '64px',
                        boxShadow: '4px 0 32px rgba(0,0,0,0.1)',
                        pointerEvents: 'auto'
                    }}>
                        {/* Brush sizes */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                            {BRUSH_SIZES.map(s => (
                                <button
                                    key={s}
                                    onClick={() => { setBrushSize(s); setIsEraser(false); }}
                                    style={{
                                        width: '40px', height: '40px', borderRadius: '12px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', border: '2px solid transparent',
                                        background: (!isEraser && brushSize === s) ? '#eff6ff' : 'white', cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: (!isEraser && brushSize === s) ? '0 0 0 2px #3b82f6' : '0 2px 4px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    <div style={{ width: Math.min(s, 20), height: Math.min(s, 20), borderRadius: '50%', background: color }} />
                                </button>
                            ))}
                        </div>

                        <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

                        {/* Eraser & Clear */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                            <button
                                onClick={() => setIsEraser(e => !e)}
                                style={{
                                    width: '40px', height: '40px', borderRadius: '12px', border: '2px solid transparent',
                                    background: isEraser ? '#fef3c7' : 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isEraser ? '0 0 0 2px #d97706' : '0 2px 4px rgba(0,0,0,0.05)'
                                }}
                                title="ممحاة"
                            >
                                <Eraser size={20} color={isEraser ? '#d97706' : '#64748b'} />
                            </button>
                            <button
                                onClick={handleClear}
                                style={{
                                    width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #fee2e2',
                                    background: 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                title="مسح الكل"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>

                        <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

                        {/* Colors */}
                        <div style={{ 
                            display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', 
                            overflowY: 'auto', flex: 1, paddingRight: '2px',
                            scrollbarWidth: 'none', msOverflowStyle: 'none',
                            maxHeight: '200px'
                        }}>
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => { setColor(c); setIsEraser(false); }}
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        background: c, border: (!isEraser && color === c) ? '3px solid #fff' : '1px solid rgba(0,0,0,0.1)',
                                        cursor: 'pointer', flexShrink: 0,
                                        boxShadow: (!isEraser && color === c) ? '0 0 0 2px #3b82f6' : '0 2px 4px rgba(0,0,0,0.1)',
                                        transition: 'transform 0.1s ease'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* 4. Bottom Overlay: Guesses and Input */}
                <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 20,
                    width: '90%',
                    maxWidth: '600px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    pointerEvents: 'none'
                }}>
                    {/* Guesses Log - Reversed (Recent at top) */}
                    {!isScoring && chatLog.length > 0 && (
                        <div style={{
                            padding: '12px', 
                            background: 'rgba(255, 255, 255, 0.8)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '16px',
                            border: '1px solid rgba(229, 231, 235, 0.8)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                            maxHeight: '140px', 
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                        }}>
                            <AnimatePresence>
                                {reversedChatLog.map((entry, idx) => (
                                    <motion.div
                                        key={`${entry.playerName}-${idx}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{
                                            fontSize: '14px', fontWeight: 'bold',
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            justifyContent: 'flex-start'
                                        }}
                                        dir="rtl"
                                    >
                                        {entry.type === 'correct' ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', background: 'rgba(236, 253, 245, 0.8)', padding: '2px 8px', borderRadius: '6px' }}>
                                                <Check size={14} />
                                                <span>{entry.playerName} خمّن الكلمة!</span>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563', padding: '2px 8px', background: 'rgba(255,255,255,0.4)', borderRadius: '6px' }}>
                                                <span style={{ color: '#64748b' }}>{entry.playerName}:</span>
                                                <span style={{ fontWeight: 600 }}>{(entry as any).guess}</span>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Guesser Input */}
                    {!isDrawer && !isScoring && (
                        <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '10px', width: '100%', pointerEvents: 'auto' }}>
                            <input
                                type="text"
                                value={guessInput}
                                onChange={e => setGuessInput(e.target.value)}
                                disabled={!!hasGuessedCorrectly}
                                placeholder={hasGuessedCorrectly ? '✅ تم التخمين بنجاح!' : 'اكتب تخمينك هنا...'}
                                style={{
                                    flex: 1, padding: '14px 20px', borderRadius: '16px', fontSize: '16px',
                                    border: hasGuessedCorrectly ? '2px solid #10b981' : '1px solid rgba(226, 232, 240, 0.8)',
                                    background: hasGuessedCorrectly ? 'rgba(240, 253, 244, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                                    backdropFilter: 'blur(8px)',
                                    outline: 'none', textAlign: 'right', fontFamily: 'inherit',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                }}
                                dir="rtl"
                                autoComplete="off"
                            />
                            <button
                                type="submit"
                                disabled={!!hasGuessedCorrectly || !guessInput.trim()}
                                style={{
                                    padding: '14px 28px', borderRadius: '16px', fontWeight: 900, fontSize: '16px',
                                    background: 'var(--brand-yellow)', border: 'none', cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    opacity: (hasGuessedCorrectly || !guessInput.trim()) ? 0.5 : 1,
                                    transition: 'all 0.2s ease'
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
