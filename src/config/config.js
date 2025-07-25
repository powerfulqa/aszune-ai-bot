/**
 * Configuration settings for the Discord bot
 */
require('dotenv').config();

// Environment validation
const requiredEnvVars = ['PERPLEXITY_API_KEY', 'DISCORD_BOT_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing ${missingEnvVars.join(', ')} in environment variables.`);
}

module.exports = {
  // API Keys and Tokens
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  
  // Bot Configuration
  MAX_HISTORY: 20,
  RATE_LIMIT_WINDOW: 5000, // 5 seconds
  
  // API Configuration
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai',
      ENDPOINTS: {
        CHAT_COMPLETIONS: '/chat/completions'
      },
      DEFAULT_MODEL: 'sonar',
      DEFAULT_TEMPERATURE: 0.0,
      MAX_TOKENS: {
        CHAT: 1024,
        SUMMARY: 256
      }
    }
  },
  
  // Discord Embed Colors
  COLORS: {
    PRIMARY: parseInt('0099ff', 16)
  },
    // System Messages
  SYSTEM_MESSAGES: {
    CHAT: 'Aszai is a bot that specialises in gaming lore, game logic, guides, and advice. If you do not know the answer to a question, clearly say "I don\'t know" rather than attempting to make up an answer.',
    SUMMARY: 'Summarise the following conversation between a user and an AI assistant in a concise paragraph, using UK English.',
    TEXT_SUMMARY: 'Summarise the following text in a concise paragraph, using UK English.'
  },
  
  // Emojis for reactions
  REACTIONS: {
    hello: '👋',
    funny: '😂',
    sad: '😢',
    awesome: '😎',
    love: '❤️',
    happy: '😊',
    congratulations: '🎉',
    thanks: '🙏',
    help: '🆘',
    welcome: '👋'
  }
};
