#!/bin/sh
echo "[start] Clearing cache and rebuilding frontend..."
cd /app
rm -rf dist
npm run build
echo "[start] Server starting..."
NODE_ENV=production node dist/boot.js
