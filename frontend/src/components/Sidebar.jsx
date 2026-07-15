import { useState } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon from './Icons';
import { canAccessView, normalizePlanId, PLAN_IDS } from '../config/plans';

const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: 'bar-chart' },
    { id: 'contacts', label: 'Contacts', icon: 'contacts' },
    { id: 'broadcast', label: 'Broadcast', icon: 'whatsapp' },
    { id: 'chat', label: 'Chat Inbox', icon: 'chat' },
    { id: 'catalogue', label: 'Catalogue', icon: 'tag' },
    { id: 'orders', label: 'Orders', icon: 'clipboard' },
    { id: 'knowledge', label: 'Smart FAQs', icon: 'message-circle' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar({ isOpen, onClose }) {
    const { currentView, setCurrentView, user, tenant, logout, totalUnread } = useStore();
    const [logoFailed, setLogoFailed] = useState(false);
    const canOpenPlatformAdmin = user?.role === 'super_admin' || user?.is_super_admin === true;
    const visibleNavItems = NAV_ITEMS.filter(item => canAccessView(item.id, tenant?.subscription_plan, user));

    const handleNav = (viewId) => {
        setCurrentView(viewId);
        onClose?.();
    };

    const firmName = tenant?.name || 'WhatsApp Broadcast';
    const firmInitial = (firmName.trim().charAt(0) || 'W').toUpperCase();
    const logoUrl = !logoFailed && tenant?.logo_url ? tenant.logo_url : null;

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`} aria-label="Primary navigation">
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-mark" aria-hidden="true">
                    {logoUrl ? (
                        <img
                            className="sidebar-logo-image"
                            src={logoUrl}
                            alt=""
                            onError={() => setLogoFailed(true)}
                        />
                    ) : firmInitial}
                </div>
                <span className="sidebar-logo-text">{firmName}</span>
                <button className="btn-icon mobile-close-btn" type="button" onClick={onClose} aria-label="Close navigation">
                    <Icon name="x" size={18} />
                </button>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {visibleNavItems.map(item => (
                    <button
                        key={item.id}
                        className={`sidebar-nav-item ${currentView === item.id ? 'active' : ''}`}
                        onClick={() => handleNav(item.id)}
                    >
                        <Icon name={item.icon} size={18} />
                        <span>{item.label}</span>
                        {item.id === 'chat' && totalUnread > 0 && (
                            <span className="sidebar-unread-badge">
                                {totalUnread > 99 ? '99+' : totalUnread}
                            </span>
                        )}
                    </button>
                ))}

                {/* Platform admin panel is only useful when the backend grants super-admin access. */}
                {canOpenPlatformAdmin && (
                    <>
                        <div style={{ height: '1px', background: 'var(--border)', margin: '8px 12px' }} />
                        <button
                            className={`sidebar-nav-item ${currentView === 'admin' ? 'active' : ''}`}
                            onClick={() => handleNav('admin')}
                            style={{ color: currentView === 'admin' ? undefined : '#F59E0B' }}
                        >
                            <Icon name="lock" size={18} />
                            <span>Admin Panel</span>
                        </button>
                    </>
                )}
            </nav>

            {/* User */}
            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">
                        {(user?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontWeight: 600, fontSize: '13px',
                            color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {user?.name || 'User'}
                        </div>
                        <div style={{
                            fontSize: '11px', color: 'var(--text-muted)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {user?.email || ''}
                        </div>
                    </div>
                    <button className="btn-icon" onClick={logout} title="Logout">
                        <Icon name="logout" size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
