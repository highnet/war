#!/bin/bash
set -e

echo "========================================"
echo "  War Multiplayer - Deploy Script"
echo "========================================"
echo ""

# Check dependencies
if ! command -v flyctl &> /dev/null; then
    echo "Error: flyctl is not installed. Install it with:"
    echo "  brew install flyctl    # macOS"
    echo "  curl -L https://fly.io/install.sh | sh   # Linux"
    exit 1
fi

if ! flyctl auth whoami &> /dev/null; then
    echo "Error: You are not logged into Fly.io. Run:"
    echo "  flyctl auth login"
    exit 1
fi

echo "Step 1: Deploy Backend (with Redis) to Fly.io"
echo "-----------------------------------------------"

# Create backend app if it doesn't exist
if ! flyctl apps list | grep -q "highnet-war-backend"; then
    echo "Creating Fly app 'highnet-war-backend'..."
    flyctl apps create highnet-war-backend
fi

echo "Deploying backend..."
flyctl deploy --config fly.toml

echo ""
echo "Backend deployed! Your API URL is:"
echo "  https://highnet-war-backend.fly.dev/graphql"
echo "  wss://highnet-war-backend.fly.dev/graphql"
echo ""

BACKEND_URL="https://highnet-war-backend.fly.dev/graphql"
WS_URL="wss://highnet-war-backend.fly.dev/graphql"

echo "Step 2: Deploy Frontend to Fly.io"
echo "-----------------------------------------------"

# Create frontend app if it doesn't exist
if ! flyctl apps list | grep -q "highnet-war-frontend"; then
    echo "Creating Fly app 'highnet-war-frontend'..."
    flyctl apps create highnet-war-frontend
fi

echo "Building frontend with backend URL: $BACKEND_URL"
flyctl deploy --config fly.frontend.toml \
    --build-arg NUXT_PUBLIC_API_URL="$BACKEND_URL" \
    --build-arg NUXT_PUBLIC_WS_URL="$WS_URL"

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Backend:  https://highnet-war-backend.fly.dev/graphql"
echo "Frontend: https://highnet-war-frontend.fly.dev"
echo ""
echo "To view logs:"
echo "  flyctl logs --app highnet-war-backend"
echo "  flyctl logs --app highnet-war-frontend"
echo ""
