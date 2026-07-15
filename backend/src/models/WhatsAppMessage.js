import mongoose from 'mongoose';

const WhatsAppMessageSchema = new mongoose.Schema({
    tenant_id: { type: String, default: 'single-tenant' },
    campaign_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppCampaign', required: true },
    phone: { type: String, required: true },
    recipient_name: { type: String, default: '' },
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', default: null },
    status: { type: String, enum: ['pending', 'sent', 'delivered', 'read', 'failed'], default: 'pending' },
    attempt_count: { type: Number, default: 0 },
    last_attempt_at: { type: Date, default: null },
    provider_message_id: { type: String, default: null },
    error_message: { type: String, default: null },
    provider_error_code: { type: String, default: null },
    provider_error_payload: { type: Object, default: null },
    sent_at: { type: Date, default: null },
    delivered_at: { type: Date, default: null },
    read_at: { type: Date, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model('WhatsAppMessage', WhatsAppMessageSchema);
