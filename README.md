# Aszune AI Bot

**Aszune AI Bot** is a Discord bot designed to provide gaming lore, game logic, guides, and advice using the Perplexity API with the **sonar** model. It maintains a short conversation history for each user and adds fun emoji reactions based on keywords found in messages.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Setup Steps](#setup-steps)
- [Usage](#usage)
  - [Running the Bot Manually](#running-the-bot-manually)
  - [Running with PM2 (for Production)](#running-with-pm2-for-production)
- [Bot Commands](#bot-commands)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- 🤖 **Chat Completions:** Uses Perplexity API's `chat/completions` endpoint with the **sonar** model.
- 🧠 **Context Awareness:** Remembers recent user messages with a configurable history length.
- 🔁 **Command Support:** Users can clear their history at any time.
- 😄 **Emoji Reactions:** Adds reactions based on keywords like "hello", "funny", "love", etc.
- 🔒 **Secure Configuration:** `.env` based token and key management (keeps secrets out of code).

---

## Installation

### Prerequisites

- Node.js (v14 or later)
- A Discord bot token (from the [Discord Developer Portal](https://discord.com/developers/applications))
- A valid [Perplexity AI API key](https://www.perplexity.ai/)

### Setup Steps

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

   ```env
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   PERPLEXITY_API_KEY=your_perplexity_api_key_here
   ```

---

## Usage

### Running the Bot Manually

```bash
node index.js
```

You should see:

```
Discord bot is online!
```

Your bot should now appear online in your Discord server.

---

### Running with PM2 (for Production)

PM2 keeps the bot alive in the background and restarts it on crashes or reboots.

#### Option A: Using an Ecosystem File

1. Create a file called `ecosystem.config.js`:

   ```js
   module.exports = {
     apps: [
       {
         name: 'aszune-ai',
         script: 'index.js',
         env: {
           DISCORD_BOT_TOKEN: 'your_discord_bot_token_here',
           PERPLEXITY_API_KEY: 'your_perplexity_api_key_here'
         }
       }
     ]
   };
   ```

2. Start your bot:

   ```bash
   pm2 start ecosystem.config.js
   pm2 logs aszune-ai
   ```

#### Option B: Inline Environment Variables

```bash
DISCORD_BOT_TOKEN=your_discord_bot_token_here PERPLEXITY_API_KEY=your_perplexity_api_key_here pm2 start index.js --name aszune-ai
```

---

## Bot Commands

| Command         | Description                             |
|-----------------|-----------------------------------------|
| `!clearhistory` | Clears your conversation history        |

---

## Project Structure

```
aszune-ai-bot/
├── index.js               # Main bot logic
├── package.json           # Project metadata
├── package-lock.json      # Dependency lock file
├── ecosystem.config.js    # PM2 deployment config (optional)
├── .env                   # Environment secrets (not committed)
└── .gitignore             # Ignored files
```

---

## Troubleshooting

### 🔴 Bot Offline or Invalid Token

- Double-check your `DISCORD_BOT_TOKEN` in `.env`
- Confirm the token has not been regenerated or revoked
- Ensure your bot has permission to join and read messages in your server

### 🔴 Perplexity API Errors (400 / 401)

- Validate your API key is current and supports the `chat/completions` endpoint
- Ensure model name is `"sonar"` and the format of your payload is correct
- Test the same key using a tool like Postman or curl

---

## Future Enhancements

- [ ] Add clickable sources and reference links from Perplexity results
- [ ] Introduce slash command support (`/ask`, `/clear`, etc.)
- [ ] Add retry/backoff logic for API rate limits
- [ ] Web dashboard for usage monitoring and history

---

## Contributing

Pull requests and ideas are always welcome! Please:

1. Fork the repository
2. Create a new branch
3. Submit a PR with your changes

---

## License

MIT — feel free to use, modify, and share ✨

---

**Made with ❤️ for the gaming community. Powered by Discord, Perplexity, and Node.js.**
