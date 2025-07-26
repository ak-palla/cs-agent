#!/bin/bash

echo "🚀 Starting Flock integration with ngrok..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please install ngrok:"
    echo "   https://ngrok.com/download"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not found. Please install Node.js and npm"
    exit 1
fi

echo "📋 Starting ngrok tunnel..."
echo "   This will create a public URL for your local server"
echo "   Wait for the ngrok URL to appear, then copy it"
echo ""

# Configure ngrok with your API key
    echo "Configuring ngrok with your API key..."
    ngrok authtoken 30POKYN477QiUAx4sp0qL6so30D_3rzzvvL6nVmeX1xaY3NXV
    
    # Start ngrok with custom configuration
    echo "Starting ngrok tunnel..."
    ngrok http 3000 --region=us > ngrok.log 2>&1 &
    NGROK_PID=$!

# Wait for ngrok to start
echo "⏳ Waiting for ngrok to initialize..."
sleep 5

# Get the public URL
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -z "$PUBLIC_URL" ]; then
    echo "❌ Failed to get ngrok URL. Checking logs..."
    cat ngrok.log
    kill $NGROK_PID 2>/dev/null || true
    exit 1
fi

echo "✅ ngrok tunnel ready!"
echo "🌐 Public URL: $PUBLIC_URL"
echo ""
echo "📋 Next steps:"
echo "1. Go to https://dev.flock.com"
echo "2. Find your app configuration"
echo "3. Set Event Listener URL to: $PUBLIC_URL/api/flock/app-install"
echo "4. Save the configuration"
echo "5. Try installing the app again"
echo ""
echo "🔧 Testing URLs:"
echo "   Webhook: $PUBLIC_URL/api/flock/app-install"
echo "   Test: $PUBLIC_URL/api/test-app-install"
echo "   Challenge Test: $PUBLIC_URL/api/flock/app-install?challenge=test123"
echo ""

# Update environment variable
echo "NEXT_PUBLIC_FLOCK_WEBHOOK_URL=$PUBLIC_URL/api/flock/app-install" >> .env.local

echo "🎯 Starting Next.js development server..."
echo "   Server will be available at: $PUBLIC_URL"
echo "   Press Ctrl+C to stop both servers"
echo ""

# Start Next.js development server
npm run dev

# Cleanup when script exits
trap 'kill $NGROK_PID 2>/dev/null || true; rm -f ngrok.log' EXIT