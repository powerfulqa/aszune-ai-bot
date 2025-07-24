# Raspberry Pi 3 Optimization Guide

This guide covers the optimizations available for running the Aszune AI Bot on resource-constrained devices like the Raspberry Pi 3.

## Table of Contents
- [Quick Start](#quick-start)
- [Optimization Features](#optimization-features)
- [Configuration Options](#configuration-options)
- [Monitoring Performance](#monitoring-performance)
- [Troubleshooting](#troubleshooting)

## Quick Start

To run the bot with all Pi optimizations enabled:

```bash
# Make the script executable
chmod +x start-pi-optimized.sh

# Run the optimized script
./start-pi-optimized.sh
```

This script will:
1. Apply system-level optimizations (if run with sudo)
2. Configure memory limits and performance settings
3. Start the bot with all Pi-specific optimizations enabled

## Optimization Features

The bot includes several optimizations specifically designed for the Raspberry Pi 3:

### Memory Management
- **Memory Monitoring:** Tracks memory usage and automatically runs garbage collection when thresholds are reached
- **Low Memory Mode:** Reduces feature set when memory is constrained
- **Memory Limits:** Enforces Node.js heap size limits to prevent crashes

### CPU Optimizations
- **Debouncing:** Prevents processing rapid messages in quick succession
- **Lazy Loading:** Only loads heavy dependencies when needed
- **Adaptive Throttling:** Dynamically adjusts processing based on CPU load
- **Connection Throttling:** Limits the number of concurrent network requests

### Network & API Optimizations
- **Response Streaming:** Processes API responses incrementally
- **Request Queuing:** Manages API request flow to prevent overload
- **Cache Management:** Automatically prunes cache entries to maintain reasonable size

### UI & Interaction Optimizations
- **Compact Mode:** Reduces message size and complexity
- **Limited Reactions:** Reduces the number of emoji reactions in responses
- **Response Formatting:** Breaks long messages into smaller chunks
- **Simplified Embeds:** Uses lighter embeds with fewer fields

## Configuration Options

You can customize the optimizations via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_PI_OPTIMIZATIONS` | Master switch for all Pi optimizations | `true` |
| `PI_LOG_LEVEL` | Logging verbosity (ERROR, WARN, INFO, DEBUG) | `ERROR` |
| `PI_MEMORY_LIMIT` | Memory threshold in MB | `200` |
| `PI_MEMORY_CRITICAL` | Critical memory threshold in MB | `250` |
| `PI_COMPACT_MODE` | Enable compact message formatting | `true` |
| `PI_LOW_CPU_MODE` | Enable CPU-saving features | `true` |
| `PI_MAX_CONNECTIONS` | Maximum concurrent network connections | `2` |
| `PI_DEBOUNCE_MS` | Message debounce delay in milliseconds | `300` |
| `PI_REACTION_LIMIT` | Maximum number of emoji reactions | `3` |

These can be set in your `.env` file or passed directly to the startup script.

## Monitoring Performance

Use the included monitor script to track the bot's resource usage:

```bash
# Make the script executable
chmod +x pi-monitor.sh

# Basic monitoring
./pi-monitor.sh

# Monitor every 10 seconds and save to a log file
./pi-monitor.sh -i 10 -l

# Monitor 6 times at 5-second intervals
./pi-monitor.sh -c 6
```

The monitor will show:
- Bot CPU and memory usage
- System CPU and memory usage
- Raspberry Pi temperature
- Bot uptime

## Troubleshooting

### High Memory Usage
- Enable `PI_LOW_CPU_MODE` and `PI_COMPACT_MODE`
- Reduce `PI_MAX_CONNECTIONS` to 1
- Increase `PI_DEBOUNCE_MS` to 500 or higher
- Set the `NODE_OPTIONS="--max-old-space-size=200"` environment variable

### High CPU Usage
- Enable `PI_LOW_CPU_MODE`
- Disable streaming responses by setting `PI_STREAM_RESPONSES=false`
- Increase `PI_DEBOUNCE_MS` to slow down processing
- Run the bot with `nice -n 10` to lower its CPU priority

### Bot Crashes
- Check memory usage with `pi-monitor.sh`
- Reduce `MAX_HISTORY` in the config
- Enable more aggressive cache pruning
- Ensure your SD card has sufficient swap space
