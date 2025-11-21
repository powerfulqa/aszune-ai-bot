# Dashboard Restart Loop Fix

## Problem
The bot is receiving SIGINT signals every ~15 seconds, causing continuous restarts. This creates a restart loop visible in:
- PM2 logs showing repeated `Stopping app:aszune-ai` and `App [aszune-ai:0] online`
- Dashboard showing disconnect/reconnect every ~15 seconds

## Root Causes Identified

### 1. PM2 Watch Mode (Most Likely)
PM2's watch mode might be enabled, causing restarts on any file change. Even though `ecosystem.config.js` has `watch: false`, PM2 might have been started with watch mode previously and retained this setting.

### 2. Dashboard Auto-Reload Loop (Fixed)
The dashboard was reloading the page 2 seconds after clicking restart, which could trigger additional restart requests.

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

### Step 1: Stop PM2 and Delete Previous Configuration
```bash
# Stop the current process (use the actual PM2 process name from 'pm2 status')
pm2 stop aszune-ai

# Delete the process to clear any watch mode settings
pm2 delete aszune-ai

# Save the PM2 configuration
pm2 save
```

### Step 2: Restart with Explicit No-Watch Configuration
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

### Step 3: Verify No Watch Mode
```bash
# Check the PM2 configuration (use actual process name from pm2 status)
pm2 describe aszune-ai

# Look for "watch & reload" in the output - it should say "disabled"
# Also verify in pm2 status output - the "watching" column should show "disabled"
```

### Step 4: Monitor Logs for Diagnostic Information
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

### Step 5: Check for External Processes (If Still Restarting)
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
4. Consider checking system journal: `journalctl -u aszune-ai-bot -n 100` (if running as systemd service)
