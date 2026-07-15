import mongoose from 'mongoose';

const IntegrationSyncRunSchema = new mongoose.Schema({
    tenant_id: { type: String, required: true, index: true },
    integration: { type: String, required: true, index: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },
    job_id: { type: String, default: null },
    totals: { type: Object, default: {} },
    error: { type: String, default: null },
    started_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

export default mongoose.model('IntegrationSyncRun', IntegrationSyncRunSchema);
