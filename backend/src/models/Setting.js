import mongoose from 'mongoose';

const SettingSchema = new mongoose.Schema({
    singletonId: { type: String, default: 'admin_settings', unique: true },
    name: { type: String, default: 'My WhatsApp Platform' },
    email: { type: String, default: 'admin@localhost' },
    phone: { type: String, default: '' },
    logo_url: { type: String, default: '' },
    primary_color: { type: String, default: '#6366f1' },
    whatsapp_access_token: { type: String, default: '' },
    whatsapp_phone_number_id: { type: String, default: '' },
    whatsapp_business_account_id: { type: String, default: '' },
    whatsapp_catalog_id: { type: String, default: '' },
    whatsapp_configured: { type: Boolean, default: false },
    razorpay_key_id: { type: String, default: '' },
    razorpay_key_secret: { type: String, default: '' },
    bot_settings: { type: Object, default: {} },
    updated_at: { type: Date, default: Date.now }
});

// Pre-save hook removed. Mongoose timestamps or manual date setting is preferred.

export default mongoose.model('Setting', SettingSchema);
