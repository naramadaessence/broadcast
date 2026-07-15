// Tenant middleware is deprecated in the new single-user architecture
import config from '../config.js';

export const resolveTenant = async (req, res, next) => {
    // No-op for single user
    next();
};

export const superAdminOnly = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const superAdminEmails = config.superAdminEmails || [];
    if (!superAdminEmails.includes(req.user.email)) {
        return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
};
