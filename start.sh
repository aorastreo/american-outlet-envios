#!/bin/sh
# Seed - if it fails, continue anyway
NODE_ENV=production node db/seed.js 2>/dev/null || echo "[start] Seed skipped or failed, continuing..."
# Start server
echo "[start] Starting server..."
NODE_ENV=production node dist/boot.js
