import JobQueue from '../models/JobQueue.js';

export const KNOWN_JOB_TYPES = ['campaign.send', 'shopify.sync'];

const handlers = new Map();
let workerTimer = null;
let workerActive = false;

const DEFAULT_WORKER_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

function parsePayload(payload) {
    if (!payload) return {};
    if (typeof payload === 'object') return payload;
    try {
        return JSON.parse(payload);
    } catch {
        return {};
    }
}

function serializeError(error) {
    if (!error) return null;
    if (typeof error === 'string') return error;
    return error.message || JSON.stringify(error);
}

function nextRunAfter(attempts) {
    const seconds = Math.min(300, Math.max(5, attempts * 15));
    return new Date(Date.now() + seconds * 1000);
}

export function registerJobHandler(jobType, handler) {
    if (!jobType || typeof handler !== 'function') {
        throw new Error('registerJobHandler requires a job type and handler function');
    }
    handlers.set(jobType, handler);
}

export async function enqueueJob({ tenantId = 'single-tenant', jobType, payload = {}, runAfter = null, maxAttempts = 3 }) {
    if (!jobType) throw new Error('jobType is required');

    const job = await JobQueue.create({
        tenant_id: tenantId || 'single-tenant',
        job_type: jobType,
        payload: payload || {},
        max_attempts: maxAttempts,
        run_after: runAfter || new Date()
    });

    return job._id.toString();
}

export async function claimNextJob({ workerId = DEFAULT_WORKER_ID, jobTypes = null } = {}) {
    const types = Array.isArray(jobTypes) && jobTypes.length ? jobTypes : [...handlers.keys()];
    if (!types.length) return null;

    const job = await JobQueue.findOneAndUpdate(
        {
            status: 'queued',
            run_after: { $lte: new Date() },
            $expr: { $lt: ['$attempts', '$max_attempts'] },
            job_type: { $in: types }
        },
        {
            $set: {
                status: 'running',
                locked_at: new Date(),
                locked_by: workerId,
                error: null,
                updated_at: new Date()
            }
        },
        { sort: { run_after: 1, _id: 1 }, new: true }
    );

    if (!job) return null;
    return { ...job.toObject(), id: job._id.toString(), payload: parsePayload(job.payload) };
}

export async function completeJob(jobId) {
    await JobQueue.findByIdAndUpdate(jobId, {
        $set: {
            status: 'completed',
            completed_at: new Date(),
            locked_at: null,
            locked_by: null,
            error: null,
            updated_at: new Date()
        }
    });
}

export async function failJob(jobId, error) {
    const job = await JobQueue.findById(jobId);
    if (!job) return;

    const message = serializeError(error);
    const nextAttempts = (job.attempts || 0) + 1;
    if (nextAttempts >= (job.max_attempts || 1)) {
        await JobQueue.findByIdAndUpdate(jobId, {
            $set: {
                status: 'failed',
                attempts: nextAttempts,
                locked_at: null,
                locked_by: null,
                error: message,
                updated_at: new Date()
            }
        });
        return;
    }

    await JobQueue.findByIdAndUpdate(jobId, {
        $set: {
            status: 'queued',
            attempts: nextAttempts,
            run_after: nextRunAfter(nextAttempts),
            locked_at: null,
            locked_by: null,
            error: message,
            updated_at: new Date()
        }
    });
}

export async function cancelJob(jobId) {
    await JobQueue.findOneAndUpdate(
        { _id: jobId, status: { $in: ['queued', 'running'] } },
        {
            $set: {
                status: 'cancelled',
                locked_at: null,
                locked_by: null,
                updated_at: new Date()
            }
        }
    );
}

export async function runDueJobs({ limit = 5, workerId = DEFAULT_WORKER_ID } = {}) {
    let processed = 0;
    while (processed < limit) {
        const job = await claimNextJob({ workerId });
        if (!job) break;

        const handler = handlers.get(job.job_type);
        if (!handler) {
            await failJob(job.id, new Error(`No handler registered for ${job.job_type}`));
            processed += 1;
            continue;
        }

        try {
            await handler(job);
            const refreshed = await JobQueue.findById(job.id);
            if (refreshed?.status === 'running') {
                await completeJob(job.id);
            }
        } catch (error) {
            await failJob(job.id, error);
        }
        processed += 1;
    }
    return processed;
}

export function startJobWorker({ intervalMs = Number(process.env.JOB_WORKER_INTERVAL_MS || 5000), workerId = DEFAULT_WORKER_ID } = {}) {
    if (workerTimer || process.env.JOB_WORKER_ENABLED === 'false') {
        return { stop: stopJobWorker };
    }

    const tick = async () => {
        if (workerActive) return;
        workerActive = true;
        try {
            await runDueJobs({ workerId });
        } catch (error) {
            console.error('[JobQueue] Worker tick failed:', error.message);
        } finally {
            workerActive = false;
        }
    };

    workerTimer = setInterval(tick, intervalMs);
    if (workerTimer.unref) workerTimer.unref();
    tick();
    return { stop: stopJobWorker };
}

export function stopJobWorker() {
    if (workerTimer) clearInterval(workerTimer);
    workerTimer = null;
    workerActive = false;
}

export async function recentJobs(tenantId, jobType, limit = 20) {
    const jobs = await JobQueue.find({ tenant_id: tenantId || 'single-tenant', job_type: jobType })
        .sort({ _id: -1 })
        .limit(Math.min(Number(limit) || 20, 100));
    return jobs.map(j => ({ ...j.toObject(), id: j._id.toString() }));
}
