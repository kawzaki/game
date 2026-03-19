import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Image as ImageIcon } from 'lucide-react';
import { playSound } from '../utils/soundUtils';

interface PixelChallengeProps {
    roomId: string;
}

const PixelChallenge: React.FC<PixelChallengeProps> = ({ roomId }) => {
    const {
        activeQuestion,
        timer,
        submitPixelAnswer,
        wordMeaningFeedback,
        gameStatus,
        myId
    } = useGameStore();

    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);


    // Countdown sound synchronization
    useEffect(() => {
        if (gameStatus === 'countdown' && timer === 3) {
            playSound('countdown');
        }
    }, [gameStatus, timer]);

    // Answer feedback sounds
    useEffect(() => {
        if (gameStatus !== 'pixel_active') return;
        const myFeedback = wordMeaningFeedback?.[myId || ''];
        if (myFeedback) {
            playSound(myFeedback.isCorrect ? 'correct' : 'wrong');
        }
    }, [wordMeaningFeedback, myId, gameStatus]);

    // Reset local state when question changes
    useEffect(() => {
        setSelectedAnswer(null);
        setImageLoaded(false);
    }, [activeQuestion?.id]);

    if (gameStatus === 'game_over') return null;

    const handleAnswer = (answer: string) => {
        if (selectedAnswer || wordMeaningFeedback?.[myId || ''] || gameStatus !== 'pixel_active') return;
        setSelectedAnswer(answer);
        submitPixelAnswer(roomId, answer);
    };

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
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '20px' }}>استعد للبدء!</div>
            </div>
        );
    }

    if (!activeQuestion || !activeQuestion.options) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 20px' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--brand-yellow)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ marginTop: '20px', fontWeight: 'bold', color: '#64748b' }}>جاري تحميل السؤال...</p>
            </div>
        );
    }


    const myFeedback = wordMeaningFeedback?.[myId || ''];
    const progress = (13 - timer) / 13;
    const pixelSize = gameStatus === 'pixel_scoring' ? 0 : Math.max(0, Math.floor(12 * (1 - progress)));

    return (
        <div style={{ padding: '10px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', height: 'calc(100vh - 40px)', maxHeight: '1200px', userSelect: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 16px', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-yellow)', fontWeight: 'bold', fontSize: '16px' }}>
                    <Timer size={18} />
                    <span>{timer}s</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, color: '#1e293b', fontSize: '16px' }}>
                    <ImageIcon size={18} color="#ec4899" />
                    <span>تحدي الصور</span>
                </div>
            </div>

            <div style={{
                flex: 1,
                position: 'relative',
                width: '100%',
                maxWidth: '800px',
                margin: '0 auto',
                aspectRatio: '9/16',
                borderRadius: '32px',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                border: '4px solid white',
                background: '#000'
            }}>
                <img
                    src={activeQuestion.imageUrl}
                    alt="Mystery"
                    onLoad={() => setImageLoaded(true)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: `blur(${pixelSize}px)`,
                        transition: 'filter 0.5s linear',
                        opacity: imageLoaded ? 1 : 0
                    }}
                />

                {!imageLoaded && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0' }}>
                        <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--brand-yellow)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    </div>
                )}

                {/* Light Shimmer Effect - Reduced to 50% frequency, Top-to-Bottom */}
                <motion.div
                    key={`shimmer-${pixelSize}`}
                    initial={{ y: '-100%', skewY: -10 }}
                    animate={(pixelSize > 0 && Math.floor(progress * 13) % 2 === 0 && imageLoaded) ? { y: '200%' } : {}}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '50%',
                        background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.3), transparent)',
                        zIndex: 10,
                        pointerEvents: 'none',
                        display: imageLoaded ? 'block' : 'none'
                    }}
                />

                {/* Options Overlay on Image */}
                <div style={{
                    position: 'absolute',
                    bottom: '40px',
                    left: '20px',
                    right: '20px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    zIndex: 20,
                    opacity: imageLoaded ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: (gameStatus === 'pixel_scoring' || selectedAnswer) ? 'none' : 'auto'
                }}>
                    {activeQuestion.options.map((option, idx) => {
                        const isSelected = selectedAnswer === option;
                        const isCorrect = option === (activeQuestion.answer);
                        const showResults = gameStatus === 'pixel_scoring' || (timer === 0);

                        let bgColor = 'rgba(255, 255, 255, 0.15)';
                        let borderColor = 'rgba(255, 255, 255, 0.3)';
                        let textColor = '#fff';
                        let backdropBlur = 'blur(10px)';

                        if (showResults) {
                            if (isCorrect) {
                                bgColor = 'rgba(16, 185, 129, 0.9)';
                                borderColor = '#10b981';
                            } else if (isSelected && !isCorrect) {
                                bgColor = 'rgba(239, 68, 68, 0.9)';
                                borderColor = '#ef4444';
                            }
                        } else if (isSelected) {
                            bgColor = 'rgba(253, 224, 71, 0.9)'; // brand-yellow
                            borderColor = '#fde047';
                            textColor = '#000';
                        }

                        return (
                            <motion.button
                                key={idx}
                                whileTap={!showResults ? { scale: 0.95 } : {}}
                                disabled={!!selectedAnswer || showResults || gameStatus !== 'pixel_active'}
                                onClick={() => handleAnswer(option)}
                                style={{
                                    background: bgColor,
                                    border: `1px solid ${borderColor}`,
                                    color: textColor,
                                    padding: '12px',
                                    borderRadius: '16px',
                                    fontWeight: 900,
                                    fontSize: '14px',
                                    backdropFilter: backdropBlur,
                                    cursor: (showResults || !!selectedAnswer) ? 'default' : 'pointer',
                                    minHeight: '54px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}
                            >
                                {option}
                            </motion.button>
                        );
                    })}
                </div>

                {/* Timer Bar - Absolute centered at bottom */}
                <div style={{
                    position: 'absolute',
                    bottom: '15px',
                    left: '20px',
                    right: '20px',
                    opacity: (imageLoaded && timer > 0) ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    zIndex: 25
                }}>
                    <div style={{
                        height: '6px',
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                        <motion.div
                            initial={{ width: '100%' }}
                            animate={{
                                width: `${Math.max(0, timer / 13) * 100}%`,
                                background: timer > 7 ? '#10b981' : timer > 3 ? '#f59e0b' : '#ef4444'
                            }}
                            transition={{ duration: 1, ease: "linear" }}
                            style={{
                                height: '100%',
                            }}
                        />
                    </div>
                </div>
                <AnimatePresence>
                    {(gameStatus === 'pixel_scoring' || (timer === 0 && gameStatus === 'pixel_active')) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'transparent',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'flex-start',
                                padding: '20px',
                                zIndex: 30,
                                pointerEvents: 'none'
                            }}
                        >
                            <motion.div
                                initial={{ scale: 0.5, x: -20 }}
                                animate={{ scale: 1, x: 0 }}
                                style={{
                                    color: '#fff',
                                    textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                                    background: 'rgba(0,0,0,0.5)',
                                    padding: '8px 16px',
                                    borderRadius: '16px',
                                    backdropFilter: 'blur(4px)'
                                }}
                            >
                                <div style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1 }}>
                                    {myFeedback?.pointsEarned || 0}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>


        </div >
    );
};

export default PixelChallenge;
