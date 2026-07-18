/**
 * Zustand Store — WhatsApp Marketing Platform
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io } from 'socket.io-client';
import { getDefaultViewForPlan } from '../config/plans';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const AUTH_TOKEN_KEY = 'narmada_broadcast_token';

let socket = null;


const APP_SUBDOMAINS = ['broadcast', 'app', 'www', 'api', 'admin'];

const getTenantSlug = () => {
    const storedSlug = localStorage.getItem('tenant_slug');
    if (storedSlug) return storedSlug;
    const parts = window.location.hostname.split('.');
    // Only treat as tenant subdomain if it's a 4+ part hostname (e.g. firm.broadcast.innodify.in)
    // For broadcast.innodify.in (3 parts), 'broadcast' is the app domain, not a tenant
    if (parts.length >= 4 && !APP_SUBDOMAINS.includes(parts[0])) {
        return parts[0];
    }
    return 'default';
};

// API helper with tenant header
const api = async (path, options = {}) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const slug = getTenantSlug();

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(slug && { 'x-tenant-slug': slug }),
    };

    const url = `${API_BASE_URL}/api/v1${path}`;

    try {
        const res = await fetch(url, { ...options, headers });

        if (!res.ok) {
            const errorText = await res.text();
            let error;
            try { error = JSON.parse(errorText); } catch { error = { error: errorText || `Request failed (${res.status})` }; }

            if (error.subscription_expired || error.trial_expired) {
                const store = useStore.getState();
                store.setCurrentView('settings');
                throw new Error(error.error);
            }
            if (error.whatsapp_not_configured) {
                const store = useStore.getState();
                store.setCurrentView('settings');
                store.showToast('Configure your WhatsApp credentials in Settings first', 'info');
                throw new Error(error.error);
            }
            if (error.upgrade_required) {
                const store = useStore.getState();
                store.setCurrentView('settings');
                store.showToast(error.error || 'Upgrade your plan to continue', 'info');
                throw new Error(error.error);
            }
            throw new Error(error.error || `Request failed (${res.status})`);
        }

        if (res.status === 204) return null;
        return res.json();
    } catch (error) {
        console.error(`API Error [${path}]:`, error);
        throw error;
    }
};

// API helper for file uploads (no Content-Type header)
const apiUpload = async (path, formData) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const slug = getTenantSlug();

    const url = `${API_BASE_URL}/api/v1${path}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(slug && { 'x-tenant-slug': slug }),
        },
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
    }
    return res.json();
};

export const useStore = create(
    persist(
        (set, get) => ({
            // ============================================================
            // AUTH
            // ============================================================
            user: null,
            tenant: null,
            isAuthenticated: false,
            isAuthReady: false,
            isLoading: false,
            error: null,
            currentView: 'overview',

            toast: null,
            showToast: (message, type = 'success', duration = 3000) => set({ toast: { message, type, duration } }),
            clearToast: () => set({ toast: null }),

            setCurrentView: (view) => set({ currentView: view }),
            clearError: () => set({ error: null }),

            initSocket: () => {
                const token = localStorage.getItem(AUTH_TOKEN_KEY);
                if (!token) return;
                if (socket) socket.disconnect();

                socket = io(API_BASE_URL || window.location.origin, {
                    path: '/api/socket.io',
                    auth: { token },
                    transports: ['websocket', 'polling']
                });

                socket.on('connect', () => {
                    console.log('[WebSocket] Connected');
                });

                socket.on('chat_updated', (data) => {
                    const state = get();
                    const conversationId = data.conversationId ?? data.conversation_id;
                    // Refresh conversations list
                    state.fetchConversations();

                    // If viewing the specific conversation, refresh messages
                    if (state.activeConversation && state.activeConversation.id === conversationId) {
                        state.fetchChatMessages(conversationId);
                    }
                });

                socket.on('handoff_requested', (data) => {
                    const state = get();
                    state.fetchConversations();
                    state.showToast(
                        `🆘 A customer needs human help${data.reason ? ` (${data.reason.replace(/_/g, ' ')})` : ''}`,
                        'warning',
                        8000
                    );
                    try {
                        const ctx = new (window.AudioContext || window.webkitAudioContext)();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.frequency.value = 880;
                        osc.type = 'sine';
                        gain.gain.setValueAtTime(0.3, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                        osc.start(ctx.currentTime);
                        osc.stop(ctx.currentTime + 0.5);
                    } catch { /* audio not available */ }
                });

                socket.on('disconnect', () => {
                    console.log('[WebSocket] Disconnected');
                });
            },

            disconnectSocket: () => {
                if (socket) {
                    socket.disconnect();
                    socket = null;
                }
            },

            login: async (email, password) => {
                try {
                    const data = await api('/auth/login', {
                        method: 'POST',
                        body: JSON.stringify({ email, password }),
                    });
                    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                    localStorage.removeItem('token');
                    localStorage.setItem('user', JSON.stringify(data.user));
                    if (data.tenant) localStorage.setItem('tenant_slug', data.tenant.slug);

                    set((state) => ({
                        user: data.user,
                        tenant: data.tenant || null,
                        isAuthenticated: true,
                        isAuthReady: true,
                        currentView: state.currentView && state.currentView !== 'overview' && data.tenant ? state.currentView : getDefaultViewForPlan(data.tenant?.subscription_plan, data.user),
                        error: null,
                    }));
                    return true;
                } catch (error) {
                    set({ error: error.message });
                    return false;
                }
            },

            validateSession: async () => {
                const token = localStorage.getItem(AUTH_TOKEN_KEY);
                if (!token) {
                    get().disconnectSocket();
                    set({ user: null, tenant: null, isAuthenticated: false, isAuthReady: true, currentView: 'overview' });
                    return false;
                }

                try {
                    const data = await api('/auth/me');
                    localStorage.setItem('user', JSON.stringify(data.user));
                    if (data.tenant) localStorage.setItem('tenant_slug', data.tenant.slug);

                    set((state) => ({
                        user: data.user,
                        tenant: data.tenant || null,
                        isAuthenticated: true,
                        isAuthReady: true,
                        currentView: state.currentView && state.currentView !== 'overview' && data.tenant ? state.currentView : getDefaultViewForPlan(data.tenant?.subscription_plan, data.user),
                        error: null,
                    }));
                    return true;
                } catch {
                    localStorage.removeItem(AUTH_TOKEN_KEY);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    localStorage.removeItem('tenant_slug');
                    get().disconnectSocket();
                    set({ user: null, tenant: null, isAuthenticated: false, isAuthReady: true, currentView: 'overview' });
                    return false;
                }
            },

            logout: () => {
                localStorage.removeItem(AUTH_TOKEN_KEY);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('tenant_slug');
                get().disconnectSocket();
                set({ user: null, tenant: null, isAuthenticated: false, isAuthReady: true, contacts: [], currentView: 'overview' });
            },

            register: async (name, firmName, email, password) => {
                try {
                    set({ isLoading: true, error: null });
                    // Use raw fetch — signup is a PUBLIC endpoint, no tenant context needed
                    const res = await fetch(`${API_BASE_URL}/api/v1/public/signup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, firmName, email, password }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Signup failed');

                    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                    localStorage.removeItem('token');
                    localStorage.setItem('user', JSON.stringify(data.user));
                    if (data.tenant) localStorage.setItem('tenant_slug', data.tenant.slug);

                    set({
                        user: data.user,
                        tenant: data.tenant || null,
                        isAuthenticated: true,
                        isAuthReady: true,
                        currentView: getDefaultViewForPlan(data.tenant?.subscription_plan, data.user),
                        isLoading: false,
                        error: null,
                    });
                    return true;
                } catch (error) {
                    set({ error: error.message, isLoading: false });
                    return false;
                }
            },

            // ============================================================
            // TENANT SETTINGS
            // ============================================================
            tenantSettings: null,

            fetchTenantSettings: async () => {
                try {
                    const settings = await api('/tenant-settings');
                    set({ tenantSettings: settings, tenant: settings });
                    return settings;
                } catch (error) {
                    console.error('Fetch tenant settings error:', error);
                }
            },

            updateTenantProfile: async (profileData) => {
                await api('/tenant-settings/profile', { method: 'PUT', body: JSON.stringify(profileData) });
                return await get().fetchTenantSettings();
            },

            updateWhatsAppConfig: async (configData) => {
                await api('/tenant-settings/whatsapp', { method: 'PUT', body: JSON.stringify(configData) });
                get().fetchTenantSettings();
            },

            disconnectWhatsApp: async () => {
                await api('/tenant-settings/whatsapp', { method: 'DELETE' });
                get().fetchTenantSettings();
            },

            createBillingOrder: async (plan) => {
                return await api('/tenant-settings/billing/order', {
                    method: 'POST',
                    body: JSON.stringify({ plan }),
                });
            },

            verifyBillingPayment: async (payload) => {
                const result = await api('/tenant-settings/billing/verify', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                await get().fetchTenantSettings();
                return result;
            },

            fetchShopifyIntegration: async () => {
                return await api('/integrations/shopify');
            },

            saveShopifyIntegration: async (payload) => {
                return await api('/integrations/shopify', {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
            },

            syncShopifyProducts: async () => {
                return await api('/integrations/shopify/sync', { method: 'POST' });
            },

            updateChatbotSettings: async (botSettings) => {
                await api('/tenant-settings/chatbot', { method: 'PUT', body: JSON.stringify({ bot_settings: botSettings }) });
                get().fetchTenantSettings();
            },

            fetchSmartAutomationOverview: async () => {
                const [analytics, suggestions, score, digest] = await Promise.all([
                    api('/tenant-settings/smart-automation/analytics'),
                    api('/tenant-settings/smart-automation/suggestions'),
                    api('/tenant-settings/smart-automation/score'),
                    api('/tenant-settings/smart-automation/digest'),
                ]);
                return {
                    analytics: analytics.analytics || {},
                    suggestions: suggestions.suggestions || [],
                    score,
                    digest: digest.digest || {},
                };
            },

            runSmartAutomationTest: async (message, options = {}) => {
                return await api('/tenant-settings/smart-automation/test', {
                    method: 'POST',
                    body: JSON.stringify({ message, ...options }),
                });
            },

            clusterSmartAutomationSuggestions: async () => {
                return await api('/tenant-settings/smart-automation/learning/cluster', {
                    method: 'POST',
                    body: JSON.stringify({ limit: 100 }),
                });
            },

            // ============================================================
            // CONTACTS
            // ============================================================
            contacts: [],
            contactsTotal: 0,

            fetchContacts: async (search = '', tag = '', page = 1, limit = 50, sort_by = 'created_at', sort_order = 'desc', location = '') => {
                try {
                    let url = `/contacts?page=${page}&limit=${limit}&sort_by=${sort_by}&sort_order=${sort_order}`;
                    if (search) url += `&search=${encodeURIComponent(search)}`;
                    if (tag) url += `&tag=${encodeURIComponent(tag)}`;
                    if (location) url += `&location=${encodeURIComponent(location)}`;

                    const data = await api(url);
                    set({ contacts: data.contacts || [], contactsTotal: data.total || 0 });
                } catch (error) {
                    console.error('Fetch contacts error:', error);
                }
            },

            createContact: async (contactData) => {
                await api('/contacts', { method: 'POST', body: JSON.stringify(contactData) });
                get().fetchContacts();
            },

            updateContact: async (id, contactData) => {
                await api(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(contactData) });
                get().fetchContacts();
            },

            deleteContact: async (id) => {
                await api(`/contacts/${id}`, { method: 'DELETE' });
                get().fetchContacts();
            },

            importContacts: async (contactsList, onProgress) => {
                if (!Array.isArray(contactsList) || contactsList.length === 0) {
                    return { imported: 0, skipped: 0 };
                }
                const CHUNK_SIZE = 1000;
                let totalImported = 0;
                let totalSkipped = 0;

                for (let i = 0; i < contactsList.length; i += CHUNK_SIZE) {
                    const chunk = contactsList.slice(i, i + CHUNK_SIZE);
                    const result = await api('/contacts/import', {
                        method: 'POST',
                        body: JSON.stringify({ contacts: chunk })
                    });
                    totalImported += (result?.imported || 0);
                    totalSkipped += (result?.skipped || 0);
                    if (typeof onProgress === 'function') {
                        onProgress(Math.min(i + CHUNK_SIZE, contactsList.length), contactsList.length);
                    }
                }
                await get().fetchContacts();
                return { imported: totalImported, skipped: totalSkipped };
            },

            // ============================================================
            // WHATSAPP BROADCAST
            // ============================================================
            whatsappRecipients: null,
            whatsappCampaigns: [],
            whatsappTemplates: [],

            fetchWhatsAppRecipients: async (filters = {}) => {
                try {
                    let url = `/whatsapp/recipients?`;
                    if (filters.label) url += `label=${encodeURIComponent(filters.label)}&`;
                    if (filters.search) url += `search=${encodeURIComponent(filters.search)}`;
                    const data = await api(url);
                    set({ whatsappRecipients: data });
                } catch (error) {
                    console.error('Failed to fetch WhatsApp recipients:', error);
                }
            },

            sendWhatsAppBroadcast: async (broadcastData) => {
                return await api('/whatsapp/broadcast', { method: 'POST', body: JSON.stringify(broadcastData) });
            },

            sendWhatsAppMessage: async (messageData) => {
                return await api('/whatsapp/send', { method: 'POST', body: JSON.stringify(messageData) });
            },

            fetchWhatsAppCampaigns: async () => {
                try {
                    const campaigns = await api('/whatsapp/campaigns');
                    set({ whatsappCampaigns: campaigns });
                } catch (error) {
                    console.error('Failed to fetch campaigns:', error);
                }
            },

            fetchWhatsAppCampaignDetail: async (id) => {
                return await api(`/whatsapp/campaigns/${id}`);
            },

            controlWhatsAppCampaign: async (id, action) => {
                const result = await api(`/whatsapp/campaigns/${id}/${action}`, { method: 'POST' });
                await get().fetchWhatsAppCampaigns();
                return result;
            },

            uploadTemplateMedia: async (mediaFile) => {
                const formData = new FormData();
                formData.append('media', mediaFile);
                const data = await apiUpload('/whatsapp/templates/upload-media', formData);
                return data.headerHandle;
            },

            createWhatsAppTemplate: async (templateData) => {
                return await api('/whatsapp/templates', { method: 'POST', body: JSON.stringify(templateData) });
            },

            fetchWhatsAppTemplates: async () => {
                try {
                    const templates = await api('/whatsapp/templates');
                    set({ whatsappTemplates: templates });
                    return templates;
                } catch (error) {
                    console.error('Failed to fetch templates:', error);
                    get().showToast('Meta API Error: ' + error.message, 'error', 5000);
                    return [];
                }
            },

            deleteWhatsAppTemplate: async (templateName) => {
                await api(`/whatsapp/templates/${encodeURIComponent(templateName)}`, { method: 'DELETE' });
                get().fetchWhatsAppTemplates();
            },

            editWhatsAppTemplate: async (templateId, templateData) => {
                const result = await api(`/whatsapp/templates/${encodeURIComponent(templateId)}`, {
                    method: 'PUT',
                    body: JSON.stringify(templateData),
                });
                get().fetchWhatsAppTemplates();
                return result;
            },

            // ============================================================
            // WHATSAPP CHAT INBOX
            // ============================================================
            conversations: [],
            conversationFilterCounts: {
                all: 0,
                unread: 0,
                open_windows: 0,
                paid: 0,
                unpaid_orders: 0,
                abandoned_carts: 0,
                needs_human: 0,
            },
            totalUnread: 0,
            activeConversation: null,
            chatMessages: [],
            chatMessagesTotal: 0,

            fetchConversations: async (search = '', filter = 'all') => {
                try {
                    const url = new URL('/whatsapp/chat/conversations', window.location.origin);
                    if (search) url.searchParams.set('search', search);
                    if (filter && filter !== 'all') url.searchParams.set('filter', filter);

                    const data = await api(`${url.pathname}${url.search}`);
                    set({
                        conversations: data.conversations || [],
                        conversationFilterCounts: data.filter_counts || get().conversationFilterCounts,
                        totalUnread: data.total_unread || 0,
                    });
                } catch (error) {
                    console.error('Failed to fetch conversations:', error);
                }
            },

            fetchChatMessages: async (conversationId) => {
                try {
                    const data = await api(`/whatsapp/chat/conversations/${conversationId}/messages?limit=50`);
                    set({
                        activeConversation: data.conversation,
                        chatMessages: data.messages || [],
                        chatMessagesTotal: data.total || 0,
                        chatHasMore: data.has_more || false,
                    });
                    return data;
                } catch (error) {
                    console.error('Failed to fetch chat messages:', error);
                }
            },

            fetchOlderMessages: async (conversationId) => {
                try {
                    const currentMessages = get().chatMessages;
                    if (!currentMessages.length) return;
                    const oldestId = currentMessages[0].id;
                    const data = await api(`/whatsapp/chat/conversations/${conversationId}/messages?limit=50&before_id=${oldestId}`);
                    if (data.messages?.length) {
                        set({
                            chatMessages: [...data.messages, ...currentMessages],
                            chatHasMore: data.has_more || false,
                        });
                    } else {
                        set({ chatHasMore: false });
                    }
                    return data;
                } catch (error) {
                    console.error('Failed to fetch older messages:', error);
                }
            },

            updateConversationLabels: async (conversationId, labels) => {
                try {
                    await api(`/whatsapp/chat/conversations/${conversationId}/labels`, {
                        method: 'PATCH',
                        body: JSON.stringify({ labels }),
                    });
                    // Update activeConversation labels locally (store as JSON string for consistency with DB)
                    const labelsStr = JSON.stringify(labels);
                    const conv = get().activeConversation;
                    if (conv && conv.id === conversationId) {
                        set({ activeConversation: { ...conv, labels: labelsStr } });
                    }
                    // Also update in conversations list so sidebar dots stay in sync
                    const convList = get().conversations;
                    set({
                        conversations: convList.map(c =>
                            c.id === conversationId ? { ...c, labels: labelsStr } : c
                        ),
                    });
                } catch (error) {
                    console.error('Failed to update labels:', error);
                }
            },

            fetchMediaUrl: async (mediaId) => {
                const token = localStorage.getItem(AUTH_TOKEN_KEY);
                const slug = getTenantSlug();
                const url = `${API_BASE_URL}/api/v1/whatsapp/chat/media/${mediaId}`;

                const headers = {
                    ...(token && { Authorization: `Bearer ${token}` }),
                    ...(slug && { 'x-tenant-slug': slug }),
                };

                const res = await fetch(url, { headers });
                if (!res.ok) throw new Error('Failed to fetch media');

                const blob = await res.blob();
                return URL.createObjectURL(blob);
            },

            sendChatReply: async (conversationId, text) => {
                const result = await api(`/whatsapp/chat/conversations/${conversationId}/send`, {
                    method: 'POST',
                    body: JSON.stringify({ text }),
                });
                // Refresh messages
                await get().fetchChatMessages(conversationId);
                await get().fetchConversations();
                return result;
            },

            sendChatMedia: async (conversationId, file, caption) => {
                const formData = new FormData();
                formData.append('media', file);
                if (caption) formData.append('caption', caption);

                const result = await apiUpload(`/whatsapp/chat/conversations/${conversationId}/send-media`, formData);

                // Refresh messages
                await get().fetchChatMessages(conversationId);
                await get().fetchConversations();
                return result;
            },

            sendChatTemplate: async (conversationId, templateName, templateParams = [], languageCode) => {
                const result = await api(`/whatsapp/chat/conversations/${conversationId}/send-template`, {
                    method: 'POST',
                    body: JSON.stringify({ templateName, templateParams, languageCode }),
                });
                await get().fetchChatMessages(conversationId);
                await get().fetchConversations();
                return result;
            },

            markConversationRead: async (conversationId) => {
                try {
                    await api(`/whatsapp/chat/conversations/${conversationId}/read`, { method: 'PATCH' });
                    set(state => ({
                        conversations: state.conversations.map(c =>
                            c.id === conversationId ? { ...c, unread_count: 0 } : c
                        ),
                        totalUnread: Math.max(0, state.totalUnread - (state.conversations.find(c => c.id === conversationId)?.unread_count || 0)),
                    }));
                } catch (error) {
                    console.error('Failed to mark as read:', error);
                }
            },

            archiveConversation: async (conversationId) => {
                await api(`/whatsapp/chat/conversations/${conversationId}/archive`, { method: 'PATCH' });
                get().fetchConversations();
            },

            updateConversationBotPause: async (conversationId, paused, sendFeedback = false) => {
                const result = await api(`/whatsapp/chat/conversations/${conversationId}/bot-pause`, {
                    method: 'PATCH',
                    body: JSON.stringify({ paused, send_feedback: sendFeedback }),
                });
                const botPaused = result.bot_paused;
                set(state => ({
                    activeConversation: state.activeConversation?.id === conversationId
                        ? { ...state.activeConversation, bot_paused: botPaused }
                        : state.activeConversation,
                    conversations: state.conversations.map(c =>
                        c.id === conversationId ? { ...c, bot_paused: botPaused } : c
                    ),
                }));
                return result;
            },

            resolveHumanHandoff: async (conversationId, sendFeedback = false) => {
                const result = await api(`/whatsapp/chat/conversations/${conversationId}/handoff/resolve`, {
                    method: 'PATCH',
                    body: JSON.stringify({ send_feedback: sendFeedback }),
                });
                set(state => ({
                    activeConversation: state.activeConversation?.id === conversationId
                        ? { ...state.activeConversation, needs_human: false, bot_paused: false }
                        : state.activeConversation,
                    conversations: state.conversations.map(c =>
                        c.id === conversationId ? { ...c, needs_human: false, bot_paused: false } : c
                    ),
                }));
                await get().fetchConversations();
                return result;
            },

            teachBotFromConversation: async (conversationId, question, answer, sourceMessageId = null) => {
                return await api(`/whatsapp/chat/conversations/${conversationId}/teach`, {
                    method: 'POST',
                    body: JSON.stringify({ question, answer, source_message_id: sourceMessageId }),
                });
            },

            startNewConversation: async (phone, contactName, templateName, templateParams = [], languageCode = 'en_US') => {
                const result = await api('/whatsapp/chat/conversations/new', {
                    method: 'POST',
                    body: JSON.stringify({ phone, contactName, templateName, templateParams, languageCode }),
                });
                await get().fetchConversations();
                return result;
            },
        }),
        {
            name: 'narmada-broadcast-storage',
            partialize: (state) => ({
                user: state.user,
                tenant: state.tenant,
                isAuthenticated: state.isAuthenticated,
                currentView: state.currentView,
            }),
        }
    )
);
