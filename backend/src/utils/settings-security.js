import { parseJsonObject } from './security.js';

const SECRET_FIELDS = ['razorpay_key_secret', 'razorpay_webhook_secret'];

export function sanitizeBotSettingsForClient(settings) {
    const sanitized = { ...parseJsonObject(settings) };

    for (const field of SECRET_FIELDS) {
        const hasSecret = Boolean(sanitized[field]);
        sanitized[`has_${field}`] = hasSecret;
        sanitized[field] = '';
    }

    return sanitized;
}

export function mergeSecretSettings(storedSettings, incomingSettings) {
    const stored = parseJsonObject(storedSettings);
    const incoming = parseJsonObject(incomingSettings);
    const merged = { ...stored, ...incoming };

    for (const field of SECRET_FIELDS) {
        if (incoming[field] === '' || incoming[field] === undefined || incoming[field] === null) {
            if (stored[field]) {
                merged[field] = stored[field];
            } else {
                delete merged[field];
            }
        }
    }

    return merged;
}
