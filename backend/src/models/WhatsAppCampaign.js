import mongoose from 'mongoose';

const WhatsAppCampaignSchema = new mongoose.Schema({
    tenant_id: { type: String, default: 'single-tenant' },
    name: { type: String, default: '' },
    campaign_name: { type: String, required: true },
    template_params: { type: Object, default: {} },
    language_code: { type: String, default: 'en' },
    recipient_type: { type: String, enum: ['all', 'custom', 'labeled', 'tagged', 'filtered'], default: 'all' },
    recipient_filter: { type: Object, default: {} },
    total_recipients: { type: Number, default: 0 },
    successful_count: { type: Number, default: 0 },
    failed_count: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'queued', 'processing', 'paused', 'cancelled', 'completed', 'failed'], default: 'draft' },
    sent_by: { type: String, default: '' },
    sent_by_name: { type: String, default: '' },
    error_log: { type: String, default: null },
    completed_at: { type: Date, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model('WhatsAppCampaign', WhatsAppCampaignSchema);
