# Getting Started

This guide will walk you through setting up Aszune AI Bot for your Discord server.

## Prerequisites

Before you begin, make sure you have:

- Node.js (v14 or later)
- A Discord bot token (from the [Discord Developer Portal](https://discord.com/developers/applications))
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

3. **Create a `.env` file**

   Create a file named `.env` in the root directory and add the following content:

   ```env
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   PERPLEXITY_API_KEY=your_perplexity_api_key_here
   ```

   Replace the placeholder values with your actual tokens and keys.

4. **Invite the bot to your server**
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   - Select your application
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
   - Use the generated URL to invite the bot to your server

5. **Run the bot**

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

## Next Steps

- Check out the [Usage Guide](Usage-Guide) to learn how to interact with the bot
- Explore the [Command Reference](Command-Reference) for detailed information about available commands
- Visit the [Troubleshooting](Troubleshooting) page if you encounter any issues
