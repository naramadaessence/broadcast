import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config.js';

let io;

export function initWebSocket(server) {
    io = new Server(server, {
        path: '/api/socket.io',
        cors: {
            origin: config.corsOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
        }
    });

    // Authentication Middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        
        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            socket.user = decoded;
            socket.tenantId = decoded.tenantId;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        if (socket.tenantId) {
            socket.join(`tenant:${socket.tenantId}`);
            console.log(`[WebSocket] Client connected: user=${socket.user.userId}, tenant=${socket.tenantId}`);
        }

        socket.on('disconnect', () => {
            console.log(`[WebSocket] Client disconnected: user=${socket.user?.userId}`);
        });
    });

    console.log('[WebSocket] Initialized');
}

export function emitToTenant(tenantId, event, data) {
    if (io) {
        io.to(`tenant:${tenantId}`).emit(event, data);
    }
}
