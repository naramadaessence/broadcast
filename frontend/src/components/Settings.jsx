import { useState, useEffect } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon from './Icons';
import { PLAN_IDS, normalizePlanId, publicPlans } from '../config/plans';

const PLATFORM_URL = 'https://broadcast.innodify.in';
const BILLING_PLAN_COPY = {
    [PLAN_IDS.BROADCAST]: {
        title: 'Broadcast plan',
        price: 'INR 399',
        description: 'Create templates and send WhatsApp broadcasts.',
    },
    [PLAN_IDS.COMMERCE]: {
        title: 'Commerce plan',
        price: 'INR 449',
        description: 'Everything in Broadcast plus the full commerce workspace.',
    },
};

const AUTOMATION_FEATURE_FLAGS = [
    { key: 'retrieval_v2', title: 'Smart Retrieval v2', desc: 'Hybrid keyword + semantic matching with confidence bands.' },
    { key: 'disambiguation', title: '"Did you mean?"', desc: 'Tappable list of likely questions on uncertain match.' },
    { key: 'embeddings_v2', title: 'Multilingual', desc: 'Understand Hindi / Hinglish queries.' },
    { key: 'smart_flows', title: 'Smart flows', desc: 'Order status, product search, slot variables, follow-up memory.' },
    { key: 'learning', title: 'Learning flywheel', desc: 'Track misses, taps, teach-from-chat, analytics.' },
];

const WEEKDAYS = [
    { l: 'S', v: 0, name: 'Sun' },
    { l: 'M', v: 1, name: 'Mon' },
    { l: 'T', v: 2, name: 'Tue' },
    { l: 'W', v: 3, name: 'Wed' },
    { l: 'T', v: 4, name: 'Thu' },
    { l: 'F', v: 5, name: 'Fri' },
    { l: 'S', v: 6, name: 'Sat' },
];

const emptyWhatsAppForm = {
    whatsapp_access_token: '',
    whatsapp_app_secret: '',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    whatsapp_catalog_id: '',
};

const profileFromSettings = (settings = {}) => ({
    name: settings.name || '',
    email: settings.email || '',
    phone: settings.phone || '',
    logo_url: settings.logo_url || '',
    primary_color: settings.primary_color || '#25D366',
});

const parseBotSettings = (settings = {}) => {
    if (!settings.bot_settings) return {};
    try {
        return typeof settings.bot_settings === 'string'
            ? JSON.parse(settings.bot_settings)
            : settings.bot_settings;
    } catch (e) {
        console.error('Error parsing bot_settings:', e);
        return {};
    }
};

const botFormFromSettings = (settings = {}) => {
    const parsedBotSettings = parseBotSettings(settings);
    return {
        enabled: parsedBotSettings.enabled !== false,
        after_hours_action: parsedBotSettings.after_hours_action || 'respond_normally',
        away_message: parsedBotSettings.away_message || '',
        razorpay_key_id: parsedBotSettings.razorpay_key_id || '',
        razorpay_key_secret: parsedBotSettings.razorpay_key_secret || '',
        razorpay_webhook_secret: parsedBotSettings.razorpay_webhook_secret || '',
        address_prompt_template: parsedBotSettings.address_prompt_template || 'Great! Your total is ₹{total}.\n\nPlease reply with your full delivery address to proceed.',
        payment_link_template: parsedBotSettings.payment_link_template || 'Thanks for the address!\n\nPlease complete your payment of {currency} {total} here:\n{link}',
        payment_success_template: parsedBotSettings.payment_success_template || '🎉 Payment Received!\n\nThank you for your payment of {currency} {total}. Your order #{order_id} is now confirmed and being processed.',
        flags: {
            retrieval_v2: false,
            embeddings_v2: false,
            disambiguation: false,
            smart_flows: false,
            learning: false,
            ...(parsedBotSettings.flags || {}),
        },
        store_hours: {
            enabled: parsedBotSettings.store_hours?.enabled || false,
            timezone: parsedBotSettings.store_hours?.timezone || 'Asia/Kolkata',
            start: parsedBotSettings.store_hours?.start || '09:00',
            end: parsedBotSettings.store_hours?.end || '18:00',
            days: Array.isArray(parsedBotSettings.store_hours?.days)
                ? parsedBotSettings.store_hours.days
                : [1, 2, 3, 4, 5],
        },
    };
};

const displayValue = (value, fallback = 'Not set') => value || fallback;

const formatBusinessDays = (days = []) => {
    const names = WEEKDAYS.filter(day => days.includes(day.v)).map(day => day.name);
    return names.length ? names.join(', ') : 'No days selected';
};

const formatSyncTotals = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return '';
    }
};

/**
 * Settings Component — Tenant admin settings page
 * Tabs: Firm Profile | WhatsApp | Subscription
 */
