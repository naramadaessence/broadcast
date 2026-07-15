import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    mrp: { type: Number, default: 0 },
    selling_price: { type: Number, default: 0 },
    category: { type: String },
    sku: { type: String },
    image_url: { type: String },
    images: { type: [String], default: [] },
    meta_product_id: { type: String },
    external_provider: { type: String, default: null },
    external_id: { type: String, default: null },
    external_variant_id: { type: String, default: null },
    external_updated_at: { type: Date, default: null },
    source_integration_id: { type: String, default: null },
    inventory_quantity: { type: Number, default: null },
    inventory_policy: { type: String, enum: ['deny', 'continue'], default: 'deny' },
    inventory_available: { type: Boolean, default: true },
    product_vector: { type: [Number] },
    embedding_model: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

export default mongoose.model('Product', ProductSchema);
