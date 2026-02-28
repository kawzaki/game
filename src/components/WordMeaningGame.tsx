import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Check, X } from 'lucide-react';

interface WordMeaningProps {
    roomId: string;
}

const WordMeaningGame: React.FC<WordMeaningProps> = ({ roomId }) => {
    const {
        gameStatus,
        timer,
        activeQuestion,
        submitWordMeaningAnswer,
        currentRound,
        roundCount,
        feedback,
        myId,
        wordMeaningFeedback
    } = useGameStore();

    // Use global feedback directly to determine selected answer
    const myFeed = myId ? wordMeaningFeedback?.[myId] : null;
    const submittedAnswer = myFeed?.answer || null;

    const handleSelectOption = (opt: string) => {
        if (submittedAnswer || gameStatus !== 'word_meaning_active') return;
        submitWordMeaningAnswer(roomId, opt);
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

    if (gameStatus === 'word_meaning_active' || gameStatus === 'word_meaning_scoring') {
        const isScoring = gameStatus === 'word_meaning_scoring';

        return (
            <div className="word-meaning-container" style={{ padding: '10px', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Timer size={20} />
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: timer <= 5 ? '#ef4444' : 'inherit' }}>{timer}s</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>الجولة {currentRound} من {roundCount}</div>
                </div>

                {activeQuestion && (
                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        <div style={{ fontSize: '16px', color: '#64748b', marginBottom: '10px' }}>ما هو معنى كلمة...</div>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{
                                fontSize: '48px',
                                fontWeight: 900,
                                color: '#1e293b',
                                background: '#f8fafc',
                                padding: '30px',
                                borderRadius: '24px',
                                border: '2px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            "{activeQuestion.question}"
                        </motion.div>
                    </div>
                )}

                {activeQuestion && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                        <AnimatePresence>
                            {activeQuestion.options.map((opt: string, idx: number) => {
                                const isSelected = submittedAnswer === opt;
                                const isCorrect = isScoring ? feedback?.answer === opt : (myFeed?.answer === opt && myFeed?.isCorrect);
                                const isWrong = isScoring ? (isSelected && feedback?.answer !== opt) : (myFeed?.answer === opt && !myFeed?.isCorrect);

                                let bgColor = '#ffffff';
                                let borderColor = '#cbd5e1';
                                let textColor = '#1e293b';
                                let itemOpacity = 1;

                                if (isScoring) {
                                    if (isCorrect) {
                                        bgColor = '#ecfdf5';
                                        borderColor = '#10b981';
                                        textColor = '#065f46';
                                    } else if (isWrong) {
                                        bgColor = '#fef2f2';
                                        borderColor = '#ef4444';
                                        textColor = '#991b1b';
                                    } else {
                                        itemOpacity = 0.6;
                                    }
                                } else if (myFeed && myFeed.answer === opt) {
                                    if (isCorrect) {
                                        bgColor = '#ecfdf5';
                                        borderColor = '#10b981';
                                        textColor = '#065f46';
                                    } else if (isWrong) {
                                        bgColor = '#fef2f2';
                                        borderColor = '#ef4444';
                                        textColor = '#991b1b';
                                    }
                                } else if (isSelected) {
                                    bgColor = '#fef3c7';
                                    borderColor = '#f59e0b';
                                }

                                return (
                                    <motion.button
                                        key={idx}
                                        whileTap={!isScoring && !submittedAnswer ? { scale: 0.98 } : {}}
                                        onClick={() => handleSelectOption(opt)}
                                        disabled={!!submittedAnswer || isScoring}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: itemOpacity, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        style={{
                                            padding: '20px',
                                            borderRadius: '16px',
                                            border: `2px solid ${borderColor}`,
                                            background: bgColor,
                                            color: textColor,
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: (submittedAnswer || isScoring) ? 'default' : 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <span>{opt}</span>
                                        {(isScoring && isCorrect) || (!isScoring && myFeed && myFeed.answer === opt && isCorrect) ? <Check size={24} color="#10b981" /> : null}
                                        {(isScoring && isWrong) || (!isScoring && myFeed && myFeed.answer === opt && isWrong) ? <X size={24} color="#ef4444" /> : null}
                                    </motion.button>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {isScoring && feedback && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ marginTop: '30px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: submittedAnswer === feedback.answer ? '#10b981' : '#ef4444' }}
                    >
                        {submittedAnswer === feedback.answer ? `إجابة صحيحة! +${myFeed?.pointsEarned || 50} نقطة` : (submittedAnswer ? 'إجابة خاطئة!' : 'لم يتم اختيار إجابة!')}
                    </motion.div>
                )}
            </div>
        );
    }

    return null;
};

export default WordMeaningGame;
