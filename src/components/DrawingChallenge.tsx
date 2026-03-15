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
        drawingMaskedWord,
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

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '800px', margin: '0 auto', padding: '0 8px', boxSizing: 'border-box' }}>
                {/* Round header - Swapped for Image 2 match */}
                <div style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    background: '#ffffff', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' 
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b' }}>
                            {drawerPlayer?.name || '...'}
                        </span>
                        <Pencil size={16} color="#64748b" />
                    </div>
                    <span style={{ fontWeight: 900, fontSize: '15px', color: '#1e293b' }}>
                        الجولة {currentRound} / {roundCount}
                    </span>
                </div>

                {/* Main Game Area with Sidebar - Canvas then Toolbar */}
                <div style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                    
                    {/* Canvas and Controls */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                        {/* Word display - Swapped order for Image 2 match */}
                        <div style={{
                            display: 'flex', alignItems: 'stretch', borderRadius: '12px', overflow: 'hidden',
                            border: '1px solid #fbbf24',
                            background: '#fffbeb',
                            minHeight: '48px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                             {/* Word/Mask - Centered */}
                             <div style={{ 
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '8px 20px', fontSize: '22px', 
                                fontWeight: 900, color: '#78350f',
                                direction: 'rtl', gap: '12px'
                            }}>
                                {isDrawer && !isScoring ? (
                                    <>
                                        <span>{drawingCurrentWord}</span>
                                        <Pencil size={20} color="#f59e0b" />
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

                            {/* Category - Swapped to Right */}
                            {drawingCategory && (
                                <div style={{ 
                                    padding: '0 20px', display: 'flex', alignItems: 'center', 
                                    fontSize: '14px', fontWeight: 900, color: '#92400e',
                                    background: '#fcd34d', minWidth: '80px', justifyContent: 'center'
                                }}>
                                    {drawingCategory}
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
                                        background: '#ecfdf5',
                                        border: '1px solid #10b981', textAlign: 'center',
                                        fontWeight: 900, fontSize: '15px', color: '#065f46',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                    }}
                                    dir="rtl"
                                >
                                    <Check size={20} color="#059669" />
                                    {correctBanner.playerName} خمّن الكلمة! +{correctBanner.pts} نقطة 🎉
                                </motion.div>
                            )}
                        </AnimatePresence>
 
                        {/* Canvas */}
                        <div style={{
                            borderRadius: '20px', overflow: 'hidden', width: '100%', boxSizing: 'border-box',
                            border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
                            background: '#fff', touchAction: 'none', position: 'relative'
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
                            <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
                                <input
                                    type="text"
                                    value={guessInput}
                                    onChange={e => setGuessInput(e.target.value)}
                                    disabled={!!hasGuessedCorrectly}
                                    placeholder={hasGuessedCorrectly ? '✅ تم التخمين بنجاح!' : 'اكتب تخمينك هنا...'}
                                    style={{
                                        flex: 1, padding: '12px 20px', borderRadius: '14px', fontSize: '16px',
                                        border: hasGuessedCorrectly ? '2px solid #10b981' : '1px solid #e2e8f0',
                                        background: hasGuessedCorrectly ? '#f0fdf4' : 'white',
                                        outline: 'none', textAlign: 'right', fontFamily: 'inherit',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}
                                    dir="rtl"
                                    autoComplete="off"
                                />
                                <button
                                    type="submit"
                                    disabled={!!hasGuessedCorrectly || !guessInput.trim()}
                                    style={{
                                        padding: '12px 28px', borderRadius: '14px', fontWeight: 900, fontSize: '16px',
                                        background: 'var(--brand-yellow)', border: 'none', cursor: 'pointer',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        opacity: (hasGuessedCorrectly || !guessInput.trim()) ? 0.5 : 1,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    أرسل
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Vertical Toolbar - Swapped to Right Side */}
                    {isDrawer && !isScoring && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 8px',
                            background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0',
                            width: '60px', flexShrink: 0, height: '440px', boxSizing: 'border-box',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}>
                            {/* Brush sizes */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                {BRUSH_SIZES.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => { setBrushSize(s); setIsEraser(false); }}
                                        style={{
                                            width: '36px', height: '36px', borderRadius: '10px', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', border: '2px solid #e2e8f0',
                                            background: (!isEraser && brushSize === s) ? '#eff6ff' : 'white', cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ width: Math.min(s, 18), height: Math.min(s, 18), borderRadius: '50%', background: color }} />
                                    </button>
                                ))}
                            </div>

                            <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0', flexShrink: 0 }} />

                            {/* Eraser & Clear */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                                <button
                                    onClick={() => setIsEraser(e => !e)}
                                    style={{
                                        width: '36px', height: '36px', borderRadius: '10px', border: '2px solid #e2e8f0',
                                        background: isEraser ? '#fef3c7' : 'white', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.2s ease'
                                    }}
                                    title="ممحاة"
                                >
                                    <Eraser size={20} color={isEraser ? '#d97706' : '#64748b'} />
                                </button>
                                <button
                                    onClick={handleClear}
                                    style={{
                                        width: '36px', height: '36px', borderRadius: '10px', border: '2px solid #fee2e2',
                                        background: '#fff', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                    title="مسح الكل"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>

                            <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0', flexShrink: 0 }} />

                            {/* Colors - SCROLLABLE */}
                            <div style={{ 
                                display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', 
                                overflowY: 'auto', flex: 1, paddingRight: '2px',
                                scrollbarWidth: 'none', msOverflowStyle: 'none'
                            }}>
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => { setColor(c); setIsEraser(false); }}
                                        style={{
                                            width: '30px', height: '30px', borderRadius: '50%',
                                            background: c, border: (!isEraser && color === c) ? '3px solid #3b82f6' : '1px solid #e2e8f0',
                                            cursor: 'pointer', flexShrink: 0,
                                            boxShadow: (!isEraser && color === c) ? '0 0 0 2px white' : 'none',
                                            transition: 'transform 0.1s ease'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Scoring reveal banner */}
                {isScoring && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            padding: '20px', borderRadius: '20px', background: '#f0fdf4',
                            border: '1px solid #10b981', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
                        }}
                    >
                        <div style={{ fontWeight: 900, fontSize: '18px', marginBottom: '12px', color: '#065f46' }}>
                            نهاية الجولة! الكلمة كانت: <span style={{ color: '#059669' }}>{drawingCurrentWord}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                            {players.map(p => {
                                const g = drawingGuesses[p.id];
                                const pts = g?.pointsEarned;
                                const isDrawerP = p.id === drawingDrawerId;
                                return (
                                    <div key={p.id} style={{
                                        padding: '8px 16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px',
                                        background: pts ? '#dcfce7' : '#f8fafc',
                                        border: pts ? '1px solid #86efac' : '1px solid #e2e8f0',
                                        color: pts ? '#166534' : '#64748b'
                                    }}>
                                        {p.name}{isDrawerP ? ' 🎨' : ''}
                                        {pts ? <span> +{pts} </span> : <span> 0 </span>}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Guess chat log — Boxed Card Style */}
                {!isScoring && chatLog.length > 0 && (
                    <div style={{
                        padding: '16px', background: '#ffffff', borderRadius: '16px',
                        border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                        maxHeight: '180px', overflowY: 'auto',
                        display: 'flex', flexDirection: 'column', gap: '8px'
                    }}>
                        <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '4px', fontWeight: 900, borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>التخمينات</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <AnimatePresence>
                                {chatLog.slice(-10).map((entry, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        style={{
                                            fontSize: '15px', fontWeight: 'bold',
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            justifyContent: 'flex-start'
                                        }}
                                        dir="rtl"
                                    >
                                        {entry.type === 'correct' ? (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                                    <Check size={16} />
                                                    <span>{entry.playerName} خمّن الكلمة!</span>
                                                    <Check size={16} />
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563' }}>
                                                <span style={{ color: '#9ca3af', fontWeight: 900 }}>؟</span>
                                                <span style={{ color: '#1f2937' }}>{entry.playerName}:</span>
                                                <span style={{ fontWeight: 500 }}>{(entry as any).guess}</span>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
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
