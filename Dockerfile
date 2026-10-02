FROM node:20-slim

# Cache buster - change this to force rebuild
ARG CACHE_BUST=2026-10-03-001

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --force

# Copy source code
COPY . .

# Build frontend + backend
RUN rm -rf dist && npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/boot.js"]
