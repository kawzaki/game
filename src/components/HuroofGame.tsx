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
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px' }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    style={{ width: '40px', height: '40px', border: '4px solid #f1f5f9', borderTopColor: 'var(--brand-yellow)', borderRadius: '50%' }}
                />
                <div style={{ fontSize: '14px', color: '#64748b' }}>جاري تحميل اللوحة...</div>
            </div>
        );
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

            <div className="huroof-board-view">
                <div className="huroof-honeycomb">
                    {/* Row 0: Top Blue Boundary (Shifted 60px left via CSS) */}
                    <div className="honeycomb-row blue-boundary">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={`top-${i}`} className="huroof-hexagon boundary blue" />
                        ))}
                    </div>

                    {[0, 1, 2, 3, 4].map(rowIndex => (
                        // Standard alternating pattern: index 1 and 3 (rows 2 and 4) are staggered
                        <div key={`row-${rowIndex}`} className={`honeycomb-row ${rowIndex % 2 === 1 ? 'staggered' : ''}`}>
                            {/* Left Red Boundary */}
                            <div className="huroof-hexagon boundary red" />

                            {/* Game Letters */}
                            {huroofGrid.slice(rowIndex * 5, (rowIndex * 5) + 5).map((item: any) => {
                                const tileClass = `huroof-hexagon interactive ${item.ownerTeam ? `occupied ${item.ownerTeam}` : ''}`;
                                return (
                                    <motion.button
                                        whileTap={!item.ownerId && isMyTurn ? { scale: 0.95 } : {}}
                                        key={item.id}
                                        onClick={() => handleLetterClick(item)}
                                        className={tileClass}
                                        data-letter={item.letter}
                                    />
                                );
                            })}

                            {/* Right Red Boundary */}
                            <div className="huroof-hexagon boundary red" />
                        </div>
                    ))}

                    {/* Row 6: Bottom Blue Boundary (Shifted 60px left via CSS) */}
                    <div className="honeycomb-row blue-boundary">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={`bottom-${i}`} className="huroof-hexagon boundary blue" />
                        ))}
                    </div>
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
