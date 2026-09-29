#!/bin/sh
cd /app

# Check if the built frontend contains our marker
if ! grep -q "v3-FORCE-REBUILD" dist/public/index.html 2>/dev/null; then
  echo "[start] Frontend outdated or missing, rebuilding..."
  rm -rf dist
  npm run build
  echo "[start] Build complete."
else
  echo "[start] Frontend is up to date."
fi

echo "[start] Starting server..."
NODE_ENV=production node dist/boot.js
