/**
 * AdminPanel — Super admin tenant management
 * Temporary development tool for managing user accounts
 */
import { useState, useEffect } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon from './Icons';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active', color: '#10B981' },
    { value: 'cancelled', label: 'Suspended', color: '#6B7280' },
];

export default function AdminPanel() {
    const { showToast } = useStore();
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [expandedId, setExpandedId] = useState(null);
    const [users, setUsers] = useState([]);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const api = async (path, options = {}) => {
        const token = localStorage.getItem('narmada_broadcast_token');
        const slug = localStorage.getItem('tenant_slug') || 'default';
        const res = await fetch(`/api/v1${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'x-tenant-slug': slug,
                ...options.headers,
            },
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Request failed');
        }
        if (res.status === 204) return null;
        return res.json();
    };

    const fetchTenants = async () => {
        try {
            setLoading(true);
            const data = await api('/admin/tenants');
            setTenants(data.tenants || []);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async (tenantId) => {
        try {
            const data = await api(`/admin/tenants/${tenantId}/users`);
            setUsers(data.users || []);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    useEffect(() => { fetchTenants(); }, []);

    const handleEdit = (tenant) => {
        setEditingId(tenant.id);
        setEditForm({
            subscription_plan: tenant.subscription_plan,
            subscription_status: tenant.subscription_status,
            max_users: tenant.max_users,
        });
    };

    const handleSave = async () => {
        try {
            await api(`/admin/tenants/${editingId}`, {
                method: 'PUT',
                body: JSON.stringify(editForm),
            });
            showToast('Tenant updated');
            setEditingId(null);
            fetchTenants();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleSuspend = async (tenantId) => {
        try {
            const data = await api(`/admin/tenants/${tenantId}/suspend`, { method: 'PUT' });
            showToast(data.message);
            fetchTenants();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleDelete = async (tenantId) => {
        try {
            const data = await api(`/admin/tenants/${tenantId}`, { method: 'DELETE' });
            showToast(data.message);
            setDeleteConfirm(null);
            fetchTenants();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const toggleExpand = (tenantId) => {
        if (expandedId === tenantId) {
            setExpandedId(null);
            setUsers([]);
        } else {
            setExpandedId(tenantId);
            fetchUsers(tenantId);
        }
    };


    const getStatusBadge = (status) => {
        const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
        return (
            <span style={{
                padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                background: `${opt.color}20`, color: opt.color,
            }}>
                {opt.label}
            </span>
        );
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Icon name="loader" size={32} />
                    <p style={{ marginTop: '12px' }}>Loading tenants...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        <Icon name="settings" size={22} style={{ marginRight: '8px' }} />
                        Admin Panel
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>
                        {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} registered
                    </p>
                </div>
                <button className="btn btn-primary" onClick={fetchTenants} style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
                    <Icon name="refresh-cw" size={14} /> Refresh
                </button>
            </div>

            {/* Tenant Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tenants.map(tenant => (
                    <div key={tenant.id} className="card" style={{
                        padding: 0, overflow: 'hidden',
                        border: tenant.subscription_status === 'cancelled' ? '1px solid var(--danger)' : undefined,
                        opacity: tenant.subscription_status === 'cancelled' ? 0.7 : 1,
                    }}>
                        {/* Main Row */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: '16px',
                            padding: '16px 20px',
                            alignItems: 'center',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                {/* Avatar */}
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #25D366, #128C7E)',
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 800, fontSize: '16px', flexShrink: 0,
                                }}>
                                    {(tenant.name || '?').charAt(0).toUpperCase()}
                                </div>

                                {/* Info */}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                                        {tenant.name}
                                        <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                            /{tenant.slug}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {tenant.email} · Created {formatDate(tenant.created_at)}
                                    </div>
                                </div>

                                {/* Badges */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {getStatusBadge(tenant.subscription_status)}
                                </div>

                                {/* Stats */}
                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                    <span><Icon name="users" size={13} style={{ marginRight: '4px' }} />{tenant.user_count} users</span>
                                    <span><Icon name="contacts" size={13} style={{ marginRight: '4px' }} />{tenant.contact_count} contacts</span>
                                    <span>Max: {tenant.max_users}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <button className="btn btn-ghost" onClick={() => toggleExpand(tenant.id)}
                                    title="View users" style={{ padding: '6px 10px' }}>
                                    <Icon name="users" size={15} />
                                </button>
                                <button className="btn btn-ghost" onClick={() => handleEdit(tenant)}
                                    title="Edit status" style={{ padding: '6px 10px' }}>
                                    <Icon name="pencil" size={15} />
                                </button>
                                <button className="btn btn-ghost" onClick={() => handleSuspend(tenant.id)}
                                    title={tenant.subscription_status === 'cancelled' ? 'Reactivate' : 'Suspend'}
                                    style={{ padding: '6px 10px', color: tenant.subscription_status === 'cancelled' ? '#10B981' : '#F59E0B' }}>
                                    <Icon name={tenant.subscription_status === 'cancelled' ? 'check-circle' : 'lock'} size={15} />
                                </button>
                                {tenant.id !== 1 && (
                                    <button className="btn btn-ghost" onClick={() => setDeleteConfirm(tenant.id)}
                                        title="Delete" style={{ padding: '6px 10px', color: '#EF4444' }}>
                                        <Icon name="trash" size={15} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Edit Form (inline) */}
                        {editingId === tenant.id && (
                            <div style={{
                                padding: '16px 20px',
                                borderTop: '1px solid var(--border)',
                                background: 'var(--bg-secondary)',
                                display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap',
                            }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Status</label>
                                    <select className="form-input" value={editForm.subscription_status}
                                        onChange={e => setEditForm({ ...editForm, subscription_status: e.target.value })}
                                        style={{ minWidth: '120px' }}>
                                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Max Users</label>
                                    <input className="form-input" type="number" value={editForm.max_users}
                                        onChange={e => setEditForm({ ...editForm, max_users: parseInt(e.target.value) || 5 })}
                                        style={{ width: '80px' }} />
                                </div>
                                <button className="btn btn-primary" onClick={handleSave} style={{ padding: '8px 20px' }}>Save</button>
                                <button className="btn btn-ghost" onClick={() => setEditingId(null)} style={{ padding: '8px 16px' }}>Cancel</button>
                            </div>
                        )}

                        {/* Expanded Users List */}
                        {expandedId === tenant.id && (
                            <div style={{
                                padding: '12px 20px 16px',
                                borderTop: '1px solid var(--border)',
                                background: 'var(--bg-secondary)',
                            }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    Users in {tenant.name}
                                </div>
                                {users.length === 0 ? (
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No users found</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {users.map(u => (
                                            <div key={u.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-primary)',
                                            }}>
                                                <div style={{
                                                    width: '28px', height: '28px', borderRadius: '50%',
                                                    background: '#25D366', color: '#fff',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 700, fontSize: '11px', flexShrink: 0,
                                                }}>
                                                    {(u.name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{u.name}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px' }}>{u.email}</span>
                                                </div>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 600,
                                                    background: u.role === 'admin' ? '#F59E0B20' : '#3B82F620',
                                                    color: u.role === 'admin' ? '#F59E0B' : '#3B82F6',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {u.role}
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    {formatDate(u.created_at)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Delete Confirmation */}
                        {deleteConfirm === tenant.id && (
                            <div style={{
                                padding: '16px 20px',
                                borderTop: '2px solid #EF4444',
                                background: '#FEF2F230',
                                display: 'flex', alignItems: 'center', gap: '12px',
                            }}>
                                <Icon name="alert-triangle" size={18} color="#EF4444" />
                                <span style={{ fontSize: '13px', color: '#EF4444', fontWeight: 500, flex: 1 }}>
                                    Permanently delete <strong>{tenant.name}</strong> and all their data?
                                </span>
                                <button className="btn" onClick={() => handleDelete(tenant.id)}
                                    style={{ background: '#EF4444', color: '#fff', padding: '6px 16px', fontSize: '12px' }}>
                                    Yes, Delete
                                </button>
                                <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}
                                    style={{ padding: '6px 16px', fontSize: '12px' }}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {tenants.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    <Icon name="users" size={48} strokeWidth={1.5} style={{ opacity: 0.4 }} />
                    <p style={{ marginTop: '12px' }}>No tenants found</p>
                </div>
            )}
        </div>
    );
}
