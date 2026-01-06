# Quick Start: Deploy Tryon App to Server

## Summary

This guide will help you:
1. Create a GitHub repository
2. Push your code to GitHub
3. Deploy to your server at 192.168.0.146
4. Configure Cloudflare tunnel for tryon.margies.app

## Step 1: Create GitHub Repo & Push Code

```bash
# 1. Create repo on GitHub (go to github.com/new)
#    Name: tryon-app
#    Don't initialize with anything

# 2. Push your code (replace YOUR_USERNAME)
git add .
git commit -m "Initial commit: Tryon app"
git remote add origin https://github.com/YOUR_USERNAME/tryon-app.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Server

SSH into your server:
```bash
ssh user@192.168.0.146
```

On the server:
```bash
# Clone the repo
cd /opt  # or wherever you keep apps
sudo git clone https://github.com/YOUR_USERNAME/tryon-app.git tryon
cd tryon

# Install dependencies
sudo npm install

# Build
sudo npm run build

# Create .env.local
sudo nano .env.local
```

Add to `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://192.168.0.146:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
TRYON_PROVIDER=fashn
FASHN_API_KEY=fa-NGp60ylEZOtn-WgNFfU8RjIXJsVWkPeYTPLvk
NEXT_PUBLIC_APP_URL=https://tryon.margies.app
NODE_ENV=production
```

## Step 3: Set Up PM2

```bash
# Install PM2
sudo npm install -g pm2

# Start app
sudo pm2 start ecosystem.config.js
sudo pm2 save
sudo pm2 startup  # Follow instructions
```

## Step 4: Configure Cloudflare Tunnel

Edit tunnel config on server:
```bash
nano ~/.cloudflared/config.yml
```

Add:
```yaml
ingress:
  - hostname: tryon.margies.app
    service: http://localhost:3000
  - service: http_status:404
```

Route DNS:
```bash
cloudflared tunnel route dns <tunnel-name> tryon.margies.app
```

Restart tunnel:
```bash
sudo systemctl restart cloudflared
```

## Step 5: Verify

1. Check app: `pm2 status`
2. Check logs: `pm2 logs tryon`
3. Test: Open https://tryon.margies.app

Done! 🎉

