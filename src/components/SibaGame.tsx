import React, { useState } from 'react';
import { useGameStore, socket } from '../store/useGameStore';
import { motion } from 'framer-motion';

const SibaGame: React.FC = () => {
    const {
        roomId,
        myId,
        players,
        sibaBoard,
        sibaPhase,
        sibaPiecesPlaced,
        sibaTurn,
        gameStatus
    } = useGameStore();

    const [selectedNode, setSelectedNode] = useState<number | null>(null);

    // Node Coords (0-100 scale for SVG viewBox)
    const nodes = [
        { cx: 10, cy: 10 }, { cx: 50, cy: 10 }, { cx: 90, cy: 10 },
        { cx: 10, cy: 50 }, { cx: 50, cy: 50 }, { cx: 90, cy: 50 },
        { cx: 10, cy: 90 }, { cx: 50, cy: 90 }, { cx: 90, cy: 90 },
    ];

    const adjacencies: Record<number, number[]> = {
        0: [1, 3, 4],
        1: [0, 2, 4],
        2: [1, 4, 5],
        3: [0, 4, 6],
        4: [0, 1, 2, 3, 5, 6, 7, 8],
        5: [2, 4, 8],
        6: [3, 4, 7],
        7: [6, 4, 8],
        8: [5, 4, 7]
    };

    const isMyTurn = myId === sibaTurn;
    const myPiecesPlaced = (myId && sibaPiecesPlaced) ? (sibaPiecesPlaced[myId] || 0) : 0;

    const handleNodeClick = (index: number) => {
        if (!isMyTurn || gameStatus === 'game_over') return;

        const owner = sibaBoard?.[index];

        if (sibaPhase === 'placement') {
            if (owner === null) {
                socket.emit('siba_action', { roomId, action: { type: 'place', to: index } });
            }
        } else if (sibaPhase === 'movement') {
            if (owner === myId) {
                // Select our own piece
                setSelectedNode(index === selectedNode ? null : index);
            } else if (owner === null && selectedNode !== null) {
                // Attempt to move to empty spot if adjacent
                if (adjacencies[selectedNode].includes(index)) {
                    socket.emit('siba_action', { roomId, action: { type: 'move', from: selectedNode, to: index } });
                    setSelectedNode(null);
                }
            }
        }
    };

    if (gameStatus === 'lobby') return null;

    const renderPiece = (ownerId: string | null) => {
        if (!ownerId) return null;
        const playerIndex = players.findIndex(p => p.id === ownerId);
        // Player 1 = Gold/Yellow, Player 2 = Blue (or Teams)
        const isP1 = playerIndex === 0;

        return (
            <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                cx="0" cy="0" r="6"
                fill={`url(#grad-${isP1 ? 'p1' : 'p2'})`}
                style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.5))' }}
            />
        );
    };

    return (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ marginBottom: '10px' }}>لعبة الصبة</h2>

            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                {sibaPhase === 'setup' && <div>في انتظار اللاعبين...</div>}

                {sibaPhase !== 'setup' && (
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: isMyTurn ? '#10b981' : '#f59e0b' }}>
                        {gameStatus === 'game_over' ? 'انتهت اللعبة!' : isMyTurn ? 'دورك الآن!' : 'انتظر دور الخصم...'}
                    </div>
                )}

                {sibaPhase === 'placement' && (
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                        مرحلة الوضع: قمت بوضع {myPiecesPlaced} من أصل 3 قطع
                    </div>
                )}
                {sibaPhase === 'movement' && (
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                        مرحلة التحريك: اختر قطعة ثم حركها لمكان فارغ متصل
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '400px' }}>
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: 'auto', background: '#f1f5f9', borderRadius: '12px', padding: '10px', boxShadow: 'inset 0 4px 6px rgba(0,0,0,0.1)' }}>
                    <defs>
                        <radialGradient id="grad-p1" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                            <stop offset="0%" stopColor="#fcd34d" />
                            <stop offset="100%" stopColor="#d97706" />
                        </radialGradient>
                        <radialGradient id="grad-p2" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                            <stop offset="0%" stopColor="#93c5fd" />
                            <stop offset="100%" stopColor="#2563eb" />
                        </radialGradient>
                    </defs>

                    {/* Lines */}
                    <g stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
                        {/* Box */}
                        <line x1="10" y1="10" x2="90" y2="10" />
                        <line x1="10" y1="50" x2="90" y2="50" />
                        <line x1="10" y1="90" x2="90" y2="90" />

                        <line x1="10" y1="10" x2="10" y2="90" />
                        <line x1="50" y1="10" x2="50" y2="90" />
                        <line x1="90" y1="10" x2="90" y2="90" />

                        {/* Diagonals */}
                        <line x1="10" y1="10" x2="90" y2="90" />
                        <line x1="10" y1="90" x2="90" y2="10" />
                    </g>

                    {/* Nodes */}
                    {nodes.map((node, idx) => {
                        const owner = sibaBoard?.[idx];
                        const isSelected = selectedNode === idx;
                        const isAdjacentToSelected = selectedNode !== null && owner === null && adjacencies[selectedNode].includes(idx);

                        return (
                            <g
                                key={idx}
                                transform={`translate(${node.cx}, ${node.cy})`}
                                onClick={() => handleNodeClick(idx)}
                                style={{ cursor: isMyTurn ? 'pointer' : 'default' }}
                            >
                                {/* Invisible larger hit area */}
                                <circle r="12" fill="transparent" />

                                {/* Slot background */}
                                <circle
                                    r="8"
                                    fill={isAdjacentToSelected ? '#bae6fd' : '#e2e8f0'}
                                    stroke={isAdjacentToSelected ? '#38bdf8' : '#cbd5e1'}
                                    strokeWidth="1"
                                />

                                {/* Piece */}
                                {owner && renderPiece(owner)}

                                {/* Selection Outline */}
                                {isSelected && (
                                    <circle r="10" fill="transparent" stroke="#10b981" strokeWidth="2" strokeDasharray="2" />
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '20px', justifyContent: 'center', width: '100%' }}>
                {players.slice(0, 2).map((p, idx) => {
                    const isP1 = idx === 0;
                    const piecesLeft = 3 - ((sibaPiecesPlaced && sibaPiecesPlaced[p.id]) || 0);
                    return (
                        <div key={p.id} style={{ textAlign: 'center', padding: '10px', background: '#fff', borderRadius: '12px', flex: 1, border: sibaTurn === p.id ? `2px solid ${isP1 ? '#f59e0b' : '#3b82f6'}` : '2px solid transparent' }}>
                            <div style={{ fontWeight: 'bold', color: isP1 ? '#d97706' : '#2563eb' }}>{p.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                                النقاط: {p.score}
                            </div>
                            {sibaPhase === 'placement' && (
                                <div style={{ fontSize: '12px', display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '6px' }}>
                                    {Array(piecesLeft).fill(0).map((_, i) => (
                                        <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: isP1 ? '#f59e0b' : '#3b82f6' }} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SibaGame;
