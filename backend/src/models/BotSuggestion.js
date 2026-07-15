import mongoose from 'mongoose';

const BotSuggestionSchema = new mongoose.Schema({
    tenant_id: { type: String, required: true, index: true },
    suggestion_type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    source_count: { type: Number, default: 0 },
    payload: { type: Object, default: {} },
    status: { type: String, default: 'open', index: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

BotSuggestionSchema.index({ tenant_id: 1, suggestion_type: 1, title: 1 }, { unique: true });

export default mongoose.model('BotSuggestion', BotSuggestionSchema);
