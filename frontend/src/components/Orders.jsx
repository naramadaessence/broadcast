import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon from './Icons';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const api = async (path, options = {}) => {
    const token = localStorage.getItem('narmada_broadcast_token');
    const slug = localStorage.getItem('tenant_slug') || 'default';
    const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-tenant-slug': slug,
            ...options.headers,
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Request failed');
    }
    if (res.status === 204) return null;
    return res.json();
};

const apiRaw = async (path) => {
    const token = localStorage.getItem('narmada_broadcast_token');
    const slug = localStorage.getItem('tenant_slug') || 'default';
    const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-slug': slug,
        },
    });
    if (!res.ok) throw new Error('Export failed');
    return res;
};

// ── Utility ──
function formatCurrency(amount) {
    const n = parseFloat(amount || 0);
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toInputDate(date) {
    return date.toISOString().split('T')[0];
}

const PAYMENT_COLORS = { paid: '#10B981', pending: '#F59E0B', failed: '#EF4444' };
const FULFILLMENT_COLORS = { delivered: '#10B981', shipped: '#3B82F6', processing: '#06B6D4', pending: '#F59E0B', cancelled: '#EF4444' };

function StatusBadge({ status, type = 'payment' }) {
    const colors = type === 'payment' ? PAYMENT_COLORS : FULFILLMENT_COLORS;
    const color = colors[status] || '#94A3B8';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
            background: `${color}14`, color, textTransform: 'capitalize', whiteSpace: 'nowrap',
        }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
            {status}
        </span>
    );
}

// ── Stat Card ──
function StatCard({ label, value, icon, color, bg }) {
    return (
        <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)', padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: '14px',
            boxShadow: 'var(--shadow-xs)', minWidth: 0,
        }}>
            <div style={{
                width: '42px', height: '42px', borderRadius: 'var(--radius-md)',
                background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
                <Icon name={icon} size={20} color={color} />
            </div>
            <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</p>
            </div>
        </div>
    );
}

