import { useState, useEffect, useRef } from 'preact/hooks';
import Icon from './Icons';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const api = async (path) => {
    const token = localStorage.getItem('narmada_broadcast_token');
    const slug = localStorage.getItem('tenant_slug') || 'default';
    const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(slug && { 'x-tenant-slug': slug }),
        },
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
};

// ── Utility: Format currency ──
function formatCurrency(amount) {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount.toFixed(0)}`;
}

function formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ── Mini Sparkline Component ──
function Sparkline({ data, color = '#25D366', height = 40, width = 120 }) {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    });

    return (
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <polygon
                points={`0,${height} ${points.join(' ')} ${width},${height}`}
                fill={`url(#spark-${color.replace('#', '')})`}
            />
            <polyline
                points={points.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// ── Area Chart Component ──
function AreaChart({ data, dataKey, color = '#25D366', height = 220 }) {
    const [tooltip, setTooltip] = useState(null);
    const svgRef = useRef(null);

    if (!data || data.length === 0) {
        return (
            <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No data yet
            </div>
        );
    }

    const padding = { top: 20, right: 16, bottom: 40, left: 56 };
    const width = 600;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = data.map(d => d[dataKey] || 0);
    const maxVal = Math.max(...values, 1);
    const niceMax = Math.ceil(maxVal / (Math.pow(10, Math.floor(Math.log10(maxVal || 1))))) * Math.pow(10, Math.floor(Math.log10(maxVal || 1))) || 10;

    const points = data.map((d, i) => ({
        x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
        y: padding.top + chartH - ((d[dataKey] || 0) / niceMax) * chartH,
        value: d[dataKey] || 0,
        date: d.date,
    }));

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaD = `${pathD} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

    // Y-axis ticks
    const yTicks = 5;
    const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (niceMax / yTicks) * i);

    const handleMouseMove = (e) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * width;
        let closest = points[0];
        let minDist = Infinity;
        for (const p of points) {
            const dist = Math.abs(p.x - mouseX);
            if (dist < minDist) { minDist = dist; closest = p; }
        }
        setTooltip(closest);
    };

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto', maxHeight: `${height}px` }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
        >
            <defs>
                <linearGradient id={`area-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>

            {/* Grid lines */}
            {yTickValues.map((val, i) => {
                const y = padding.top + chartH - (val / niceMax) * chartH;
                return (
                    <g key={i}>
                        <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
                        <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">
                            {dataKey === 'revenue' ? formatCurrency(val) : formatNumber(val)}
                        </text>
                    </g>
                );
            })}

            {/* X-axis labels */}
            {points.filter((_, i) => data.length <= 10 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1).map((p, i) => (
                <text key={i} x={p.x} y={height - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">
                    {formatDate(p.date)}
                </text>
            ))}

            {/* Area fill */}
            <path d={areaD} fill={`url(#area-${dataKey})`} />

            {/* Line */}
            <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Data dots */}
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={data.length <= 15 ? 3.5 : 0} fill="white" stroke={color} strokeWidth="2" />
            ))}

            {/* Tooltip */}
            {tooltip && (
                <g>
                    <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={padding.top + chartH} stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                    <circle cx={tooltip.x} cy={tooltip.y} r="5" fill={color} stroke="white" strokeWidth="2" />
                    <rect x={tooltip.x - 50} y={tooltip.y - 36} width="100" height="28" rx="6" fill="var(--text-primary)" opacity="0.9" />
                    <text x={tooltip.x} y={tooltip.y - 18} textAnchor="middle" fill="white" fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif">
                        {dataKey === 'revenue' ? formatCurrency(tooltip.value) : tooltip.value} · {formatDate(tooltip.date)}
                    </text>
                </g>
            )}
        </svg>
    );
}

