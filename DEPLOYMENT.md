# Deployment Guide for Tryon App

This guide covers deploying the Tryon app to your server at 192.168.0.146 and configuring it with Cloudflare Tunnel.

## Prerequisites

- Server at 192.168.0.146
- Cloudflare tunnel already running
- Node.js 18+ installed on server
- Git installed on server
- GitHub repository created

## Step 1: Create GitHub Repository

1. Go to GitHub and create a new repository (e.g., `tryon-app`)
2. Don't initialize with README (we already have files)

## Step 2: Push Code to GitHub

On your local machine:

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Add remote (replace with your GitHub username/repo)
git remote add origin https://github.com/YOUR_USERNAME/tryon-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Server

SSH into your server:

```bash
ssh user@192.168.0.146
```

On the server:

```bash
# Navigate to your apps directory (adjust path as needed)
cd /path/to/apps  # or wherever you keep your apps

# Clone the repository
git clone https://github.com/YOUR_USERNAME/tryon-app.git tryon
cd tryon

# Install dependencies
npm install

# Build the app
npm run build
```

## Step 4: Set Up Environment Variables

Create `.env.local` on the server:

```bash
nano .env.local
```

Add your environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://192.168.0.146:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Try-on Provider
TRYON_PROVIDER=fashn
FASHN_API_KEY=fa-NGp60ylEZOtn-WgNFfU8RjIXJsVWkPeYTPLvk

# App URL (public URL via Cloudflare tunnel)
NEXT_PUBLIC_APP_URL=https://tryon.margies.app

# Node environment
NODE_ENV=production
```

**Important:** Make sure to use the local Supabase URL (`http://192.168.0.146:54321`) for `NEXT_PUBLIC_SUPABASE_URL` since the server is on the same network.

## Step 5: Configure Cloudflare Tunnel

On your server, edit the Cloudflare tunnel config (usually at `~/.cloudflared/config.yml`):

```yaml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: tryon.margies.app
    service: http://localhost:3000
  - service: http_status:404
```

Or if you have multiple services, add it to the existing config:

```yaml
ingress:
  # Existing services...
  - hostname: tryon.margies.app
    service: http://localhost:3000
  - service: http_status:404
```

Update DNS (if not already done):
```bash
cloudflared tunnel route dns <tunnel-name> tryon.margies.app
```

Restart the tunnel:
```bash
# If running as service
sudo systemctl restart cloudflared

# Or if running manually, stop and restart
cloudflared tunnel run <tunnel-name>
```

## Step 6: Set Up PM2 (Process Manager)

Install PM2 to keep the app running:

```bash
npm install -g pm2
```

Create a PM2 ecosystem file:

```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'tryon',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/tryon',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

Start the app:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable on boot
```

## Step 7: Verify Deployment

1. Check PM2 status:
   ```bash
   pm2 status
   pm2 logs tryon
   ```

2. Test locally on server:
   ```bash
   curl http://localhost:3000
   ```

3. Test via tunnel:
   Open `https://tryon.margies.app` in your browser

## Step 8: Update Supabase Config

Make sure your local Supabase instance is accessible from the server. If Supabase is running on the same machine, `http://192.168.0.146:54321` should work.

If Supabase is on a different machine, update the URL accordingly.

## Troubleshooting

### App won't start
- Check PM2 logs: `pm2 logs tryon`
- Verify environment variables are set
- Check if port 3000 is available: `lsof -i :3000`

### Tunnel not working
- Verify tunnel config: `cloudflared tunnel info <tunnel-name>`
- Check tunnel logs
- Verify DNS: `dig tryon.margies.app`

### Can't connect to Supabase
- Verify Supabase is running: `docker ps` (if using Docker)
- Check Supabase URL is correct
- Test connection: `curl http://192.168.0.146:54321/rest/v1/`

### Images not loading
- Verify `NEXT_PUBLIC_APP_URL` is set to `https://tryon.margies.app`
- Check proxy endpoint: `curl https://tryon.margies.app/api/storage/proxy?bucket=actors&path=...`
- Make sure authentication is working

## Updating the App

When you make changes:

```bash
# On local machine
git add .
git commit -m "Your changes"
git push

# On server
cd /path/to/tryon
git pull
npm install  # If dependencies changed
npm run build
pm2 restart tryon
```

## Security Notes

- Keep `.env.local` secure and never commit it
- Use strong passwords for Supabase
- Regularly update dependencies
- Monitor PM2 logs for errors
- Set up firewall rules if needed

