import { useState, useEffect, useRef } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon from './Icons';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const apiRaw = async (path) => {
    const token = localStorage.getItem('narmada_broadcast_token');
    const slug = localStorage.getItem('tenant_slug') || 'default';
    const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
        headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': slug },
    });
    if (!res.ok) throw new Error('Request failed');
    return res;
};

const apiFetch = async (path) => {
    const res = await apiRaw(path);
    return res.json();
};

export default function Contacts() {
    const { contacts, contactsTotal, fetchContacts, createContact, updateContact, deleteContact, importContacts, showToast, setView } = useStore();

    // Filters
    const [search, setSearch] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);

    // Dropdown data
    const [allTags, setAllTags] = useState([]);
    const [allLocations, setAllLocations] = useState([]);

    // Selection
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Form
    const [showForm, setShowForm] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', location: '', ticket_size: '', tags: '', notes: '', source: '' });

    // Import
    const [showImport, setShowImport] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importPreview, setImportPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    const searchTimer = useRef(null);

    // ── Fetch data ──
    const doFetch = () => {
        fetchContacts(searchQuery, tagFilter, page, limit, sortBy, sortOrder, locationFilter);
    };

    useEffect(() => { doFetch(); }, [searchQuery, tagFilter, locationFilter, page, limit, sortBy, sortOrder]);

    useEffect(() => {
        // Load filter dropdown options
        apiFetch('/contacts/tags/list').then(setAllTags).catch(() => {});
        apiFetch('/contacts/locations/list').then(setAllLocations).catch(() => {});
    }, []);

    // Debounced search
    const handleSearchInput = (e) => {
        setSearch(e.target.value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setSearchQuery(e.target.value);
            setPage(1);
        }, 400);
    };

    // ── Sort ──
    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
        setPage(1);
    };

    const SortIcon = ({ field }) => {
        if (sortBy !== field) return <Icon name="arrow-right" size={12} color="var(--text-muted)" style={{ opacity: 0.3, transform: 'rotate(90deg)' }} />;
        return <Icon name="arrow-right" size={12} color="var(--accent-primary)" style={{ transform: sortOrder === 'asc' ? 'rotate(-90deg)' : 'rotate(90deg)' }} />;
    };

    // ── Selection ──
    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === contacts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(contacts.map(c => c.id)));
        }
    };

    // ── Bulk Delete ──
    const bulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.size} selected contacts?`)) return;
        try {
            for (const id of selectedIds) {
                await deleteContact(id);
            }
            showToast(`${selectedIds.size} contacts deleted`);
            setSelectedIds(new Set());
            doFetch();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // ── Export ──
    const handleExport = async () => {
        try {
            setExporting(true);
            let url = '/contacts/export?';
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
            if (tagFilter) url += `&tag=${encodeURIComponent(tagFilter)}`;
            if (locationFilter) url += `&location=${encodeURIComponent(locationFilter)}`;

            const res = await apiRaw(url);
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            showToast('Contacts exported!', 'success');
        } catch {
            showToast('Export failed', 'error');
        } finally {
            setExporting(false);
        }
    };

    // ── Quick Chat ──
    const openChat = () => {
        setView('chat');
        // The chat component will handle showing conversations
    };

    // ── Form Handlers ──
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                ticket_size: formData.ticket_size ? parseFloat(formData.ticket_size) : null,
                tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            };
            if (editingContact) {
                await updateContact(editingContact.id, payload);
                showToast('Contact updated');
            } else {
                await createContact(payload);
                showToast('Contact created');
            }
            resetForm();
            doFetch();
        } catch (err) {
            showToast(err.message, 'error');
        }
        setLoading(false);
    };

    const handleEdit = (contact) => {
        const tags = contact.tags ? (typeof contact.tags === 'string' ? JSON.parse(contact.tags) : contact.tags) : [];
        setFormData({
            name: contact.name || '', phone: contact.phone || '', email: contact.email || '',
            location: contact.location || '', ticket_size: contact.ticket_size || '',
            tags: tags.join(', '), notes: contact.notes || '', source: contact.source || '',
        });
        setEditingContact(contact);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Delete this contact?')) {
            await deleteContact(id);
            showToast('Contact deleted');
            doFetch();
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingContact(null);
        setFormData({ name: '', phone: '', email: '', location: '', ticket_size: '', tags: '', notes: '', source: '' });
    };

    const parseCSV = (text) => {
        const lines = text.trim().split('\n').filter(Boolean);
        if (lines.length === 0) return [];
        
        const parseLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"' && line[i+1] === '"') {
                    current += '"';
                    i++;
                } else if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        const startIdx = lines[0].toLowerCase().includes('name') && lines[0].toLowerCase().includes('phone') ? 1 : 0;
        
        return lines.slice(startIdx).map(line => {
            const parts = parseLine(line);
            
            // Safety measure in case of lingering outer quotes
            const clean = (val) => {
                if (!val) return '';
                let v = val;
                if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
                return v;
            };
            
            return {
                name: clean(parts[0]),
                phone: clean(parts[1]),
                email: clean(parts[2]),
                location: clean(parts[3]),
                ticket_size: parts[4] ? parseFloat(clean(parts[4])) : null,
                tags: parts[5] ? clean(parts[5]).split(';').map(t => t.trim()).filter(Boolean) : [],
                notes: clean(parts[7])
            };
        }).filter(c => c.name && c.phone);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            setImportPreview(parseCSV(text));
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!importPreview || importPreview.length === 0) { showToast('No valid contacts found', 'error'); return; }
        setLoading(true);
        try {
            const result = await importContacts(importPreview);
            showToast(`Imported ${result.imported} contacts (${result.skipped} skipped)`);
            setShowImport(false); setImportFile(null); setImportPreview(null);
            doFetch();
            // Refresh filter dropdowns
            apiFetch('/contacts/tags/list').then(setAllTags).catch(() => {});
            apiFetch('/contacts/locations/list').then(setAllLocations).catch(() => {});
        } catch (err) {
            showToast(err.message, 'error');
        }
        setLoading(false);
    };

    const downloadTemplate = () => {
        const csv = [
            'name,phone,email,location,ticket_size,tags',
            'Rahul Sharma,9876543210,rahul@example.com,Mumbai,5000000,buyer;premium',
            'Priya Patel,8765432109,priya@example.com,Delhi,3000000,investor',
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'contacts_import_template.csv'; a.click();
        URL.revokeObjectURL(url);
        showToast('Template downloaded');
    };

    const parseTags = (tags) => {
        if (!tags) return [];
        if (typeof tags === 'string') { try { return JSON.parse(tags); } catch { return []; } }
        return tags;
    };

    const LABEL_COLORS = {
        vip: { bg: '#f3e8ff', color: '#7c3aed', label: 'VIP' },
        follow_up: { bg: '#dbeafe', color: '#2563eb', label: 'Follow Up' },
        complaint: { bg: '#fee2e2', color: '#dc2626', label: 'Complaint' },
        new_order: { bg: '#dcfce7', color: '#16a34a', label: 'New Order' },
        pending_payment: { bg: '#fef3c7', color: '#d97706', label: 'Pending Payment' },
        resolved: { bg: '#f1f5f9', color: '#64748b', label: 'Resolved' },
    };

    const parseLabels = (labels) => {
        if (!labels) return [];
        if (Array.isArray(labels)) return labels;
        try { return JSON.parse(labels); } catch { return []; }
    };

    const formatTicket = (amount) => {
        if (!amount) return '—';
        const num = Number(amount);
        if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
        if (num >= 100000) return `₹${(num / 100000).toFixed(0)}L`;
        if (num >= 1000) return `₹${(num / 1000).toFixed(0)}K`;
        return `₹${num.toLocaleString('en-IN')}`;
    };

    const hasFilters = searchQuery || tagFilter || locationFilter;
    const totalPages = Math.ceil(contactsTotal / limit);

    return (
        <div className="page-container" style={{ padding: '24px' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '16px' }}>
                <div>
                    <h1 className="page-title" style={{ margin: 0 }}>Contacts</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                        {contactsTotal} total contacts
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={handleExport} disabled={exporting} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="download" size={14} />
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                    <button className="btn btn-secondary" onClick={downloadTemplate} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="download" size={14} /> Template
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowImport(true)} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="upload" size={14} /> Import
                    </button>
                    <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="plus" size={14} /> Add Contact
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="card" style={{ marginBottom: '14px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                    {/* Search */}
                    <div className="form-group" style={{ margin: 0, flex: '1 1 220px', minWidth: '180px' }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Search</label>
                        <div style={{ position: 'relative' }}>
                            <Icon name="search" size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                className="form-input" type="text"
                                placeholder="Name, phone, email, location..."
                                value={search} onInput={handleSearchInput}
                                style={{ paddingLeft: '32px' }}
                            />
                        </div>
                    </div>

                    {/* Tag Filter */}
                    <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Tag</label>
                        <select className="form-select" value={tagFilter} onChange={e => { setTagFilter(e.target.value); setPage(1); }}>
                            <option value="">All Tags</option>
                            {allTags.map(t => {
                                const lc = LABEL_COLORS[t];
                                return <option key={t} value={t}>{lc ? lc.label : t}</option>;
                            })}
                        </select>
                    </div>

                    {/* Location Filter */}
                    <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Location</label>
                        <select className="form-select" value={locationFilter} onChange={e => { setLocationFilter(e.target.value); setPage(1); }}>
                            <option value="">All Locations</option>
                            {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>

                    {hasFilters && (
                        <button className="btn btn-secondary" onClick={() => { setSearch(''); setSearchQuery(''); setTagFilter(''); setLocationFilter(''); setPage(1); }} style={{ padding: '6px 12px', fontSize: '12px', alignSelf: 'flex-end' }}>
                            <Icon name="x" size={12} /> Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <div style={{
                    background: 'var(--accent-primary-soft)', border: '1px solid var(--accent-primary)',
                    borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: '12px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent-primary)' }}>
                        {selectedIds.size} selected
                    </span>
                    <button className="btn btn-secondary" onClick={bulkDelete} style={{ fontSize: '12px', padding: '5px 12px', color: '#EF4444', borderColor: '#EF4444' }}>
                        <Icon name="delete" size={13} /> Delete Selected
                    </button>
                    <button className="btn btn-secondary" onClick={() => setSelectedIds(new Set())} style={{ fontSize: '12px', padding: '5px 10px' }}>
                        Clear
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="card" style={{ overflow: 'auto' }}>
                <table className="table" style={{ fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '36px', paddingRight: 0 }}>
                                <input type="checkbox" checked={contacts.length > 0 && selectedIds.size === contacts.length} onChange={toggleSelectAll} />
                            </th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Name <SortIcon field="name" />
                                </div>
                            </th>
                            <th>Phone</th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('location')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Location <SortIcon field="location" />
                                </div>
                            </th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('ticket_size')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Ticket Size <SortIcon field="ticket_size" />
                                </div>
                            </th>
                            <th>Tags</th>
                            <th>Source</th>
                            <th style={{ width: '100px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contacts.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '48px' }}>
                                    <Icon name="contacts" size={36} color="var(--text-muted)" style={{ opacity: 0.4 }} />
                                    <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        {hasFilters ? 'No contacts match your filters' : 'No contacts yet. Add your first contact to get started.'}
                                    </p>
                                </td>
                            </tr>
                        ) : contacts.map(contact => (
                            <tr key={contact.id}>
                                <td style={{ paddingRight: 0 }}>
                                    <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleSelect(contact.id)} />
                                </td>
                                <td>
                                    <div style={{ fontWeight: 600 }}>{contact.name}</div>
                                    {contact.email && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{contact.email}</div>}
                                </td>
                                <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{contact.phone}</span></td>
                                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{contact.location || '—'}</td>
                                <td style={{ fontWeight: 500 }}>{formatTicket(contact.ticket_size)}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                        {parseTags(contact.tags).map(tag => (
                                            <span key={tag} style={{
                                                padding: '2px 8px', borderRadius: '9999px',
                                                background: '#eef2ff', color: '#6366f1', fontSize: '10px', fontWeight: 600,
                                            }}>{tag}</span>
                                        ))}
                                        {parseLabels(contact.labels).map(lv => {
                                            const lc = LABEL_COLORS[lv];
                                            if (!lc) return null;
                                            return (
                                                <span key={lv} style={{
                                                    padding: '2px 8px', borderRadius: '9999px',
                                                    background: lc.bg, color: lc.color, fontSize: '10px', fontWeight: 600,
                                                }}>{lc.label}</span>
                                            );
                                        })}
                                    </div>
                                </td>
                                <td style={{ opacity: 0.6, fontSize: '12px' }}>{contact.source || '—'}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        <button className="btn-icon" onClick={() => openChat(contact.phone)} title="Open Chat" style={{ color: '#25D366' }}>
                                            <Icon name="whatsapp" size={15} />
                                        </button>
                                        <button className="btn-icon" onClick={() => handleEdit(contact)} title="Edit">
                                            <Icon name="edit" size={15} />
                                        </button>
                                        <button className="btn-icon" onClick={() => handleDelete(contact.id)} title="Delete" style={{ color: '#ef4444' }}>
                                            <Icon name="delete" size={15} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {contactsTotal > 0 ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, contactsTotal)} of ${contactsTotal}` : '0 contacts'}
                    </span>
                    <select className="form-select" value={limit} onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }} style={{ width: 'auto', fontSize: '12px', padding: '4px 8px' }}>
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                    </select>
                </div>
                {totalPages > 1 && (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(1)} style={{ padding: '4px 8px', fontSize: '12px' }}>«</button>
                        <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', fontSize: '12px' }}>‹ Prev</button>
                        <span style={{ fontSize: '12px', fontWeight: 600, padding: '0 8px', color: 'var(--text-secondary)' }}>
                            Page {page} / {totalPages}
                        </span>
                        <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', fontSize: '12px' }}>Next ›</button>
                        <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(totalPages)} style={{ padding: '4px 8px', fontSize: '12px' }}>»</button>
                    </div>
                )}
            </div>

            {/* Add/Edit Form Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={resetForm}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                        <div className="modal-header">
                            <h2>{editingContact ? 'Edit Contact' : 'Add Contact'}</h2>
                            <button className="btn-icon" onClick={resetForm}><Icon name="close" size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Name *</label>
                                        <input className="form-input" value={formData.name} onInput={e => setFormData(d => ({ ...d, name: e.target.value }))} required />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Phone *</label>
                                        <input className="form-input" value={formData.phone} onInput={e => setFormData(d => ({ ...d, phone: e.target.value }))} required placeholder="9876543210" />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Email</label>
                                        <input className="form-input" type="email" value={formData.email} onInput={e => setFormData(d => ({ ...d, email: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Location</label>
                                        <input className="form-input" value={formData.location} onInput={e => setFormData(d => ({ ...d, location: e.target.value }))} placeholder="Delhi, Mumbai..." />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Ticket Size (₹)</label>
                                        <input className="form-input" type="number" value={formData.ticket_size} onInput={e => setFormData(d => ({ ...d, ticket_size: e.target.value }))} placeholder="5000000" />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">Source</label>
                                        <input className="form-input" value={formData.source} onInput={e => setFormData(d => ({ ...d, source: e.target.value }))} placeholder="Website, Referral..." />
                                    </div>
                                </div>
                                <div className="form-group" style={{ margin: '12px 0 0' }}>
                                    <label className="form-label">Tags <span style={{ opacity: 0.5 }}>(comma separated)</span></label>
                                    <input className="form-input" value={formData.tags} onInput={e => setFormData(d => ({ ...d, tags: e.target.value }))} placeholder="vip, interested, premium" />
                                </div>
                                <div className="form-group" style={{ margin: '12px 0 0' }}>
                                    <label className="form-label">Notes</label>
                                    <textarea className="form-input" value={formData.notes} onInput={e => setFormData(d => ({ ...d, notes: e.target.value }))} rows={2} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Saving...' : editingContact ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImport && (
                <div className="modal-overlay" onClick={() => setShowImport(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                        <div className="modal-header">
                            <h2>Import Contacts</h2>
                            <button className="btn-icon" onClick={() => setShowImport(false)}><Icon name="close" size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{
                                border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '32px 20px',
                                textAlign: 'center', cursor: 'pointer',
                                background: importFile ? 'rgba(37, 211, 102, 0.04)' : 'var(--bg-tertiary)', transition: 'all 0.2s',
                            }}
                                onClick={() => document.getElementById('csv-file-input').click()}
                            >
                                <input id="csv-file-input" type="file" accept=".csv,text/csv" onChange={handleFileSelect} style={{ display: 'none' }} />
                                {!importFile ? (
                                    <>
                                        <Icon name="upload" size={32} />
                                        <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600 }}>Click to upload CSV file</div>
                                        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>Format: name, phone, email, location, ticket_size, tags</div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-primary)' }}>✓ {importFile.name}</div>
                                        <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {importPreview ? `${importPreview.length} valid contacts found` : 'Parsing...'}
                                        </div>
                                        <button type="button" className="btn btn-secondary" style={{ marginTop: '8px', fontSize: '12px', padding: '4px 12px' }}
                                            onClick={(e) => { e.stopPropagation(); setImportFile(null); setImportPreview(null); }}>
                                            Change file
                                        </button>
                                    </>
                                )}
                            </div>

                            {importPreview && importPreview.length > 0 && (
                                <div style={{ marginTop: '16px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                    <table className="table" style={{ fontSize: '12px' }}>
                                        <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Location</th></tr></thead>
                                        <tbody>
                                            {importPreview.slice(0, 5).map((c, i) => (
                                                <tr key={i}><td>{c.name}</td><td style={{ fontFamily: 'monospace' }}>{c.phone}</td><td>{c.email || '—'}</td><td>{c.location || '—'}</td></tr>
                                            ))}
                                            {importPreview.length > 5 && (
                                                <tr><td colSpan={4} style={{ textAlign: 'center', opacity: 0.5 }}>...and {importPreview.length - 5} more</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowImport(false); setImportFile(null); setImportPreview(null); }}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleImport} disabled={loading || !importPreview?.length}>
                                {loading ? 'Importing...' : `Import ${importPreview?.length || 0} Contacts`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
