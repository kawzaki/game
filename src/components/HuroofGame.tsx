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

            <div className="huroof-honeycomb" style={{
                maxWidth: '520px',
                margin: '0 auto',
                padding: '24px 12px',
                background: '#f8fafc',
                borderRadius: '24px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                borderTop: '6px solid #3b82f6',
                borderBottom: '6px solid #3b82f6',
                borderLeft: '6px solid #ef4444',
                borderRight: '6px solid #ef4444',
                position: 'relative',
                overflow: 'visible'
            }}>
                {[0, 1, 2, 3, 4].map(rowIndex => (
                    <div key={rowIndex} className="honeycomb-row">
                        {huroofGrid.slice(rowIndex * 5, (rowIndex * 5) + 5).map((item: any) => {
                            const tileClass = `huroof-hexagon ${item.ownerTeam ? `occupied ${item.ownerTeam}` : ''}`;

                            return (
                                <motion.button
                                    whileHover={!item.ownerId && isMyTurn ? { scale: 1.1 } : {}}
                                    whileTap={!item.ownerId && isMyTurn ? { scale: 0.95 } : {}}
                                    key={item.id}
                                    onClick={() => handleLetterClick(item)}
                                    className={tileClass}
                                >
                                    {item.letter}
                                </motion.button>
                            );
                        })}
                    </div>
                ))}
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
