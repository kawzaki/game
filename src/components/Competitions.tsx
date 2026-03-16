import React, { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Users, Layout, Type, BookOpen, Pencil, Image as ImageIcon, Zap, Trophy, Play } from 'lucide-react';
import { motion } from 'framer-motion';

const Competitions: React.FC = () => {
    const { activeRooms, fetchActiveRooms, setRoomId, roomDataLoading } = useGameStore();

    useEffect(() => {
        fetchActiveRooms();
    }, [fetchActiveRooms]);

    const getGameIcon = (type: string) => {
        switch (type) {
            case 'jeopardy': return <Layout size={20} />;
            case 'huroof': return <Type size={20} />;
            case 'bin_o_walad': return <Zap size={20} />;
            case 'word_meaning': return <BookOpen size={20} />;
            case 'siba': return <Layout size={20} />;
            case 'pixel_challenge': return <ImageIcon size={20} />;
            case 'drawing_challenge': return <Pencil size={20} />;
            default: return <Trophy size={20} />;
        }
    };

    const getGameName = (type: string) => {
        switch (type) {
            case 'jeopardy': return 'تحدي الأسئلة';
            case 'huroof': return 'لعبة الحروف';
            case 'bin_o_walad': return 'بنت وولد';
            case 'word_meaning': return 'معاني الكلمات';
            case 'siba': return 'لعبة الصبة';
            case 'pixel_challenge': return 'تحدي الصور';
            case 'drawing_challenge': return 'تحدي الرسم';
            default: return 'لعبة مجهولة';
        }
    };

    return (
        <div className="competitions-container" style={{ padding: '0 16px 20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={28} color="var(--brand-yellow)" fill="var(--brand-yellow)" />
                المنافسات المباشرة
            </h2>

            {roomDataLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '40px' }}>
                    <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--brand-yellow)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <span style={{ color: '#64748b' }}>جاري البحث عن غرف...</span>
                </div>
            ) : activeRooms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '24px', border: '1px dashed #e2e8f0' }}>
                    <Trophy size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
                    <p style={{ color: '#475569', fontSize: '16px', fontWeight: 'bold' }}>لا توجد غرف نشطة حالياً</p>
                    <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>كن أول من ينشئ غرفة ويدعو الأصدقاء!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeRooms.map((room) => (
                        <motion.div
                            key={room.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setRoomId(room.id)}
                            style={{
                                background: 'white',
                                padding: '16px',
                                borderRadius: '20px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                border: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ 
                                    background: 'var(--brand-yellow)', 
                                    color: '#000',
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {getGameIcon(room.gameType)}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 900, fontSize: '16px' }}>{getGameName(room.gameType)}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#64748b' }}>
                                        <Users size={14} />
                                        <span>بواسطة: {room.creatorName}</span>
                                        <span style={{ margin: '0 4px' }}>•</span>
                                        <span>{room.playerCount} لاعبين</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ background: '#f0f9ff', color: '#0369a1', padding: '8px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>دخول</span>
                                <Play size={14} fill="currentColor" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
            
            <button 
                onClick={() => fetchActiveRooms()}
                style={{ 
                    marginTop: '24px', 
                    width: '100%', 
                    padding: '12px', 
                    background: '#f1f5f9', 
                    border: 'none', 
                    borderRadius: '16px', 
                    color: '#475569', 
                    fontWeight: 'bold',
                    fontSize: '14px',
                    cursor: 'pointer'
                }}
            >
                تحديث القائمة
            </button>
        </div>
    );
};

export default Competitions;
