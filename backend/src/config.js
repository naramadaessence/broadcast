// Config for WhatsApp Broadcast SaaS Platform
import dotenv from 'dotenv';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables — always try .env.production first, then .env as fallback
// dotenv won't override existing vars, so first-loaded wins
const envProd = path.join(__dirname, '..', '.env.production');
const envDefault = path.join(__dirname, '..', '.env');

dotenv.config({ path: envProd });
dotenv.config({ path: envDefault });

if (!process.env.DB_USER) {
    dotenv.config({ path: path.join(process.cwd(), '.env.production') });
    dotenv.config({ path: path.join(process.cwd(), '.env') });
}

console.log(`[CONFIG] NODE_ENV=${process.env.NODE_ENV} SUPER_ADMIN_EMAILS="${process.env.SUPER_ADMIN_EMAILS}"`);

export default {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGO_URI || '',

    // Legacy SQL-compatible config retained for old helper modules.
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsapp_saas',
    },

    // JWT
    jwtSecret: (() => {
        const secret = process.env.JWT_SECRET;
        if (process.env.NODE_ENV === 'production' && (!secret || secret === 'change-me-in-production')) {
            throw new Error('FATAL: JWT_SECRET must be set to a strong value in production');
        }
        return secret || 'dev-only-secret-not-for-production';
    })(),
    jwtExpiration: parseInt(process.env.JWT_EXPIRATION) || 86400,

    // CORS
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],

    // App Domain (for tenant subdomain routing)
    appDomain: process.env.APP_DOMAIN || 'localhost',

    // Super Admin emails (platform owners)
    superAdminEmails: (() => {
        const envVal = process.env.SUPER_ADMIN_EMAILS;
        if (envVal) return envVal.split(',').map(e => e.trim());
        // Fallback: read directly from .env.production
        try {
            const envContent = readFileSync(path.join(__dirname, '..', '.env.production'), 'utf-8');
            const match = envContent.match(/^SUPER_ADMIN_EMAILS=(.+)$/m);
            if (match) {
                console.log('[CONFIG] Loaded SUPER_ADMIN_EMAILS from file fallback');
                return match[1].split(',').map(e => e.trim());
            }
        } catch {}
        return [];
    })(),
};