// ── Bar Chart Component ──
function BarChart({ data, height = 220 }) {
    const [tooltip, setTooltip] = useState(null);

    if (!data || data.length === 0) {
        return (
            <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No data yet
            </div>
        );
    }

    const padding = { top: 20, right: 16, bottom: 40, left: 40 };
    const width = 600;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal = Math.max(...data.map(d => Math.max(d.inbound || 0, d.outbound || 0)), 1);
    const niceMax = Math.ceil(maxVal * 1.2) || 10;

    const barGroupWidth = chartW / data.length;
    const barWidth = Math.min(barGroupWidth * 0.3, 20);
    const gap = 3;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto', maxHeight: `${height}px` }}
            onMouseLeave={() => setTooltip(null)}
        >
            {/* Y grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
                const y = padding.top + chartH * (1 - frac);
                const val = Math.round(niceMax * frac);
                return (
                    <g key={i}>
                        <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
                        <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">
                            {val}
                        </text>
                    </g>
                );
            })}

            {data.map((d, i) => {
                const cx = padding.left + barGroupWidth * i + barGroupWidth / 2;
                const inH = ((d.inbound || 0) / niceMax) * chartH;
                const outH = ((d.outbound || 0) / niceMax) * chartH;

                return (
                    <g key={i}
                        onMouseEnter={() => setTooltip({ ...d, cx })}
                        style={{ cursor: 'pointer' }}
                    >
                        {/* Inbound bar */}
                        <rect
                            x={cx - barWidth - gap / 2}
                            y={padding.top + chartH - inH}
                            width={barWidth}
                            height={Math.max(inH, 1)}
                            rx="3"
                            fill="#3B82F6"
                            opacity="0.85"
                        />
                        {/* Outbound bar */}
                        <rect
                            x={cx + gap / 2}
                            y={padding.top + chartH - outH}
                            width={barWidth}
                            height={Math.max(outH, 1)}
                            rx="3"
                            fill="#25D366"
                            opacity="0.85"
                        />
                        {/* X label */}
                        {(data.length <= 10 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && (
                            <text x={cx} y={height - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">
                                {formatDate(d.date)}
                            </text>
                        )}
                    </g>
                );
            })}

            {/* Tooltip */}
            {tooltip && (
                <g>
                    <rect x={tooltip.cx - 65} y={4} width="130" height="32" rx="6" fill="var(--text-primary)" opacity="0.92" />
                    <text x={tooltip.cx} y={16} textAnchor="middle" fill="#3B82F6" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">
                        In: {tooltip.inbound || 0}
                    </text>
                    <text x={tooltip.cx} y={30} textAnchor="middle" fill="#25D366" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">
                        Out: {tooltip.outbound || 0}
                    </text>
                </g>
            )}

            {/* Legend */}
            <circle cx={width - 150} cy={10} r="4" fill="#3B82F6" />
            <text x={width - 142} y={14} fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">Inbound</text>
            <circle cx={width - 80} cy={10} r="4" fill="#25D366" />
            <text x={width - 72} y={14} fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">Outbound</text>
        </svg>
    );
}

