# Getting Started

This guide will walk you through setting up Aszune AI Bot for your Discord server.

## Prerequisites

Before you begin, make sure you have:

- Node.js v20.18.1 or later
- A Discord bot token (from the
  [Discord Developer Portal](https://discord.com/developers/applications))
- A valid [Perplexity AI API key](https://www.perplexity.ai/)

## Installation

Follow these steps to set up the Aszune AI Bot:

1. **Clone the repository**

   ```bash
   git clone https://github.com/powerfulqa/aszune-ai-bot.git
   cd aszune-ai-bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   Optional: Install qlty for code quality checks during development:

   ```bash
   # macOS/Linux
   curl -sSL https://qlty.sh/install | sh

   # Windows (PowerShell)
   Invoke-RestMethod -Uri "https://qlty.sh/install.ps1" | Invoke-Expression
   ```

3. **Create a `.env` file**

   Create a file named `.env` in the root directory and add the following content:

   ```env
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   PERPLEXITY_API_KEY=your_perplexity_api_key_here
   ```

   Replace the placeholder values with your actual tokens and keys.

4. **Database Setup (Automatic)**

   The bot automatically handles database setup:
   - **SQLite database** is created automatically on first run
   - **Default location**: `./data/bot.db` (directory created if needed)
   - **No manual setup required** - everything is handled automatically
   - **Conversation history** and **user statistics** are stored persistently

   Optional database configuration:

   ```env
   # Optional: Custom database path (defaults to ./data/bot.db)
   DB_PATH=./custom/path/bot.db
   ```

5. **Configure Discord Bot Intents** (Required for Analytics)
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   - Select your application
   - Go to "Bot" section
   - Under "Privileged Gateway Intents", enable:
     - **Server Members Intent** (required for `/analytics` member counting)
     - **Presence Intent** (required for accurate online status detection)
   - Save changes

6. **Invite the bot to your server**
   - In the same Discord Developer Portal application
   - Go to OAuth2 > URL Generator
   - Select the following scopes:
     - `bot`
     - `applications.commands`
   - Select the following bot permissions:
     - Send Messages
     - Read Message History
     - Add Reactions
     - Use Slash Commands
     - Embed Links
     - **View Server Members** (required for `/analytics` and `/dashboard` real member counts)
   - Use the generated URL to invite the bot to your server

7. **Run the bot**

   ```bash
   # Development
   node src/index.js

   # Production (with PM2)
   npm install pm2 -g
   pm2 start src/index.js --name aszune-ai
   ```

## Verification

When the bot starts, you'll see:

```
Discord bot is online!
```

Test with `/help` in any channel where the bot has access.

## Optional: Web Dashboard

Visit `http://localhost:3000` while running for real-time monitoring dashboards.

## Optional: Instance Tracking / Authorization

For production deployments, you can run the tracking server to list instances and approve/revoke from the Services page.

Add to `.env`:

```env
INSTANCE_TRACKING_SERVER=http://localhost:3001/api/beacon
TRACKING_ADMIN_KEY=your_strong_admin_key

# Optional
AUTHORIZED_IPS=1.2.3.4,5.6.7.8
BOT_LOCATION=Home Server, UK
```

Start the tracking server:

```bash
node scripts/tracking-server.js
```

## Next Steps

- [Usage Guide](Usage-Guide) – How to interact with the bot
- [Command Reference](Command-Reference) – All available commands
- [Troubleshooting](Troubleshooting) – Common issues and solutions
