import mongoose from 'mongoose';

const FaqPhrasingSchema = new mongoose.Schema({
    tenant_id: { type: String, required: true, index: true },
    faq_id: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeBase', required: true, index: true },
    phrasing: { type: String, required: true },
    phrasing_vector: { type: [Number], default: [] },
    embedding_model: { type: String, default: null },
    created_at: { type: Date, default: Date.now }
});

export default mongoose.model('FaqPhrasing', FaqPhrasingSchema);
