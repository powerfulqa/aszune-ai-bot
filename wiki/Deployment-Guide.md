# Deployment Guide

This guide covers production deployment for Aszune AI Bot.

## Recommended Deployment Method: PM2

PM2 is the supported process manager for keeping the bot running reliably, including across reboots.

### Prerequisites

- Node.js **>= 20.18.1** (matches the repository `package.json` engines)
- A Discord bot token and Perplexity API key
- A `.env` file (see below)

### 1) Create your `.env`

This project loads environment variables via `dotenv` on startup.

1. Copy the example file:

```bash
cp .env.example .env
```

2. Edit `.env` and set at least:

- `DISCORD_BOT_TOKEN`
- `PERPLEXITY_API_KEY`

Do **not** put secrets in `ecosystem.config.js`, shell scripts, or source code.

### 2) Install PM2

```bash
npm install -g pm2
```

### 3) Start with the repository ecosystem file

The repository includes `ecosystem.config.js`. Start it from the project root so `.env` is found.

```bash
pm2 start ecosystem.config.js --update-env
```

The primary PM2 process name is `aszune-ai`.

### Raspberry Pi deployments (recommended)

If you are deploying on a Raspberry Pi, use the Pi start script. It loads `.env`, applies
system-level optimisations, then starts PM2 via `ecosystem.config.js`.

```bash
sudo ./start-pi-optimized.sh

pm2 startup
pm2 save
```

### PM2 Commands

- **Status**: `pm2 status`
- **Logs**: `pm2 logs aszune-ai`
- **Restart bot**: `pm2 restart aszune-ai`
- **Stop bot**: `pm2 stop aszune-ai`

## Server Requirements

- Node.js **>= 20.18.1**
- 1GB+ RAM recommended (more helps on larger servers)
- 1GB+ free disk space
- Stable internet connection

## Notes on systemd

Some environments may use a systemd unit for service management. Avoid running both a dedicated
systemd unit and PM2 for the bot at the same time, as this can cause restart loops.

## Security Best Practices

1. **Environment Variables**: Never commit your `.env` file or any file containing secrets
2. **Regular Updates**: Keep all dependencies updated
   ```bash
   npm audit
   npm update
   ```
3. **Limited Permissions**: Your bot's Discord token should have only the required permissions
4. **Monitoring**: Set up monitoring and alerts for your bot's health

## Keeping Your Bot Online

If you're using PM2:

```bash
# Set up PM2 to start on boot
pm2 startup
# Save current processes to restore on reboot
pm2 save
```

## Updating Your Bot

1. Pull the latest code:

   ```bash
   git pull origin main
   ```

2. Install any new dependencies:

   ```bash
   npm install
   ```

3. Restart the bot:
   ```bash
   pm2 restart aszune-ai
   ```

## Backing Up

It's recommended to regularly backup your bot's data:

```bash
# If you're using file-based storage
cp -r data/ backup/data_$(date +%Y%m%d)/
```

For more advanced deployment scenarios, consider setting up CI/CD pipelines with GitHub Actions,
GitLab CI, or other continuous integration tools.
