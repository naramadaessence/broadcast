import mongoose from 'mongoose';

const JobQueueSchema = new mongoose.Schema({
    tenant_id: { type: String, required: true, index: true },
    job_type: { type: String, required: true, index: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed', 'cancelled'], default: 'queued', index: true },
    payload: { type: Object, default: {} },
    attempts: { type: Number, default: 0 },
    max_attempts: { type: Number, default: 3 },
    run_after: { type: Date, default: Date.now, index: true },
    locked_at: { type: Date, default: null },
    locked_by: { type: String, default: null },
    error: { type: String, default: null },
    completed_at: { type: Date, default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

export default mongoose.model('JobQueue', JobQueueSchema);
