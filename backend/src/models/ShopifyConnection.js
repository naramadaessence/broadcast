import mongoose from 'mongoose';

const ShopifyConnectionSchema = new mongoose.Schema({
    tenant_id: { type: String, required: true, unique: true, index: true },
    shop_domain: { type: String, required: true, index: true },
    client_id: { type: String, default: '' },
    client_secret: { type: String, default: '' },
    access_token: { type: String, default: '' },
    access_token_expires_at: { type: Date, default: null },
    sync_enabled: { type: Boolean, default: true },
    last_sync_at: { type: Date, default: null },
    last_sync_status: { type: String, default: null },
    last_sync_error: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

export default mongoose.model('ShopifyConnection', ShopifyConnectionSchema);
