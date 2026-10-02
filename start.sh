#!/bin/sh
set -e

cd /app

echo "========================================"
echo "[AO] START.SH - Build v3.4"
echo "[AO] Node version: $(node --version)"
echo "[AO] Working dir: $(pwd)"
echo "========================================"

# Verify vite is available
if ! command -v vite >/dev/null 2>&1; then
  echo "[AO] vite not found, checking node_modules..."
  ls node_modules/.bin/vite 2>/dev/null || echo "[AO] vite binary NOT FOUND"
fi

# Clean old build to force fresh compile
echo "[AO] Cleaning dist/public..."
rm -rf dist/public

echo "[AO] Building frontend with Vite..."
npx vite build

echo "[AO] Verifying build output..."
ls -la dist/public/ 2>/dev/null | head -10 || echo "[AO] dist/public NOT FOUND"

echo "[AO] Checking index.html for build marker..."
grep -o 'BUILD: [^<]*' dist/public/index.html 2>/dev/null || echo "[AO] No build marker found"

echo "[AO] Starting server..."
NODE_ENV=production node dist/boot.js
