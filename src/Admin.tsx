import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, LogOut, Check, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Admin() {
    const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<any>(null);
    const [formData, setFormData] = useState({
        category: '',
        value: 100,
        question: '',
        answer: '',
        options: '' // comma separated
    });

    useEffect(() => {
        if (token) {
            fetchQuestions();
        }
    }, [token]);

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
        setFormData({ category: '', value: 100, question: '', answer: '', options: '' });
        setIsModalOpen(true);
    };

    const handleEditClick = (q: any) => {
        setEditingQuestion(q);
        setFormData({
            category: q.category,
            value: q.value,
            question: q.question,
            answer: q.answer || '',
            options: q.options ? q.options.join(', ') : ''
        });
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (id: string, questionText: string) => {
        if (!confirm(`هل أنت متأكد من حذف السؤال:\n"${questionText}"؟`)) return;
        try {
            const res = await fetch(`/api/admin/questions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchQuestions();
            }
        } catch (e) {
            console.error("Failed to delete", e);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            category: formData.category,
            value: Number(formData.value),
            question: formData.question,
            answer: formData.answer,
            options: formData.options ? formData.options.split(',').map(s => s.trim()).filter(Boolean) : []
        };

        const url = editingQuestion ? `/api/admin/questions/${editingQuestion.id}` : '/api/admin/questions';
        const method = editingQuestion ? 'PUT' : 'POST';

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
                fetchQuestions();
            } else if (res.status === 401) {
                handleLogout();
            } else {
                alert('حدث خطأ أثناء الحفظ');
            }
        } catch (e) {
            alert('حدث خطأ أثناء الاتصال');
        }
    };

    const filteredQuestions = questions.filter(q =>
        q.question?.includes(searchTerm) ||
        q.category?.includes(searchTerm) ||
        q.answer?.includes(searchTerm)
    );

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
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Shield size={28} color="#0f172a" />
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>إدارة الأسئلة</h1>
                    </div>
                    <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>
                        <LogOut size={16} /> خروج
                    </button>
                </div>

                <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
                            <Search size={18} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                placeholder="بحث في الأسئلة، الأقسام، الإجابات..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', background: '#f8fafc' }}
                            />
                        </div>
                        <button onClick={handleAddClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', background: '#10b981', color: '#fff', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                            <Plus size={18} /> إضافة سؤال جديد
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', zIndex: 10 }}>
                                <tr>
                                    <th style={{ padding: '16px', color: '#64748b', fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>القسم</th>
                                    <th style={{ padding: '16px', color: '#64748b', fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>النقاط</th>
                                    <th style={{ padding: '16px', color: '#64748b', fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>السؤال</th>
                                    <th style={{ padding: '16px', color: '#64748b', fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>الإجابة</th>
                                    <th style={{ padding: '16px', color: '#64748b', fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>جاري التحميل...</td>
                                    </tr>
                                ) : filteredQuestions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>لا توجد أسئلة</td>
                                    </tr>
                                ) : (
                                    filteredQuestions.map((q) => (
                                        <tr key={q.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '16px', fontWeight: 'bold' }}><span style={{ background: '#e0e7ff', color: '#4f46e5', padding: '4px 8px', borderRadius: '6px', fontSize: '12px' }}>{q.category}</span></td>
                                            <td style={{ padding: '16px', fontWeight: 'bold', color: '#f59e0b' }}>{q.value}</td>
                                            <td style={{ padding: '16px', maxWidth: '300px' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.question}</div>
                                                {q.type === 'luck' && <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>حظ</span>}
                                            </td>
                                            <td style={{ padding: '16px', maxWidth: '200px' }}>
                                                <div style={{ color: '#10b981', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.answer || '-'}</div>
                                                {q.options && q.options.length > 0 && (
                                                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>خيارات: {q.options.join('، ')}</div>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => handleEditClick(q)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '4px' }} title="تعديل">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => handleDeleteClick(q.id, q.question)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="حذف">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>{editingQuestion ? 'تعديل السؤال' : 'إضافة سؤال'}</h3>
                                <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSave} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold' }}>القسم / الحرف</label>
                                        <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} required />
                                    </div>
                                    <div style={{ width: '100px' }}>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold' }}>النقاط</label>
                                        <input type="number" value={formData.value} onChange={e => setFormData({ ...formData, value: Number(e.target.value) })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} required />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold' }}>السؤال</label>
                                    <textarea value={formData.question} onChange={e => setFormData({ ...formData, question: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '80px', resize: 'vertical' }} required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold' }}>الإجابة الصحيحة</label>
                                    <input type="text" value={formData.answer} onChange={e => setFormData({ ...formData, answer: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold' }}>الخيارات (اختياري - مفصولة بفاصلة)</label>
                                    <input type="text" value={formData.options} onChange={e => setFormData({ ...formData, options: e.target.value })} placeholder="خيار 1، خيار 2، خيار 3..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                                </div>
                                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#f1f5f9', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>إلغاء</button>
                                    <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                                        <Check size={18} /> حفظ
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
