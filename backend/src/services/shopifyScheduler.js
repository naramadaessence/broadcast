import ShopifyConnection from '../models/ShopifyConnection.js';
import IntegrationSyncRun from '../models/IntegrationSyncRun.js';
import { enqueueJob } from './jobQueue.js';

const DEFAULT_SHOPIFY_SYNC_INTERVAL_HOURS = 6;
const MIN_SHOPIFY_SYNC_INTERVAL_MS = 15 * 60 * 1000;

let schedulerTimer = null;
let schedulerActive = false;

function parseIntervalMs(env = process.env) {
    const configuredHours = Number(env.SHOPIFY_SYNC_INTERVAL_HOURS || DEFAULT_SHOPIFY_SYNC_INTERVAL_HOURS);
    const intervalHours = Number.isFinite(configuredHours) && configuredHours > 0
        ? configuredHours
        : DEFAULT_SHOPIFY_SYNC_INTERVAL_HOURS;
    return Math.max(MIN_SHOPIFY_SYNC_INTERVAL_MS, Math.round(intervalHours * 60 * 60 * 1000));
}

export function getShopifySyncScheduleConfig(env = process.env) {
    return {
        enabled: env.SHOPIFY_SCHEDULED_SYNC_ENABLED === 'true',
        intervalMs: parseIntervalMs(env),
    };
}

export async function enqueueDueShopifySyncs({
    staleBefore = new Date(Date.now() - getShopifySyncScheduleConfig().intervalMs),
    reason = 'scheduled',
} = {}) {
    const connections = await ShopifyConnection.find({
        sync_enabled: true,
        $or: [
            { client_id: { $ne: '' }, client_secret: { $ne: '' } },
            { access_token: { $ne: '' } }
        ],
        $or: [
            { last_sync_at: null },
            { last_sync_at: { $lt: staleBefore } }
        ]
    }).limit(50);

    let queued = 0;
    for (const connection of connections) {
        const activeRun = await IntegrationSyncRun.findOne({
            tenant_id: connection.tenant_id,
            integration: 'shopify',
            status: { $in: ['queued', 'running'] }
        });
        if (activeRun) continue;

        let syncRunId = null;
        try {
            const syncRun = await IntegrationSyncRun.create({
                tenant_id: connection.tenant_id,
                integration: 'shopify',
                status: 'queued',
                totals: { reason, staleBefore }
            });
            syncRunId = syncRun._id.toString();

            const jobId = await enqueueJob({
                tenantId: connection.tenant_id,
                jobType: 'shopify.sync',
                payload: {
                    tenantId: connection.tenant_id,
                    connectionId: connection._id.toString(),
                    syncRunId: syncRunId,
                    trigger: reason,
                },
                maxAttempts: 3,
            });

            await IntegrationSyncRun.findByIdAndUpdate(syncRunId, { $set: { job_id: jobId } });
            queued += 1;
        } catch (error) {
            if (syncRunId) {
                await IntegrationSyncRun.findByIdAndUpdate(syncRunId, {
                    $set: { status: 'failed', error: error.message, completed_at: new Date() }
                }).catch(() => {});
            }
            console.error(`[ShopifyScheduler] Failed to queue tenant ${connection.tenant_id}:`, error.message);
        }
    }

    return queued;
}

export function startShopifySyncScheduler({ intervalMs = null } = {}) {
    const config = getShopifySyncScheduleConfig();
    if (schedulerTimer || !config.enabled) {
        return { stop: stopShopifySyncScheduler };
    }

    const effectiveIntervalMs = Math.max(
        MIN_SHOPIFY_SYNC_INTERVAL_MS,
        Number(intervalMs || config.intervalMs) || config.intervalMs
    );

    const tick = async () => {
        if (schedulerActive) return;
        schedulerActive = true;
        try {
            const staleBefore = new Date(Date.now() - effectiveIntervalMs);
            await enqueueDueShopifySyncs({ staleBefore, reason: 'scheduled' });
        } catch (error) {
            console.error('[ShopifyScheduler] Tick failed:', error.message);
        } finally {
            schedulerActive = false;
        }
    };

    schedulerTimer = setInterval(tick, effectiveIntervalMs);
    if (schedulerTimer.unref) schedulerTimer.unref();
    tick();
    return { stop: stopShopifySyncScheduler };
}

export function stopShopifySyncScheduler() {
    if (schedulerTimer) clearInterval(schedulerTimer);
    schedulerTimer = null;
    schedulerActive = false;
}
