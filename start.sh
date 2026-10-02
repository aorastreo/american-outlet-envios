#!/bin/sh
cd /app

echo "[AO] === START.SH v3.3 ==="
echo "[AO] Rebuilding frontend..."
npx vite build

echo "[AO] Frontend rebuilt. Starting server..."
NODE_ENV=production node dist/boot.js
