import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, LogOut, Check, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Admin() {
    const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [questions, setQuestions] = useState<any[]>([]);
    const [pixelQuestions, setPixelQuestions] = useState<any[]>([]);
    const [proverbs, setProverbs] = useState<any[]>([]);
    const [wordMeanings, setWordMeanings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'jeopardy' | 'pixel' | 'proverbs' | 'word_meaning'>('jeopardy');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<any>(null);
    const [formData, setFormData] = useState({
        category: '',
        value: 100,
        question: '',
        answer: '',
        options: '', // comma separated
        type: 'completion', // for proverbs
        imageUrl: '',
        series: '', // comma separated emojis
        word: '', // for word meaning
        meaning: '' // for word meaning
    });

    useEffect(() => {
        if (token) {
            fetchQuestions();
            fetchPixelQuestions();
            fetchProverbs();
            fetchWordMeanings();
        }
    }, [token]);

    const fetchWordMeanings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/word-meaning', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                handleLogout();
                return;
            }
            const data = await res.json();
            setWordMeanings(data);
        } catch (e) {
            console.error("Failed to fetch word meanings", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchProverbs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/proverbs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                handleLogout();
                return;
            }
            const data = await res.json();
            setProverbs(data);
        } catch (e) {
            console.error("Failed to fetch proverbs", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchPixelQuestions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/pixel-challenge', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                handleLogout();
                return;
            }
            const data = await res.json();
            setPixelQuestions(data);
        } catch (e) {
            console.error("Failed to fetch pixel questions", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/questions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                handleLogout();
                return;
            }
            const data = await res.json();
            setQuestions(data);
        } catch (e) {
            console.error("Failed to fetch questions", e);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (res.ok) {
                const data = await res.json();
                setToken(data.token);
                localStorage.setItem('adminToken', data.token);
            } else {
                setLoginError('بيانات الدخول غير صحيحة');
            }
        } catch (e) {
            setLoginError('خطأ في الاتصال بالخادم');
        }
    };

    const handleLogout = () => {
        setToken(null);
        localStorage.removeItem('adminToken');
        setQuestions([]);
    };

    const handleAddClick = () => {
        setEditingQuestion(null);
        setFormData({
            category: '',
            value: 100,
            question: '',
            answer: '',
            options: '',
            type: activeTab === 'proverbs' ? 'completion' : '',
            imageUrl: '',
            series: '',
            word: '',
            meaning: ''
        });
        setIsModalOpen(true);
    };

    const handleEditClick = (q: any) => {
        setEditingQuestion(q);
        setFormData({
            category: q.category || '',
            value: q.value || 0,
            question: q.question || '',
            answer: q.answer || '',
            options: q.options ? q.options.join(', ') : '',
            type: q.type || '',
            imageUrl: q.imageUrl || '',
            series: q.series ? q.series.join(', ') : '',
            word: q.word || '',
            meaning: q.meaning || ''
        });
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (id: string, questionText: string) => {
        if (!confirm(`هل أنت متأكد من حذف العنصر:\n"${questionText}"؟`)) return;
        const endpoint = activeTab === 'proverbs' ? 'proverbs' : (activeTab === 'pixel' ? 'pixel-challenge' : (activeTab === 'word_meaning' ? 'word-meaning' : 'questions'));
        try {
            const res = await fetch(`/api/admin/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                if (activeTab === 'proverbs') fetchProverbs();
                else if (activeTab === 'pixel') fetchPixelQuestions();
                else if (activeTab === 'word_meaning') fetchWordMeanings();
                else fetchQuestions();
            }
        } catch (e) {
            console.error("Failed to delete", e);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formDataFile = new FormData();
        formDataFile.append('image', file);

        setIsUploading(true);
        try {
            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formDataFile
            });
            if (res.ok) {
                const data = await res.json();
                setFormData(prev => ({ ...prev, imageUrl: data.url }));
            } else {
                alert('فشل رفع الصورة');
            }
        } catch (e) {
            alert('خطأ في الاتصال أثناء الرفع');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const endpoint = activeTab === 'proverbs' ? 'proverbs' : (activeTab === 'pixel' ? 'pixel-challenge' : (activeTab === 'word_meaning' ? 'word-meaning' : 'questions'));
        const method = editingQuestion ? 'PUT' : 'POST';
        const url = editingQuestion ? `/api/admin/${endpoint}/${editingQuestion.id}` : `/api/admin/${endpoint}`;

        const payload: any = { ...formData };
        
        // Normalize payload based on active tab
        if (activeTab === 'jeopardy' || activeTab === 'pixel') {
            payload.value = Number(formData.value);
            if (formData.options) {
                payload.options = formData.options.split(',').map(s => s.trim()).filter(Boolean);
            }
        } else if (activeTab === 'proverbs') {
            if (formData.options) {
                payload.options = formData.options.split(',').map(s => s.trim()).filter(Boolean);
            }
            if (formData.series) {
                payload.series = formData.series.split(',').map(s => s.trim()).filter(Boolean);
            }
        } else if (activeTab === 'word_meaning') {
            // Word meaning only needs word and meaning
            delete payload.category;
            delete payload.value;
            delete payload.question;
            delete payload.answer;
            delete payload.options;
            delete payload.type;
            delete payload.imageUrl;
            delete payload.series;
        }

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsModalOpen(false);
                if (activeTab === 'proverbs') fetchProverbs();
                else if (activeTab === 'pixel') fetchPixelQuestions();
                else if (activeTab === 'word_meaning') fetchWordMeanings();
                else fetchQuestions();
            } else if (res.status === 401) {
                handleLogout();
            } else {
                alert('فشل في حفظ البيانات');
            }
        } catch (e) {
            console.error("Failed to save", e);
            alert('خطأ في الاتصال أثناء الحفظ');
        }
    };


    if (!token) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ background: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                    <Shield size={48} color="#0f172a" style={{ marginBottom: '20px' }} />
                    <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}>لوحة التحكم</h2>
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>يرجى تسجيل الدخول لإدارة الأسئلة</p>

                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <input
                            type="text"
                            placeholder="اسم المستخدم"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', outline: 'none', background: '#f8fafc', textAlign: 'right' }}
                            dir="rtl"
                            required
                        />
                        <input
                            type="password"
                            placeholder="كلمة المرور"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', outline: 'none', background: '#f8fafc', textAlign: 'right' }}
                            dir="rtl"
                            required
                        />
                        {loginError && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>{loginError}</div>}
                        <button type="submit" style={{ background: '#0f172a', color: '#fff', padding: '14px', borderRadius: '12px', fontWeight: 900, marginTop: '8px', cursor: 'pointer', border: 'none' }}>
                            تسجيل الدخول
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '20px', direction: 'rtl' }}>
            <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Shield size={32} color="#0f172a" />
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>لوحة التحكم المطورة</h1>
                    </div>
                    <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <LogOut size={18} /> تسجيل خروج
                    </button>
                </div>

                <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 10px' }}>
                        {[
                            { id: 'jeopardy', label: 'تحدي الأسئلة' },
                            { id: 'pixel', label: 'تحدي الصور' },
                            { id: 'proverbs', label: 'تحدي الأمثال' },
                            { id: 'word_meaning', label: 'تحدي المعاني' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                style={{
                                    padding: '16px 24px',
                                    border: 'none',
                                    background: 'none',
                                    borderBottom: activeTab === tab.id ? '3px solid #0f172a' : '3px solid transparent',
                                    fontWeight: 900,
                                    color: activeTab === tab.id ? '#0f172a' : '#64748b',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
                             <div style={{ position: 'relative', flex: '1', minWidth: '300px' }}>
                                <Search size={20} color="#94a3b8" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    placeholder="بحث في البيانات المتاحة..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ width: '100%', padding: '12px 48px 12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: '#f8fafc', focus: 'border-color: #0f172a', textAlign: 'right' } as any}
                                />
                            </div>
                            <button 
                                onClick={handleAddClick} 
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: '#10b981', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)' }}
                            >
                                <Plus size={20} /> إضافة جديد
                            </button>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} style={{ display: 'inline-block', marginBottom: '12px' }}>
                                    <Shield size={32} />
                                </motion.div>
                                <p style={{ fontWeight: 'bold' }}>جاري تحميل البيانات...</p>
                            </div>
                        ) : activeTab === 'jeopardy' ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc' }}>
                                            <th style={{ padding: '16px', color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>الفئة</th>
                                            <th style={{ padding: '16px', color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>النقاط</th>
                                            <th style={{ padding: '16px', color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>السؤال</th>
                                            <th style={{ padding: '16px', color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>الإجابة</th>
                                            <th style={{ padding: '16px', color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {questions.filter(q => q.question?.includes(searchTerm) || q.category?.includes(searchTerm)).map((q) => (
                                            <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '16px' }}><span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>{q.category}</span></td>
                                                <td style={{ padding: '16px', fontWeight: 'bold' }}>{q.value}</td>
                                                <td style={{ padding: '16px', maxWidth: '300px' }}>{q.question}</td>
                                                <td style={{ padding: '16px', color: '#10b981', fontWeight: 'bold' }}>{q.answer}</td>
                                                <td style={{ padding: '16px' }}>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button onClick={() => handleEditClick(q)} style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={18} /></button>
                                                        <button onClick={() => handleDeleteClick(q.id, q.question)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : activeTab === 'pixel' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                                {pixelQuestions.filter(q => q.question?.includes(searchTerm) || q.answer?.includes(searchTerm)).map((q) => (
                                    <div key={q.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
                                            <img src={q.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                            <div style={{ position: 'absolute', bottom: '12px', right: '12px', background: '#10b981', color: '#fff', padding: '4px 12px', borderRadius: '8px', fontWeight: 900, fontSize: '12px' }}>{q.answer}</div>
                                        </div>
                                        <div style={{ padding: '16px' }}>
                                            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 900 }}>{q.question}</h4>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleEditClick(q)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>تعديل</button>
                                                <button onClick={() => handleDeleteClick(q.id, q.question)} style={{ padding: '8px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : activeTab === 'proverbs' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                                {proverbs.filter(p => p.question?.includes(searchTerm) || p.answer?.includes(searchTerm)).map((p) => (
                                    <div key={p.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                        {p.imageUrl && <img src={p.imageUrl} style={{ width: '100%', height: '160px', objectFit: 'cover' }} alt="" />}
                                        <div style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>{p.type}</span>
                                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{p.category}</span>
                                            </div>
                                            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 900 }}>{p.question}</h4>
                                            <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '13px', marginBottom: '16px' }}>{p.answer}</div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleEditClick(p)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>تعديل</button>
                                                <button onClick={() => handleDeleteClick(p.id, p.question)} style={{ padding: '8px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc' }}>
                                            <th style={{ padding: '16px', color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>الكلمة</th>
                                            <th style={{ padding: '16px', color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>المعنى</th>
                                            <th style={{ padding: '16px', color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {wordMeanings.filter(w => w.word?.includes(searchTerm) || w.meaning?.includes(searchTerm)).map((w) => (
                                            <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '16px', fontWeight: 900, fontSize: '18px' }}>{w.word}</td>
                                                <td style={{ padding: '16px', color: '#475569' }}>{w.meaning}</td>
                                                <td style={{ padding: '16px' }}>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button onClick={() => handleEditClick(w)} style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={18} /></button>
                                                        <button onClick={() => handleDeleteClick(w.id, w.word)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                            animate={{ opacity: 1, scale: 1, y: 0 }} 
                            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
                            style={{ background: '#fff', width: '100%', maxWidth: '600px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                        >
                            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>{editingQuestion ? 'تعديل البيانات' : 'إضافة جديد'}</h3>
                                <button onClick={() => setIsModalOpen(false)} style={{ background: '#f8fafc', border: 'none', cursor: 'pointer', color: '#64748b', padding: '8px', borderRadius: '50%' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <form 
                                onSubmit={handleSave} 
                                style={{ 
                                    padding: '24px', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '20px',
                                    maxHeight: '75vh',
                                    overflowY: 'auto',
                                    paddingRight: '12px'
                                }}
                            >
                                {activeTab === 'word_meaning' ? (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 900, color: '#475569' }}>الكلمة</label>
                                            <input type="text" value={formData.word} onChange={e => setFormData({ ...formData, word: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '16px' }} required dir="rtl" />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 900, color: '#475569' }}>المعنى</label>
                                            <textarea value={formData.meaning} onChange={e => setFormData({ ...formData, meaning: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', minHeight: '120px', resize: 'vertical', fontSize: '16px' }} required dir="rtl" />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 900, color: '#475569' }}>القسم / الحرف</label>
                                                <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} required={activeTab === 'jeopardy'} dir="rtl" />
                                            </div>
                                            <div style={{ width: '120px' }}>
                                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 900, color: '#475569' }}>النقاط</label>
                                                <input type="number" value={formData.value} onChange={e => setFormData({ ...formData, value: Number(e.target.value) })} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} required={activeTab === 'jeopardy'} />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 900, color: '#475569' }}>السؤال</label>
                                            <textarea value={formData.question} onChange={e => setFormData({ ...formData, question: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', minHeight: '80px', resize: 'vertical' }} required dir="rtl" />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 900, color: '#475569' }}>الإجابة الصحيحة</label>
                                            <input type="text" value={formData.answer} onChange={e => setFormData({ ...formData, answer: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} required dir="rtl" />
                                        </div>

                                        {activeTab === 'proverbs' && (
                                            <>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 900, color: '#475569' }}>نوع التحدي</label>
                                                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', background: '#fff' }}>
                                                        <option value="completion">إكمال المثل</option>
                                                        <option value="illustration">تخمين المثل من الصورة</option>
                                                        <option value="context">متى يقال هذا المثل؟</option>
                                                        <option value="series">سلسلة الرموز</option>
                                                    </select>
                                                </div>
                                                {formData.type === 'series' && (
                                                    <div>
                                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 900, color: '#475569' }}>سلسلة الرموز (مفصولة بفاصلة)</label>
                                                        <input type="text" value={formData.series} onChange={e => setFormData({ ...formData, series: e.target.value })} placeholder="🍎, 🍌, 🍒" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {(activeTab === 'pixel' || (activeTab === 'proverbs' && formData.type === 'illustration')) && (
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 900, color: '#475569' }}>الصورة</label>
                                                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                                    <input type="text" value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="رابط الصورة مباشر..." style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} />
                                                    <label style={{ padding: '12px 20px', borderRadius: '12px', background: '#0f172a', color: '#fff', fontSize: '14px', fontWeight: 900, cursor: isUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                        {isUploading ? 'جاري الرفع...' : <><Plus size={18} /> رفع</>}
                                                        <input type="file" onChange={handleFileUpload} accept="image/*" style={{ display: 'none' }} disabled={isUploading} />
                                                    </label>
                                                </div>
                                                {formData.imageUrl && (
                                                    <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                        <img src={formData.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8fafc' }} />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 900, color: '#475569' }}>الخيارات (اختياري - مفصولة بفاصلة)</label>
                                            <input type="text" value={formData.options} onChange={e => setFormData({ ...formData, options: e.target.value })} placeholder="خيار 1، خيار 2، خيار 3..." style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }} dir="rtl" />
                                        </div>
                                    </>
                                )}

                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px', marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 900, cursor: 'pointer' }}>إلغاء</button>
                                    <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 32px', borderRadius: '12px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)' }}>
                                        <Check size={20} /> حفظ التغييرات
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
