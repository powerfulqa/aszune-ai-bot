# Dashboard Controls Setup Guide (Raspberry Pi 5)

## Overview

The Aszune AI Bot Dashboard includes control buttons to restart the bot and pull the latest code
changes directly from the web interface. This guide explains how to set them up on your Raspberry Pi
5 running DietPi.

## Prerequisites

- Raspberry Pi 5 running DietPi
- Bot running as a systemd service
- sudo access configured for passwordless commands (recommended)

## Setup Steps

### Step 1: Identify Your Service Name

First, determine what your bot's systemd service is named:

```bash
systemctl list-units --type=service | grep aszune
```

Common names:

- `aszune-bot.service`
- `aszune-ai-bot.service`
- `bot.service`

### Step 2: Configure Environment Variable

Add the service name to your `.env` file:

```bash
nano .env
```

Add this line (replace `aszune-bot` with your actual service name):

```env
SERVICE_NAME=aszune-bot
```

### Step 3: Configure Sudoers for Passwordless Systemctl (Recommended)

For the restart button to work without requiring a password, configure sudoers to allow the bot
process user to restart the service without a password.

⚠️ **Only do this if the user running the bot is the same user running the web server.**

```bash
sudo visudo
```

Add this line at the end (replace `aszune-bot-user` with the actual user running your bot):

```sudoers
aszune-bot-user ALL=(ALL) NOPASSWD: /bin/systemctl restart aszune-bot
```

This allows the user to restart the service without entering a password.

### Step 4: Verify Git Permissions

Ensure the user running the bot can write to the repository directory:

```bash
# Check current owner of repo
ls -ld /path/to/aszune-ai-bot

# If needed, change ownership
sudo chown -R aszune-bot-user:aszune-bot-user /path/to/aszune-ai-bot

# Or change group permissions
sudo chmod -R g+w /path/to/aszune-ai-bot
```

### Step 5: Test from Dashboard

1. Navigate to your dashboard: `http://your-pi-ip:3000`
2. Look for the control buttons in the top-right:
   - 🔄 **Restart** (red)
   - ⬇️ **Git Pull** (green)

3. **Test Git Pull first**:
   - Click "Git Pull"
   - Confirm the action
   - Check "Recent Activity" for output

4. **Test Restart**:
   - Click "Restart"
   - Confirm the action
   - Dashboard should reconnect automatically after ~2 seconds

## Troubleshooting

### Restart Button Not Working

**Error**: "Command failed" or "Permission denied"

**Solutions**:

1. Check if you configured sudoers correctly
2. Verify the SERVICE_NAME matches your actual service name:
   ```bash
   systemctl status aszune-bot
   ```
3. Test manually:
   ```bash
   sudo systemctl restart aszune-bot
   ```

### Git Pull Not Working

**Error**: "Permission denied"

**Solutions**:

1. Check repo ownership:
   ```bash
   ls -ld /path/to/aszune-ai-bot
   whoami  # Check current user
   ```
2. Fix permissions:
   ```bash
   sudo chown -R $(whoami):$(whoami) /path/to/aszune-ai-bot
   ```

**Error**: "fatal: not a git repository"

**Solutions**:

1. Verify .git exists:
   ```bash
   ls -la /path/to/aszune-ai-bot/.git
   ```
2. Reinitialize if needed:
   ```bash
   cd /path/to/aszune-ai-bot
   git init
   git remote add origin https://github.com/powerfulqa/aszune-ai-bot.git
   ```

### Git Pull Requires Authentication

If git pull prompts for credentials:

**Solution 1: Use SSH keys (recommended)**

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your-email@example.com"

# Add public key to GitHub
cat ~/.ssh/id_ed25519.pub  # Copy this to GitHub SSH keys

# Change remote to use SSH
cd /path/to/aszune-ai-bot
git remote set-url origin git@github.com:powerfulqa/aszune-ai-bot.git
```

**Solution 2: Use GitHub Personal Access Token**

```bash
# Create a token at https://github.com/settings/tokens
# Use it as password when git prompts

# Or cache credentials
git config --global credential.helper store
```

### Dashboard Not Showing Buttons

**Issue**: Control buttons don't appear in the header

**Solutions**:

1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check browser console for JavaScript errors (F12)

## Activity Log

Both operations log their results in the "Recent Activity" section at the bottom of the dashboard:

- ✓ Success messages (green)
- ✗ Error messages (red)
- Command output displayed inline

## Security Considerations

⚠️ **Important Security Notes**:

1. **The dashboard is exposed to anyone with access to your network**
   - Consider restricting access with authentication
   - Only run on private/trusted networks
   - Don't expose to the public internet

2. **Restart and Git Pull are powerful operations**
   - These can interrupt service
   - Code changes could break the bot
   - Test changes in a dev branch first

3. **Sudo configuration**
   - Only enable passwordless sudo for trusted operations
   - Review sudoers changes carefully
   - Consider using IP-based restrictions

## Advanced Configuration

### Custom Service Name

If your service has a different name, update:

```env
SERVICE_NAME=my-custom-bot-service
```

Then update sudoers:

```sudoers
botuser ALL=(ALL) NOPASSWD: /bin/systemctl restart my-custom-bot-service
```

### Git Pull to Different Branch

To pull from a different branch, modify the backend code in `src/services/web-dashboard.js`:

Find this line:

```javascript
await execPromise('git pull origin main', {
```

Change `main` to your branch name:

```javascript
await execPromise('git pull origin develop', {
```

## Related Documentation

- [Dashboard Overview](./DASHBOARD-v1.8.0-RELEASE.md)
- [Raspberry Pi Optimization](./RELEASE-NOTES-v1.6.0.md#raspberry-pi-optimizations)
- [Systemd Service Setup](./DEPLOYMENT-v1.7.0-COMPLETE.md)

## Support

If you encounter issues:

1. Check the bot's system logs:

   ```bash
   journalctl -u aszune-bot -n 50 -f
   ```

2. Check the dashboard activity log for detailed error messages

3. Review the troubleshooting section above

---

**Last Updated**: November 14, 2025 **Version**: v1.8.0
