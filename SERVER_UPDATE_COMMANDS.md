# Server Update Commands

## Pull Latest Changes and Restart App

Run these commands on your server:

```bash
cd ~/apps/tryon
git pull
npm run build
pm2 restart tryon
pm2 status
```

## One-liner Version

```bash
cd ~/apps/tryon && git pull && npm run build && pm2 restart tryon && pm2 status
```

## If Build Fails

If the build fails, check for errors:

```bash
cd ~/apps/tryon
git pull
npm install  # In case new dependencies were added
npm run build
pm2 restart tryon
```

## View Logs After Restart

```bash
pm2 logs tryon --lines 50
```

## Check if App is Running

```bash
pm2 status
curl http://localhost:3002  # Or whatever port your app uses
```

