# Fix PM2 App Name on Server

The PM2 process is still using the old name "tryon-app". Here's how to fix it:

## Step 1: Fix Git Ownership Issue

```bash
git config --global --add safe.directory /home/john/apps/tryon
```

## Step 2: Update ecosystem.config.js on Server

Make sure the file has the correct name:

```bash
nano ~/apps/tryon/ecosystem.config.js
```

It should have:
```javascript
name: 'tryon',
```
NOT `name: 'tryon-app',`

## Step 3: Stop and Delete Old Process

```bash
sudo pm2 stop tryon-app
sudo pm2 delete tryon-app
```

## Step 4: Start with Updated Config

```bash
cd ~/apps/tryon
sudo pm2 start ecosystem.config.js
sudo pm2 save
```

You should now see `tryon` instead of `tryon-app` in the PM2 list.

## Alternative: Manual Update

If the config file is correct but PM2 is still using the old name, you can manually update:

```bash
# Stop current process
sudo pm2 stop tryon-app

# Delete it
sudo pm2 delete tryon-app

# Start with explicit name
sudo pm2 start npm --name "tryon" -- start
sudo pm2 save
```

Or edit the ecosystem file directly and restart:
```bash
sudo pm2 delete tryon-app
sudo pm2 start ecosystem.config.js
sudo pm2 save
```