// ── Main Orders Component ──
export default function Orders() {
    const { showToast } = useStore();

    // Data
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('');
    const [fulfillmentFilter, setFulfillmentFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);

    // Selection
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkAction, setBulkAction] = useState('');

    // Detail modal
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [tempPayment, setTempPayment] = useState('');
    const [tempFulfillment, setTempFulfillment] = useState('');
    const [tempNotes, setTempNotes] = useState('');

    // Exporting
    const [exporting, setExporting] = useState(false);

    // Debounced search
    const searchTimer = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearchInput = (e) => {
        setSearch(e.target.value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setSearchQuery(e.target.value);
            setPage(1);
        }, 400);
    };

    // ── Fetch orders ──
    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            let url = `/orders?page=${page}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}`;
            if (paymentFilter) url += `&payment_status=${paymentFilter}`;
            if (fulfillmentFilter) url += `&fulfillment_status=${fulfillmentFilter}`;
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
            if (dateFrom) url += `&date_from=${dateFrom}`;
            if (dateTo) url += `&date_to=${dateTo}`;

            const data = await api(url);
            setOrders(data.orders || []);
            setTotal(data.total || 0);
            setSelectedIds(new Set());
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [page, limit, sortBy, sortOrder, paymentFilter, fulfillmentFilter, searchQuery, dateFrom, dateTo]);

    const fetchStats = async () => {
        try {
            const data = await api('/orders/stats');
            setStats(data);
        } catch { /* silent */ }
    };

    useEffect(() => { fetchOrders(); }, [fetchOrders]);
    useEffect(() => { fetchStats(); }, []);

    // ── Sorting ──
    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
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
        if (selectedIds.size === orders.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(orders.map(o => o.id)));
        }
    };

    // ── Bulk Actions ──
    const executeBulk = async () => {
        if (selectedIds.size === 0 || !bulkAction) return;
        try {
            const body = { orderIds: [...selectedIds] };
            if (['paid', 'pending', 'failed'].includes(bulkAction)) {
                body.payment_status = bulkAction;
            } else {
                body.fulfillment_status = bulkAction;
            }
            await api('/orders/bulk/status', { method: 'PATCH', body: JSON.stringify(body) });
            showToast(`${selectedIds.size} orders updated`, 'success');
            setBulkAction('');
            setSelectedIds(new Set());
            fetchOrders();
            fetchStats();
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    // ── Export ──
    const handleExport = async () => {
        try {
            setExporting(true);
            let url = `/orders/export?`;
            if (paymentFilter) url += `&payment_status=${paymentFilter}`;
            if (fulfillmentFilter) url += `&fulfillment_status=${fulfillmentFilter}`;
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
            if (dateFrom) url += `&date_from=${dateFrom}`;
            if (dateTo) url += `&date_to=${dateTo}`;

            const res = await apiRaw(url);
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            showToast('Orders exported!', 'success');
        } catch {
            showToast('Export failed', 'error');
        } finally {
            setExporting(false);
        }
    };

    // ── Date presets ──
    const setDatePreset = (preset) => {
        const today = new Date();
        switch (preset) {
            case 'today':
                setDateFrom(toInputDate(today));
                setDateTo(toInputDate(today));
                break;
            case 'week': {
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                setDateFrom(toInputDate(weekAgo));
                setDateTo(toInputDate(today));
                break;
            }
            case 'month': {
                const monthAgo = new Date(today);
                monthAgo.setDate(today.getDate() - 30);
                setDateFrom(toInputDate(monthAgo));
                setDateTo(toInputDate(today));
                break;
            }
            default:
                setDateFrom('');
                setDateTo('');
        }
        setPage(1);
    };

    // ── Detail Modal ──
    const openOrderDetails = async (orderId) => {
        try {
            setLoadingDetails(true);
            setSelectedOrder({ id: orderId });
            const order = await api(`/orders/${orderId}`);
            setSelectedOrder(order);
            setTempPayment(order.payment_status);
            setTempFulfillment(order.fulfillment_status);
            setTempNotes(order.notes || '');
        } catch (error) {
            showToast(error.message, 'error');
            setSelectedOrder(null);
        } finally {
            setLoadingDetails(false);
        }
    };

    const updateOrderStatus = async () => {
        if (!selectedOrder) return;
        try {
            setUpdatingStatus(true);
            await api(`/orders/${selectedOrder.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({
                    payment_status: tempPayment,
                    fulfillment_status: tempFulfillment,
                    notes: tempNotes,
                })
            });
            showToast('Order updated!', 'success');
            setSelectedOrder(prev => ({ ...prev, payment_status: tempPayment, fulfillment_status: tempFulfillment, notes: tempNotes }));
            fetchOrders();
            fetchStats();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setUpdatingStatus(false);
        }
    };

    // ── Reset Filters ──
    const hasFilters = paymentFilter || fulfillmentFilter || searchQuery || dateFrom || dateTo;
    const resetFilters = () => {
        setPaymentFilter('');
        setFulfillmentFilter('');
        setSearch('');
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
        setPage(1);
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="page-container" style={{ padding: '24px' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '20px' }}>
                <div>
                    <h1 className="page-title" style={{ margin: 0 }}>Orders</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                        Track and fulfill customer orders placed via WhatsApp
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={handleExport} disabled={exporting} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name="download" size={14} />
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                    <button className="btn btn-secondary btn-icon" onClick={() => { fetchOrders(); fetchStats(); }} disabled={loading} title="Refresh">
                        <Icon name="refresh-cw" size={16} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px', marginBottom: '20px',
                }}>
                    <StatCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon="indian-rupee" color="#10B981" bg="rgba(16,185,129,0.08)" />
                    <StatCard label="Total Orders" value={stats.totalOrders} icon="clipboard" color="#8B5CF6" bg="rgba(139,92,246,0.08)" />
                    <StatCard label="Orders Today" value={stats.ordersToday} icon="calendar" color="#3B82F6" bg="rgba(59,130,246,0.08)" />
                    <StatCard label="Pending Payments" value={stats.pendingPayments} icon="alert-triangle" color="#F59E0B" bg="rgba(245,158,11,0.08)" />
                    <StatCard label="Avg. Order Value" value={formatCurrency(stats.avgOrderValue)} icon="target" color="#06B6D4" bg="rgba(6,182,212,0.08)" />
                </div>
            )}

            {/* Filters Bar */}
            <div className="card" style={{ marginBottom: '16px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                    {/* Search */}
                    <div className="form-group" style={{ margin: 0, flex: '1 1 220px', minWidth: '180px' }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Search</label>
                        <div style={{ position: 'relative' }}>
                            <Icon name="search" size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Order #, phone, name..."
                                value={search}
                                onInput={handleSearchInput}
                                style={{ paddingLeft: '32px' }}
                            />
                        </div>
                    </div>

                    {/* Payment Filter */}
                    <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Payment</label>
                        <select className="form-select" value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}>
                            <option value="">All</option>
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>

                    {/* Fulfillment Filter */}
                    <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Fulfillment</label>
                        <select className="form-select" value={fulfillmentFilter} onChange={e => { setFulfillmentFilter(e.target.value); setPage(1); }}>
                            <option value="">All</option>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    {/* Date presets */}
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Date Range</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[['today', 'Today'], ['week', '7 Days'], ['month', '30 Days']].map(([key, label]) => (
                                <button
                                    key={key}
                                    className={`btn btn-secondary`}
                                    style={{
                                        padding: '5px 10px', fontSize: '11px',
                                        ...(dateFrom && key === 'today' && dateFrom === toInputDate(new Date()) && dateTo === toInputDate(new Date()) ? { background: 'var(--accent-primary-soft)', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' } : {}),
                                    }}
                                    onClick={() => setDatePreset(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom date inputs */}
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>From</label>
                        <input type="date" className="form-input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={{ fontSize: '12px', padding: '6px 8px' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>To</label>
                        <input type="date" className="form-input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={{ fontSize: '12px', padding: '6px 8px' }} />
                    </div>

                    {hasFilters && (
                        <button className="btn btn-secondary" onClick={resetFilters} style={{ padding: '6px 12px', fontSize: '12px', alignSelf: 'flex-end' }}>
                            <Icon name="x" size={12} /> Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div style={{
                    background: 'var(--accent-primary-soft)', border: '1px solid var(--accent-primary)',
                    borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: '12px',
                    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent-primary)' }}>
                        {selectedIds.size} selected
                    </span>
                    <select className="form-select" value={bulkAction} onChange={e => setBulkAction(e.target.value)} style={{ width: 'auto', fontSize: '12px', padding: '4px 8px' }}>
                        <option value="">Choose action...</option>
                        <optgroup label="Payment Status">
                            <option value="paid">Mark Paid</option>
                            <option value="pending">Mark Pending</option>
                        </optgroup>
                        <optgroup label="Fulfillment Status">
                            <option value="processing">Mark Processing</option>
                            <option value="shipped">Mark Shipped</option>
                            <option value="delivered">Mark Delivered</option>
                            <option value="cancelled">Mark Cancelled</option>
                        </optgroup>
                    </select>
                    <button className="btn btn-primary" onClick={executeBulk} disabled={!bulkAction} style={{ fontSize: '12px', padding: '5px 14px' }}>
                        Apply
                    </button>
                    <button className="btn btn-secondary" onClick={() => setSelectedIds(new Set())} style={{ fontSize: '12px', padding: '5px 10px' }}>
                        Clear
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="card orders-table-card" style={{ overflow: 'auto' }}>
                <table className="table" style={{ fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '36px', paddingRight: 0 }}>
                                <input type="checkbox" checked={orders.length > 0 && selectedIds.size === orders.length} onChange={toggleSelectAll} />
                            </th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('created_at')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Order <SortIcon field="created_at" />
                                </div>
                            </th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('total_amount')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Amount <SortIcon field="total_amount" />
                                </div>
                            </th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('payment_status')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Payment <SortIcon field="payment_status" />
                                </div>
                            </th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('fulfillment_status')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Fulfillment <SortIcon field="fulfillment_status" />
                                </div>
                            </th>
                            <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '48px' }}>
                                    <Icon name="loader" size={22} className="spin" />
                                    <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading orders...</p>
                                </td>
                            </tr>
                        ) : orders.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '48px' }}>
                                    <Icon name="clipboard" size={36} color="var(--text-muted)" style={{ opacity: 0.4 }} />
                                    <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        {hasFilters ? 'No orders match your filters' : 'No orders yet'}
                                    </p>
                                </td>
                            </tr>
                        ) : orders.map(order => (
                            <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => openOrderDetails(order.id)}>
                                <td style={{ paddingRight: 0 }} onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelect(order.id)} />
                                </td>
                                <td>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>#{order.id}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(order.created_at)}</div>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 600 }}>{order.contact_name || 'Walk-in'}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{order.phone}</div>
                                </td>
                                <td>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                                    </span>
                                </td>
                                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {order.currency} {parseFloat(order.total_amount).toFixed(2)}
                                </td>
                                <td><StatusBadge status={order.payment_status} type="payment" /></td>
                                <td><StatusBadge status={order.fulfillment_status} type="fulfillment" /></td>
                                <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                    <button className="btn-icon" onClick={() => openOrderDetails(order.id)} title="View Details">
                                        <Icon name="eye" size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="orders-mobile-list">
                {loading ? (
                    <div className="orders-mobile-card orders-mobile-card--empty">
                        <Icon name="loader" size={22} className="spin" />
                        <span>Loading orders...</span>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="orders-mobile-card orders-mobile-card--empty">
                        <Icon name="clipboard" size={28} color="var(--text-muted)" />
                        <span>{hasFilters ? 'No orders match your filters' : 'No orders yet'}</span>
                    </div>
                ) : orders.map(order => (
                    <article
                        key={order.id}
                        className={`orders-mobile-card ${selectedIds.has(order.id) ? 'is-selected' : ''}`}
                        onClick={() => openOrderDetails(order.id)}
                    >
                        <div className="orders-mobile-card__top">
                            <div>
                                <div className="orders-mobile-card__id">Order #{order.id}</div>
                                <div className="orders-mobile-card__date">{formatDate(order.created_at)}</div>
                            </div>
                            <input
                                type="checkbox"
                                checked={selectedIds.has(order.id)}
                                onClick={e => e.stopPropagation()}
                                onChange={() => toggleSelect(order.id)}
                                aria-label={`Select order ${order.id}`}
                            />
                        </div>
                        <div className="orders-mobile-card__customer">
                            <span>{order.contact_name || 'Walk-in'}</span>
                            <code>{order.phone || 'No phone'}</code>
                        </div>
                        <div className="orders-mobile-card__meta">
                            <span>{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</span>
                            <strong>{order.currency} {parseFloat(order.total_amount).toFixed(2)}</strong>
                        </div>
                        <div className="orders-mobile-card__status">
                            <StatusBadge status={order.payment_status} type="payment" />
                            <StatusBadge status={order.fulfillment_status} type="fulfillment" />
                        </div>
                        <button className="btn btn-secondary orders-mobile-card__button" type="button" onClick={(e) => { e.stopPropagation(); openOrderDetails(order.id); }}>
                            <Icon name="eye" size={14} />
                            View Details
                        </button>
                    </article>
                ))}
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {total > 0 ? `${((page - 1) * limit) + 1}–${Math.min(page * limit, total)} of ${total}` : '0 orders'}
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

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '92%', maxHeight: '90vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Order #{selectedOrder.id}
                                {!loadingDetails && selectedOrder.payment_status && (
                                    <StatusBadge status={selectedOrder.payment_status} type="payment" />
                                )}
                            </h2>
                            <button className="btn-icon" onClick={() => setSelectedOrder(null)}><Icon name="close" size={20} /></button>
                        </div>
                        <div className="modal-body">
                            {loadingDetails ? (
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Icon name="loader" size={22} className="spin" />
                                    <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Loading...</p>
                                </div>
                            ) : (
                                <div>
                                    {/* Customer + Order Info */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                                            <h4 style={{ margin: '0 0 8px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>Customer</h4>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{selectedOrder.contact_name || 'Walk-in Customer'}</div>
                                            {selectedOrder.contact_email && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedOrder.contact_email}</div>}
                                            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{selectedOrder.phone}</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                                            <h4 style={{ margin: '0 0 8px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>Order Info</h4>
                                            <div style={{ fontSize: '12px' }}><strong>Placed:</strong> {formatDate(selectedOrder.created_at)}</div>
                                            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '4px' }}>
                                                {selectedOrder.currency} {parseFloat(selectedOrder.total_amount).toFixed(2)}
                                            </div>
                                            {selectedOrder.shipping_address && (
                                                <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-secondary)' }}>
                                                    <strong>Ship to:</strong> {selectedOrder.shipping_address}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Update Status */}
                                    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '14px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                                        <h4 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Update Status</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: '11px' }}>Payment</label>
                                                <select className="form-select" value={tempPayment} onChange={e => setTempPayment(e.target.value)}>
                                                    <option value="pending">Pending</option>
                                                    <option value="paid">Paid</option>
                                                    <option value="failed">Failed</option>
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: '11px' }}>Fulfillment</label>
                                                <select className="form-select" value={tempFulfillment} onChange={e => setTempFulfillment(e.target.value)}>
                                                    <option value="pending">Pending</option>
                                                    <option value="processing">Processing</option>
                                                    <option value="shipped">Shipped</option>
                                                    <option value="delivered">Delivered</option>
                                                    <option value="cancelled">Cancelled</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="form-group" style={{ margin: '12px 0 0' }}>
                                            <label className="form-label" style={{ fontSize: '11px' }}>Internal Notes</label>
                                            <textarea
                                                className="form-input"
                                                rows={2}
                                                placeholder="Add notes about this order..."
                                                value={tempNotes}
                                                onInput={e => setTempNotes(e.target.value)}
                                                style={{ fontSize: '12px', resize: 'vertical' }}
                                            />
                                        </div>
                                        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                                            <button className="btn btn-primary" onClick={updateOrderStatus} disabled={updatingStatus} style={{ fontSize: '12px', padding: '6px 16px' }}>
                                                {updatingStatus ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Line Items */}
                                    <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Items</h4>
                                    <div style={{ marginBottom: '16px' }}>
                                        {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px' }}>Item</th>
                                                        <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px' }}>SKU</th>
                                                        <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px' }}>Price</th>
                                                        <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px' }}>Qty</th>
                                                        <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px' }}>Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedOrder.items.map(item => (
                                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                            <td style={{ padding: '8px 6px', fontWeight: 500 }}>{item.item_name}</td>
                                                            <td style={{ padding: '8px 6px' }}><code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.sku || '—'}</code></td>
                                                            <td style={{ textAlign: 'right', padding: '8px 6px' }}>₹{parseFloat(item.price).toFixed(2)}</td>
                                                            <td style={{ textAlign: 'center', padding: '8px 6px' }}>{item.quantity}</td>
                                                            <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>₹{(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr>
                                                        <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, padding: '10px 6px', color: 'var(--text-primary)' }}>Total:</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 700, padding: '10px 6px', fontSize: '14px', color: 'var(--accent-primary)' }}>
                                                            {selectedOrder.currency} {parseFloat(selectedOrder.total_amount).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        ) : (
                                            <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '16px' }}>No items in this order</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
