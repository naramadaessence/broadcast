import { createServer } from 'http';
import app from './app.js';
import config from './config.js';
import { initDatabase } from './database.js';
import { initModel } from './services/smartResponder.js';
import { initWebSocket } from './services/websocket.js';


const startServer = async () => {
    try {
        // Initialize database first
        await initDatabase();

        // Pre-warm the NLP model in the background
        initModel().catch(console.error);

        // Create HTTP server
        const server = createServer(app);

        // Initialize WebSocket
        initWebSocket(server);

        // Start server
        server.listen(config.port, () => {
            console.log(`WhatsApp Broadcast API running on port ${config.port}`);
            console.log(`Environment: ${config.nodeEnv}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
