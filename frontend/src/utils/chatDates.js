const TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: true };

export function parseChatDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const utcCandidate = hasExplicitZone ? normalized : `${normalized}Z`;
    const parsed = new Date(utcCandidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatChatTime(value, nowValue = new Date()) {
    const date = parseChatDate(value);
    if (!date) return '';

    const now = parseChatDate(nowValue) || new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-IN', TIME_FORMAT);
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatChatFullTime(value) {
    const date = parseChatDate(value);
    return date ? date.toLocaleTimeString('en-IN', TIME_FORMAT) : '';
}

export function formatChatDateSeparator(value, nowValue = new Date()) {
    const date = parseChatDate(value);
    if (!date) return '';

    const now = parseChatDate(nowValue) || new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
