#!/bin/sh
set -e

echo "[startup] Running Prisma migrations..."
node_modules/.bin/prisma migrate deploy

echo "[startup] Running seed..."
node_modules/.bin/prisma db seed

echo "[startup] Starting API on port ${PORT:-5000}..."
exec node --max-old-space-size=1024 dist/main.js