export default function Settings() {
    const {
        tenantSettings,
        fetchTenantSettings,
        updateTenantProfile, updateWhatsAppConfig, disconnectWhatsApp,
        createBillingOrder, verifyBillingPayment,
        fetchShopifyIntegration, saveShopifyIntegration, syncShopifyProducts,
        updateChatbotSettings,
        fetchSmartAutomationOverview, runSmartAutomationTest, clusterSmartAutomationSuggestions,
        showToast, tenant
    } = useStore();

    const [activeTab, setActiveTab] = useState('profile');
    const [saving, setSaving] = useState(false);
    const [billingBusy, setBillingBusy] = useState('');
    const [isProfileEditing, setIsProfileEditing] = useState(false);
    const [isWhatsAppEditing, setIsWhatsAppEditing] = useState(false);
    const [isChatbotEditing, setIsChatbotEditing] = useState(false);
    const [isShopifyEditing, setIsShopifyEditing] = useState(false);

    // Profile form
    const [profileForm, setProfileForm] = useState(profileFromSettings());

    const [waForm, setWaForm] = useState(emptyWhatsAppForm);
    const [shopifyForm, setShopifyForm] = useState({ shop_domain: '', client_id: '', client_secret: '', sync_enabled: true });
    const [shopifyIntegration, setShopifyIntegration] = useState(null);
    const [shopifySyncRuns, setShopifySyncRuns] = useState([]);
    const [shopifyBusy, setShopifyBusy] = useState(false);

    // Chatbot settings form
    const [botForm, setBotForm] = useState(botFormFromSettings());

    // Embedding-model status (Phase 2)
    const [embStatus, setEmbStatus] = useState(null);
    const [embBusy, setEmbBusy] = useState(false);
    const [selectedModel, setSelectedModel] = useState('');
    const [automationOverview, setAutomationOverview] = useState(null);
    const [automationBusy, setAutomationBusy] = useState(false);
    const [automationTestMessage, setAutomationTestMessage] = useState('');
    const [automationTestResult, setAutomationTestResult] = useState(null);

    useEffect(() => {
        fetchTenantSettings();
    }, []);

    useEffect(() => {
        if (tenantSettings) {
            setProfileForm(profileFromSettings(tenantSettings));
            setBotForm(botFormFromSettings(tenantSettings));
        }
    }, [tenantSettings]);

    const handleDayToggle = (dayNum) => {
        setBotForm(prev => {
            const currentDays = prev.store_hours.days || [];
            let newDays;
            if (currentDays.includes(dayNum)) {
                newDays = currentDays.filter(d => d !== dayNum);
            } else {
                newDays = [...currentDays, dayNum].sort();
            }
            return {
                ...prev,
                store_hours: {
                    ...prev.store_hours,
                    days: newDays
                }
            };
        });
    };

    const cancelProfileEdit = () => {
        setProfileForm(profileFromSettings(tenantSettings || {}));
        setIsProfileEditing(false);
    };

    const cancelWhatsAppEdit = () => {
        setWaForm({ ...emptyWhatsAppForm });
        setIsWhatsAppEditing(false);
    };

    const loadShopifyIntegration = async () => {
        try {
            const data = await fetchShopifyIntegration();
            setShopifyIntegration(data.connection);
            setShopifySyncRuns(data.sync_runs || []);
            setShopifyForm({
                shop_domain: data.connection?.shop_domain || '',
                client_id: '',
                client_secret: '',
                sync_enabled: data.connection?.sync_enabled !== false,
            });
        } catch (err) {
            console.error('Shopify integration error:', err);
        }
    };

    const cancelShopifyEdit = () => {
        setShopifyForm({
            shop_domain: shopifyIntegration?.shop_domain || '',
            client_id: '',
            client_secret: '',
            sync_enabled: shopifyIntegration?.sync_enabled !== false,
        });
        setIsShopifyEditing(false);
    };

    const cancelChatbotEdit = () => {
        setBotForm(botFormFromSettings(tenantSettings || {}));
        setIsChatbotEditing(false);
    };

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateTenantProfile(profileForm);
            setIsProfileEditing(false);
            showToast('Firm profile updated!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleChatbotSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateChatbotSettings(botForm);
            setIsChatbotEditing(false);
            showToast('Chatbot settings updated!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- Smart Automation: embedding-model status + re-embed ---
    const authHeaders = () => ({
        'Authorization': `Bearer ${localStorage.getItem('narmada_broadcast_token')}`,
        'x-tenant-slug': localStorage.getItem('tenant_slug') || 'default',
        'Content-Type': 'application/json',
    });

    const fetchEmbStatus = async () => {
        try {
            const res = await fetch('/api/v1/tenant-settings/embeddings', { headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setEmbStatus(data);
                setSelectedModel((prev) => prev || data.active_model);
            }
        } catch { /* non-fatal */ }
    };

    const fetchAutomationOverview = async () => {
        try {
            const data = await fetchSmartAutomationOverview();
            setAutomationOverview(data);
        } catch (err) {
            console.error('Smart Automation overview error:', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'shopify') {
            loadShopifyIntegration();
        }
        if (activeTab === 'chatbot') {
            fetchEmbStatus();
            fetchAutomationOverview();
        }
    }, [activeTab]);

    const handleReembed = async () => {
        if (!selectedModel) return;
        if (!confirm(`Re-embed all FAQs & products with "${selectedModel}" and switch the bot to it? This runs on-device and may take a moment.`)) return;
        setEmbBusy(true);
        try {
            const res = await fetch('/api/v1/tenant-settings/embeddings/reembed', {
                method: 'POST', headers: authHeaders(), body: JSON.stringify({ model: selectedModel }),
            });
            const data = await res.json();
            if (res.ok) {
                showToast(`Re-embedded onto ${data.model} (${data.faqs} FAQs, ${data.products} products).`, 'success');
                await fetchEmbStatus();
                fetchTenantSettings();
            } else {
                showToast(data.error || 'Re-embed failed', 'error');
            }
        } catch (err) {
            showToast('Re-embed failed: ' + err.message, 'error');
        } finally {
            setEmbBusy(false);
        }
    };

    const handleAutomationTest = async () => {
        if (!automationTestMessage.trim()) return;
        setAutomationBusy(true);
        try {
            const result = await runSmartAutomationTest(automationTestMessage.trim());
            setAutomationTestResult(result);
        } catch (err) {
            showToast(err.message || 'Smart Automation test failed', 'error');
        } finally {
            setAutomationBusy(false);
        }
    };

    const handleClusterSuggestions = async () => {
        setAutomationBusy(true);
        try {
            await clusterSmartAutomationSuggestions();
            await fetchAutomationOverview();
            showToast('Suggestions queue refreshed', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to refresh suggestions', 'error');
        } finally {
            setAutomationBusy(false);
        }
    };

    const handleWhatsAppSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateWhatsAppConfig(waForm);
            showToast('WhatsApp configured! Credentials verified with Meta.', 'success');
            setWaForm({ ...emptyWhatsAppForm });
            setIsWhatsAppEditing(false);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnectWhatsApp = async () => {
        if (!confirm('Disconnect WhatsApp? You won\'t be able to send broadcasts until you reconnect.')) return;
        try {
            await disconnectWhatsApp();
            showToast('WhatsApp disconnected', 'info');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleShopifySave = async (e) => {
        e.preventDefault();
        setShopifyBusy(true);
        try {
            const data = await saveShopifyIntegration(shopifyForm);
            setShopifyIntegration(data.connection);
            setShopifyForm({
                shop_domain: data.connection?.shop_domain || '',
                client_id: '',
                client_secret: '',
                sync_enabled: data.connection?.sync_enabled !== false,
            });
            setIsShopifyEditing(false);
            showToast('Shopify integration saved', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setShopifyBusy(false);
        }
    };

    const handleShopifySync = async () => {
        setShopifyBusy(true);
        try {
            await syncShopifyProducts();
            await loadShopifyIntegration();
            showToast('Shopify Sync queued', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setShopifyBusy(false);
        }
    };

    const loadRazorpayCheckout = () => new Promise((resolve, reject) => {
        if (window.Razorpay) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
        document.body.appendChild(script);
    });

    const startPlanCheckout = async (planId) => {
        setBillingBusy(planId);
        try {
            const order = await createBillingOrder(planId);
            await loadRazorpayCheckout();

            if (!window.Razorpay) {
                throw new Error('Razorpay Checkout did not load');
            }

            const checkout = new window.Razorpay({
                key: order.key_id,
                amount: order.amount,
                currency: order.currency,
                name: 'WhatsApp Broadcast',
                description: `${order.plan.displayName} monthly plan`,
                order_id: order.order_id,
                prefill: {
                    name: tenantSettings?.name || tenant?.name || '',
                    email: tenantSettings?.email || tenant?.email || '',
                    contact: tenantSettings?.phone || tenant?.phone || '',
                },
                notes: {
                    plan: planId,
                    tenant: tenantSettings?.slug || tenant?.slug || '',
                },
                handler: async (response) => {
                    try {
                        await verifyBillingPayment({
                            plan: planId,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        showToast('Plan activated successfully', 'success');
                    } catch (err) {
                        showToast(err.message || 'Payment verification failed', 'error');
                    } finally {
                        setBillingBusy('');
                    }
                },
                modal: {
                    ondismiss: () => setBillingBusy(''),
                },
            });

            checkout.open();
        } catch (err) {
            showToast(err.message || 'Could not start checkout', 'error');
            setBillingBusy('');
        }
    };

    const tabs = [
        { id: 'profile', label: 'Firm Profile', icon: 'briefcase' },
        { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
        { id: 'shopify', label: 'Shopify Sync', icon: 'refresh-cw' },
        { id: 'chatbot', label: 'Automation & Hours', icon: 'message-circle' },
    ];
    const parsedBotSettings = parseBotSettings(tenantSettings || {});
    const isCommercePlan = true;
    const activeFeatureCount = AUTOMATION_FEATURE_FLAGS.filter(flag => botForm.flags?.[flag.key]).length;
    const configuredRazorpaySecrets = [
        parsedBotSettings.razorpay_key_id,
        parsedBotSettings.has_razorpay_key_secret,
        parsedBotSettings.has_razorpay_webhook_secret,
    ].filter(Boolean).length;
    const businessHoursText = botForm.store_hours.enabled
        ? `${botForm.store_hours.start}–${botForm.store_hours.end}, ${formatBusinessDays(botForm.store_hours.days)}`
        : 'Disabled';

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Manage your firm's profile, integrations, and subscription</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    >
                        <Icon name={tab.icon} size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Profile Tab ── */}
            {activeTab === 'profile' && (
                <div className="card" style={{ maxWidth: '600px' }}>
                    <div className="settings-section-header">
                        <h2>Firm Profile</h2>
                        {!isProfileEditing && (
                            <button type="button" className="btn btn-secondary" onClick={() => setIsProfileEditing(true)}>
                                Edit Profile
                            </button>
                        )}
                    </div>
                    {!isProfileEditing ? (
                        <div className="settings-readonly-list">
                            <div className="settings-summary-grid">
                                <div className="settings-summary-item">
                                    <span>Firm name</span>
                                    <strong>{displayValue(tenantSettings?.name)}</strong>
                                </div>
                                <div className="settings-summary-item">
                                    <span>Contact email</span>
                                    <strong>{displayValue(tenantSettings?.email)}</strong>
                                </div>
                                <div className="settings-summary-item">
                                    <span>Phone</span>
                                    <strong>{displayValue(tenantSettings?.phone)}</strong>
                                </div>
                                <div className="settings-summary-item">
                                    <span>Brand color</span>
                                    <strong className="settings-color-value">
                                        <i style={{ background: tenantSettings?.primary_color || '#25D366' }} />
                                        {tenantSettings?.primary_color || '#25D366'}
                                    </strong>
                                </div>
                            </div>
                            <div className="settings-profile-meta-grid">
                                <div className="settings-profile-meta-item">
                                    <span>Login URL</span>
                                    <div className="settings-profile-meta-value">{PLATFORM_URL}</div>
                                </div>
                                <div className="settings-profile-meta-item">
                                    <span>Workspace slug</span>
                                    <div className="settings-profile-meta-value">{tenantSettings?.slug || 'workspace'}</div>
                                </div>
                            </div>
                            <div className="settings-summary-item">
                                <span>Logo URL</span>
                                <strong>{displayValue(tenantSettings?.logo_url)}</strong>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleProfileSave}>
                            <div className="form-group">
                                <label className="form-label">Firm Name *</label>
                                <input className="form-input" value={profileForm.name}
                                    onInput={e => setProfileForm(p => ({ ...p, name: e.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contact Email *</label>
                                <input type="email" className="form-input" value={profileForm.email}
                                    onInput={e => setProfileForm(p => ({ ...p, email: e.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-input" value={profileForm.phone}
                                    onInput={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                                    placeholder="+91 98765 43210" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Logo URL</label>
                                <input type="url" className="form-input" value={profileForm.logo_url}
                                    onInput={e => setProfileForm(p => ({ ...p, logo_url: e.target.value }))}
                                    placeholder="https://example.com/logo.png" />
                                {profileForm.logo_url && (
                                    <div style={{ marginTop: '8px' }}>
                                        <img src={profileForm.logo_url} alt="Logo preview"
                                            style={{ maxHeight: '60px', borderRadius: '8px' }} />
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Brand Color</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="color" value={profileForm.primary_color}
                                        onInput={e => setProfileForm(p => ({ ...p, primary_color: e.target.value }))}
                                        style={{ width: '48px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                                    <input className="form-input" value={profileForm.primary_color}
                                        onInput={e => setProfileForm(p => ({ ...p, primary_color: e.target.value }))}
                                        pattern="#[0-9a-fA-F]{6}"
                                        maxLength={7}
                                        placeholder="#128C7E"
                                        style={{ maxWidth: '120px' }} />
                                </div>
                            </div>
                            <div className="settings-form-actions">
                                <button type="button" className="btn btn-secondary" onClick={cancelProfileEdit} disabled={saving}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* ── WhatsApp Tab ── */}
            {activeTab === 'whatsapp' && (
                <div style={{ maxWidth: '600px' }}>
                    {/* Status */}
                    <div className="card" style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
                                    WhatsApp Integration
                                </h3>
                                <p style={{
                                    color: tenantSettings?.whatsapp_configured ? 'var(--accent-success)' : 'var(--text-muted)',
                                    fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0,
                                }}>
                                    <span style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: tenantSettings?.whatsapp_configured ? 'var(--accent-success)' : 'var(--accent-danger)',
                                        display: 'inline-block',
                                    }} />
                                    {tenantSettings?.whatsapp_configured ? 'Connected' : 'Not Connected'}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setIsWhatsAppEditing(true)}
                                    style={{ fontSize: '12px' }}>
                                    {tenantSettings?.whatsapp_configured ? 'Update Credentials' : 'Connect WhatsApp'}
                                </button>
                                {tenantSettings?.whatsapp_configured && (
                                    <button className="btn btn-secondary" onClick={handleDisconnectWhatsApp}
                                        style={{ fontSize: '12px' }}>Disconnect</button>
                                )}
                            </div>
                        </div>

                        {tenantSettings?.whatsapp_configured && (
                            <div style={{
                                marginTop: '12px', padding: '12px',
                                background: 'var(--bg-tertiary)', borderRadius: '8px',
                                fontSize: '13px', color: 'var(--text-secondary)',
                                display: 'flex', flexDirection: 'column', gap: '4px',
                            }}>
                                <div><strong>Phone Number ID:</strong> {tenantSettings.whatsapp_phone_number_id}</div>
                                <div><strong>Business Account ID:</strong> {tenantSettings.whatsapp_business_account_id}</div>
                                {tenantSettings.whatsapp_catalog_id && <div><strong>Commerce Catalog ID:</strong> {tenantSettings.whatsapp_catalog_id}</div>}
                                <div><strong>Access Token:</strong> ••••••{tenantSettings.whatsapp_access_token?.slice(-6)}</div>
                                <div><strong>App Secret:</strong> {tenantSettings.whatsapp_app_secret_configured ? 'Configured' : 'Missing'}</div>
                            </div>
                        )}
                        {!isWhatsAppEditing && (
                            <p style={{ margin: '12px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                                Credentials are hidden until you intentionally update them.
                            </p>
                        )}
                    </div>

                    {/* Config Form */}
                    {isWhatsAppEditing && (
                    <div className="card">
                        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
                            {tenantSettings?.whatsapp_configured ? 'Update Credentials' : 'Connect WhatsApp'}
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>
                            Get these from{' '}
                            <a href="https://developers.facebook.com" target="_blank" rel="noopener">
                                Meta Developer Portal
                            </a>{' '}
                            → Your App → WhatsApp → API Setup, and App settings → Basic
                        </p>

                        <form onSubmit={handleWhatsAppSave}>
                            <div className="form-group">
                                <label className="form-label">Permanent Access Token *</label>
                                <input type="password" className="form-input"
                                    value={waForm.whatsapp_access_token}
                                    onInput={e => setWaForm(f => ({ ...f, whatsapp_access_token: e.target.value }))}
                                    placeholder="EAAxxxxx..." required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Meta App Secret *</label>
                                <input type="password" className="form-input"
                                    value={waForm.whatsapp_app_secret}
                                    onInput={e => setWaForm(f => ({ ...f, whatsapp_app_secret: e.target.value }))}
                                    placeholder="App secret from Meta App settings" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number ID *</label>
                                <input className="form-input"
                                    value={waForm.whatsapp_phone_number_id}
                                    onInput={e => setWaForm(f => ({ ...f, whatsapp_phone_number_id: e.target.value }))}
                                    placeholder="123456789012345" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">WhatsApp Business Account ID *</label>
                                <input className="form-input"
                                    value={waForm.whatsapp_business_account_id}
                                    onInput={e => setWaForm(f => ({ ...f, whatsapp_business_account_id: e.target.value }))}
                                    placeholder="123456789012345" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Commerce Catalog ID (Optional for Products)</label>
                                <input className="form-input"
                                    value={waForm.whatsapp_catalog_id}
                                    onInput={e => setWaForm(f => ({ ...f, whatsapp_catalog_id: e.target.value }))}
                                    placeholder="e.g. 543210987654321" />
                            </div>

                            <div className="info-box" style={{ marginBottom: '16px' }}>
                                <strong>Note:</strong> We'll verify these credentials with Meta's API before saving. Make sure your token is a permanent (System User) token, not a temporary one.
                            </div>

                            <div className="settings-form-actions">
                                <button type="button" className="btn btn-secondary" onClick={cancelWhatsAppEdit} disabled={saving}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Verifying & Saving...' : 'Save & Verify'}
                                </button>
                            </div>
                        </form>
                    </div>
                    )}
                </div>
            )}

            {/* -- Shopify Sync Tab -- */}
            {activeTab === 'shopify' && (
                <div style={{ maxWidth: '760px' }}>
                    <div className="card" style={{ marginBottom: '16px' }}>
                        <div className="settings-section-header">
                            <div>
                                <h2>Shopify Sync</h2>
                                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    Import Shopify products into Catalogue using this tenant's own Shopify store credentials.
                                </p>
                            </div>
                            {!isShopifyEditing && (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsShopifyEditing(true)} disabled={!isCommercePlan}>
                                        {shopifyIntegration?.connected ? 'Update Connection' : 'Connect Shopify'}
                                    </button>
                                    {shopifyIntegration?.connected && (
                                        <button type="button" className="btn btn-primary" onClick={handleShopifySync} disabled={!isCommercePlan || shopifyBusy}>
                                            {shopifyBusy ? 'Queueing...' : 'Sync Products'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {!isShopifyEditing ? (
                            <div className="settings-readonly-list">
                                <div className="settings-summary-grid">
                                    <div className="settings-summary-item">
                                        <span>Connection</span>
                                        <strong className={shopifyIntegration?.connected ? 'settings-status-pill is-on' : 'settings-status-pill'}>
                                            {shopifyIntegration?.connected ? 'Connected' : 'Not connected'}
                                        </strong>
                                    </div>
                                    <div className="settings-summary-item">
                                        <span>Shop domain</span>
                                        <strong>{displayValue(shopifyIntegration?.shop_domain)}</strong>
                                    </div>
                                    <div className="settings-summary-item">
                                        <span>Client ID</span>
                                        <strong>{shopifyIntegration?.has_client_id ? 'Configured' : 'Missing'}</strong>
                                    </div>
                                    <div className="settings-summary-item">
                                        <span>Client Secret</span>
                                        <strong>{shopifyIntegration?.has_client_secret ? 'Configured' : shopifyIntegration?.has_access_token ? 'Legacy token configured' : 'Missing'}</strong>
                                    </div>
                                    <div className="settings-summary-item">
                                        <span>Last sync</span>
                                        <strong>{shopifyIntegration?.last_sync_at || 'Never'}</strong>
                                    </div>
                                </div>
                                {shopifyIntegration?.last_sync_error && (
                                    <div className="info-box" style={{ borderColor: '#fecaca', background: '#fff7f7' }}>
                                        <strong>Last sync failed:</strong> {shopifyIntegration.last_sync_error}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleShopifySave}>
                                <div className="form-group">
                                    <label className="form-label">Shop domain *</label>
                                    <input
                                        className="form-input"
                                        value={shopifyForm.shop_domain}
                                        onInput={e => setShopifyForm(f => ({ ...f, shop_domain: e.target.value }))}
                                        placeholder="your-store.myshopify.com"
                                        required
                                    />
                                </div>
                                <div className="info-box" style={{ marginBottom: '14px' }}>
                                    Use the Client ID and Client Secret from your Shopify Dev Dashboard app settings. App automation tokens are only for CI/CD and cannot sync products.
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Client ID {shopifyIntegration?.has_client_id ? '(leave blank to keep current)' : '*'}</label>
                                    <input
                                        className="form-input"
                                        value={shopifyForm.client_id}
                                        onInput={e => setShopifyForm(f => ({ ...f, client_id: e.target.value }))}
                                        placeholder="Client ID from Shopify Dev Dashboard"
                                        required={!shopifyIntegration?.has_client_id}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Client Secret {shopifyIntegration?.has_client_secret ? '(leave blank to keep current)' : '*'}</label>
                                    <input
                                        className="form-input"
                                        type="password"
                                        value={shopifyForm.client_secret}
                                        onInput={e => setShopifyForm(f => ({ ...f, client_secret: e.target.value }))}
                                        placeholder="Client Secret from Shopify Dev Dashboard"
                                        required={!shopifyIntegration?.has_client_secret}
                                    />
                                </div>
                                <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', marginBottom: '16px' }}>
                                    <input
                                        type="checkbox"
                                        checked={shopifyForm.sync_enabled}
                                        onChange={e => setShopifyForm(f => ({ ...f, sync_enabled: e.target.checked }))}
                                    />
                                    Enable product sync for this store
                                </label>
                                <div className="settings-form-actions">
                                    <button type="button" className="btn btn-secondary" onClick={cancelShopifyEdit} disabled={shopifyBusy}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={!isCommercePlan || shopifyBusy}>
                                        {shopifyBusy ? 'Saving...' : 'Save Shopify'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    <div className="card">
                        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Recent sync runs</h3>
                        {shopifySyncRuns.length === 0 ? (
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>No syncs queued yet.</p>
                        ) : (
                            <div className="settings-readonly-list">
                                {shopifySyncRuns.slice(0, 5).map(run => (
                                    <div key={run.id} className="settings-summary-item">
                                        <span>{run.created_at}</span>
                                        <strong>{run.status}{run.totals ? ` - ${formatSyncTotals(run.totals)}` : ''}</strong>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Automation & Hours Tab */}
            {activeTab === 'chatbot' && (
                <div className="settings-chatbot-grid">
                    {/* ── LEFT: Bot Configuration ── */}
                    <div className="card">
                        {!isChatbotEditing ? (
                            <div className="settings-readonly-list">
                                <div className="settings-section-header">
                                    <h2>Bot Configuration</h2>
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsChatbotEditing(true)}>
                                        Edit Bot Settings
                                    </button>
                                </div>
                                <div className="settings-summary-grid">
                                    <div className="settings-summary-item">
                                        <span>Status</span>
                                        <strong className={botForm.enabled ? 'settings-status-pill is-on' : 'settings-status-pill'}>
                                            {botForm.enabled ? 'Active' : 'Inactive'}
                                        </strong>
                                    </div>
                                    <div className="settings-summary-item">
                                        <span>Smart features</span>
                                        <strong>{activeFeatureCount} of {AUTOMATION_FEATURE_FLAGS.length} enabled</strong>
                                    </div>
                                    <div className="settings-summary-item">
                                        <span>Business hours</span>
                                        <strong>{businessHoursText}</strong>
                                    </div>
                                    <div className="settings-summary-item">
                                        <span>Embedding model</span>
                                        <strong>{embStatus?.active_model || 'Loading...'}</strong>
                                    </div>
                                    <div className="settings-summary-item">
                                        <span>After-hours action</span>
                                        <strong>{botForm.after_hours_action.replace(/_/g, ' ')}</strong>
                                    </div>
                                    <div className="settings-summary-item">
                                        <span>Razorpay</span>
                                        <strong>{configuredRazorpaySecrets ? `${configuredRazorpaySecrets} setting${configuredRazorpaySecrets > 1 ? 's' : ''} configured` : 'Not configured'}</strong>
                                    </div>
                                </div>
                                <div className="settings-feature-list">
                                    {AUTOMATION_FEATURE_FLAGS.map(feature => (
                                        <div key={feature.key} className="settings-feature-row">
                                            <div>
                                                <strong>{feature.title}</strong>
                                                <span>{feature.desc}</span>
                                            </div>
                                            <em className={botForm.flags?.[feature.key] ? 'is-on' : ''}>
                                                {botForm.flags?.[feature.key] ? 'On' : 'Off'}
                                            </em>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                        <form onSubmit={handleChatbotSave}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, fontSize: '17px' }}>Bot Configuration</h2>
                                <label htmlFor="bot-enabled" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: botForm.enabled ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                                    <input type="checkbox" id="bot-enabled" checked={botForm.enabled}
                                        onChange={e => setBotForm(f => ({ ...f, enabled: e.target.checked }))}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                    {botForm.enabled ? 'Active' : 'Inactive'}
                                </label>
                            </div>

                            {/* Feature Flags */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Smart Automation</div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>Each feature is additive and off by default.</p>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    {AUTOMATION_FEATURE_FLAGS.map(f => (
                                        <label key={f.key} htmlFor={`flag-${f.key}`}
                                            style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: botForm.flags?.[f.key] ? 'var(--accent-primary-alpha, rgba(37,211,102,0.06))' : 'var(--bg-tertiary)', cursor: 'pointer', border: '1px solid', borderColor: botForm.flags?.[f.key] ? 'var(--accent-primary)' : 'transparent', transition: 'all 0.15s' }}>
                                            <input type="checkbox" id={`flag-${f.key}`}
                                                checked={botForm.flags?.[f.key] === true}
                                                onChange={e => setBotForm(prev => ({ ...prev, flags: { ...prev.flags, [f.key]: e.target.checked } }))}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer', marginTop: '1px', flexShrink: 0 }} />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.3 }}>{f.title}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3 }}>{f.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Embedding Model */}
                            <div style={{ background: 'var(--bg-tertiary)', padding: '12px 14px', borderRadius: '8px', marginBottom: '20px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Embedding Model</div>
                                {embStatus ? (<>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Active: <strong>{embStatus.active_model}</strong></div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <select className="form-select" style={{ flex: 1, minWidth: '140px' }} value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                                            {(embStatus.available_models || []).map(m => (<option key={m.key} value={m.key}>{m.label}</option>))}
                                        </select>
                                        <button type="button" className="btn btn--outline" disabled={embBusy || !selectedModel} onClick={handleReembed} style={{ whiteSpace: 'nowrap' }}>
                                            {embBusy ? 'Re-embedding…' : 'Re-embed & Switch'}
                                        </button>
                                    </div>
                                </>) : (<div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading model status…</div>)}
                            </div>

                            {/* Business Hours */}
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <input type="checkbox" id="hours-enabled" checked={botForm.store_hours.enabled}
                                        onChange={e => setBotForm(f => ({ ...f, store_hours: { ...f.store_hours, enabled: e.target.checked } }))}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                    <label htmlFor="hours-enabled" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', margin: 0 }}>Business Hours</label>
                                </div>
                                {botForm.store_hours.enabled && (<>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '8px', marginBottom: '12px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: '11px' }}>Timezone</label>
                                                <select className="form-select" value={botForm.store_hours.timezone}
                                                    onChange={e => setBotForm(f => ({ ...f, store_hours: { ...f.store_hours, timezone: e.target.value } }))}>
                                                    <option value="Asia/Kolkata">IST</option><option value="UTC">UTC</option>
                                                    <option value="America/New_York">EST/EDT</option><option value="Europe/London">GMT/BST</option>
                                                    <option value="Asia/Dubai">GST</option><option value="Asia/Singapore">SGT</option>
                                                    <option value="Australia/Sydney">AEST</option>
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: '11px' }}>Open</label>
                                                <input type="time" className="form-input" value={botForm.store_hours.start}
                                                    onChange={e => setBotForm(f => ({ ...f, store_hours: { ...f.store_hours, start: e.target.value } }))} required />
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: '11px' }}>Close</label>
                                                <input type="time" className="form-input" value={botForm.store_hours.end}
                                                    onChange={e => setBotForm(f => ({ ...f, store_hours: { ...f.store_hours, end: e.target.value } }))} required />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {WEEKDAYS.map(d => (
                                                <button key={d.v} type="button" onClick={() => handleDayToggle(d.v)}
                                                    style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid', borderColor: botForm.store_hours.days.includes(d.v) ? 'var(--accent-primary)' : 'var(--border-color)', background: botForm.store_hours.days.includes(d.v) ? 'var(--accent-primary)' : 'transparent', color: botForm.store_hours.days.includes(d.v) ? '#fff' : 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                                    {d.l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ margin: '0 0 8px 0' }}>
                                        <label className="form-label" style={{ fontSize: '12px' }}>After-hours action</label>
                                        <select className="form-select" value={botForm.after_hours_action}
                                            onChange={e => setBotForm(f => ({ ...f, after_hours_action: e.target.value }))}>
                                            <option value="respond_normally">Respond Normally (Smart Automation)</option>
                                            <option value="send_away_message">Send Away Message</option>
                                            <option value="remain_silent">Remain Silent</option>
                                        </select>
                                    </div>
                                    {botForm.after_hours_action === 'send_away_message' && (
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <textarea className="form-textarea" rows={2} value={botForm.away_message}
                                                onChange={e => setBotForm(f => ({ ...f, away_message: e.target.value }))}
                                                placeholder="We are currently closed. We'll get back to you soon!" required />
                                        </div>
                                    )}
                                </>)}
                            </div>

                            {/* Razorpay */}
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '16px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Razorpay Integration</div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '0 0 10px 0' }}>Payment links for customer orders.</p>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label" style={{ fontSize: '12px' }}>Key ID</label>
                                        <input className="form-input" type="text" value={botForm.razorpay_key_id}
                                            onInput={e => setBotForm(f => ({ ...f, razorpay_key_id: e.target.value }))} placeholder="rzp_live_XXXXX..." />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label" style={{ fontSize: '12px' }}>Key Secret</label>
                                            <input className="form-input" type="password" value={botForm.razorpay_key_secret}
                                                onInput={e => setBotForm(f => ({ ...f, razorpay_key_secret: e.target.value }))} placeholder="Secret" />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label" style={{ fontSize: '12px' }}>Webhook Secret</label>
                                            <input className="form-input" type="password" value={botForm.razorpay_webhook_secret}
                                                onInput={e => setBotForm(f => ({ ...f, razorpay_webhook_secret: e.target.value }))} placeholder="Optional" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Message Templates */}
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '16px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Order Message Templates</div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '0 0 10px 0' }}>
                                    Variables: <code style={{ fontSize: '10px', background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>{`{total}`}</code>{' '}
                                    <code style={{ fontSize: '10px', background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>{`{currency}`}</code>{' '}
                                    <code style={{ fontSize: '10px', background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>{`{link}`}</code>{' '}
                                    <code style={{ fontSize: '10px', background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>{`{order_id}`}</code>
                                </p>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label" style={{ fontSize: '12px' }}>Address Collection</label>
                                        <textarea className="form-textarea" rows={2} value={botForm.address_prompt_template}
                                            onInput={e => setBotForm(f => ({ ...f, address_prompt_template: e.target.value }))} placeholder="Your total is ₹{total}. Please reply with your delivery address." required />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label" style={{ fontSize: '12px' }}>Payment Link</label>
                                        <textarea className="form-textarea" rows={2} value={botForm.payment_link_template}
                                            onInput={e => setBotForm(f => ({ ...f, payment_link_template: e.target.value }))} placeholder="Complete payment of {currency} {total} here: {link}" required />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label" style={{ fontSize: '12px' }}>Payment Confirmation</label>
                                        <textarea className="form-textarea" rows={2} value={botForm.payment_success_template}
                                            onInput={e => setBotForm(f => ({ ...f, payment_success_template: e.target.value }))} placeholder="🎉 Payment Received! Order #{order_id} confirmed." required />
                                    </div>
                                </div>
                            </div>

                            <div className="settings-form-actions">
                                <button type="button" className="btn btn-secondary" onClick={cancelChatbotEdit} disabled={saving}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Saving…' : 'Save All Settings'}
                                </button>
                            </div>
                        </form>
                        )}
                    </div>

                    {/* Smart Automation Control Center */}
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {/* Score + Metrics */}
                        <div className="card" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                <h2 style={{ margin: 0, fontSize: '17px' }}>Smart Automation Control Center</h2>
                                <button type="button" className="btn btn--outline" onClick={fetchAutomationOverview} disabled={automationBusy} style={{ fontSize: '12px', padding: '4px 12px' }}>↻ Refresh</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-primary)', lineHeight: 1 }}>{automationOverview?.score?.score ?? '—'}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>Smartness Score</div>
                                    {automationOverview?.score?.grade && <div style={{ fontSize: '10px', marginTop: '2px', color: 'var(--text-muted)' }}>Grade: <strong style={{ color: automationOverview.score.grade === 'A' ? 'var(--accent-success)' : automationOverview.score.grade === 'F' ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{automationOverview.score.grade}</strong></div>}
                                </div>
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-success)', lineHeight: 1 }}>{automationOverview?.analytics?.deflection_rate ?? 0}<span style={{ fontSize: '14px' }}>%</span></div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>Deflection</div>
                                </div>
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 800, color: automationOverview?.analytics?.handoff_rate > 20 ? 'var(--accent-danger)' : 'var(--accent-warning, #f59e0b)', lineHeight: 1 }}>{automationOverview?.analytics?.handoff_rate ?? 0}<span style={{ fontSize: '14px' }}>%</span></div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>Handoff</div>
                                </div>
                            </div>
                            {automationOverview?.analytics && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Auto-resolved</div>
                                        <div style={{ fontSize: '18px', fontWeight: 700 }}>{automationOverview.analytics.auto_resolved_rate ?? 0}%</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Total Interactions</div>
                                        <div style={{ fontSize: '18px', fontWeight: 700 }}>{automationOverview.analytics.total_interactions ?? 0}</div>
                                    </div>
                                </div>
                            )}
                            {automationOverview?.digest && automationOverview.digest.score !== undefined && (
                                <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <strong style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Weekly Digest</strong>
                                    <div style={{ marginTop: '4px' }}>Score: <strong>{automationOverview.digest.score}</strong> · Deflection: <strong>{automationOverview.digest.deflection_rate ?? 0}%</strong> · Open: <strong>{automationOverview.digest.open_suggestions ?? 0}</strong></div>
                                </div>
                            )}
                        </div>

                        {/* Suggestions Queue */}
                        <div className="card" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Suggestions Queue</h3>
                                <button type="button" className="btn btn--outline" onClick={handleClusterSuggestions} disabled={automationBusy} style={{ fontSize: '12px', padding: '4px 12px' }}>Build</button>
                            </div>
                            {(automationOverview?.suggestions || []).length === 0
                                ? <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>No open suggestions — bot is answering well! 🎉</div>
                                : <div style={{ display: 'grid', gap: '6px' }}>
                                    {(automationOverview?.suggestions || []).slice(0, 8).map(item => (
                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                                            <span style={{ fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0, background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '10px' }}>{item.source_count}×</span>
                                        </div>
                                    ))}
                                  </div>
                            }
                            {automationOverview?.analytics?.top_unanswered?.length > 0 && (
                                <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Top Unanswered</div>
                                    <div style={{ display: 'grid', gap: '4px' }}>
                                        {automationOverview.analytics.top_unanswered.slice(0, 5).map((q, i) => (
                                            <div key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                                                {typeof q === 'string' ? q : q.query || q.normalized_message || JSON.stringify(q)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Test Console */}
                        <div className="card" style={{ padding: '16px' }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700 }}>Faithful test console</h3>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>Routes through the real responder.</p>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                <textarea className="form-textarea" rows={2} value={automationTestMessage}
                                    onInput={e => setAutomationTestMessage(e.target.value)}
                                    placeholder="e.g. Where is my order?" style={{ flex: 1, marginBottom: 0, fontSize: '13px' }} />
                                <button type="button" className="btn btn--primary" onClick={handleAutomationTest} disabled={automationBusy || !automationTestMessage.trim()} style={{ whiteSpace: 'nowrap', alignSelf: 'stretch' }}>
                                    {automationBusy ? '…' : 'Test'}
                                </button>
                            </div>
                            {automationTestResult && (
                                <pre style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '11px', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto', lineHeight: 1.5 }}>
                                    {JSON.stringify(automationTestResult.reply || automationTestResult, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
