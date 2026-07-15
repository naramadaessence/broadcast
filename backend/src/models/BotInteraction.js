import mongoose from 'mongoose';

const BotInteractionSchema = new mongoose.Schema({
    tenant_id: { type: String, required: true, index: true },
    conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppConversation', default: null },
    phone: { type: String, default: '' },
    interaction_type: { type: String, required: true, index: true },
    source: { type: String, default: 'bot' },
    faq_id: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeBase', default: null },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    intent: { type: String, default: null },
    outcome: { type: String, default: null },
    metadata: { type: Object, default: {} },
    created_at: { type: Date, default: Date.now, index: true }
});

export default mongoose.model('BotInteraction', BotInteractionSchema);
