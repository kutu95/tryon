# Configure Cloudflare Tunnel for tryon.margies.app

## Step 1: Find Your Tunnel Configuration

The tunnel config is usually at `~/.cloudflared/config.yml` or `/root/.cloudflared/config.yml` (if running as root).

```bash
# Check where the config is
ls -la ~/.cloudflared/config.yml
# or
ls -la /root/.cloudflared/config.yml
```

## Step 2: Edit the Tunnel Config

Edit the config file:

```bash
sudo nano ~/.cloudflared/config.yml
# or if it's in root's home
sudo nano /root/.cloudflared/config.yml
```

## Step 3: Add the Ingress Rule

Add `tryon.margies.app` to the ingress section. Your config should look something like this:

```yaml
tunnel: b2be279d-ebd1-41c7-8b33-c6e64b24547d
credentials-file: /root/.cloudflared/b2be279d-ebd1-41c7-8b33-c6e64b24547d.json

ingress:
  # Your existing routes (keep these)
  - hostname: cashbook.margies.app  # or whatever you have
    service: http://localhost:3001  # or whatever port
  # Add the new tryon route
  - hostname: tryon.margies.app
    service: http://localhost:3000
  # Catch-all must be last
  - service: http_status:404
```

**Important:** The catch-all rule (`http_status:404`) must be the last entry in the ingress list.

## Step 4: Route DNS

Route the DNS for tryon.margies.app:

```bash
# Find your tunnel name first
cloudflared tunnel list

# Route DNS (replace <tunnel-name> with the actual name from the list)
cloudflared tunnel route dns <tunnel-name> tryon.margies.app
```

Or if you know the tunnel name, it might be something like:
```bash
cloudflared tunnel route dns b2be279d-ebd1-41c7-8b33-c6e64b24547d tryon.margies.app
```

## Step 5: Restart the Tunnel

If running as a service:
```bash
sudo systemctl restart cloudflared
```

If running manually, stop and restart:
```bash
# Find the process
ps aux | grep cloudflared

# Kill it (replace PID with actual process ID)
sudo kill <PID>

# Restart
cloudflared tunnel run <tunnel-name>
# or if running as service
sudo systemctl start cloudflared
```

## Step 6: Verify

1. Check tunnel status:
   ```bash
   cloudflared tunnel info <tunnel-name>
   ```

2. Test DNS:
   ```bash
   dig tryon.margies.app
   ```
   Should show the tunnel CNAME.

3. Test the app:
   Open `https://tryon.margies.app` in your browser

## Troubleshooting

### Tunnel won't start
- Check config syntax: `cloudflared tunnel validate`
- Check logs: `sudo journalctl -u cloudflared -f` (if service)
- Verify credentials file exists

### DNS not working
- Wait a few minutes for DNS propagation
- Check Cloudflare dashboard for the CNAME record
- Verify the hostname matches exactly in config

### App not accessible
- Make sure PM2 app is running: `pm2 status`
- Check app is on port 3000: `sudo lsof -i :3000`
- Test locally: `curl http://localhost:3000`

