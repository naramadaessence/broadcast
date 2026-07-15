import { useEffect, useState } from 'preact/hooks';
import { useStore } from './stores/store';
import Icon from './components/Icons';
import AuthPage from './components/Login';
import Sidebar from './components/Sidebar';
import Contacts from './components/Contacts';
import WhatsAppBroadcast from './components/WhatsAppBroadcast';
import WhatsAppChat from './components/WhatsAppChat';
import Catalogue from './components/Catalogue';
import Settings from './components/Settings';
import AdminPanel from './components/AdminPanel';
import Toast from './components/Toast';
import KnowledgeBase from './components/KnowledgeBase';
import Orders from './components/Orders';
import Overview from './components/Overview';
import { canAccessView, getDefaultViewForPlan } from './config/plans';

const DEFAULT_BRAND_COLOR = '#128C7E';

const isValidBrandColor = (value) => /^#[0-9a-fA-F]{6}$/.test(value || '');

const hexToRgb = (hex) => {
    const normalized = hex.replace('#', '');
    return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
    };
};

const mixHex = (hex, mixWith, weight) => {
    const color = hexToRgb(hex);
    const target = hexToRgb(mixWith);
    const channel = (from, to) => Math.round(from * (1 - weight) + to * weight);
    return `#${[channel(color.r, target.r), channel(color.g, target.g), channel(color.b, target.b)]
        .map(value => value.toString(16).padStart(2, '0'))
        .join('')}`;
};

const rgba = (hex, alpha) => {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const brandTheme = (color) => {
    const brandColor = isValidBrandColor(color) ? color : DEFAULT_BRAND_COLOR;
    return {
        '--accent-primary': brandColor,
        '--accent-primary-hover': mixHex(brandColor, '#000000', 0.16),
        '--accent-primary-soft': rgba(brandColor, 0.09),
        '--accent-primary-ring': rgba(brandColor, 0.18),
        '--bg-active': rgba(brandColor, 0.08),
        '--border-focus': brandColor,
    };
};


export default function App() {
    const { isAuthenticated, isAuthReady, currentView, tenant, user, setCurrentView, validateSession } = useStore();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        validateSession();
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            useStore.getState().initSocket();
        } else {
            useStore.getState().disconnectSocket();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated || !tenant) return;
        if (!canAccessView(currentView, tenant.subscription_plan, user)) {
            setCurrentView(getDefaultViewForPlan(tenant.subscription_plan, user));
        }
    }, [isAuthenticated, tenant?.subscription_plan, currentView, user?.role, user?.is_super_admin]);

    if (!isAuthReady) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
                <Icon name="loader" size={32} color="var(--accent-primary)" />
                <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                    Loading your workspace...
                </p>
            </div>
        );
    }

    // If authenticated, show dashboard
    if (isAuthenticated) {
        const renderView = () => {
            switch (currentView) {
                case 'overview': return <Overview />;
                case 'contacts': return <Contacts />;
                case 'broadcast': return <WhatsAppBroadcast />;
                case 'chat': return <WhatsAppChat />;
                case 'catalogue': return <Catalogue />;
                case 'orders': return <Orders />;
                case 'knowledge': return <KnowledgeBase />;
                case 'settings': return <Settings />;
                case 'admin': return <AdminPanel />;
                default: return <Overview />;
            }
        };

        const logoUrl = tenant?.logo_url || null;
        const firmName = tenant?.name || 'WhatsApp Broadcast';
        const appBrandTheme = brandTheme(tenant?.primary_color);

        return (
            <div className={`app-layout ${isMobileMenuOpen ? 'nav-open' : ''}`} style={appBrandTheme}>
                <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

                <header className="mobile-header">
                    <button className="btn-icon" onClick={() => setIsMobileMenuOpen(true)} aria-label="Open navigation">
                        <Icon name="menu" size={22} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {logoUrl && <img src={logoUrl} alt={firmName} style={{ height: '40px', width: 'auto' }} />}
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{firmName}</span>
                    </div>
                    <div style={{ width: '32px' }}></div>
                </header>

                <main className="main-content">
                    {renderView()}
                </main>

                {isMobileMenuOpen && (
                    <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} aria-hidden="true" />
                )}

                <Toast />
            </div>
        );
    }

    // Not authenticated — show workspace login directly
    return (
        <>
            <AuthPage />
            <Toast />
        </>
    );
}
