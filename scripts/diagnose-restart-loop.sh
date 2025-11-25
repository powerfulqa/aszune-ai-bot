#!/bin/bash

# Diagnostic script to identify what's causing the PM2 restart loop

echo "=========================================="
echo "PM2 Restart Loop Diagnostic Tool"
echo "=========================================="
echo ""

# 1. Check PM2 configuration
echo "1. Checking PM2 configuration..."
pm2 describe aszune-ai | grep -E "watch|restart|kill_timeout|listen_timeout|max_memory_restart"
echo ""

# 2. Check for auto-restart settings
echo "2. Checking PM2 auto-restart settings..."
pm2 describe aszune-ai | grep -E "autorestart|min_uptime|max_restarts"
echo ""

# 3. Check for active cron jobs
echo "3. Checking for cron jobs that might restart PM2..."
crontab -l 2>/dev/null | grep -E "pm2|aszune|restart" || echo "No matching cron jobs found"
echo ""

# 4. Check for systemd timers
echo "4. Checking for systemd timers..."
systemctl list-timers --all | grep -E "pm2|aszune" || echo "No matching systemd timers found"
echo ""

# 5. Check for other PM2 processes
echo "5. Checking all PM2 processes..."
pm2 list
echo ""

# 6. Check PM2 startup configuration
echo "6. Checking PM2 startup configuration..."
pm2 startup | head -5
echo ""

# 7. Check for processes sending signals
echo "7. Checking for processes that might send SIGINT..."
echo "Monitoring PM2 logs for 30 seconds - DO NOT CLOSE THIS WINDOW"
echo "This will capture the next restart..."
timeout 30 pm2 logs aszune-ai --raw --lines 0 2>&1 | tee /tmp/pm2-diagnostic.log
echo ""

# 8. Analyze the captured logs
echo "8. Analyzing captured logs..."
if grep -q "SHUTDOWN TRIGGERED" /tmp/pm2-diagnostic.log; then
    echo "✓ Shutdown diagnostic found in logs!"
    grep -A 10 "SHUTDOWN TRIGGERED" /tmp/pm2-diagnostic.log
else
    echo "✗ No shutdown diagnostic found - process may not have restarted during monitoring"
fi
echo ""

# 9. Check for memory/resource limits
echo "9. Checking PM2 memory limits..."
pm2 describe aszune-ai | grep -E "memory|max_memory"
echo ""

# 10. Check ecosystem config
echo "10. Checking ecosystem.config.js..."
if [ -f "ecosystem.config.js" ]; then
    echo "Found ecosystem.config.js:"
    grep -E "watch|restart|kill_timeout|max_memory_restart|autorestart" ecosystem.config.js
else
    echo "ecosystem.config.js not found"
fi
echo ""

echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review the output above for any auto-restart triggers"
echo "2. If 'SHUTDOWN TRIGGERED' was found, check the stack trace"
echo "3. Run 'pm2 logs aszune-ai' and watch for the diagnostic output"
echo "4. The diagnostic output will show WHO is calling shutdown"
