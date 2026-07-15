import { useState, useEffect } from 'preact/hooks';
import Icon from './Icons';

export default function KnowledgeBase() {
    const [faqs, setFaqs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);

    // Test Bot state
    const [testMessage, setTestMessage] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [isTesting, setIsTesting] = useState(false);
    const [showTestBot, setShowTestBot] = useState(false);

    // Alternate phrasings (Phase 3 — disambiguation)
    const [openPhrasingFaq, setOpenPhrasingFaq] = useState(null);
    const [phrasingsByFaq, setPhrasingsByFaq] = useState({});
    const [newPhrasing, setNewPhrasing] = useState('');
    const [phrasingBusy, setPhrasingBusy] = useState(false);

    const authHeaders = () => ({
        'Authorization': `Bearer ${localStorage.getItem('narmada_broadcast_token')}`,
        'x-tenant-slug': localStorage.getItem('tenant_slug') || 'default',
        'Content-Type': 'application/json',
    });

    const togglePhrasings = async (faqId) => {
        if (openPhrasingFaq === faqId) { setOpenPhrasingFaq(null); return; }
        setOpenPhrasingFaq(faqId);
        setNewPhrasing('');
        try {
            const res = await fetch(`/api/v1/knowledge-base/${faqId}/phrasings`, { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setPhrasingsByFaq(prev => ({ ...prev, [faqId]: data.phrasings || [] }));
            }
        } catch (err) { console.error('Failed to fetch phrasings', err); }
    };

    const addPhrasing = async (faqId) => {
        const text = newPhrasing.trim();
        if (!text) return;
        setPhrasingBusy(true);
        try {
            const res = await fetch(`/api/v1/knowledge-base/${faqId}/phrasings`, {
                method: 'POST', headers: authHeaders(), body: JSON.stringify({ phrasing: text }),
            });
            const data = await res.json();
            if (res.ok) {
                setPhrasingsByFaq(prev => ({ ...prev, [faqId]: [data, ...(prev[faqId] || [])] }));
                setNewPhrasing('');
            }
        } catch (err) { console.error('Failed to add phrasing', err); }
        finally { setPhrasingBusy(false); }
    };

    const deletePhrasing = async (faqId, pid) => {
        try {
            const res = await fetch(`/api/v1/knowledge-base/${faqId}/phrasings/${pid}`, { method: 'DELETE', headers: authHeaders() });
            if (res.ok) setPhrasingsByFaq(prev => ({ ...prev, [faqId]: (prev[faqId] || []).filter(p => p.id !== pid) }));
        } catch (err) { console.error('Failed to delete phrasing', err); }
    };

    const handleTestBot = async () => {
        if (!testMessage.trim()) return;
        setIsTesting(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/v1/knowledge-base/test', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('narmada_broadcast_token')}`,
                    'x-tenant-slug': localStorage.getItem('tenant_slug') || 'default',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: testMessage }),
            });
            const data = await res.json();
            setTestResult(data);
        } catch {
            setTestResult({ error: 'Failed to test. Is the server running?' });
        } finally {
            setIsTesting(false);
        }
    };
    const fetchFaqs = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/v1/knowledge-base', {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('narmada_broadcast_token')}`,
                    'x-tenant-slug': localStorage.getItem('tenant_slug') || 'default'
                }
            });
            if (res.ok) {
                const data = await res.json();
                setFaqs(data.faqs || []);
            }
        } catch (err) {
            console.error('Failed to fetch FAQs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFaqs();
    }, []);

    const handleAddOrEdit = async (e) => {
        e.preventDefault();
        if (!question.trim() || !answer.trim()) return;
        
        setIsSaving(true);
        setError(null);
        try {
            const url = editingId ? `/api/v1/knowledge-base/${editingId}` : '/api/v1/knowledge-base';
            const method = editingId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('narmada_broadcast_token')}`,
                    'x-tenant-slug': localStorage.getItem('tenant_slug') || 'default',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question, answer })
            });
            const data = await res.json();
            
            if (res.ok) {
                setQuestion('');
                setAnswer('');
                setEditingId(null);
                fetchFaqs(); // refresh
                
                // Show success toast
                const evt = new CustomEvent('toast', { detail: { type: 'success', message: `Smart FAQ ${editingId ? 'updated' : 'added'} successfully!` }});
                window.dispatchEvent(evt);
            } else {
                setError(data.error || `Failed to ${editingId ? 'update' : 'add'} FAQ`);
            }
        } catch {
            setError(`Network error ${editingId ? 'updating' : 'adding'} FAQ`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (faq) => {
        setEditingId(faq.id);
        setQuestion(faq.question);
        setAnswer(faq.answer);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setQuestion('');
        setAnswer('');
        setError(null);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this FAQ?')) return;
        
        try {
            const res = await fetch(`/api/v1/knowledge-base/${id}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('narmada_broadcast_token')}`,
                    'x-tenant-slug': localStorage.getItem('tenant_slug') || 'default'
                }
            });
            if (res.ok) {
                setFaqs(faqs.filter(f => f.id !== id));
            }
        } catch (err) {
            console.error('Failed to delete', err);
        }
    };

    const filteredFaqs = faqs.filter(faq => 
        (faq.question || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (faq.answer || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Smart Knowledge Base</h1>
                    <p className="page-subtitle">Add frequently asked questions. Smart Automation will match customer questions to these answers.</p>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                    <span className="stat-label">Total FAQs</span>
                    <span className="stat-value">{faqs.length}</span>
                    <span className="stat-change">Active Questions</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Automation Status</span>
                    <span className="stat-value" style={{ color: 'var(--accent-success)' }}>Active</span>
                    <span className="stat-change">Semantic Matching</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">NLP Model</span>
                    <span className="stat-value" style={{ fontSize: '18px', fontWeight: 'bold', padding: '4px 0', margin: '4px 0' }}>MiniLM-L6 (Local)</span>
                    <span className="stat-change">On-Device Embeddings</span>
                </div>
            </div>

            {/* Test Bot Panel */}
            <div className="card" style={{ padding: '0', marginBottom: '24px', overflow: 'hidden' }}>
                <button onClick={() => setShowTestBot(!showTestBot)} style={{
                    width: '100%', padding: '14px 20px', background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                    fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)',
                }}>
                    <span style={{ fontSize: '18px' }}>🧪</span>
                    Test Your Bot
                    <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.5 }}>{showTestBot ? '▲' : '▼'}</span>
                </button>
                {showTestBot && (
                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border, #e2e8f0)' }}>
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '12px 0' }}>
                            Type a message as if you were a customer. See what the bot would reply.
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text" value={testMessage}
                                onChange={e => setTestMessage(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleTestBot()}
                                placeholder="e.g. What are your delivery charges?"
                                style={{
                                    flex: 1, padding: '10px 14px', border: '1px solid var(--border, #e2e8f0)',
                                    borderRadius: '8px', fontSize: '14px', outline: 'none',
                                }}
                            />
                            <button onClick={handleTestBot} disabled={isTesting || !testMessage.trim()} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                                {isTesting ? '⏳ Testing...' : '▶ Test'}
                            </button>
                        </div>

                        {testResult && !testResult.error && (
                            <div style={{ marginTop: '16px' }}>
                                <div style={{
                                    padding: '14px 16px', borderRadius: '10px',
                                    background: testResult.would_reply ? '#dcfce7' : '#fef3c7',
                                    border: `1px solid ${testResult.would_reply ? '#bbf7d0' : '#fde68a'}`,
                                    marginBottom: '12px',
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: testResult.would_reply ? '#16a34a' : '#d97706' }}>
                                        {testResult.would_reply ? '✅ Bot WOULD reply:' : '⚠️ No match above threshold (0.45)'}
                                    </div>
                                    {testResult.matched_answer && (
                                        <div style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>{testResult.matched_answer}</div>
                                    )}
                                </div>

                                {testResult.matches?.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Top Matches:</div>
                                        {testResult.matches.map((m, i) => (
                                            <div key={m.id} style={{
                                                padding: '10px 12px', borderRadius: '8px',
                                                background: i === 0 && testResult.would_reply ? '#f0fdf4' : '#f8fafc',
                                                border: '1px solid var(--border, #e2e8f0)',
                                                marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px',
                                            }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>Q: {m.question}</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b' }}>A: {m.answer}</div>
                                                </div>
                                                <span style={{
                                                    fontSize: '12px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', flexShrink: 0,
                                                    background: m.score >= 0.45 ? '#dcfce7' : '#fef3c7',
                                                    color: m.score >= 0.45 ? '#16a34a' : '#d97706',
                                                }}>
                                                    {(m.score * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {testResult?.error && (
                            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
                                {testResult.error}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="faq-grid-container">
                {/* Left Column: Add Form */}
                <div className="faq-form-column">
                    <div className="card" style={{ padding: '24px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Icon name={editingId ? "edit" : "plus"} size={18} style={{ color: 'var(--accent-primary)' }} />
                            {editingId ? 'Edit FAQ' : 'Add New FAQ'}
                        </h2>
                        
                        {error && (
                            <div style={{ padding: '12px', background: '#FEE2E2', color: '#B91C1C', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
                                {error}
                            </div>
                        )}
                        
                        <form onSubmit={handleAddOrEdit}>
                            <div className="form-group">
                                <label className="form-label">Question (or Topic)</label>
                                <div style={{ position: 'relative' }}>
                                    <Icon name="chat" size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input 
                                        className="form-input" 
                                        type="text" 
                                        value={question} 
                                        onChange={e => setQuestion(e.target.value)} 
                                        placeholder="e.g. What are your store hours?"
                                        style={{ paddingLeft: '36px', width: '100%' }}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Exact Reply</label>
                                <textarea 
                                    className="form-input" 
                                    value={answer} 
                                    onChange={e => setAnswer(e.target.value)} 
                                    placeholder="e.g. We are open Monday to Friday, 9 AM to 5 PM."
                                    rows={4}
                                    style={{ width: '100%', resize: 'vertical', minHeight: '100px' }}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                {editingId && (
                                    <button type="button" onClick={handleCancelEdit} className="btn btn--outline" style={{ flex: 1 }}>
                                        Cancel
                                    </button>
                                )}
                                <button type="submit" className="btn btn--primary" disabled={isSaving} style={{ flex: editingId ? 2 : 1 }}>
                                    {isSaving ? 'Training Engine...' : <><Icon name="check" size={16} /> {editingId ? 'Update FAQ' : 'Save & Train'}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right Column: List */}
                <div className="faq-list-column">
                    <div className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Active FAQs</h2>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                                {filteredFaqs.length} {filteredFaqs.length === 1 ? 'item' : 'items'}
                            </span>
                        </div>

                        {/* Search Bar */}
                        {faqs.length > 0 && (
                            <div className="search-bar" style={{ marginBottom: '20px' }}>
                                <Icon name="search" size={18} />
                                <input 
                                    type="text" 
                                    value={searchQuery} 
                                    onInput={e => setSearchQuery(e.target.value)}
                                    placeholder="Search active FAQs..." 
                                    className="search-input" 
                                />
                            </div>
                        )}
                        
                        {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading knowledge base...</div>
                        ) : faqs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                                <Icon name="search" size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                                <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>No FAQs yet</h3>
                                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Add your first FAQ on the left so the bot can start answering customer queries automatically.</p>
                            </div>
                        ) : filteredFaqs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                                <Icon name="search" size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                                <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>No matches found</h3>
                                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No FAQs match your search query "{searchQuery}". Try a different keyword.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {filteredFaqs.map(faq => (
                                    <div key={faq.id} className="faq-item-card">
                                        <div className="faq-question-container">
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flex: 1 }}>
                                                <Icon name="chat" size={16} style={{ color: 'var(--accent-primary)', marginTop: '3px', flexShrink: 0 }} />
                                                <h3 className="faq-question-text">{faq.question}</h3>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    onClick={() => handleEdit(faq)}
                                                    className="faq-delete-btn"
                                                    title="Edit FAQ"
                                                >
                                                    <Icon name="edit" size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(faq.id)}
                                                    className="faq-delete-btn"
                                                    title="Delete FAQ"
                                                >
                                                    <Icon name="x" size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="faq-answer-text">
                                            {faq.answer}
                                        </div>
                                        <div className="faq-footer">
                                            <div className="faq-footer-item">
                                                <Icon name="check" size={12} style={{ color: 'var(--accent-success)' }} />
                                                <span>Semantic Match Ready</span>
                                            </div>
                                            <div>
                                                Added: {new Date(faq.created_at).toLocaleDateString()}
                                            </div>
                                        </div>

                                        {/* Alternate phrasings (Phase 3) */}
                                        <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                            <button type="button" onClick={() => togglePhrasings(faq.id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', padding: 0 }}>
                                                <Icon name="plus" size={14} /> Alternate phrasings {openPhrasingFaq === faq.id ? '▲' : '▼'}
                                            </button>
                                            {openPhrasingFaq === faq.id && (
                                                <div style={{ marginTop: '10px' }}>
                                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                                        Other ways customers might ask this. Each one improves matching and powers "Did you mean?" suggestions.
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                                        <input
                                                            type="text"
                                                            value={newPhrasing}
                                                            onInput={e => setNewPhrasing(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && addPhrasing(faq.id)}
                                                            placeholder="e.g. how much for shipping?"
                                                            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}
                                                        />
                                                        <button type="button" className="btn btn--primary" disabled={phrasingBusy || !newPhrasing.trim()} onClick={() => addPhrasing(faq.id)} style={{ padding: '8px 14px' }}>
                                                            {phrasingBusy ? '…' : 'Add'}
                                                        </button>
                                                    </div>
                                                    {(phrasingsByFaq[faq.id] || []).length === 0 ? (
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No alternate phrasings yet.</div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                            {(phrasingsByFaq[faq.id] || []).map(p => (
                                                                <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-tertiary)', borderRadius: '14px', padding: '4px 10px', fontSize: '12px' }}>
                                                                    {p.phrasing}
                                                                    <button type="button" onClick={() => deletePhrasing(faq.id, p.id)} title="Remove phrasing" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: '14px' }}>×</button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
