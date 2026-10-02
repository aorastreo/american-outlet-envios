FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --force

# Copy source code
COPY . .

# Build frontend (Vite) + backend (esbuild)
RUN rm -rf dist && npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/boot.js"]
