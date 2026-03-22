import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Check, X, BookOpen, Image as ImageIcon, MessageSquare, Zap } from 'lucide-react';
import { playSound } from '../utils/soundUtils';

interface ProverbsGameProps {
    roomId: string;
}

const ProverbsGame: React.FC<ProverbsGameProps> = ({ roomId }) => {
    const {
        gameStatus,
        timer,
        activeQuestion,
        submitProverbsAnswer,
        currentRound,
        roundCount,
        feedback,
        myId,
        wordMeaningFeedback
    } = useGameStore();

    const myFeed = myId ? wordMeaningFeedback?.[myId] : null;
    const submittedAnswer = myFeed?.answer || null;
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleSelectOption = (opt: string) => {
        if (submittedAnswer || gameStatus !== 'proverbs_active') return;
        submitProverbsAnswer(roomId, opt);
        playSound('buzzer');
    };

    useEffect(() => {
        if (gameStatus === 'countdown' && timer === 3) {
            playSound('countdown');
        }
    }, [gameStatus, timer]);

    const getCategoryIcon = (type: string) => {
        switch (type) {
            case 'illustration': return <ImageIcon className="text-blue-500" />;
            case 'context': return <MessageSquare className="text-purple-500" />;
            case 'series': return <Zap className="text-amber-500" />;
            default: return <BookOpen className="text-amber-500" />;
        }
    };

    const getCategoryLabel = (type: string) => {
        switch (type) {
            case 'illustration': return 'خمن من الرسم';
            case 'context': return 'متى يقال؟';
            case 'series': return 'خمن من الرموز';
            default: return 'أكمل المثل';
        }
    };

    if (gameStatus === 'countdown') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <motion.div
                    key={timer}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    style={{ fontSize: '120px', fontWeight: 900, color: '#f59e0b' }}
                >
                    {timer}
                </motion.div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '32px', color: '#334155' }}>أمثال وحكم... استعد!</div>
            </div>
        );
    }

    if (gameStatus === 'proverbs_active' && !activeQuestion) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    style={{ width: '64px', height: '64px', border: '4px solid #e2e8f0', borderTop: '4px solid #f59e0b', borderRadius: '50%' }}
                />
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#64748b' }}>جاري تحميل المحتوى...</div>
            </div>
        );
    }

    if (gameStatus === 'proverbs_active' || gameStatus === 'proverbs_scoring') {
        const isScoring = gameStatus === 'proverbs_scoring';
        const qType = activeQuestion?.type || 'completion';

        return (
            <div style={{ maxWidth: '700px', margin: '0 auto', padding: isMobile ? '8px' : '16px', direction: 'rtl' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '16px' : '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)', padding: '8px 16px', borderRadius: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                        <Timer size={24} color={timer <= 5 ? '#ef4444' : '#64748b'} className={timer <= 5 ? 'animate-pulse' : ''} />
                        <span style={{ fontSize: '30px', fontWeight: 900, color: timer <= 5 ? '#ef4444' : '#334155' }}>{timer}s</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#fffbeb', padding: '8px 16px', borderRadius: '16px', border: '1px solid #fef3c7' }}>
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#b45309' }}>الجولة {currentRound} / {roundCount}</span>
                    </div>
                </div>

                {activeQuestion && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        style={{ background: '#fff', borderRadius: isMobile ? '20px' : '32px', padding: isMobile ? '24px' : '32px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9', marginBottom: isMobile ? '24px' : '32px', position: 'relative', overflow: 'hidden' }}
                    >
                        <div style={{ position: 'absolute', top: 0, right: 0, padding: '16px', opacity: 0.1 }}>
                            {getCategoryIcon(qType)}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <span style={{ padding: '4px 12px', background: '#f1f5f9', color: '#475569', borderRadius: '9999px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {getCategoryLabel(qType)}
                            </span>
                        </div>

                        {qType === 'illustration' && activeQuestion.imageUrl && (
                            <div style={{ marginBottom: '24px', borderRadius: '16px', overflow: 'hidden', border: '4px solid #f8fafc', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)' }}>
                                <motion.img
                                    initial={{ filter: 'blur(10px)', scale: 1.1 }}
                                    animate={{ filter: 'blur(0px)', scale: 1 }}
                                    src={activeQuestion.imageUrl}
                                    alt="Proverb Illustration"
                                    style={{ width: '100%', height: 'auto', objectFit: 'cover', maxHeight: '300px' }}
                                />
                            </div>
                        )}

                        {qType === 'series' && (activeQuestion as any).series && (
                            <div style={{ marginBottom: isMobile ? '16px' : '24px', display: 'flex', justifyContent: 'center', gap: isMobile ? '8px' : '16px', padding: isMobile ? '16px 0' : '24px 0', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                {(activeQuestion as any).series.map((emoji: string, idx: number) => (
                                    <motion.span
                                        key={idx}
                                        initial={{ scale: 0, rotate: -20 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ delay: idx * 0.15, type: 'spring' }}
                                        style={{ fontSize: isMobile ? '40px' : '60px' }}
                                    >
                                        {emoji}
                                    </motion.span>
                                ))}
                            </div>
                        )}

                        <div style={{ textAlign: 'center' }}>
                            {qType === 'context' && (
                                <p style={{ fontSize: isMobile ? '16px' : '18px', color: '#64748b', marginBottom: isMobile ? '12px' : '16px', fontStyle: 'italic', lineHeight: 1.6, background: '#f8fafc', padding: isMobile ? '12px' : '16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                    {activeQuestion.question}
                                </p>
                            )}
                            <h2 style={{ fontWeight: 900, color: '#1e293b', lineHeight: 1.2, fontSize: isMobile ? '22px' : (qType === 'context' ? '28px' : '32px'), marginBottom: isMobile ? '16px' : '0' }}>
                                {(activeQuestion as any).proverb || 
                                 (qType === 'context' ? 'ما هو المثل المناسب لهذا الموقف؟' : 
                                  qType === 'illustration' ? 'ما هو المثل الذي تعبر عنه هذه الرسمة؟' : 
                                  activeQuestion.question)}
                            </h2>
                        </div>
                    </motion.div>
                )}

                {activeQuestion && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                        <AnimatePresence>
                            {(activeQuestion.options || []).map((opt: string, idx: number) => {
                                const isSelected = submittedAnswer === opt;
                                const isCorrect = isScoring ? feedback?.answer === opt : (myFeed?.answer === opt && myFeed?.isCorrect);
                                const isWrong = isScoring ? (isSelected && feedback?.answer !== opt) : (myFeed?.answer === opt && !myFeed?.isCorrect);

                                let bgColor = '#fff';
                                let borderColor = '#e2e8f0';
                                let textColor = '#334155';
                                let shadow = 'none';

                                if (isScoring && isCorrect) {
                                    bgColor = '#ecfdf5';
                                    borderColor = '#10b981';
                                    textColor = '#065f46';
                                    shadow = '0 10px 15px -3px rgba(16, 185, 129, 0.1)';
                                } else if (isScoring && isWrong) {
                                    bgColor = '#fef2f2';
                                    borderColor = '#ef4444';
                                    textColor = '#991b1b';
                                    shadow = '0 10px 15px -3px rgba(239, 68, 68, 0.1)';
                                } else if (isSelected) {
                                    bgColor = '#fffbeb';
                                    borderColor = '#f59e0b';
                                    textColor = '#92400e';
                                    shadow = '0 0 0 4px rgba(245, 158, 11, 0.1)';
                                } else if (isScoring) {
                                    bgColor = '#f8fafc';
                                    borderColor = '#e2e8f0';
                                    textColor = '#94a3b8';
                                }

                                return (
                                    <motion.button
                                        key={idx}
                                        whileHover={!isScoring && !submittedAnswer ? { scale: 1.01, translateY: -2 } : {}}
                                        whileTap={!isScoring && !submittedAnswer ? { scale: 0.99 } : {}}
                                        onClick={() => handleSelectOption(opt)}
                                        disabled={!!submittedAnswer || isScoring}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        style={{
                                            position: 'relative',
                                            padding: isMobile ? '12px 16px' : '20px',
                                            borderRadius: '16px',
                                            textAlign: 'right',
                                            transition: 'all 0.3s ease',
                                            border: `2px solid ${borderColor}`,
                                            background: bgColor,
                                            color: textColor,
                                            fontSize: isMobile ? '15px' : '18px',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: (isScoring || !!submittedAnswer) ? 'default' : 'pointer',
                                            boxShadow: shadow,
                                            width: '100%',
                                            outline: 'none'
                                        }}
                                    >
                                        <span style={{ lineHeight: 1.4 }}>{opt}</span>
                                        <div style={{ flexShrink: 0, marginRight: '8px' }}>
                                            {((isScoring && isCorrect) || (!isScoring && myFeed && myFeed.answer === opt && isCorrect)) &&
                                                <div style={{ background: '#10b981', borderRadius: '50%', padding: '4px', display: 'flex' }}><Check size={18} color="white" /></div>}
                                            {((isScoring && isWrong) || (!isScoring && myFeed && myFeed.answer === opt && isWrong)) &&
                                                <div style={{ background: '#ef4444', borderRadius: '50%', padding: '4px', display: 'flex' }}><X size={18} color="white" /></div>}
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}

                <AnimatePresence>
                    {isScoring && feedback && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            style={{ marginTop: isMobile ? '16px' : '32px', textAlign: 'center' }}
                        >
                            <div style={{
                                display: 'inline-block',
                                padding: isMobile ? '12px 24px' : '16px 32px',
                                borderRadius: '9999px',
                                fontSize: isMobile ? '16px' : '20px',
                                fontWeight: 900,
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                background: submittedAnswer === feedback.answer ? '#10b981' : '#ef4444',
                                color: '#fff'
                            }}>
                                {submittedAnswer === feedback.answer ?
                                    `بطل! +${myFeed?.pointsEarned || 50} نقطة` :
                                    (submittedAnswer ? 'للأسف، إجابة غير دقيقة' : 'انتهى الوقت!')}
                            </div>

                            {submittedAnswer !== feedback.answer && (
                                <div style={{ marginTop: '16px', color: '#64748b', fontWeight: 'bold' }}>
                                    الإجابة الصحيحة: <span style={{ color: '#059669' }}>{feedback.answer}</span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return null;
};

export default ProverbsGame;
