import mongoose from 'mongoose';
import config from './config.js';

let initialized = false;
const LOCAL_MONGO_URI = 'mongodb://127.0.0.1:27017/narmada_broadcast_dev';

export function resolveMongoUri(env = process.env, appConfig = config) {
    const uri = env.MONGO_URI || appConfig.mongoUri;
    if (uri) return uri;

    if (env.NODE_ENV === 'production' || env.VERCEL) {
        throw new Error('MONGO_URI is required for production/Vercel deployments');
    }

    return LOCAL_MONGO_URI;
}

const initDatabase = async () => {
    if (initialized) return;
    try {
        const uri = resolveMongoUri();
        await mongoose.connect(uri);
        console.log('MongoDB connected successfully');
        initialized = true;
    } catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
};

export const query = async () => [];
export const get = async () => null;
export const run = async () => ({ changes: 0, lastInsertRowid: 0 });
export const getTenantById = async () => null;
export const getTenantBySlug = async () => null;

export { initDatabase };
export default { initDatabase, query, get, run, getTenantById, getTenantBySlug };
