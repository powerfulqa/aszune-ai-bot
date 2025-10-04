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
   git clone https://github.com/chrishaycock/aszune-ai-bot.git
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

4. **Configure Discord Bot Intents** (Required for Analytics)
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   - Select your application
   - Go to "Bot" section
   - Under "Privileged Gateway Intents", enable:
     - **Server Members Intent** (required for `/analytics` member counting)
     - **Presence Intent** (required for accurate online status detection)
   - Save changes

5. **Invite the bot to your server**
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

6. **Run the bot**

   You can run the bot using one of the following methods:

   **Method 1: Run manually**

   ```bash
   node src/index.js
   ```

   **Method 2: Run with PM2 (recommended for production)**

   ```bash
   npm install pm2 -g
   DISCORD_BOT_TOKEN=your_discord_bot_token_here PERPLEXITY_API_KEY=your_perplexity_api_key_here pm2 start src/index.js --name aszune-ai
   ```

   Or create an ecosystem file as described in the [Deployment Guide](Deployment-Guide).

## Verification

When the bot starts successfully, you should see the following message in your terminal:

```
Discord bot is online!
```

You can test the bot by sending the `!help` command in a channel where the bot has access.

## Development Setup (Optional)

If you plan to contribute to the project, consider setting up the development environment:

```bash
# Run quality checks
npm run quality:check

# Run security scan
npm run security:all

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Next Steps

- Check out the [Usage Guide](Usage-Guide) to learn how to interact with the bot
- **Try the new analytics features**: Use `/analytics`, `/dashboard`, and `/resources` to explore
  the monitoring capabilities
- Explore the [Command Reference](Command-Reference) for detailed information about all available
  commands including the new analytics commands
- Read the [Contributing Guidelines](../CONTRIBUTING.md) if you want to contribute to the project
- Review the [Code Quality Documentation](../docs/QLTY_INTEGRATION.md) for development standards
- Visit the [Troubleshooting](Troubleshooting) page if you encounter any issues

## What's New in v1.6.0

🎉 **Analytics Integration** - The bot now includes comprehensive monitoring and analytics features:

- **`/analytics`** - Discord server analytics with user engagement insights
- **`/dashboard`** - Real-time performance monitoring dashboard
- **`/resources`** - Resource optimization analysis and recommendations

All monitoring features are accessible directly in Discord - no need to access your Raspberry Pi
separately!
