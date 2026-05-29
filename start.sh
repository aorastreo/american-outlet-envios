#!/bin/sh
set -e
echo "Running seed..."
NODE_ENV=production node db/seed.js
echo "Starting server..."
NODE_ENV=production node dist/boot.js
