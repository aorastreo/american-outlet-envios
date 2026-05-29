#!/bin/sh
set -e
echo "[start] Creating tables..."
NODE_ENV=production node db/init.js
echo "[start] Running seed..."
NODE_ENV=production node db/seed.js
echo "[start] Starting server..."
NODE_ENV=production node dist/boot.js
