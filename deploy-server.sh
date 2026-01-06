#!/bin/bash

# Server Deployment Script for Tryon App
# Run this on your server (192.168.0.146)

set -e

APP_DIR="/opt/tryon"  # Adjust this path as needed
REPO_URL="https://github.com/YOUR_USERNAME/tryon-app.git"  # Update with your repo URL
APP_NAME="tryon-app"

echo "Deploying Tryon App to server..."

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run with sudo or as root"
    exit 1
fi

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Create app directory
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Clone or update repository
if [ -d ".git" ]; then
    echo "Updating repository..."
    git pull
else
    echo "Cloning repository..."
    git clone "$REPO_URL" .
fi

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Build the app
echo "Building the app..."
npm run build

# Create logs directory
mkdir -p logs

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local template..."
    cat > .env.local << 'EOF'
# Supabase (update with your values)
NEXT_PUBLIC_SUPABASE_URL=http://192.168.0.146:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Try-on Provider
TRYON_PROVIDER=fashn
FASHN_API_KEY=your_fashn_api_key_here

# App URL (public URL via Cloudflare tunnel)
NEXT_PUBLIC_APP_URL=https://tryon.margies.app

# Node environment
NODE_ENV=production
EOF
    echo "⚠️  Please edit .env.local with your actual values!"
fi

# Start/restart with PM2
echo "Starting app with PM2..."
if pm2 list | grep -q "$APP_NAME"; then
    echo "Restarting existing app..."
    pm2 restart "$APP_NAME"
else
    echo "Starting new app..."
    pm2 start ecosystem.config.js
    pm2 save
fi

# Show status
echo ""
echo "✓ Deployment complete!"
echo ""
echo "PM2 Status:"
pm2 status
echo ""
echo "To view logs: pm2 logs $APP_NAME"
echo "To stop: pm2 stop $APP_NAME"
echo "To restart: pm2 restart $APP_NAME"

