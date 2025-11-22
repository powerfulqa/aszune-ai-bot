#!/bin/bash

# Find what's sending SIGINT to the PM2 process

echo "=========================================="
echo "Finding SIGINT Source"
echo "=========================================="
echo ""

# Get the current PM2 process PID
PM2_PID=$(pm2 jlist | grep -o '"pid":[0-9]*' | grep -o '[0-9]*' | head -1)

if [ -z "$PM2_PID" ]; then
    echo "Error: Could not find PM2 process PID"
    exit 1
fi

echo "Current aszune-ai PID: $PM2_PID"
echo ""

# Check if auditd is available
if command -v ausearch &> /dev/null; then
    echo "Checking audit logs for SIGINT signals..."
    sudo ausearch -m SYSCALL -sc kill -sv $PM2_PID 2>/dev/null || echo "No audit data found (auditd may not be enabled)"
    echo ""
fi

# Monitor process signals in real-time
echo "Monitoring for signals sent to PID $PM2_PID..."
echo "This will run for 30 seconds. Press Ctrl+C to stop early."
echo ""

# Use strace to monitor signals (requires root)
timeout 30 sudo strace -e trace=signal -p $PM2_PID 2>&1 | grep -i sigint || echo "No SIGINT signals captured"

echo ""
echo "=========================================="
echo "Alternative: Check for scripts sending signals"
echo "=========================================="
echo ""

# Check for any scripts or cron jobs that might be sending signals
echo "Checking for scripts that might send signals to PM2..."
find /etc/cron.* /var/spool/cron /root -type f 2>/dev/null | xargs grep -l "pm2\|kill\|pkill\|SIGINT" 2>/dev/null || echo "No matching scripts found"

echo ""
echo "Checking running processes that might interact with PM2..."
ps aux | grep -E "pm2|node|monitor|health|watch" | grep -v grep

echo ""
echo "=========================================="
echo "Check PM2 God Daemon"
echo "=========================================="
PM2_HOME=${PM2_HOME:-~/.pm2}
echo "PM2 Home: $PM2_HOME"
echo ""
echo "PM2 God Daemon Process:"
ps aux | grep "PM2\|God" | grep -v grep

echo ""
echo "Check PM2 logs for restart commands:"
tail -50 $PM2_HOME/pm2.log | grep -E "Stopping|restart|SIGINT"
