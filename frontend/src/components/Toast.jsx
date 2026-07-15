import { useState, useEffect } from 'preact/hooks';
import { useStore } from '../stores/store';

/**
 * Toast Notification Component
 * Shows success/error/info messages with auto-dismiss
 */
export default function Toast() {
    const { toast, clearToast } = useStore();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (toast) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => clearToast(), 300); // Wait for fade out
            }, toast.duration || 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    if (!toast) return null;

    const typeStyles = {
        success: { background: 'var(--accent-success)', icon: '✓' },
        error: { background: 'var(--accent-danger)', icon: '✕' },
        warning: { background: 'var(--accent-warning)', icon: '⚠' },
        info: { background: 'var(--accent-primary)', icon: 'ℹ' }
    };

    const style = typeStyles[toast.type] || typeStyles.info;

    return (
        <div
            className={`toast ${isVisible ? 'toast-visible' : 'toast-hidden'}`}
            style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                background: style.background,
                color: 'white',
                padding: '12px 20px',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 9999,
                maxWidth: '400px',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.3s ease'
            }}
        >
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{style.icon}</span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
                onClick={() => { setIsVisible(false); setTimeout(() => clearToast(), 300); }}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '18px',
                    padding: '4px'
                }}
            >
                ✕
            </button>
        </div>
    );
}
