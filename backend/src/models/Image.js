import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
    filename: { type: String, required: true, unique: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true }
}, { timestamps: true });

export default mongoose.model('Image', imageSchema);
