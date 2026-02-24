import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion } from 'framer-motion';

interface HuroofGameProps {
    roomId: string;
}

const HuroofGame: React.FC<HuroofGameProps> = ({ roomId }) => {
    const {
        players,
        myId,
        huroofGrid,
        pickCategory,
        currentPlayerIndex
    } = useGameStore();

    const isMyTurn = players[currentPlayerIndex]?.id === myId;
    const activePlayer = players[currentPlayerIndex];
    const activePlayerName = activePlayer ? `${activePlayer.name} (#${activePlayer.number || currentPlayerIndex + 1})` : '...';

    const handleLetterClick = (item: any) => {
        if (!isMyTurn || item.ownerId !== null) return;
        pickCategory(roomId, item.letter);
    };

    if (!huroofGrid) {
        return <div style={{ textAlign: 'center', padding: '40px' }}>جاري تحميل اللوحة...</div>;
    }

    return (
        <div className="huroof-container">
            <div className={`turn-banner ${isMyTurn ? 'my-turn' : 'their-turn'}`} style={{ marginBottom: '24px', padding: '16px', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', opacity: 0.8, marginBottom: '4px' }}>
                    {isMyTurn ? 'دورك الآن' : 'بانتظار المنافس'}
                </div>
                <div style={{ fontSize: '20px', fontWeight: '900' }}>
                    {isMyTurn ? 'اختر حرفاً للتحدي' : `يقوم ${activePlayerName} بالاختيار...`}
                </div>
            </div>

            <div style={{
                position: 'relative',
                maxWidth: '520px',
                margin: '0 auto',
                padding: '12px',
                borderRadius: '24px',
                background: '#f8fafc',
                borderTop: '6px solid #3b82f6',
                borderBottom: '6px solid #3b82f6',
                borderLeft: '6px solid #ef4444',
                borderRight: '6px solid #ef4444',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}>
                <div className="huroof-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '10px'
                }}>
                    {huroofGrid.map((item: any) => {
                        const tileColor = item.ownerTeam === 'blue' ? '#3b82f6' : item.ownerTeam === 'red' ? '#ef4444' : '#fff';

                        return (
                            <motion.button
                                whileHover={!item.ownerId && isMyTurn ? { scale: 1.05 } : {}}
                                whileTap={!item.ownerId && isMyTurn ? { scale: 0.95 } : {}}
                                key={item.id}
                                onClick={() => handleLetterClick(item)}
                                style={{
                                    aspectRatio: '1/1',
                                    borderRadius: '12px',
                                    background: tileColor,
                                    border: '2px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '24px',
                                    fontWeight: '900',
                                    color: item.ownerTeam ? '#fff' : '#1e293b',
                                    cursor: isMyTurn && !item.ownerId ? 'pointer' : 'default',
                                    boxShadow: item.ownerTeam ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    transition: 'all 0.3s ease',
                                    opacity: !item.ownerId && !isMyTurn ? 0.7 : 1
                                }}
                            >
                                {item.letter}
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            <div style={{ marginTop: '32px', textAlign: 'center', color: '#64748b' }}>
                <p style={{ fontSize: '14px' }}>الأحمر 🔴: هدفك طريق أفقي | الأزرق 🔵: هدفك طريق رأسي</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }} />
                        <span>الفريق الأحمر</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#3b82f6' }} />
                        <span>الفريق الأزرق</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HuroofGame;
