# Aszune AI Bot

Aszune AI Bot is a Discord bot that specializes in gaming lore, game logic, guides, and advice. It uses the Perplexity API with the **sonar** model to generate chat completions and maintains a short conversation history for each user. The bot also adds fun emoji reactions based on keywords found in messages.

## Features

- **Chat Completions:** Uses the Perplexity API's `chat/completions` endpoint with the **sonar** model.
- **Conversation History:** Maintains a history of user interactions (up to 10 message pairs) for contextual responses.
- **Clear History Command:** Users can reset their conversation history with `!clearhistory`.
- **Emoji Reactions:** Automatically reacts with emojis based on keywords in messages.
- **Environment-based Configuration:** Uses a `.env` file to manage sensitive keys.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later recommended)
- A Discord Bot account (see [Discord Developer Portal](https://discord.com/developers/applications))
- A valid Perplexity API Key (ensure your API tier supports the endpoint you're using)

### Setup Steps

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/chrishaycock/aszune-ai-bot.git
   cd aszune-ai-bot
Install Dependencies:

bash
Copy
npm install
Configure Environment Variables:

Create a file named .env in the root directory of the project and add your keys:

env
Copy
DISCORD_BOT_TOKEN=your_discord_bot_token_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
Important: Do not commit your .env file to public repositories as it contains sensitive information.

Usage
Running the Bot
Manually:

From your project directory, run:

bash
Copy
node index.js
Using PM2 for Production:

If you want to keep the bot running in the background, use PM2.

(Optional) Create an ecosystem.config.js file:

js
Copy
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
Start the bot with PM2:

bash
Copy
pm2 start ecosystem.config.js
View logs:

bash
Copy
pm2 logs aszune-ai
Bot Commands
!clearhistory
Clears your conversation history with the bot.

Project Structure
index.js: Main bot code, which handles message events, calls the Perplexity API for chat completions, and sends responses.

ecosystem.config.js: (Optional) PM2 configuration file for running the bot as a background service.

.gitignore: Lists files and directories to be ignored by Git (e.g., node_modules/, .env, and log files).

package.json / package-lock.json: Project metadata and dependency definitions.

Troubleshooting
Bot Offline / TokenInvalid Error:

Ensure that the .env file is in the same directory as index.js.

Verify that DISCORD_BOT_TOKEN in .env is the actual bot token (obtained from the Bot tab, not General Information) and contains two periods.

When running with PM2, ensure that environment variables are properly passed (via an ecosystem file or inline).

Perplexity API Errors (e.g., 400 Bad Request):

Ensure your API key is valid and that your account tier supports the endpoint/model you're using.

Double-check the request body format.

Future Enhancements
Retrieve and Display Sources:
Implement a retrieval-augmented pipeline that automatically adds clickable hyperlinks to sources in responses.

Slash Commands:
Add support for Discord slash commands for improved user interaction.

Enhanced Error Handling:
Add robust logging and error handling to manage API failures gracefully.

Contributing
Contributions are welcome! If you have ideas for improvements or run into issues, feel free to open an issue or submit a pull request.

License
Include your license information here if applicable.
