# Production Boot Issues - Emergency Fix Guide

## 🚨 Critical Issues Detected

### Error Analysis:

```
Error: Cannot find module 'chrono-node'
Module resolution failures in:
- /root/discord-bot/aszuneai/src/utils/time-parser.js
- /root/discord-bot/aszuneai/src/commands/reminder.js
- /root/discord-bot/aszuneai/src/services/chat.js
```

## ⚡ Emergency Fix Steps

### 1. Reinstall Dependencies (CRITICAL)

```bash
# Navigate to production directory
cd /root/discord-bot/aszuneai

# Clear node_modules and package-lock
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install

# Verify critical dependencies
npm ls chrono-node
npm ls better-sqlite3
npm ls discord.js
```

### 2. Check Node.js Version

```bash
# Ensure Node.js >= 20.18.1
node --version

# If version is too old, update Node.js
# For Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Environment Variables

```bash
# Ensure .env file exists with required variables
cat > .env << EOF
DISCORD_TOKEN=your_token_here
PERPLEXITY_API_KEY=your_key_here
LOG_LEVEL=INFO
NODE_ENV=production
DB_PATH=./data/bot.db
EOF
```

### 4. Directory Permissions

```bash
# Fix directory permissions
sudo chown -R $USER:$USER /root/discord-bot/aszuneai
chmod -R 755 /root/discord-bot/aszuneai
mkdir -p /root/discord-bot/aszuneai/data
mkdir -p /root/discord-bot/aszuneai/logs
```

### 5. Production Start Script

```bash
# Use production-safe start command
NODE_ENV=production node src/index.js
```

## 🛠️ Raspberry Pi Specific Fixes

### Memory Optimization (Pi 3)

```bash
# If running on Raspberry Pi 3, use optimized start:
NODE_OPTIONS="--max-old-space-size=200" node src/index.js
```

### SQLite3 Build Issues

```bash
# If better-sqlite3 fails on Pi, rebuild:
npm rebuild better-sqlite3
# OR install with Python fallback:
npm install better-sqlite3 --build-from-source
```

## 🔍 Troubleshooting Commands

### Check Module Loading

```bash
# Test if modules can be required
node -e "console.log(require('./src/utils/time-parser.js'))"
node -e "console.log(require('chrono-node'))"
```

### Database Test

```bash
# Test database initialization
node -e "
const db = require('./src/services/database.js');
console.log('Database service loaded successfully');
"
```

### Memory Check

```bash
# Check available memory (important for Pi)
free -m
```

## 📋 Production Deployment Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Node.js version >= 20.18.1
- [ ] Environment variables configured
- [ ] Directory permissions correct
- [ ] Database directory exists
- [ ] Log directory exists
- [ ] Memory sufficient (>200MB for Pi 3)
- [ ] All modules can be required

## 🚀 Alternative Deployment Methods

### Method 1: Docker (Recommended)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "src/index.js"]
```

### Method 2: PM2 Process Manager

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Method 3: Systemd Service

```ini
[Unit]
Description=Aszune AI Bot
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/root/discord-bot/aszuneai
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## 📞 Emergency Rollback

If issues persist, rollback to previous version:

```bash
git checkout v1.6.5
npm install
node src/index.js
```