// ── Donut Chart Component ──
function DonutChart({ data, colors, size = 120 }) {
    if (!data || Object.keys(data).length === 0) return null;

    const entries = Object.entries(data);
    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    if (total === 0) return null;

    const radius = size / 2 - 10;
    const cx = size / 2;
    const cy = size / 2;
    let cumAngle = -90;

    const defaultColors = { paid: '#10B981', pending: '#F59E0B', failed: '#EF4444', completed: '#25D366', processing: '#3B82F6', draft: '#94A3B8' };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <svg width={size} height={size}>
                {entries.map(([key, value], i) => {
                    const angle = (value / total) * 360;
                    const startAngle = cumAngle;
                    cumAngle += angle;
                    const endAngle = cumAngle;

                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;
                    const largeArc = angle > 180 ? 1 : 0;

                    const x1 = cx + radius * Math.cos(startRad);
                    const y1 = cy + radius * Math.sin(startRad);
                    const x2 = cx + radius * Math.cos(endRad);
                    const y2 = cy + radius * Math.sin(endRad);

                    const innerR = radius * 0.6;
                    const x3 = cx + innerR * Math.cos(endRad);
                    const y3 = cy + innerR * Math.sin(endRad);
                    const x4 = cx + innerR * Math.cos(startRad);
                    const y4 = cy + innerR * Math.sin(startRad);

                    const color = (colors && colors[key]) || defaultColors[key] || `hsl(${i * 80}, 60%, 55%)`;

                    return (
                        <path
                            key={key}
                            d={`M${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${largeArc} 0 ${x4},${y4} Z`}
                            fill={color}
                            opacity="0.9"
                        />
                    );
                })}
                <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="700" fontFamily="Inter, sans-serif">
                    {total}
                </text>
                <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="Inter, sans-serif">
                    total
                </text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {entries.map(([key, value], i) => {
                    const color = (colors && colors[key]) || defaultColors[key] || `hsl(${i * 80}, 60%, 55%)`;
                    return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{key}</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: 'auto' }}>{value}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Overview Component ──
export default function Overview() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await api('/analytics/dashboard');
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Icon name="loader" size={28} />
                    <p style={{ marginTop: '12px', fontSize: '14px' }}>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div style={{ textAlign: 'center', color: 'var(--accent-danger)' }}>
                    <Icon name="alert-triangle" size={28} />
                    <p style={{ marginTop: '12px', fontSize: '14px' }}>{error}</p>
                    <button className="btn btn-primary" onClick={fetchDashboard} style={{ marginTop: '12px' }}>Retry</button>
                </div>
            </div>
        );
    }

    const { metrics, revenueOverTime, messagesOverTime, ordersByStatus, recentOrders } = data || {};

    // Sparkline data for cards
    const revenueSpark = (revenueOverTime || []).map(d => d.revenue);
    const messageSpark = (messagesOverTime || []).map(d => (d.inbound || 0) + (d.outbound || 0));

    const metricCards = [
        {
            label: 'Total Revenue',
            value: formatCurrency(metrics?.totalRevenue || 0),
            icon: 'indian-rupee',
            color: '#10B981',
            bg: 'rgba(16, 185, 129, 0.08)',
            spark: revenueSpark,
            sparkColor: '#10B981',
        },
        {
            label: 'Total Orders',
            value: formatNumber(metrics?.totalOrders || 0),
            icon: 'clipboard',
            color: '#8B5CF6',
            bg: 'rgba(139, 92, 246, 0.08)',
            spark: null,
        },
        {
            label: 'Contacts',
            value: formatNumber(metrics?.totalContacts || 0),
            icon: 'contacts',
            color: '#3B82F6',
            bg: 'rgba(59, 130, 246, 0.08)',
            spark: null,
        },
        {
            label: 'Campaigns Sent',
            value: formatNumber(metrics?.totalCampaigns || 0),
            icon: 'send',
            color: '#F59E0B',
            bg: 'rgba(245, 158, 11, 0.08)',
            spark: null,
        },
        {
            label: 'Conversations',
            value: formatNumber(metrics?.totalConversations || 0),
            icon: 'chat',
            color: '#25D366',
            bg: 'rgba(37, 211, 102, 0.08)',
            spark: messageSpark,
            sparkColor: '#25D366',
        },
    ];

    return (
        <div className="page-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                        Your business at a glance
                    </p>
                </div>
                <button className="btn btn-secondary btn-icon" onClick={fetchDashboard} title="Refresh">
                    <Icon name="refresh-cw" size={16} />
                </button>
            </div>

            {/* Metric Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
            }}>
                {metricCards.map((card) => (
                    <div
                        key={card.label}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'var(--transition-fast)',
                            boxShadow: 'var(--shadow-xs)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {card.label}
                                </p>
                                <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                                    {card.value}
                                </p>
                            </div>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                                background: card.bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Icon name={card.icon} size={20} color={card.color} />
                            </div>
                        </div>
                        {card.spark && card.spark.length >= 2 && (
                            <div style={{ marginTop: '12px', opacity: 0.8 }}>
                                <Sparkline data={card.spark} color={card.sparkColor} width={160} height={32} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
            }}>
                {/* Revenue Chart */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    boxShadow: 'var(--shadow-xs)',
                }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                        Revenue (Last 30 Days)
                    </h3>
                    <AreaChart data={revenueOverTime} dataKey="revenue" color="#10B981" label="Revenue" />
                </div>

                {/* Messages Chart */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    boxShadow: 'var(--shadow-xs)',
                }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                        Messages (Last 30 Days)
                    </h3>
                    <BarChart data={messagesOverTime} />
                </div>
            </div>

            {/* Bottom Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px',
            }}>
                {/* Order Status */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    boxShadow: 'var(--shadow-xs)',
                }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                        Order Status
                    </h3>
                    {ordersByStatus && Object.keys(ordersByStatus).length > 0 ? (
                        <DonutChart data={ordersByStatus} />
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No orders yet</p>
                    )}
                </div>

                {/* Recent Orders */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    boxShadow: 'var(--shadow-xs)',
                }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                        Recent Orders
                    </h3>
                    {recentOrders && recentOrders.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {recentOrders.map(order => (
                                <div
                                    key={order.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-tertiary)',
                                        fontSize: '13px',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: order.payment_status === 'paid' ? '#10B981' : order.payment_status === 'pending' ? '#F59E0B' : '#EF4444',
                                        }} />
                                        <div>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>#{order.id}</span>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>{order.phone}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {order.currency} {parseFloat(order.total_amount).toFixed(2)}
                                        </span>
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-full)',
                                            textTransform: 'capitalize',
                                            background: order.payment_status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            color: order.payment_status === 'paid' ? '#10B981' : '#F59E0B',
                                        }}>
                                            {order.payment_status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No orders yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}
