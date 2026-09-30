FROM node:20-alpine
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./
RUN npm install --force

# Copy all source code
COPY . .

# Force cache invalidation - always rebuild frontend
ARG CACHE_BUST=2026-09-30-001
RUN echo "Cache bust: $CACHE_BUST" && rm -rf dist && npm run build

EXPOSE 3000
CMD ["sh", "start.sh"]
