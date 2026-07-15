/**
 * Public Routes — No tenant resolution, no auth required
 * 
 * POST /api/v1/public/signup — Self-service tenant creation + admin user
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { run, get } from '../database.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

router.post('/signup', async (req, res) => {
    try {
        const { name, firmName, email, password } = req.body;

        if (!name || !firmName || !email || !password) {
            return res.status(400).json({ error: 'Name, business name, email, and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Validate email format
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Generate slug from firm name
        const slug = firmName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!slug) {
            return res.status(400).json({ error: 'Invalid business name' });
        }

        // Check if slug already exists
        const existingTenant = await get('SELECT id FROM tenants WHERE slug = ?', [slug]);
        if (existingTenant) {
            return res.status(409).json({ error: 'A business with a similar name already exists. Try a different name.' });
        }

        // Check if email already exists globally
        const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(409).json({ error: 'This email is already registered. Try signing in.' });
        }

        // Create tenant with active unlimited access
        const tenantResult = await run(
            `INSERT INTO tenants (name, slug, email, subscription_plan, subscription_status, trial_ends_at)
             VALUES (?, ?, ?, 'commerce', 'active', NULL)`,
            [firmName, slug, email]
        );
        const tenantId = tenantResult.lastInsertRowid;

        // Create admin user
        const passwordHash = bcrypt.hashSync(password, 10);
        const userResult = await run(
            'INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [tenantId, name, email, passwordHash, 'admin']
        );
        const userId = userResult.lastInsertRowid;

        // Auto-login: generate token
        const token = generateToken(userId, email, 'admin', tenantId);

        console.log(`[SIGNUP] New tenant created: ${firmName} (${slug}) by ${email}`);

        res.status(201).json({
            token,
            user: { id: userId, name, email, role: 'admin' },
            tenant: {
                id: tenantId, name: firmName, slug,
                subscription_plan: 'commerce', subscription_status: 'active',
            },
        });
    } catch (error) {
        console.error('[SIGNUP ERROR]', error.message, error.stack);
        res.status(500).json({ error: 'Signup failed. Please try again.' });
    }
});

export default router;
