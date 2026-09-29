# Stage 1: Build everything
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --force
COPY . .
RUN rm -rf dist
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY start.sh ./
RUN npm install --force --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["sh", "start.sh"]
