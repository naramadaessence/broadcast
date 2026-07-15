import express from 'express';
import ShopifyConnection from '../models/ShopifyConnection.js';
import IntegrationSyncRun from '../models/IntegrationSyncRun.js';
import { enqueueJob } from '../services/jobQueue.js';
import { normalizeShopDomain } from '../services/shopifySync.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

function sanitizeShopifyConnection(connection) {
    if (!connection) {
        return {
            connected: false,
            shop_domain: '',
            client_id: '',
            has_client_id: false,
            client_secret: '',
            has_client_secret: false,
            access_token: '',
            has_access_token: false,
            access_token_expires_at: null,
            sync_enabled: true,
            last_sync_at: null,
            last_sync_status: null,
            last_sync_error: null,
        };
    }
    return {
        connected: true,
        id: connection._id || connection.id,
        shop_domain: connection.shop_domain,
        client_id: '',
        has_client_id: Boolean(connection.client_id),
        client_secret: '',
        has_client_secret: Boolean(connection.client_secret),
        access_token: '',
        has_access_token: Boolean(connection.access_token),
        access_token_expires_at: connection.access_token_expires_at,
        sync_enabled: Boolean(connection.sync_enabled),
        last_sync_at: connection.last_sync_at,
        last_sync_status: connection.last_sync_status,
        last_sync_error: connection.last_sync_error,
    };
}

router.use(auth);

router.get('/shopify', async (req, res) => {
    try {
        const connection = await ShopifyConnection.findOne({ tenant_id: req.user?.tenant_id || 'single-tenant' });
        const syncRuns = await IntegrationSyncRun.find({
            tenant_id: req.user?.tenant_id || 'single-tenant',
            integration: 'shopify'
        }).sort({ created_at: -1 }).limit(10);

        res.json({
            connection: sanitizeShopifyConnection(connection ? connection.toObject() : null),
            sync_runs: syncRuns.map(s => ({ ...s.toObject(), id: s._id.toString() }))
        });
    } catch (error) {
        console.error('[Integrations] Shopify fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch Shopify integration' });
    }
});

router.put('/shopify', async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || 'single-tenant';
        const shopDomain = normalizeShopDomain(req.body?.shop_domain);
        const clientId = String(req.body?.client_id || '').trim();
        const clientSecret = String(req.body?.client_secret || '').trim();
        const legacyAccessToken = String(req.body?.access_token || '').trim();
        const syncEnabled = req.body?.sync_enabled !== false;

        if (!shopDomain) {
            return res.status(400).json({ error: 'Shopify shop domain is required' });
        }

        const existing = await ShopifyConnection.findOne({ tenant_id: tenantId });
        const clientIdToStore = clientId || existing?.client_id || '';
        const clientSecretToStore = clientSecret || existing?.client_secret || '';
        const resetGeneratedToken = Boolean(clientId || clientSecret);
        const accessTokenToStore = legacyAccessToken || (resetGeneratedToken ? null : existing?.access_token || null);
        const accessTokenExpiresAt = resetGeneratedToken || legacyAccessToken
            ? null
            : existing?.access_token_expires_at || null;
        const canAuthenticate = (clientIdToStore && clientSecretToStore) || accessTokenToStore;
        if (!canAuthenticate) {
            return res.status(400).json({ error: 'Shopify Client ID and Client Secret are required' });
        }

        const updated = await ShopifyConnection.findOneAndUpdate(
            { tenant_id: tenantId },
            {
                $set: {
                    shop_domain: shopDomain,
                    client_id: clientIdToStore || null,
                    client_secret: clientSecretToStore || null,
                    access_token: accessTokenToStore,
                    access_token_expires_at: accessTokenExpiresAt,
                    sync_enabled: syncEnabled,
                    updated_at: new Date()
                }
            },
            { upsert: true, new: true }
        );

        res.json({ connection: sanitizeShopifyConnection(updated.toObject()), message: 'Shopify integration saved' });
    } catch (error) {
        console.error('[Integrations] Shopify save error:', error);
        res.status(500).json({ error: 'Failed to save Shopify integration' });
    }
});

router.post('/shopify/sync', async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || 'single-tenant';
        const connection = await ShopifyConnection.findOne({ tenant_id: tenantId });
        if (!connection || !((connection.client_id && connection.client_secret) || connection.access_token)) {
            return res.status(400).json({ error: 'Connect Shopify with Client ID and Client Secret first' });
        }

        const syncRun = await IntegrationSyncRun.create({
            tenant_id: tenantId,
            integration: 'shopify',
            status: 'queued'
        });

        const jobId = await enqueueJob({
            tenantId: tenantId,
            jobType: 'shopify.sync',
            payload: {
                tenantId: tenantId,
                connectionId: connection._id.toString(),
                syncRunId: syncRun._id.toString(),
            },
            maxAttempts: 3,
        });

        await IntegrationSyncRun.findByIdAndUpdate(syncRun._id, { $set: { job_id: jobId } });

        res.status(202).json({
            success: true,
            jobId,
            sync_run_id: syncRun._id.toString(),
            message: 'Shopify sync queued',
        });
    } catch (error) {
        console.error('[Integrations] Shopify sync error:', error);
        res.status(500).json({ error: 'Failed to queue Shopify sync' });
    }
});

export default router;
