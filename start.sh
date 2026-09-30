#!/bin/sh
cd /app

# Railway sometimes serves old cached frontend files.
# Rebuild frontend at startup if it's outdated.
if [ -f dist/boot.js ] && ([ ! -f dist/public/index.html ] || ! grep -q "v3-FORCE-REBUILD" dist/public/index.html 2>/dev/null); then
  echo "[start] FRONTEND OUTDATED - Rebuilding now..."
  npx vite build
  echo "[start] Frontend rebuild complete."
fi

if [ ! -f dist/boot.js ]; then
  echo "[start] Backend missing - Running full build..."
  npm run build
fi

echo "[start] Starting server..."
NODE_ENV=production node dist/boot.js
