# ──────────────────────────────────────────────────
# DocForge — Document Generator
# Single container: Node.js + LibreOffice
# ──────────────────────────────────────────────────

# Base image: Node.js 22 on Debian Slim
FROM node:22-slim

# Install LibreOffice for DOCX → PDF conversion
# --no-install-recommends keeps the image smaller
# Clean up apt cache afterwards to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libreoffice-writer \
        libreoffice-common \
        fonts-dejavu \
        fonts-liberation && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy package files first (Docker layer caching optimization)
# If these don't change, npm install is skipped on rebuild
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source code
COPY server.js ./
COPY services/ ./services/
COPY public/ ./public/

# Create uploads directory for runtime file storage
RUN mkdir -p uploads

# Document the port the app listens on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check — Docker pings this endpoint every 30s
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:3000/api/check-pdf', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "server.js"]
