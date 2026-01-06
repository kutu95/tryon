# Setting Up GitHub Repository

## Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `tryon-app` (or your preferred name)
3. Description: "Costume Stylist Virtual Try-On Application"
4. Choose Private or Public
5. **Don't** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 2: Push Code to GitHub

On your local machine, run these commands:

```bash
# Add all files
git add .

# Commit
git commit -m "Initial commit: Tryon app with FASHN AI integration"

# Add your GitHub repository as remote
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/tryon-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

If you need to authenticate:
- Use a Personal Access Token (Settings > Developer settings > Personal access tokens)
- Or use SSH: `git remote add origin git@github.com:YOUR_USERNAME/tryon-app.git`

## Step 3: Update Deployment Script

Edit `deploy-server.sh` and update:
- `REPO_URL` with your actual GitHub repository URL

## Step 4: Deploy to Server

SSH into your server:
```bash
ssh user@192.168.0.146
```

Copy the deployment script to the server:
```bash
# From your local machine
scp deploy-server.sh user@192.168.0.146:/tmp/
scp ecosystem.config.js user@192.168.0.146:/tmp/
scp DEPLOYMENT.md user@192.168.0.146:/tmp/
```

On the server:
```bash
# Make executable
chmod +x /tmp/deploy-server.sh

# Edit the script to update REPO_URL
nano /tmp/deploy-server.sh

# Run deployment (as root or with sudo)
sudo /tmp/deploy-server.sh
```

Or follow the manual steps in `DEPLOYMENT.md`.

## Step 5: Configure Cloudflare Tunnel

On your server, edit the Cloudflare tunnel config to add the tryon route:

```bash
nano ~/.cloudflared/config.yml
```

Add or update the ingress section:

```yaml
ingress:
  # Your existing routes...
  - hostname: tryon.margies.app
    service: http://localhost:3000
  - service: http_status:404
```

Route DNS:
```bash
cloudflared tunnel route dns <tunnel-name> tryon.margies.app
```

Restart the tunnel:
```bash
# If running as service
sudo systemctl restart cloudflared

# Or manually
cloudflared tunnel run <tunnel-name>
```

## Step 6: Set Environment Variables

On the server, edit `.env.local`:

```bash
nano /opt/tryon/.env.local
```

Make sure these are set correctly:
- `NEXT_PUBLIC_SUPABASE_URL=http://192.168.0.146:54321` (local Supabase)
- `NEXT_PUBLIC_APP_URL=https://tryon.margies.app` (public URL)
- All your API keys

Restart the app:
```bash
pm2 restart tryon-app
```

## Updating the App

When you make changes:

```bash
# On local machine
git add .
git commit -m "Your changes"
git push

# On server
cd /opt/tryon
git pull
npm install  # If dependencies changed
npm run build
pm2 restart tryon-app
```

