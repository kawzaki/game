import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Heart, Package, Utensils, Dog, MapPin, Timer, Check, X, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import { playSound } from '../utils/soundUtils';

interface BentOWaladProps {
    roomId: string;
}

const CATEGORIES = [
    { key: 'girl', label: 'بنت', icon: <Heart size={18} /> },
    { key: 'boy', label: 'ولد', icon: <User size={18} /> },
    { key: 'thing', label: 'جماد', icon: <Package size={18} /> },
    { key: 'food', label: 'أكل', icon: <Utensils size={18} /> },
    { key: 'animal', label: 'حيوان', icon: <Dog size={18} /> },
    { key: 'location', label: 'بلاد', icon: <MapPin size={18} /> }
];

const normalizeArabic = (text: string) => {
    if (!text) return "";
    return text.trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u0652]/g, "")
        .toLowerCase();
};

const isCategoryValid = (val: string, letter: string | null) => {
    if (!val || !letter) return false;
    const trimmed = val.trim();
    if (trimmed.length < 2) return false;
    return normalizeArabic(trimmed).startsWith(normalizeArabic(letter));
};

const BentOWalad: React.FC<BentOWaladProps> = ({ roomId }) => {
    const {
        gameStatus,
        timer,
        currentLetter,
        currentRound,
        roundCount,
        submitRoundBinOWalad,
        voteWordBinOWalad,
        confirmBinOWaladReview,
        forceScoreBinOWalad,
        roundResults,
        players,
        myId,
        binOWaladFinisher,
        binOWaladReview,
        binOWaladConfirmedPlayers
    } = useGameStore();

    const [inputs, setInputs] = useState<Record<string, string>>({
        girl: '', boy: '', thing: '', food: '', animal: '', location: ''
    });

    const [hasSubmitted, setHasSubmitted] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const allCategoriesCompleted = CATEGORIES.every(c => isCategoryValid(inputs[c.key], currentLetter));
    const isRoomCreator = players.length > 0 && players[0].id === myId;
    const hasMyConfirmedReview = Boolean(myId && binOWaladConfirmedPlayers && binOWaladConfirmedPlayers.includes(myId));

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (index < CATEGORIES.length - 1) {
                inputRefs.current[index + 1]?.focus();
            } else if (allCategoriesCompleted) {
                handleManualSubmit(true);
            }
        }
    };

    // Reset inputs when a new round starts
    useEffect(() => {
        if (gameStatus === 'round_active') {
            setInputs({ girl: '', boy: '', thing: '', food: '', animal: '', location: '' });
            setHasSubmitted(false);
        }
    }, [gameStatus, currentRound]);

    // Auto-submit partial inputs when timer hits zero
    useEffect(() => {
        if (timer === 0 && gameStatus === 'round_active' && !hasSubmitted) {
            handleManualSubmit(false);
        }
    }, [timer, gameStatus, hasSubmitted]);

    const handleManualSubmit = (isFinal: boolean = true) => {
        if (hasSubmitted && isFinal) return;
        submitRoundBinOWalad(roomId, inputs, isFinal);
        if (isFinal) {
            setHasSubmitted(true);
            playSound('correct');
        }
    };

    // Countdown sound synchronization
    useEffect(() => {
        if (gameStatus === 'countdown' && timer === 3) {
            playSound('countdown');
        }
    }, [gameStatus, timer]);

    // Countdown before round starts
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

    // Active Writing Round
    if (gameStatus === 'round_active') {
        return (
            <div className="bent-o-walad-container" style={{ padding: '10px', maxWidth: '650px', margin: '0 auto' }}>
                {/* Header with timer and round number */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Timer size={20} color={timer <= 7 ? '#ef4444' : 'currentColor'} />
                        <span style={{ fontSize: '26px', fontWeight: 900, color: timer <= 7 ? '#ef4444' : 'inherit' }}>
                            {timer}s
                        </span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', background: '#f1f5f9', padding: '6px 14px', borderRadius: '20px' }}>
                        الجولة {currentRound} من {roundCount}
                    </div>
                </div>

                {/* Finisher Alert Banner */}
                <AnimatePresence>
                    {binOWaladFinisher && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: -10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            style={{
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                color: '#fff',
                                padding: '12px 18px',
                                borderRadius: '16px',
                                marginBottom: '20px',
                                textAlign: 'center',
                                boxShadow: '0 6px 18px rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px'
                            }}
                        >
                            <AlertTriangle size={24} />
                            <div>
                                <div style={{ fontWeight: 900, fontSize: '16px' }}>
                                    أنهى اللاعب «{binOWaladFinisher}»!
                                </div>
                                <div style={{ fontSize: '13px', opacity: 0.95 }}>
                                    متبقي {timer} ثوانٍ فقط للجميع لإنهاء ما كتبوه!
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Target Letter display */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>الحرف المطلوب</div>
                    <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        style={{
                            fontSize: '76px',
                            fontWeight: 900,
                            color: '#1e293b',
                            background: '#f8fafc',
                            width: '110px',
                            height: '110px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto',
                            borderRadius: '24px',
                            border: '2px solid #e2e8f0',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                        }}
                    >
                        {currentLetter}
                    </motion.div>
                </div>

                {/* Input Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                    {CATEGORIES.map((cat, idx) => {
                        const val = inputs[cat.key] || '';
                        const isValid = isCategoryValid(val, currentLetter);
                        const hasTyped = val.trim().length > 0;

                        return (
                            <div
                                key={cat.key}
                                style={{
                                    background: '#fff',
                                    padding: '12px 16px',
                                    borderRadius: '16px',
                                    border: `2px solid ${isValid ? '#10b981' : hasTyped ? '#f59e0b' : '#e2e8f0'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isValid ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none'
                                }}
                            >
                                <div style={{
                                    background: isValid ? '#ecfdf5' : '#f8fafc',
                                    padding: '10px',
                                    borderRadius: '12px',
                                    color: isValid ? '#10b981' : '#3b82f6'
                                }}>
                                    {cat.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>{cat.label}</span>
                                        {hasTyped && (
                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: isValid ? '#10b981' : '#f59e0b' }}>
                                                {isValid ? 'صحيح ✓' : `حرفان فأكثر بحرف ${currentLetter}`}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        ref={(el) => { inputRefs.current[idx] = el; }}
                                        type="text"
                                        disabled={hasSubmitted}
                                        placeholder={`كلمة تبدأ بحرف ${currentLetter}...`}
                                        value={val}
                                        onChange={(e) => setInputs({ ...inputs, [cat.key]: e.target.value })}
                                        onKeyDown={(e) => handleKeyDown(e, idx)}
                                        style={{
                                            width: '100%',
                                            border: 'none',
                                            background: 'transparent',
                                            outline: 'none',
                                            fontSize: '17px',
                                            fontWeight: 'bold',
                                            color: '#0f172a'
                                        }}
                                    />
                                </div>
                                {isValid && (
                                    <div style={{ color: '#10b981' }}>
                                        <Check size={20} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Submit / Finish Button */}
                <button
                    onClick={() => handleManualSubmit(true)}
                    disabled={hasSubmitted || !allCategoriesCompleted}
                    style={{
                        marginTop: '24px',
                        width: '100%',
                        padding: '16px',
                        borderRadius: '16px',
                        background: hasSubmitted
                            ? '#94a3b8'
                            : allCategoriesCompleted
                                ? 'var(--brand-yellow)'
                                : '#e2e8f0',
                        color: hasSubmitted || !allCategoriesCompleted ? '#64748b' : '#000',
                        fontWeight: 900,
                        border: 'none',
                        fontSize: '18px',
                        cursor: (hasSubmitted || !allCategoriesCompleted) ? 'not-allowed' : 'pointer',
                        boxShadow: allCategoriesCompleted && !hasSubmitted ? '0 6px 18px rgba(244, 209, 37, 0.4)' : 'none',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {hasSubmitted
                        ? 'تم الإرسال ✓ بانتظار الوقت'
                        : allCategoriesCompleted
                            ? 'انتهيت! (ستوب 🛑)'
                            : `املأ جميع الخانات بحرف ${currentLetter} للتسليم`}
                </button>
            </div>
        );
    }

    // Phase: Peer Review & Voting on Words
    if (gameStatus === 'round_review') {
        const reviewData = binOWaladReview || {};
        const confirmedCount = (binOWaladConfirmedPlayers || []).length;

        return (
            <div className="bent-o-walad-review" style={{ padding: '10px', maxWidth: '750px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#eff6ff', color: '#1d4ed8', padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
                        <Sparkles size={16} />
                        مرحلة تدقيق واعتماد الكلمات (حرف {currentLetter})
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '4px 0' }}>هل الكلمات صحيحة؟</h2>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                        اضغط على أي كلمة للتبديل بين <strong>مقبولة ✅</strong> و <strong>مرفوضة ❌</strong>
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '18px', fontWeight: 900, color: timer <= 5 ? '#ef4444' : '#1e293b' }}>
                            <Timer size={18} />
                            {timer}s
                        </div>
                        <div style={{ fontSize: '13px', background: '#f1f5f9', padding: '4px 12px', borderRadius: '12px', fontWeight: 'bold' }}>
                            تم الاعتماد: {confirmedCount} / {players.length} لاعبين
                        </div>
                    </div>
                </div>

                {/* Categories Review Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '30px' }}>
                    {CATEGORIES.map(cat => (
                        <div
                            key={cat.key}
                            style={{
                                background: '#fff',
                                borderRadius: '18px',
                                border: '1px solid #e2e8f0',
                                padding: '14px 18px',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                <span style={{ color: '#3b82f6' }}>{cat.icon}</span>
                                <span style={{ fontWeight: 900, fontSize: '16px' }}>{cat.label}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                                {players.map(p => {
                                    const playerWordData = reviewData[p.name]?.[cat.key];
                                    const rawWord = playerWordData?.word || '';
                                    const status = playerWordData?.status || 'rejected';
                                    const isAccepted = status === 'valid';
                                    const isEmpty = !rawWord || rawWord.trim().length === 0;

                                    return (
                                        <div
                                            key={p.id}
                                            style={{
                                                background: isEmpty ? '#f8fafc' : isAccepted ? '#f0fdf4' : '#fef2f2',
                                                border: `1px solid ${isEmpty ? '#e2e8f0' : isAccepted ? '#bbf7d0' : '#fecaca'}`,
                                                borderRadius: '14px',
                                                padding: '10px 14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '8px'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>
                                                    {p.name} {p.id === myId ? '(أنت)' : ''}
                                                </div>
                                                <div style={{ fontSize: '16px', fontWeight: 900, color: isEmpty ? '#94a3b8' : '#0f172a' }}>
                                                    {isEmpty ? '— لم يكتب —' : rawWord}
                                                </div>
                                            </div>

                                            {!isEmpty && (
                                                <button
                                                    onClick={() => {
                                                        const nextStatus = isAccepted ? 'rejected' : 'valid';
                                                        voteWordBinOWalad(roomId, p.name, cat.key, nextStatus);
                                                        playSound('pop');
                                                    }}
                                                    style={{
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        padding: '6px 12px',
                                                        fontWeight: 'bold',
                                                        fontSize: '13px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        background: isAccepted ? '#10b981' : '#ef4444',
                                                        color: '#fff',
                                                        transition: 'transform 0.1s ease',
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                                                    }}
                                                >
                                                    {isAccepted ? (
                                                        <>
                                                            <Check size={14} /> مقبولة
                                                        </>
                                                    ) : (
                                                        <>
                                                            <X size={14} /> مرفوضة
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Action Bar */}
                <div style={{ position: 'sticky', bottom: '16px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', padding: '14px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        onClick={() => {
                            confirmBinOWaladReview(roomId);
                            playSound('correct');
                        }}
                        disabled={hasMyConfirmedReview}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '14px',
                            background: hasMyConfirmedReview ? '#10b981' : 'var(--brand-yellow)',
                            color: hasMyConfirmedReview ? '#fff' : '#000',
                            fontWeight: 900,
                            border: 'none',
                            fontSize: '16px',
                            cursor: hasMyConfirmedReview ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        {hasMyConfirmedReview ? (
                            <>
                                <CheckCircle2 size={18} /> تم اعتماد مراجعتك ✓ (بانتظار الآخرين...)
                            </>
                        ) : (
                            '✅ تأكيد مراجعتي والجاهزية'
                        )}
                    </button>

                    {isRoomCreator && (
                        <button
                            onClick={() => forceScoreBinOWalad(roomId)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '12px',
                                background: 'transparent',
                                color: '#64748b',
                                fontWeight: 'bold',
                                border: '1px dashed #cbd5e1',
                                fontSize: '13px',
                                cursor: 'pointer'
                            }}
                        >
                            ⚡ إنهاء المراجعة واحتساب النتائج فوراً (المضيف)
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Phase: Scoring and Results Display
    if (gameStatus === 'round_scoring') {
        const lastResult = roundResults && roundResults.length > 0 ? roundResults[roundResults.length - 1] : null;
        if (!lastResult) return <div style={{ textAlign: 'center', padding: '40px' }}>جاري حساب النتائج...</div>;

        const categoryResults = lastResult.categoryResults || {};

        return (
            <div style={{ textAlign: 'center', maxWidth: '850px', margin: '0 auto', padding: '10px' }}>
                <h2 style={{ marginBottom: '8px', fontWeight: 900 }}>نتائج الجولة ({lastResult.letter || currentLetter})</h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                    الكلمة الفريدة المقبولة = <strong>10 نقاط</strong> | الكلمة المكررة = <strong>5 نقاط</strong> | المرفوضة = <strong>0</strong>
                </p>

                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '20px', padding: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)', border: '1px solid #e2e8f0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                                <th style={{ padding: '12px', textAlign: 'right' }}>اللاعب</th>
                                {CATEGORIES.map(c => <th key={c.key} style={{ padding: '12px', fontSize: '13px' }}>{c.label}</th>)}
                                <th style={{ padding: '12px' }}>مجموع الجولة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map(p => {
                                const pRoundScore = lastResult.scores ? lastResult.scores[p.id] : 0;
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{p.name}</td>
                                        {CATEGORIES.map(c => {
                                            const item = categoryResults[c.key]?.[p.name];
                                            const word = item ? item.word : (lastResult.submissions?.[p.name]?.[c.key] || '');
                                            const status = item ? item.status : 'rejected';
                                            const score = item ? item.score : 0;

                                            return (
                                                <td key={c.key} style={{ padding: '10px', verticalAlign: 'middle' }}>
                                                    {word ? (
                                                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <span style={{
                                                                fontWeight: 'bold',
                                                                textDecoration: status === 'rejected' ? 'line-through' : 'none',
                                                                color: status === 'rejected' ? '#94a3b8' : '#1e293b'
                                                            }}>
                                                                {word}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '11px',
                                                                fontWeight: 900,
                                                                padding: '2px 6px',
                                                                borderRadius: '8px',
                                                                marginTop: '2px',
                                                                background: score === 10 ? '#dcfce7' : score === 5 ? '#fef3c7' : '#fee2e2',
                                                                color: score === 10 ? '#166534' : score === 5 ? '#92400e' : '#991b1b'
                                                            }}>
                                                                {score === 10 ? '+10 فريدة' : score === 5 ? '+5 مكررة' : '0 مرفوضة'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: '#cbd5e1' }}>—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td style={{ padding: '12px', fontWeight: 900, color: '#10b981', fontSize: '18px' }}>
                                            +{pRoundScore}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: '24px', color: '#64748b', fontSize: '15px', fontWeight: 'bold' }}>
                    سيتم الانتقال للجولة التالية خلال لحظات...
                </div>
            </div>
        );
    }

    return null;
};

export default BentOWalad;
