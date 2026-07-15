import mongoose from 'mongoose';

const KnowledgeBaseSchema = new mongoose.Schema({
    tenant_id: { type: String, default: 'single-tenant' },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    question_vector: { type: [Number], default: [] },
    embedding_model: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now }
});

export default mongoose.model('KnowledgeBase', KnowledgeBaseSchema);
