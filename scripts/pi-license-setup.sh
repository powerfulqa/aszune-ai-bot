#!/bin/bash

# Aszune AI Bot - Raspberry Pi License Server Quick Setup
# Run this script on your Raspberry Pi 3 to set up license monitoring

set -e  # Exit on any error

echo "🍓 Aszune AI Bot - License Server Setup for Raspberry Pi 3"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Raspberry Pi
check_raspberry_pi() {
    if [[ ! -f /proc/cpuinfo ]] || ! grep -q "Raspberry Pi" /proc/cpuinfo; then
        log_warning "This doesn't appear to be a Raspberry Pi. Continue anyway? (y/n)"
        read -r response
        if [[ ! $response =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing system dependencies..."
    
    sudo apt update
    sudo apt install -y curl git build-essential ufw logrotate
    
    # Check Node.js version
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            log_info "Upgrading Node.js to version 20..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
    else
        log_info "Installing Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install PM2 globally
    if ! command -v pm2 >/dev/null 2>&1; then
        log_info "Installing PM2 process manager..."
        sudo npm install -g pm2
    fi
    
    log_success "Dependencies installed successfully"
}

# Create license server directory and files
setup_license_server() {
    log_info "Setting up license server..."
    
    # Create directory structure
    mkdir -p ~/license-server/{data/violations,data/backups,logs,utils}
    cd ~/license-server
    
    # Copy license server from main bot repo if it exists
    if [ -f ~/aszune-ai-bot/src/utils/license-server.js ]; then
        cp ~/aszune-ai-bot/src/utils/license-server.js ./
        cp ~/aszune-ai-bot/src/utils/logger.js ./utils/ 2>/dev/null || true
    else
        log_error "License server files not found in ~/aszune-ai-bot/src/utils/"
        log_info "Please copy license-server.js to ~/license-server/ manually"
        exit 1
    fi
    
    # Create package.json
    cat > package.json << 'EOF'
{
  "name": "aszune-license-server",
  "version": "1.0.0",
  "main": "license-server.js",
  "scripts": {
    "start": "node license-server.js",
    "pm2": "pm2 start ecosystem.config.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "undici": "^7.12.0"
  }
}
EOF
    
    # Install dependencies
    npm install
    
    log_success "License server files created"
}

# Generate configuration
generate_config() {
    log_info "Generating configuration files..."
    
    # Generate secure API key
    API_KEY=$(openssl rand -hex 32)
    PI_IP=$(hostname -I | awk '{print $1}')
    
    # Create .env file
    cat > .env << EOF
LICENSE_SERVER_API_KEY=$API_KEY
PORT=3001
NODE_ENV=production
ASZUNE_SERVER_URL=http://$PI_IP:3001
EOF
    
    # Create initial license database
    cat > data/licenses.json << 'EOF'
[
  {
    "key": "ASZUNE-PERS-20251001-SAMPLE01",
    "type": "personal",
    "status": "active", 
    "allowedServers": 1,
    "owner": "sample@example.com",
    "createdAt": "2025-10-01T00:00:00.000Z",
    "expiresAt": null,
    "features": ["basic_analytics", "performance_dashboard"]
  }
]
EOF
    
    # Create PM2 ecosystem config optimized for Pi 3
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'aszune-license-server',
    script: './license-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    node_args: '--max-old-space-size=256',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      UV_THREADPOOL_SIZE: 2
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log', 
    error_file: './logs/error.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}
EOF
    
    log_success "Configuration generated"
    log_info "API Key: $API_KEY"
    log_info "Save this API key - you'll need it for bot configuration!"
}

# Create monitoring and maintenance scripts
create_scripts() {
    log_info "Creating monitoring scripts..."
    
    # Health monitoring script
    cat > monitor-license-server.sh << 'EOF'
#!/bin/bash
LOG_FILE="$HOME/license-server/logs/monitor.log"
WEBHOOK_URL=""  # Add Discord/Slack webhook URL here for alerts

echo "$(date): Checking license server health..." >> "$LOG_FILE"

# Check if server is responding
if curl -sf http://localhost:3001/health > /dev/null; then
    echo "$(date): License server is healthy" >> "$LOG_FILE"
else
    echo "$(date): LICENSE SERVER DOWN - Restarting..." >> "$LOG_FILE"
    cd "$HOME/license-server" && pm2 restart aszune-license-server
    
    if [ ! -z "$WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
        --data '{"content":"🚨 Aszune License Server restarted on Pi"}' \
        "$WEBHOOK_URL" || true
    fi
fi

# Cleanup old files (Pi 3 storage management)
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "$(date): High disk usage ($DISK_USAGE%) - cleaning up..." >> "$LOG_FILE"
    find "$HOME/license-server/logs" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    find "$HOME/license-server/data/violations" -name "*.json" -mtime +30 -delete 2>/dev/null || true
fi
EOF
    
    chmod +x monitor-license-server.sh
    
    # Backup script
    cat > backup-licenses.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/license-server/data/backups"
DATE=$(date +%Y%m%d_%H%M%S)

cp "$HOME/license-server/data/licenses.json" "$BACKUP_DIR/licenses_$DATE.json"
find "$BACKUP_DIR" -name "licenses_*.json" -mtime +7 -delete 2>/dev/null || true

echo "$(date): License database backed up to licenses_$DATE.json" >> "$HOME/license-server/logs/backup.log"
EOF
    
    chmod +x backup-licenses.sh
    
    # License generation helper
    cat > generate-license.sh << 'EOF'
#!/bin/bash
# Quick license generator

TYPE=${1:-personal}
DATE=$(date +%Y%m%d)
RANDOM_ID=$(openssl rand -hex 4 | tr '[:lower:]' '[:upper:]')

case $TYPE in
    "personal"|"pers"|"p")
        PREFIX="PERS"
        SERVERS=1
        ;;
    "community"|"comm"|"c")  
        PREFIX="COMM"
        SERVERS=3
        ;;
    "commercial"|"biz"|"b")
        PREFIX="COMM"
        SERVERS=999
        ;;
    *)
        echo "Usage: $0 [personal|community|commercial]"
        exit 1
        ;;
