import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String },
    location: { type: String },
    ticket_size: { type: Number },
    tags: { type: [String], default: [] },
    labels: { type: [String], default: [] },
    notes: { type: String },
    source: { type: String, default: 'manual' },
    whatsapp_consent: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

// Pre-save removed

export default mongoose.model('Contact', ContactSchema);
