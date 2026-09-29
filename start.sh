#!/bin/sh
echo "[start] Rebuilding frontend to clear any volume cache..."
rm -rf dist
npm run build
echo "[start] Starting server..."
NODE_ENV=production node dist/boot.js