esac

KEY="ASZUNE-$PREFIX-$DATE-$RANDOM_ID"

echo "Generated License Key: $KEY"
echo "Type: $TYPE"  
echo "Allowed Servers: $SERVERS"
echo ""
echo "Add this to data/licenses.json manually or use the web interface"
EOF
    
    chmod +x generate-license.sh
    
    log_success "Monitoring scripts created"
}

# Setup firewall and networking
setup_networking() {
    log_info "Configuring firewall..."
    
    # Enable UFW and allow SSH + license server port
    sudo ufw --force enable
    sudo ufw allow ssh
    sudo ufw allow 3001/tcp
    
    PI_IP=$(hostname -I | awk '{print $1}')
    
    log_success "Firewall configured"
    log_info "License server will be accessible at: http://$PI_IP:3001"
}

# Setup cron jobs
setup_cron() {
    log_info "Setting up automated tasks..."
    
    # Add cron jobs
    (crontab -l 2>/dev/null; echo "*/5 * * * * $HOME/license-server/monitor-license-server.sh") | crontab -
    (crontab -l 2>/dev/null; echo "0 2 * * * $HOME/license-server/backup-licenses.sh") | crontab -
    
    log_success "Cron jobs configured (monitoring every 5 minutes, daily backups)"
}

# Setup log rotation
setup_logrotate() {
    log_info "Configuring log rotation..."
    
    sudo tee /etc/logrotate.d/aszune-license > /dev/null << EOF
$HOME/license-server/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        cd $HOME/license-server && pm2 reload aszune-license-server > /dev/null 2>&1 || true
    endscript
}
EOF
    
    log_success "Log rotation configured"
}

# Start the license server
start_server() {
    log_info "Starting license server..."
    
    cd ~/license-server
    
    # Start with PM2
    pm2 start ecosystem.config.js
    
    # Setup auto-start on boot
    pm2 startup systemd -u "$(whoami)" --hp "$HOME"
    pm2 save
    
    # Wait a moment for startup
    sleep 3
    
    # Test server
    if curl -sf http://localhost:3001/health > /dev/null; then
        log_success "License server started successfully!"
    else
        log_error "License server failed to start. Check logs with: pm2 logs aszune-license-server"
        exit 1
    fi
}

# Display final information
show_summary() {
    PI_IP=$(hostname -I | awk '{print $1}')
    API_KEY=$(grep LICENSE_SERVER_API_KEY ~/license-server/.env | cut -d'=' -f2)
    
    echo ""
    echo "============================================================"
    log_success "🎉 License Server Setup Complete!"
    echo "============================================================"
    echo ""
    echo "📊 Dashboard URL: http://$PI_IP:3001/dashboard"
    echo "🔒 API Key: $API_KEY"
    echo "📁 Server Directory: $HOME/license-server"
    echo ""
    echo "🤖 Bot Configuration:"
    echo "Add these to your bot's .env file:"
    echo "ASZUNE_LICENSE_SERVER=http://$PI_IP:3001"
    echo "ASZUNE_LICENSE_API_KEY=$API_KEY"
    echo "ASZUNE_LICENSE_KEY=ASZUNE-PERS-20251001-SAMPLE01"
    echo ""
    echo "📋 Management Commands:"
    echo "pm2 status                    # Check server status"
    echo "pm2 logs aszune-license-server # View logs"
    echo "pm2 restart aszune-license-server # Restart server"
    echo "pm2 stop aszune-license-server    # Stop server"
    echo ""
    echo "🔧 Utilities:"
    echo "cd ~/license-server"
    echo "./generate-license.sh personal   # Generate new personal license"
    echo "./backup-licenses.sh            # Manual backup"
    echo "./monitor-license-server.sh     # Manual health check"
    echo ""
    echo "🌐 Port Forwarding (if needed):"
    echo "Router: Forward external port 3001 to $PI_IP:3001"
    echo ""
    log_success "Setup complete! Your Pi is now ready to monitor license usage."
}

# Main execution
main() {
    echo "Starting setup process..."
    
    check_raspberry_pi
    install_dependencies
    setup_license_server
    generate_config
    create_scripts
    setup_networking
    setup_cron
    setup_logrotate
    start_server
    show_summary
}

# Run main function
main "$@"