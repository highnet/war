#!/bin/sh
set -e

# Start Redis in the background
redis-server --daemonize no --bind 127.0.0.1 --port 6379 &

# Wait for Redis to be ready
echo "Waiting for Redis..."
until redis-cli ping | grep -q PONG; do
  sleep 0.5
done
echo "Redis is ready"

# Start the backend
exec npm run start:prod --workspace=apps/backend
