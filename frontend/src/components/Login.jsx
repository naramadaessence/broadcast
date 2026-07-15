import { useState } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon from './Icons';

/**
 * Auth Component — Single Client Workspace Login
 */
export default function AuthPage() {
    const { login, isLoading, error, clearError } = useStore();
    const [form, setForm] = useState({ email: 'admin', password: '' });
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearError?.();
        await login(form.email, form.password);
    };

    const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    return (
        <div className="auth-page">
            <section className="auth-panel" aria-label="Sign in">
                <div className="auth-brand">
                    <div className="auth-brand-mark">W</div>
                    <div>
                        <h1>Workspace Login</h1>
                        <p>Sign in to your WhatsApp Broadcast & Commerce workspace.</p>
                    </div>
                </div>



                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <label>
                        <span>Username or Email</span>
                        <input type="text" value={form.email} onInput={update('email')} placeholder="admin" required />
                    </label>

                    <label>
                        <span>Password</span>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={form.password}
                                onInput={update('password')}
                                placeholder="Enter password (default: admin123)"
                                required
                                minLength={3}
                                style={{ width: '100%', paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#94a3b8',
                                    display: 'flex',
                                    padding: 0
                                }}
                                title={showPassword ? "Hide password" : "Show password"}
                            >
                                <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                            </button>
                        </div>
                    </label>

                    <button type="submit" className="auth-submit" disabled={isLoading}>
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </section>
        </div>
    );
}
