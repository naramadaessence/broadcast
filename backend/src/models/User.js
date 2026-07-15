import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    role: { type: String, default: 'admin' }, // Since it's single user, defaults to admin
    whatsapp_access_token: { type: String },
    whatsapp_phone_number_id: { type: String },
    whatsapp_business_account_id: { type: String },
    whatsapp_catalog_id: { type: String },
    whatsapp_configured: { type: Boolean, default: false },
    bot_settings: { type: Object, default: {} },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

// Pre-save removed

export default mongoose.model('User', UserSchema);
