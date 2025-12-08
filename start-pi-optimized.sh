#!/bin/bash

# Aszune AI Bot - Raspberry Pi Optimized Startup Script
# This script applies various system-level optimizations for running on Raspberry Pi

# =========================================
# Configuration variables - adjust as needed
# =========================================

# Memory limits (MB)
#MEMORY_LIMIT=200
#MEMORY_CRITICAL=250

# Performance settings
#ENABLE_PI_OPTIMIZATIONS=true
#PI_LOG_LEVEL="WARN"
#PI_COMPACT_MODE=true
#PI_LOW_CPU_MODE=true
#PI_MAX_CONNECTIONS=2
#PI_DEBOUNCE_MS=500
#PI_REACTION_LIMIT=2

# Auto-detect Pi model and set appropriate limits
PI_MODEL=$(cat /proc/device-tree/model 2>/dev/null | tr -d '\0' || echo "Unknown")

if [[ "$PI_MODEL" == *"Raspberry Pi 5"* ]]; then
    echo "Detected: Raspberry Pi 5 Model B"
    MEMORY_LIMIT=1536
    MEMORY_CRITICAL=1800
    PI_MAX_CONNECTIONS=10
    PI_DEBOUNCE_MS=100
    PI_REACTION_LIMIT=10
    PI_LOW_CPU_MODE=false
    PI_COMPACT_MODE=false
    PI_VERSION="5"
elif [[ "$PI_MODEL" == *"Raspberry Pi 4"* ]]; then
    echo "Detected: Raspberry Pi 4"
    MEMORY_LIMIT=800
    MEMORY_CRITICAL=900
    PI_MAX_CONNECTIONS=6
    PI_DEBOUNCE_MS=200
    PI_REACTION_LIMIT=5
    PI_LOW_CPU_MODE=false
    PI_COMPACT_MODE=false
    PI_VERSION="4"
else
    echo "Detected: Raspberry Pi 3 or older"
    MEMORY_LIMIT=512
    MEMORY_CRITICAL=600
    PI_MAX_CONNECTIONS=3
    PI_DEBOUNCE_MS=400
    PI_REACTION_LIMIT=2
    PI_LOW_CPU_MODE=true
    PI_COMPACT_MODE=true
    PI_VERSION="3"
fi

# Common settings for all Pi models
ENABLE_PI_OPTIMIZATIONS=true
PI_LOG_LEVEL="WARN"

# Node.js settings
NODE_OPTIONS="--max-old-space-size=$MEMORY_LIMIT"
NODE_ENV="production"

# =========================================
# Load environment variables
# =========================================

if [ -f .env ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' .env | xargs)
else
  echo "No .env file found. Make sure DISCORD_BOT_TOKEN and PERPLEXITY_API_KEY are set!"
  exit 1
fi

# =========================================
# System optimizations
# =========================================

echo "Applying system optimizations for Raspberry Pi $PI_VERSION..."

# Check if running as root/sudo (required for some optimizations)
if [ "$EUID" -eq 0 ]; then
  # Set CPU governor to conservative for better power/performance balance
  echo "Setting CPU governor to conservative mode..."
  for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo "conservative" > "$cpu" 2>/dev/null || true
  done

  # Drop disk cache to free memory before starting
  echo "Dropping disk cache to free memory..."
  sync
  echo 1 > /proc/sys/vm/drop_caches
  
  # Reduce swappiness to prefer keeping processes in RAM
  echo "Configuring memory settings..."
  echo 10 > /proc/sys/vm/swappiness
  
  echo "System-level optimizations applied."
else
  echo "Warning: Not running as root. Some system optimizations were skipped."
  echo "For full optimization, run with sudo."
fi

# =========================================
# Process optimizations
# =========================================

# Export all Pi optimization environment variables
export ENABLE_PI_OPTIMIZATIONS=$ENABLE_PI_OPTIMIZATIONS
export PI_LOG_LEVEL=$PI_LOG_LEVEL
export PI_MEMORY_LIMIT=$MEMORY_LIMIT
export PI_MEMORY_CRITICAL=$MEMORY_CRITICAL
export PI_COMPACT_MODE=$PI_COMPACT_MODE
export PI_LOW_CPU_MODE=$PI_LOW_CPU_MODE
export PI_MAX_CONNECTIONS=$PI_MAX_CONNECTIONS
export PI_DEBOUNCE_MS=$PI_DEBOUNCE_MS
export PI_REACTION_LIMIT=$PI_REACTION_LIMIT

# Export Node.js settings
export NODE_OPTIONS=$NODE_OPTIONS
export NODE_ENV=$NODE_ENV

# =========================================
# Start the bot
# =========================================

echo "Starting Aszune AI Bot with Pi $PI_VERSION optimizations..."
echo "Memory limit: ${MEMORY_LIMIT}MB"
echo "Log level: $PI_LOG_LEVEL"
echo "Optimizations enabled: $ENABLE_PI_OPTIMIZATIONS"

# Start the application with PM2
echo "Configuring PM2..."
pm2 delete aszune-ai 2>/dev/null || true

# Start with all exported environment variables
pm2 start ecosystem.config.js --update-env

# Save the list for startup
pm2 save

echo "✅ Bot started with PM2!"
echo "To enable auto-restart on boot, run: pm2 startup"
echo "To view logs, run: pm2 logs"

