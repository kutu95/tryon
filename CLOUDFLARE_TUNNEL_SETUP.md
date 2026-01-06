# Cloudflare Tunnel Setup for Tryon App

This guide helps you set up a Cloudflare tunnel to expose your local Next.js server publicly, allowing FASHN API to access your image proxy endpoints.

## Quick Start (Temporary URL)

The easiest way to get started is using a quick tunnel that gives you a temporary URL:

```bash
# Install cloudflared if not already installed
brew install cloudflare/cloudflare/cloudflared

# Start a quick tunnel (temporary URL, changes each time)
cloudflared tunnel --url http://localhost:3000
```

This will give you a URL like `https://abc123-def456.trycloudflare.com`. Copy this URL and add it to your `.env.local`:

```env
NEXT_PUBLIC_APP_URL=https://abc123-def456.trycloudflare.com
```

**Note:** This URL changes each time you restart the tunnel. For a permanent URL, use the setup script below.

## Permanent Tunnel Setup

### 1. Install cloudflared

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
# Download from https://github.com/cloudflare/cloudflared/releases
```

### 2. Authenticate

```bash
cloudflared tunnel login
```

This opens a browser window to authenticate with Cloudflare.

### 3. Create a Tunnel

```bash
cloudflared tunnel create tryon-app
```

### 4. Configure the Tunnel

Edit `~/.cloudflared/config.yml`:

```yaml
tunnel: <your-tunnel-uuid>
credentials-file: /Users/your-username/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: tryon-app.yourdomain.com  # Or use a trycloudflare.com subdomain
    service: http://localhost:3000
  - service: http_status:404
```

### 5. Route DNS (if you have a domain)

```bash
cloudflared tunnel route dns tryon-app tryon-app.yourdomain.com
```

### 6. Start the Tunnel

```bash
cloudflared tunnel run tryon-app
```

### 7. Update Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_APP_URL=https://tryon-app.yourdomain.com
```

## Using the Setup Script

We've included a setup script to automate most of this:

```bash
./setup-cloudflare-tunnel.sh
```

This script will:
- Check if cloudflared is installed (install if needed)
- Authenticate with Cloudflare
- Create the tunnel
- Generate a config file

You'll still need to:
1. Update the hostname in the config file
2. Route DNS (if using your own domain)
3. Start the tunnel

## Running the Tunnel

### Option 1: Quick Tunnel (Temporary)
```bash
cloudflared tunnel --url http://localhost:3000
```

### Option 2: Named Tunnel (Permanent)
```bash
cloudflared tunnel run tryon-app
```

### Option 3: Run as Service (Background)

**macOS (using launchd):**
```bash
cloudflared service install
cloudflared tunnel run tryon-app
```

**Linux (using systemd):**
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
```

## Troubleshooting

### Tunnel won't start
- Make sure your Next.js server is running on `http://localhost:3000`
- Check that the tunnel credentials file exists
- Verify the config file syntax is correct

### Can't access the tunnel URL
- Make sure the tunnel is running
- Check DNS propagation (if using your own domain)
- Verify the hostname in config matches your DNS

### FASHN still can't access images
- Make sure `NEXT_PUBLIC_APP_URL` is set correctly in `.env.local`
- Restart your Next.js dev server after updating the env var
- Test the proxy URL manually: `https://your-tunnel-url/api/storage/proxy?bucket=actors&path=...`

## Resources

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [cloudflared Installation Guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)

