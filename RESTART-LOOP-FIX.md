# Dashboard Restart Loop Fix

## ✅ ROOT CAUSE IDENTIFIED

**The bot is being managed by BOTH systemd AND PM2, causing a conflict!**

The systemd service `/etc/systemd/system/aszune-ai-bot.service` is configured with:

```
Restart=always
RestartSec=15
```

This causes systemd to:

1. Start `start-pi-optimized.sh` which launches PM2
2. Script exits successfully after starting PM2
3. Systemd waits 15 seconds (RestartSec=15)
4. Systemd sends SIGINT to restart the service
5. Loop repeats forever!

## 🔧 IMMEDIATE FIX

Run these commands on your Raspberry Pi:

```bash
# Stop the systemd service
sudo systemctl stop aszune-ai-bot.service

# Disable it from starting on boot
sudo systemctl disable aszune-ai-bot.service

# Verify it's disabled
systemctl status aszune-ai-bot.service
# Should show: "disabled" and "inactive (dead)"

# PM2 should now be stable
pm2 status

# Monitor logs to confirm no more restarts
pm2 logs aszune-ai --lines 50
```

## 📋 Choose Your Process Manager

You need to pick ONE process manager:

### Option 1: Use PM2 (RECOMMENDED)

Already done! The systemd service is now disabled, PM2 manages the bot.

**To start bot on system boot with PM2:**

```bash
pm2 startup
# Follow the command it outputs
pm2 save
```

### Option 2: Use Systemd (Alternative)

If you prefer systemd, you need to modify the service file:

```bash
sudo nano /etc/systemd/system/aszune-ai-bot.service
```

Change it to run Node.js directly instead of the startup script:

```ini
[Service]
Type=simple
ExecStart=/usr/bin/node /root/aszune-ai-bot/src/index.js
Restart=on-failure
RestartSec=5
# Remove: Restart=always
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable aszune-ai-bot.service
sudo systemctl start aszune-ai-bot.service

# Stop PM2
pm2 delete aszune-ai
```

---

## Original Investigation Notes

The bot is receiving SIGINT signals every ~15 seconds, causing continuous restarts. This creates a
restart loop visible in:

- PM2 logs showing repeated `Stopping app:aszune-ai` and `App [aszune-ai:0] online`
- Dashboard showing disconnect/reconnect every ~15 seconds

## Root Causes Identified

### 1. PM2 Watch Mode (Most Likely)

PM2's watch mode might be enabled, causing restarts on any file change. Even though
`ecosystem.config.js` has `watch: false`, PM2 might have been started with watch mode previously and
retained this setting.

### 2. Dashboard Auto-Reload Loop (Fixed)

The dashboard was reloading the page 2 seconds after clicking restart, which could trigger
additional restart requests.

## Fixes Applied

### ✅ Fix 1: Enhanced Shutdown Logging

Added detailed logging to `src/index.js` to capture:

- What signal triggered the shutdown
- Process uptime at shutdown
- Stack trace to identify the caller

This will help diagnose the exact cause when you check the logs.

### ✅ Fix 2: Removed Dashboard Auto-Reload

Changed `dashboard/public/dashboard.js` to NOT auto-reload after restart. The dashboard will:

- Show "Bot restart initiated" message
- Keep the socket connection (auto-reconnects when bot comes back)
- Let users manually refresh when ready

## Required Actions on Raspberry Pi

### URGENT: Pull Latest Code First

The diagnostic logging has been updated to ERROR level so it will show up in your logs:

```bash
cd ~/aszune-ai-bot
git pull
pm2 restart aszune-ai
```

### Option 1: Run Diagnostic Script (RECOMMENDED)

```bash
cd ~/aszune-ai-bot
chmod +x diagnose-restart-loop.sh
./diagnose-restart-loop.sh
```

This will check for:

- PM2 auto-restart settings
- Cron jobs that might restart the bot
- Systemd timers
- Memory limits
- Capture the shutdown diagnostic in realtime

### Option 2: Manual Diagnostic Steps

### Step 1: Monitor for Diagnostic Output

```bash
# Watch logs in realtime
pm2 logs aszune-ai --lines 100

# Look for this output when the restart happens:
# ========================================
# SHUTDOWN TRIGGERED - Signal: SIGINT
# Process uptime: XXs
# Stack trace:
# Error
#     at shutdown (/root/aszune-ai-bot/src/index.js:XXX:XX)
#     ... (this will show WHAT called shutdown)
# ========================================
```

The stack trace will reveal exactly what's triggering the shutdown!

### Step 2: Stop PM2 and Delete Previous Configuration (If Needed)

```bash
# Stop the current process (use the actual PM2 process name from 'pm2 status')
pm2 stop aszune-ai

# Delete the process to clear any watch mode settings
pm2 delete aszune-ai

# Save the PM2 configuration
pm2 save
```

### Step 3: Restart with Explicit No-Watch Configuration

```bash
# Navigate to the bot directory
cd ~/aszune-ai-bot

# Use the Pi-optimized startup script (recommended for Raspberry Pi)
sudo ./start-pi-optimized.sh

# This script will:
# - Delete the old PM2 process
# - Start with ecosystem.config.js (ensures watch: false)
# - Apply Pi-specific optimizations
# - Save the PM2 configuration
```

### Step 4: Verify No Watch Mode

```bash
# Check the PM2 configuration (use actual process name from pm2 status)
pm2 describe aszune-ai

# Look for "watch & reload" in the output - it should say "disabled"
# Also verify in pm2 status output - the "watching" column should show "disabled"
```

### Step 5: Monitor Logs for Diagnostic Information

```bash
# Watch the logs to see the new diagnostic output
pm2 logs aszune-ai --lines 100

# Check for the shutdown diagnostic messages:
# ========================================
# SHUTDOWN TRIGGERED - Signal: SIGINT
# Process uptime: XXs
# Stack trace:
# ========================================
```

### Step 6: Check for External Processes (If Still Restarting)

If the restart loop continues after fixing PM2:

```bash
# Check for cron jobs that might be restarting the bot
crontab -l

# Check for systemd timers
systemctl list-timers

# Check what's sending signals to the process
# (requires installing 'sysdig' or using 'auditd')
```

## Verification

After completing the steps above, the bot should:

1. ✅ Stay running without automatic restarts
2. ✅ Only restart when you click the restart button
3. ✅ Show diagnostic logs if SIGINT is received
4. ✅ Dashboard stays connected without disconnect/reconnect cycles

## Additional Debugging

If the issue persists, check the new diagnostic logs in PM2:

```bash
pm2 logs aszune-ai --lines 200 | grep "SHUTDOWN TRIGGERED"
```

This will show:

- What signal caused the shutdown
- How long the process ran before shutdown
- The stack trace of what triggered it

## Files Modified

- `src/index.js` - Added diagnostic logging for shutdown signals
- `dashboard/public/dashboard.js` - Removed auto-reload after restart

## Next Steps if Issue Persists

1. Share the diagnostic logs showing the "SHUTDOWN TRIGGERED" messages
2. Check `pm2 describe aszune-ai` output for watch mode status
3. Verify no external scripts are sending SIGINT signals
4. Consider checking system journal: `journalctl -u aszune-ai-bot -n 100` (if running as systemd
   service)
