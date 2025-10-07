#!/bin/bash
# Production Emergency Fix Script for Aszune AI Bot v1.7.0

echo "🚨 EMERGENCY PRODUCTION FIX - Aszune AI Bot v1.7.0"
echo "=================================================="

# Function to print colored output
print_status() {
    echo -e "\033[1;32m✅ $1\033[0m"
}

print_error() {
    echo -e "\033[1;31m❌ $1\033[0m"
}

print_info() {
    echo -e "\033[1;34mℹ️  $1\033[0m"
}

# Step 1: Check current directory
if [[ ! -f "package.json" ]]; then
    print_error "Not in bot directory. Please cd to /root/discord-bot/aszuneai"
    exit 1
fi

print_info "Current directory: $(pwd)"

# Step 2: Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
print_info "Node.js version: $NODE_VERSION"

if [[ "$NODE_VERSION" == "not found" ]] || [[ ! "$NODE_VERSION" =~ v2[0-9] ]]; then
    print_error "Node.js >= 20 required. Current: $NODE_VERSION"
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Step 3: Clean and reinstall dependencies
print_info "Cleaning node_modules and package-lock.json..."
rm -rf node_modules package-lock.json

print_info "Installing dependencies..."
npm install

# Step 4: Verify critical dependencies
print_info "Verifying critical dependencies..."

# Check chrono-node
if npm ls chrono-node >/dev/null 2>&1; then
    print_status "chrono-node installed successfully"
else
    print_error "chrono-node installation failed"
    npm install chrono-node@^2.9.0
fi

# Check better-sqlite3
if npm ls better-sqlite3 >/dev/null 2>&1; then
    print_status "better-sqlite3 installed successfully"
else
    print_error "better-sqlite3 installation failed"
    npm install better-sqlite3@^12.4.1
fi

# Check discord.js
if npm ls discord.js >/dev/null 2>&1; then
    print_status "discord.js installed successfully"
else
    print_error "discord.js installation failed"
    npm install discord.js@^14.18.0
fi

# Step 5: Create required directories
print_info "Creating required directories..."
mkdir -p data logs

# Step 6: Set permissions
print_info "Setting proper permissions..."
chmod -R 755 .
chown -R $USER:$USER .

# Step 7: Check environment variables
print_info "Checking environment variables..."
if [[ ! -f ".env" ]]; then
    print_error ".env file not found!"
    echo "Creating template .env file..."
    cat > .env << EOF
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_token_here
PERPLEXITY_API_KEY=your_perplexity_key_here

# Bot Configuration
LOG_LEVEL=INFO
NODE_ENV=production
DB_PATH=./data/bot.db

# Optional Features
ENABLE_LICENSE_VALIDATION=false
ENABLE_LICENSE_SERVER=false
ENABLE_LICENSE_ENFORCEMENT=false
EOF
    print_error "Please edit .env file with your tokens before starting the bot"
fi

# Step 8: Test module loading
print_info "Testing module loading..."

# Test time-parser
if node -e "require('./src/utils/time-parser.js'); console.log('time-parser OK')" 2>/dev/null; then
    print_status "time-parser module loads successfully"
else
    print_error "time-parser module failed to load"
fi

# Test database service
if node -e "require('./src/services/database.js'); console.log('database OK')" 2>/dev/null; then
    print_status "database service loads successfully"
else
    print_error "database service failed to load"
fi

# Test main index
if node -e "console.log('Testing main...'); process.exit(0)" -c "require('./src/index.js')" 2>/dev/null; then
    print_status "Main index file loads successfully"
else
    print_error "Main index file failed to load"
fi

# Step 9: Memory check for Raspberry Pi
MEMORY_MB=$(free -m | awk 'NR==2{print $2}')
print_info "Available memory: ${MEMORY_MB}MB"

if [[ $MEMORY_MB -lt 512 ]]; then
    print_error "Low memory detected (${MEMORY_MB}MB). Using memory optimization..."
    echo "export NODE_OPTIONS=\"--max-old-space-size=200\"" >> ~/.bashrc
fi

# Step 10: Production start commands
print_status "Production fix completed!"
echo ""
echo "🚀 START THE BOT WITH ONE OF THESE COMMANDS:"
echo ""
echo "Standard start:"
echo "  node src/index.js"
echo ""
echo "Memory optimized (for Raspberry Pi):"
echo "  NODE_OPTIONS=\"--max-old-space-size=200\" node src/index.js"
echo ""
echo "Background with PM2:"
echo "  npm install -g pm2"
echo "  pm2 start src/index.js --name aszune-bot"
echo ""
echo "Test run (exits after 5 seconds):"
echo "  timeout 5s node src/index.js"
echo ""

print_info "If issues persist, check the logs and environment variables"
print_info "Bot logs will be saved to: ./logs/"