import { spawn } from 'child_process';

/**
 * Transcode WebM audio buffer (from browser MediaRecorder) to OGG Opus format using FFmpeg.
 * Pipes buffer directly to FFmpeg stdin and reads OGG format from stdout.
 * @param {Buffer} webmBuffer
 * @returns {Promise<Buffer>}
 */
export function transcodeWebmToOgg(webmBuffer) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', 'pipe:0',       // Input from stdin
            '-acodec', 'libopus', // Encode with Opus codec
            '-b:a', '64k',        // Audio bitrate
            '-f', 'ogg',          // Output format OGG
            'pipe:1'              // Output to stdout
        ]);

        const chunks = [];
        const stderrChunks = [];

        ffmpeg.stdout.on('data', (chunk) => {
            chunks.push(chunk);
        });

        ffmpeg.stderr.on('data', (chunk) => {
            stderrChunks.push(chunk);
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve(Buffer.concat(chunks));
            } else {
                const stderr = Buffer.concat(stderrChunks).toString();
                reject(new Error(`FFmpeg exited with code ${code}. Stderr: ${stderr}`));
            }
        });

        ffmpeg.on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new Error('FFmpeg is not installed on the system. Please run: sudo apt-get update && sudo apt-get install -y ffmpeg'));
            } else {
                reject(new Error(`FFmpeg process error: ${err.message}`));
            }
        });

        // Write the webm buffer to FFmpeg's stdin
        try {
            ffmpeg.stdin.write(webmBuffer);
            ffmpeg.stdin.end();
        } catch (writeErr) {
            reject(new Error(`FFmpeg stdin write error: ${writeErr.message}`));
        }
    });
}
