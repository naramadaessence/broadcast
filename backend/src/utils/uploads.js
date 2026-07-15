import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Returns a writable uploads directory path.
 * In serverless environments (Vercel, AWS Lambda) or when process.cwd() is read-only,
 * it falls back to os.tmpdir()/uploads.
 */
export const getUploadsDir = () => {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.VERCEL_ENV);
    const baseDir = isServerless ? os.tmpdir() : process.cwd();
    let uploadDir = path.join(baseDir, 'uploads');

    try {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
    } catch (err) {
        // If creating dir in process.cwd() fails (read-only file system), fallback to os.tmpdir()
        uploadDir = path.join(os.tmpdir(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
    }

    return uploadDir;
};
