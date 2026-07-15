# Node.js runtime
FROM node:20-slim

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# Install frontend dependencies & build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
RUN cd frontend && npx vite build

# Copy backend source
COPY backend/ ./backend/

# Move frontend build into backend's public folder
RUN cp -r frontend/dist backend/public

# Expose port (Cloud Run sets PORT env)
EXPOSE 3000

# Start the server
WORKDIR /app/backend
CMD ["node", "src/server.js"]
