# Raspberry Pi 3 License Server Setup Guide

## 🍓 Setting Up License Server on Raspberry Pi 3

### Prerequisites
- Raspberry Pi 3 with Raspbian OS
- Internet connection
- Static IP address (recommended)
- Domain name pointing to your Pi (optional)

## 🔧 Step 1: System Preparation

### Update Your Pi
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install git curl build-essential -y
```

### Install Node.js (if not already installed)
```bash
# Install Node.js 20.x (recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

## 🖥️ Step 2: License Server Setup

### Create License Server Directory
```bash
# Create dedicated directory for license server
mkdir -p ~/license-server
cd ~/license-server

# Copy license server files from your main bot repo
cp ~/aszune-ai-bot/src/utils/license-server.js ./
cp -r ~/aszune-ai-bot/src/utils/logger.js ./utils/

# Install dependencies
npm init -y
npm install express undici
```

### Configure Environment
```bash
# Create environment configuration
cat > .env << EOF
LICENSE_SERVER_API_KEY=$(openssl rand -hex 32)
PORT=3001
NODE_ENV=production
ASZUNE_SERVER_URL=http://$(hostname -I | awk '{print $1}'):3001
EOF

# Make sure directories exist
mkdir -p data/violations
mkdir -p data/backups
```

### Create License Database
```bash
# Create initial license database
cat > data/licenses.json << 'EOF'
[
  {
    "key": "ASZUNE-PERS-20251001-SAMPLE01",
    "type": "personal", 
    "status": "active",
    "allowedServers": 1,
    "owner": "test@example.com",
    "createdAt": "2025-10-01T00:00:00.000Z",
    "expiresAt": null,
    "features": ["basic_analytics", "performance_dashboard"]
  }
]
EOF
```

## 🚀 Step 3: Running the License Server

### Manual Start (for testing)
```bash
cd ~/license-server
node license-server.js
```

### Production Setup with PM2
```bash
# Install PM2 globally
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'aszune-license-server',
    script: './license-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',  # Pi 3 memory limit
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    time: true
  }]
}
EOF

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js

# Setup auto-start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi
pm2 save
```

## 🔒 Step 4: Network Configuration

### Open Firewall Port
```bash
# Allow license server port
sudo ufw allow 3001/tcp
sudo ufw enable
```

### Router Port Forwarding (if needed)
```
Router Settings:
- External Port: 3001
- Internal Port: 3001  
- Internal IP: [Your Pi's IP]
- Protocol: TCP
```

### Dynamic DNS Setup (recommended)
```bash
# Install ddclient for dynamic DNS
sudo apt install ddclient -y

# Configure for your DNS provider (e.g., No-IP, DuckDNS)
# Follow provider-specific instructions
```

## 📊 Step 5: Monitoring Setup

### Access Dashboard
```bash
# Local access
curl http://localhost:3001/health

# Remote access (replace with your Pi's IP)
curl http://192.168.1.100:3001/health

# Web dashboard
# Open browser: http://your-pi-ip:3001/dashboard
```

### Create Monitoring Script
```bash
cat > monitor-license-server.sh << 'EOF'
#!/bin/bash

LOG_FILE="/home/pi/license-server/logs/monitor.log"
WEBHOOK_URL=""  # Optional: Slack/Discord webhook for alerts

echo "$(date): Checking license server health..." >> $LOG_FILE

# Check if server is responding
if curl -sf http://localhost:3001/health > /dev/null; then
    echo "$(date): License server is healthy" >> $LOG_FILE
else
    echo "$(date): LICENSE SERVER DOWN - Restarting..." >> $LOG_FILE
    pm2 restart aszune-license-server
    
    # Optional: Send alert
    if [ ! -z "$WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"🚨 Aszune License Server restarted on Pi"}' \
        $WEBHOOK_URL
    fi
fi

# Check disk space (Pi 3 has limited storage)
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): WARNING: Disk usage at ${DISK_USAGE}%" >> $LOG_FILE
    # Clean old logs
    find /home/pi/license-server/logs -name "*.log" -mtime +7 -delete
    find /home/pi/license-server/data/violations -name "*.json" -mtime +30 -delete
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEM_USAGE -gt 80 ]; then
    echo "$(date): WARNING: Memory usage at ${MEM_USAGE}%" >> $LOG_FILE
fi
EOF

chmod +x monitor-license-server.sh

# Add to crontab (check every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/pi/license-server/monitor-license-server.sh") | crontab -
```

