import React, { useEffect } from 'react';
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
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <motion.div
                    key={timer}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    className="text-[120px] font-black text-amber-500"
                >
                    {timer}
                </motion.div>
                <div className="text-2xl font-bold mt-8 text-slate-700">أمثال وحكم... استعد!</div>
            </div>
        );
    }

    if (gameStatus === 'proverbs_active' || gameStatus === 'proverbs_scoring') {
        const isScoring = gameStatus === 'proverbs_scoring';
        const qType = activeQuestion?.type || 'completion';

        return (
            <div className="proverbs-container max-w-2xl mx-auto p-4 rtl">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3 bg-white/80 backdrop-blur px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
                        <Timer size={24} className={timer <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-500'} />
                        <span className={`text-3xl font-black ${timer <= 5 ? 'text-red-500' : 'text-slate-700'}`}>{timer}s</span>
                    </div>
                    <div className="flex items-center gap-3 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
                        <span className="text-lg font-bold text-amber-700">الجولة {currentRound} / {roundCount}</span>
                    </div>
                </div>

                {activeQuestion && (
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 mb-8 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            {getCategoryIcon(qType)}
                        </div>
                        
                        <div className="flex items-center gap-2 mb-4">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">
                                {getCategoryLabel(qType)}
                            </span>
                        </div>

                        {qType === 'illustration' && activeQuestion.imageUrl && (
                            <div className="mb-6 rounded-2xl overflow-hidden border-4 border-slate-50 shadow-inner">
                                <motion.img 
                                    initial={{ filter: 'blur(10px)', scale: 1.1 }}
                                    animate={{ filter: 'blur(0px)', scale: 1 }}
                                    src={activeQuestion.imageUrl} 
                                    alt="Proverb Illustration" 
                                    className="w-full h-auto object-cover max-h-[300px]"
                                />
                            </div>
                        )}

                        {qType === 'series' && (activeQuestion as any).series && (
                            <div className="mb-6 flex justify-center gap-4 py-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                                {(activeQuestion as any).series.map((emoji: string, idx: number) => (
                                    <motion.span 
                                        key={idx}
                                        initial={{ scale: 0, rotate: -20 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ delay: idx * 0.15, type: 'spring' }}
                                        className="text-6xl"
                                    >
                                        {emoji}
                                    </motion.span>
                                ))}
                            </div>
                        )}

                        <div className="text-center">
                            {qType === 'context' && (
                                <p className="text-lg text-slate-500 mb-4 italic leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    "{activeQuestion.question}"
                                </p>
                            )}
                            <h2 className={`font-black text-slate-800 leading-tight ${qType === 'context' ? 'text-2xl' : 'text-3xl lg:text-4xl'}`}>
                                {qType === 'context' ? 'ما هو المثل المناسب لهذا الموقف؟' : 
                                 qType === 'illustration' ? 'ما هو المثل الذي تعبر عنه هذه الرسمة؟' : 
                                 activeQuestion.question}
                            </h2>
                        </div>
                    </motion.div>
                )}

                {activeQuestion && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AnimatePresence>
                            {activeQuestion.options.map((opt: string, idx: number) => {
                                const isSelected = submittedAnswer === opt;
                                const isCorrect = isScoring ? feedback?.answer === opt : (myFeed?.answer === opt && myFeed?.isCorrect);
                                const isWrong = isScoring ? (isSelected && feedback?.answer !== opt) : (myFeed?.answer === opt && !myFeed?.isCorrect);

                                return (
                                    <motion.button
                                        key={idx}
                                        whileHover={!isScoring && !submittedAnswer ? { scale: 1.02, translateY: -2 } : {}}
                                        whileTap={!isScoring && !submittedAnswer ? { scale: 0.98 } : {}}
                                        onClick={() => handleSelectOption(opt)}
                                        disabled={!!submittedAnswer || isScoring}
                                        initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className={`
                                            relative p-6 rounded-2xl text-right transition-all duration-300 border-2 text-lg font-bold flex justify-between items-center group
                                            ${isScoring && isCorrect ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-emerald-100' : 
                                              isScoring && isWrong ? 'bg-red-50 border-red-500 text-red-700 shadow-red-100' :
                                              isSelected ? 'bg-amber-50 border-amber-500 text-amber-700 ring-4 ring-amber-100' :
                                              isScoring ? 'opacity-40 grayscale-[0.5] border-slate-200 bg-slate-50' :
                                              'bg-white border-slate-200 hover:border-amber-300 hover:shadow-lg text-slate-700'}
                                        `}
                                    >
                                        <span className="leading-snug">{opt}</span>
                                        <div className="flex-shrink-0 ml-2">
                                            {((isScoring && isCorrect) || (!isScoring && myFeed && myFeed.answer === opt && isCorrect)) && 
                                                <div className="bg-emerald-500 rounded-full p-1"><Check size={18} className="text-white" /></div>}
                                            {((isScoring && isWrong) || (!isScoring && myFeed && myFeed.answer === opt && isWrong)) && 
                                                <div className="bg-red-500 rounded-full p-1"><X size={18} className="text-white" /></div>}
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
                            className="mt-8 text-center"
                        >
                            <div className={`
                                inline-block px-8 py-4 rounded-full text-xl font-black shadow-lg
                                ${submittedAnswer === feedback.answer ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}
                            `}>
                                {submittedAnswer === feedback.answer ? 
                                    `بطل! +${myFeed?.pointsEarned || 50} نقطة` : 
                                    (submittedAnswer ? 'للأسف، إجابة غير دقيقة' : 'انتهى الوقت!')}
                            </div>
                            
                            {submittedAnswer !== feedback.answer && (
                                <div className="mt-4 text-slate-500 font-bold">
                                    الإجابة الصحيحة: <span className="text-emerald-600">{feedback.answer}</span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    if (gameStatus === 'proverbs_active' && !activeQuestion) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-16 h-16 border-4 border-slate-200 border-t-amber-500 rounded-full"
                />
                <div className="text-xl font-bold text-slate-500 animate-pulse">جاري تحميل المحتوى...</div>
            </div>
        );
    }

    return null;
};

export default ProverbsGame;
