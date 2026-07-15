import mongoose from 'mongoose';

const WhatsAppChatMessageSchema = new mongoose.Schema({
    tenant_id: { type: String, required: true },
    conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppConversation', required: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    message_type: { type: String, enum: ['text', 'image', 'video', 'audio', 'document', 'template', 'interactive', 'location', 'contacts', 'unknown', 'order'], default: 'text' },
    body: { type: String, default: '' },
    media_id: { type: String, default: null },
    media_mime_type: { type: String, default: null },
    provider_message_id: { type: String, default: null },
    status: { type: String, enum: ['sent', 'delivered', 'read', 'failed', 'received'], default: 'sent' },
    error_message: { type: String, default: null },
    sent_by: { type: String, default: null } // The admin user who sent it, if outbound
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

WhatsAppChatMessageSchema.index({ conversation_id: 1, created_at: -1 });

export default mongoose.model('WhatsAppChatMessage', WhatsAppChatMessageSchema);