## 🤖 Step 6: Configure Your Bot

### Update Bot Configuration
```bash
# On the Pi where your bot runs
cd ~/aszune-ai-bot

# Set environment variables
cat >> .env << EOF

# License Server Configuration
ASZUNE_LICENSE_SERVER=http://localhost:3001
ASZUNE_LICENSE_API_KEY=your-api-key-from-license-server-env
ASZUNE_LICENSE_KEY=ASZUNE-PERS-20251001-SAMPLE01
EOF
```

### Test License Validation
```bash
# Start your bot and check logs
cd ~/aszune-ai-bot
npm start

# Should see in logs:
# "Validating software license..."
# "License validation successful - starting bot..."
```

## 📈 Step 7: Daily Operations

### Check Status
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs aszune-license-server

# Check resource usage
pm2 monit

# View dashboard
# Browser: http://your-pi-ip:3001/dashboard
```

### Backup License Data
```bash
# Create backup script
cat > backup-licenses.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/pi/license-server/data/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup license database
cp /home/pi/license-server/data/licenses.json $BACKUP_DIR/licenses_$DATE.json

# Keep only last 7 days of backups
find $BACKUP_DIR -name "licenses_*.json" -mtime +7 -delete

echo "$(date): License database backed up to licenses_$DATE.json"
EOF

chmod +x backup-licenses.sh

# Run daily backup
(crontab -l 2>/dev/null; echo "0 2 * * * /home/pi/license-server/backup-licenses.sh") | crontab -
```

## 🔍 Step 8: Issue Management

### Create New Personal License
```bash
# Generate new license key
NEW_KEY="ASZUNE-PERS-$(date +%Y%m%d)-$(openssl rand -hex 4 | tr '[:lower:]' '[:upper:]')"
echo "New license key: $NEW_KEY"

# Add to database (manual editing for now)
nano data/licenses.json
```

### Handle Violations
```bash
# Check violation reports
ls -la data/violations/
cat data/violations/violation-*.json | jq '.'

# Monitor violations in real-time
tail -f logs/error.log | grep "VIOLATION"
```

## ⚠️ Pi 3 Specific Considerations

### Memory Optimization
```bash
# Reduce memory usage
export NODE_OPTIONS="--max-old-space-size=256"  # Limit to 256MB

# Monitor memory usage
watch -n 5 'free -h && echo "---" && ps aux --sort=-%mem | head -10'
```

### Performance Tuning
```javascript
// Add to license-server.js for Pi 3 optimization
if (os.platform() === 'linux' && os.arch() === 'arm') {
  // Raspberry Pi detected - use conservative settings
  process.env.UV_THREADPOOL_SIZE = '2';  // Reduce thread pool
  setInterval(() => {
    if (global.gc) global.gc();  // Force garbage collection
  }, 30000);
}
```

### Storage Management
```bash
# Setup log rotation
sudo apt install logrotate -y

cat > /etc/logrotate.d/aszune-license << 'EOF'
/home/pi/license-server/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 pi pi
    postrotate
        pm2 reload aszune-license-server > /dev/null 2>&1 || true
    endscript
}
EOF
```

## 🎯 Summary - Your Pi 3 Setup

After setup, your Pi 3 will:
- ✅ Run license server on port 3001
- ✅ Monitor all bot instances automatically  
- ✅ Detect violations and phone home
- ✅ Provide web dashboard for monitoring
- ✅ Auto-restart on failures
- ✅ Handle backups and maintenance

**Dashboard Access**: http://your-pi-ip:3001/dashboard
**API Endpoint**: http://your-pi-ip:3001/api/*
**Monitoring**: PM2 + cron jobs + log rotation

Your Pi becomes the central control point for licensing! 🎯