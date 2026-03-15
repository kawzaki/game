import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Eraser, Trash2, Check, Pencil, Palette, Download, Share2, Link as LinkIcon, Loader2, Droplets } from 'lucide-react';

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
        drawingCurrentWord,
        drawingMaskedWord,
        drawingDrawerId,
        drawingGuesses,
        drawingCategory,
        drawingLiveStrokes = [],
        sendDrawingStroke,
        sendDrawingClear,
        submitDrawingGuess,
        createChallenge,
        challengeData,
        challengeLoading
    } = useGameStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawer = myId === drawingDrawerId;

    // Drawing state
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(6);
    const [isEraser, setIsEraser] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const drawerStrokes = useRef<any[]>([]); // To track drawer strokes locally

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

    useEffect(() => {
        if (challengeData && roomId !== 'solo-challenge') {
            setShowChallengeModal(true);
        }
    }, [challengeData, roomId]);

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
            canvas.width = rect.width;
            canvas.height = rect.height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const strokesToDraw = roomId === 'solo-challenge' ? (challengeData?.strokes || []) : (isDrawer ? drawerStrokes.current : drawingLiveStrokes);
                strokesToDraw.forEach(stroke => {
                    if (stroke.type === 'segment' && stroke.from && stroke.to) {
                        drawSegment(ctx, stroke.from, stroke.to, stroke.color, stroke.size, stroke.eraser);
                    }
                });
            }
        };

        window.addEventListener('resize', updateSize);
        updateSize();
        return () => window.removeEventListener('resize', updateSize);
    }, [gameStatus, drawingLiveStrokes, drawSegment, roomId, challengeData, isDrawer]);

    // Draw incoming strokes live
    useEffect(() => {
        if (isDrawer || roomId === 'solo-challenge') return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas || drawingLiveStrokes.length === 0) return;

        const stroke = drawingLiveStrokes[drawingLiveStrokes.length - 1];
        if (!stroke) return;

        if (stroke.type === 'segment' && stroke.from && stroke.to) {
            drawSegment(ctx, stroke.from, stroke.to, stroke.color, stroke.size, stroke.eraser);
        }
    }, [drawingLiveStrokes, isDrawer, drawSegment, roomId]);

    // ─── Drawer pointer handlers ──────────────────────────────────────
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawer || gameStatus !== 'drawing_active' || roomId === 'solo-challenge') return;
        if (isSoloInkMode && ink <= 0) return;
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        setIsDrawing(true);
        lastPos.current = getCanvasPos(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawer || !isDrawing || gameStatus !== 'drawing_active' || roomId === 'solo-challenge') return;
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
            const consumption = (dist * (brushSize / 10)) / 300; // Increased capacity (slower consumption)
            setInk(prev => Math.max(0, prev - consumption));
        }

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) drawSegment(ctx, from, pos, activeColor, brushSize, isEraser);

        const stroke = { type: 'segment', from, to: pos, color: activeColor, size: brushSize, eraser: isEraser };
        sendDrawingStroke(roomId, stroke);
        drawerStrokes.current.push(stroke);

        lastPos.current = pos;
    };

    const handlePointerUp = () => {
        setIsDrawing(false);
        lastPos.current = null;
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        sendDrawingClear(roomId);
        drawerStrokes.current = [];
        if (isSoloInkMode) setInk(100);
    };

    const handleGuessSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const guess = guessInput.trim();
        if (!guess || hasGuessedCorrectly || soloGuessedCorrectly) return;

        if (roomId === 'solo-challenge' && challengeData) {
            if (guess.toLowerCase() === challengeData.word.toLowerCase()) {
                setSoloGuessedCorrectly(true);
                import('canvas-confetti').then(confetti => confetti.default());
            } else {
                alert('خطأ، حاول مرة أخرى!');
            }
        } else {
            submitDrawingGuess(roomId, guess);
        }
        setGuessInput('');
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // Ensure background is strictly white before capture
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(canvas, 0, 0);
            
            const link = document.createElement('a');
            link.download = `drawing-${drawingCurrentWord || 'challenge'}.png`;
            link.href = tempCanvas.toDataURL('image/png');
            link.click();
        }
    };

    const handleShare = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        try {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) return;
            
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(canvas, 0, 0);

            const blob = await new Promise<Blob | null>(resolve => tempCanvas.toBlob(resolve, 'image/png'));
            if (!blob) return;
            const file = new File([blob], 'drawing.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'تحدي الرسم!',
                    text: 'خمنوا ايش رسمت'
                });
            } else {
                handleDownload();
            }
        } catch (err) {
            console.error('Sharing failed:', err);
            handleDownload();
        }
    };

    const handleCreateChallenge = () => {
        if (!drawingCurrentWord || drawerStrokes.current.length === 0) {
            alert('يجب عليك الرسم أولاً!');
            return;
        }
        createChallenge(drawerStrokes.current, drawingCurrentWord, drawingCategory || '');
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
            <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100vw', height: 'calc(100vh - 64px)', overflow: 'hidden', background: '#f1f5f9', userSelect: 'none', WebkitUserSelect: 'none' }}>
                <div style={{ zIndex: 30, display: 'flex', flexDirection: 'column', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', width: '100%' }}>
                        {drawingCategory && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 900, color: '#f59e0b', direction: 'rtl' }}>
                                <Palette size={16} />
                                <span>{drawingCategory}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: 900, color: '#451a03', direction: 'rtl' }}>
                                {isDrawer && !isScoring ? (
                                    <><span>{drawingCurrentWord}</span><Pencil size={18} color="#f59e0b" /></>
                                ) : (
                                    <div style={{ letterSpacing: isScoring ? '2px' : '4px' }}>
                                        {isScoring ? <span>الكلمة: <span style={{ color: '#059669' }}>{drawingCurrentWord}</span></span> : maskedDisplay}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {isDrawer && !isScoring && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                <button onClick={() => setIsEraser(e => !e)} title="ممحاة" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid transparent', background: isEraser ? '#fef3c7' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isEraser ? '0 0 0 2px #d97706' : '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <Eraser size={16} color={isEraser ? '#d97706' : '#64748b'} />
                                </button>
                                <button onClick={handleClear} title="مسح الكل" style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'white', border: '1px solid #fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                    <Trash2 size={16} />
                                </button>
                                <div style={{ width: '1px', height: '20px', background: '#e2e8f0', margin: '0 2px' }} />
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {BRUSH_SIZES.map(s => (
                                        <button key={s} onClick={() => { setBrushSize(s); setIsEraser(false); }} style={{ width: '26px', height: '26px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid transparent', background: (!isEraser && brushSize === s) ? '#3b82f6' : 'white', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                            <div style={{ width: Math.min(s/2 + 2, 12), height: Math.min(s/2 + 2, 12), borderRadius: '50%', background: (!isEraser && brushSize === s) ? 'white' : color }} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px 0', flex: 1, scrollbarWidth: 'none' }}>
                                {COLORS.map(c => (
                                    <button key={c} onClick={() => { setColor(c); setIsEraser(false); }} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: (!isEraser && color === c) ? '2px solid #fff' : '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', flexShrink: 0, boxShadow: (!isEraser && color === c) ? '0 0 0 2px #3b82f6' : 'none' }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {isSoloInkMode && isDrawer && !isScoring && (
                        <div style={{ padding: '0 12px 8px 12px', background: '#f8fafc' }}>
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
                    <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', cursor: isDrawer && !isScoring ? (isEraser ? 'cell' : 'crosshair') : 'default', touchAction: 'none' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
                    <AnimatePresence>
                        {correctBanner && (
                            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 40, padding: '10px 20px', borderRadius: '50px', background: 'rgba(5, 150, 105, 0.95)', color: '#fff', fontWeight: 900, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }} dir="rtl">
                                <Check size={18} color="#fff" />
                                {correctBanner.playerName} خمّن الكلمة! +{correctBanner.pts} نقطة 🎉
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div style={{ zIndex: 30, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
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
                    
                    <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                        {!isDrawer && !isScoring && (
                            <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '8px', flex: 1 }}>
                                <input type="text" value={guessInput} onChange={e => setGuessInput(e.target.value)} disabled={!!hasGuessedCorrectly} placeholder={hasGuessedCorrectly ? '✅ تم التخمين!' : 'تخمين...'} style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '15px', border: hasGuessedCorrectly ? '2px solid #10b981' : '1px solid #e2e8f0', background: hasGuessedCorrectly ? '#f0fdf4' : '#fff', outline: 'none', textAlign: 'right', fontFamily: 'inherit' }} dir="rtl" autoComplete="off" />
                                <button type="submit" disabled={!!hasGuessedCorrectly || !guessInput.trim()} style={{ padding: '10px 16px', borderRadius: '10px', fontWeight: 900, fontSize: '14px', background: 'var(--brand-yellow)', border: 'none', cursor: 'pointer', opacity: (hasGuessedCorrectly || !guessInput.trim()) ? 0.5 : 1 }}>أرسل</button>
                            </form>
                        )}
                        
                        {isDrawer && !isScoring && (
                            <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                                <button onClick={handleDownload} title="حفظ الصورة" style={{ padding: '10px 16px', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '6px', fontSize: '13px', fontWeight: 'bold' }}>
                                    <Download size={16} />
                                    حفظ
                                </button>
                                <button onClick={handleShare} title="مشاركة الصورة" style={{ padding: '10px 16px', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '6px', fontSize: '13px', fontWeight: 'bold' }}>
                                    <Share2 size={16} />
                                    مشاركة
                                </button>
                                <button onClick={handleCreateChallenge} disabled={challengeLoading} title="وضع التحدي" style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--brand-yellow)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold', fontSize: '14px', gap: '8px', flex: 1 }}>
                                    {challengeLoading ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />}
                                    تحدي صديق
                                </button>
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
                    {showChallengeModal && challengeData && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: 'white', padding: '24px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                                <div style={{ fontSize: '18px', fontWeight: 900, marginBottom: '12px' }}>تم إنشاء التحدي! 🎉</div>
                                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>ارسل هذا الرابط لصديقك ليعرف ماذا رسمت!</p>
                                <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '10px', fontSize: '11px', wordBreak: 'break-all', marginBottom: '20px', cursor: 'pointer', border: '1px dashed #cbd5e1' }} onClick={() => { const link = `${window.location.origin}${window.location.pathname}?challenge=${challengeData.id}`; navigator.clipboard.writeText(link); alert('تم نسخ الرابط!'); }}>
                                    {window.location.origin}{window.location.pathname}?challenge={challengeData.id}
                                </div>
                                <button onClick={() => setShowChallengeModal(false)} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'var(--brand-yellow)', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>حسناً</button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    if (roomId === 'solo-challenge' && challengeData) {
        const soloMasked = challengeData.word.split('').map(c => c === ' ' ? '\u00A0\u00A0' : '_').join(' ');
        return (
            <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', width: '100%', height: 'calc(100vh - 44px)', background: '#f1f5f9', userSelect: 'none', WebkitUserSelect: 'none' }}>
                <div style={{ background: 'white', padding: '12px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#f59e0b' }}>{challengeData.category}</div>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#451a03' }}>
                        {soloGuessedCorrectly ? <span style={{ color: '#059669' }}>{challengeData.word}</span> : soloMasked}
                    </div>
                </div>
                <div style={{ flex: 1, position: 'relative', background: 'white' }}>
                    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                    <AnimatePresence>
                        {soloGuessedCorrectly && (
                            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(5, 150, 105, 0.9)', color: 'white', padding: '20px 40px', borderRadius: '50px', fontWeight: 900, zIndex: 100 }}>كفووو! إجابة صحيحة 🎉</motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div style={{ padding: '12px', background: 'white', borderTop: '1px solid #eee' }}>
                    <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '8px' }}>
                        <input type="text" value={guessInput} onChange={e => setGuessInput(e.target.value)} disabled={soloGuessedCorrectly} placeholder={soloGuessedCorrectly ? '✅ إجابة صحيحة!' : 'خمّن الكلمة...'} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #eee', textAlign: 'right' }} dir="rtl" />
                        <button type="submit" style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--brand-yellow)', border: 'none', fontWeight: 900 }}>خمّن</button>
                    </form>
                </div>
            </div>
        );
    }

    return null;
};

export default DrawingChallenge;