import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion } from 'framer-motion';
import { User, Heart, Package, Utensils, Dog, MapPin, Timer } from 'lucide-react';

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

const BentOWalad: React.FC<BentOWaladProps> = ({ roomId }) => {
    const {
        gameStatus,
        timer,
        currentLetter,
        currentRound,
        roundCount,
        submitRoundBinOWalad,
        roundResults,
        players
    } = useGameStore();

    const [inputs, setInputs] = useState<Record<string, string>>({
        girl: '', boy: '', thing: '', food: '', animal: '', location: ''
    });

    const [hasSubmitted, setHasSubmitted] = useState(false);

    // Reset inputs when a new round starts
    useEffect(() => {
        if (gameStatus === 'round_active') {
            setInputs({ girl: '', boy: '', thing: '', food: '', animal: '', location: '' });
            setHasSubmitted(false);
        }
    }, [gameStatus, currentRound]);

    // Auto-submit when timer hits zero
    useEffect(() => {
        if (timer === 0 && gameStatus === 'round_active' && !hasSubmitted) {
            handleManualSubmit();
        }
    }, [timer, gameStatus, hasSubmitted]);

    const handleManualSubmit = () => {
        if (hasSubmitted) return;
        submitRoundBinOWalad(roomId, inputs);
        setHasSubmitted(true);
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

    if (gameStatus === 'round_active') {
        return (
            <div className="bent-o-walad-container" style={{ padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Timer size={20} />
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: timer <= 10 ? '#ef4444' : 'inherit' }}>{timer}s</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>الجولة {currentRound} من {roundCount}</div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>الحرف الحالي</div>
                    <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        style={{ fontSize: '80px', fontWeight: 900, color: '#1e293b', background: '#f1f5f9', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', borderRadius: '24px' }}
                    >
                        {currentLetter}
                    </motion.div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                    {CATEGORIES.map(cat => (
                        <div key={cat.key} style={{ background: '#fff', padding: '12px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '12px', color: '#3b82f6' }}>{cat.icon}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{cat.label}</div>
                                <input
                                    type="text"
                                    disabled={hasSubmitted}
                                    placeholder={`بداية بحرف ${currentLetter}...`}
                                    value={inputs[cat.key]}
                                    onChange={(e) => setInputs({ ...inputs, [cat.key]: e.target.value })}
                                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '16px', fontWeight: 'bold' }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleManualSubmit}
                    disabled={hasSubmitted}
                    style={{ marginTop: '30px', width: '100%', padding: '16px', borderRadius: '16px', background: hasSubmitted ? '#94a3b8' : 'var(--brand-yellow)', color: '#000', fontWeight: 'bold', border: 'none', fontSize: '18px', cursor: 'pointer' }}
                >
                    {hasSubmitted ? 'تم الإرسال ✓' : 'انتهيت!'}
                </button>
            </div>
        );
    }

    if (gameStatus === 'round_scoring') {
        const lastResult = roundResults[roundResults.length - 1];
        return (
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ marginBottom: '20px' }}>نتائج الجولة ({currentLetter})</h2>
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '20px', padding: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                <th style={{ padding: '12px', textAlign: 'right' }}>اللاعب</th>
                                {CATEGORIES.map(c => <th key={c.key} style={{ padding: '12px', fontSize: '12px' }}>{c.label}</th>)}
                                <th style={{ padding: '12px' }}>المجموع</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map(p => {
                                const pSub = lastResult?.submissions[p.id] || {};
                                const pRoundScore = lastResult?.scores[p.id] || 0;
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{p.name}</td>
                                        {CATEGORIES.map(c => (
                                            <td key={c.key} style={{ padding: '12px', fontSize: '14px' }}>
                                                {pSub[c.key] || '-'}
                                            </td>
                                        ))}
                                        <td style={{ padding: '12px', fontWeight: '900', color: '#10b981' }}>+{pRoundScore}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: '20px', color: '#64748b' }}>سيتم بدء الجولة التالية خلال لحظات...</div>
            </div>
        );
    }

    return null;
};

export default BentOWalad;
