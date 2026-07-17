import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { auth } from './middleware/auth.js';
import { loadSettings } from './middleware/loadSettings.js';
import { initDatabase } from './database.js';
import { getUploadsDir } from './utils/uploads.js';

// Initialize DB for serverless environment
initDatabase().catch(console.error);

// Routes
import authRoutes from './routes/auth.js';
import contactsRoutes from './routes/contacts.js';
import tenantSettingsRoutes from './routes/tenant-settings.js';
import adminRoutes from './routes/admin.js';
import productsRoutes from './routes/products.js';
import knowledgeBaseRoutes from './routes/knowledge-base.js';
import ordersRoutes from './routes/orders.js';
import analyticsRoutes from './routes/analytics.js';
// WhatsApp routes (migrated to MongoDB)
import whatsappRoutes from './routes/whatsapp.js';
import webhookRoutes from './routes/webhook.js';
import whatsappChatRoutes from './routes/whatsapp-chat.js';
import checkoutRoutes from './routes/checkout.js';
import integrationsRoutes from './routes/integrations.js';
import { registerJobHandler, startJobWorker } from './services/jobQueue.js';
import { processCampaignSendJob } from './services/campaignWorker.js';
import { processShopifySyncJob } from './services/shopifySync.js';
import { startShopifySyncScheduler } from './services/shopifyScheduler.js';

registerJobHandler('campaign.send', processCampaignSendJob);
registerJobHandler('shopify.sync', processShopifySyncJob);

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    startJobWorker();
    startShopifySyncScheduler();
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8');
    },
}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-slug'],
}));

app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/', (req, res) => res.json({ message: 'WhatsApp Marketing Platform API (MongoDB)' }));
app.use('/api/v1/uploads', express.static(getUploadsDir()));

// Public Webhook (No Auth)
app.use('/api/v1/whatsapp-webhook', webhookRoutes);
app.use('/api/v1/checkout', checkoutRoutes);

// Global tenant loader for single client architecture
app.use(loadSettings);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/contacts', contactsRoutes);
app.use('/api/v1/tenant-settings', tenantSettingsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/knowledge-base', knowledgeBaseRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/integrations', integrationsRoutes);

// WhatsApp broadcast routes (migrated to MongoDB)
app.use('/api/v1/whatsapp', whatsappRoutes);
// WhatsApp chat routes
app.use('/api/v1/whatsapp/chat', whatsappChatRoutes);

export default app;
