#!/bin/sh
cd /app

echo "[start] Rebuilding frontend..."
npx vite build

echo "[start] Starting server..."
NODE_ENV=production node dist/boot.js
