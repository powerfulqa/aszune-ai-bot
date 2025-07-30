/**
 * Configuration for the Discord bot with auto-detection for Raspberry Pi models
 */
require('dotenv').config();

// Environment validation
const requiredEnvVars = ['PERPLEXITY_API_KEY', 'DISCORD_BOT_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing ${missingEnvVars.join(', ')} in environment variables.`);
}

// Export the basic config first - Pi optimizations will be initialized later dynamically
const config = {
  // API Keys and Tokens
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  
  // Bot Configuration
  MAX_HISTORY: 20,
  RATE_LIMIT_WINDOW: 5000, // 5 seconds
  CONVERSATION_MAX_LENGTH: 50, // Max messages per conversation history
  
  // Raspberry Pi optimizations (default values, will be overridden by pi-detector)
  PI_OPTIMIZATIONS: {
    ENABLED: process.env.ENABLE_PI_OPTIMIZATIONS === 'true',
    LOG_LEVEL: process.env.PI_LOG_LEVEL || 'ERROR',
    CACHE_ENABLED: true,
    CACHE_MAX_ENTRIES: 100,
    CLEANUP_INTERVAL_MINUTES: 30,
    DEBOUNCE_MS: parseInt(process.env.PI_DEBOUNCE_MS || '300', 10),
    MAX_CONNECTIONS: parseInt(process.env.PI_MAX_CONNECTIONS || '2', 10),
    MEMORY_LIMITS: {
      RAM_THRESHOLD_MB: parseInt(process.env.PI_MEMORY_LIMIT || '200', 10),
      RAM_CRITICAL_MB: parseInt(process.env.PI_MEMORY_CRITICAL || '250', 10)
    },
    COMPACT_MODE: process.env.PI_COMPACT_MODE === 'true',
    REACTION_LIMIT: parseInt(process.env.PI_REACTION_LIMIT || '3', 10),
    LOW_CPU_MODE: process.env.PI_LOW_CPU_MODE === 'true',
    STREAM_RESPONSES: process.env.PI_STREAM_RESPONSES !== 'false'
  },
  
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

/**
 * Initialize Pi-specific optimizations and update config
 * This function should be called when the bot starts
 */
async function initializePiOptimizations() {
  // Import pi-detector only when needed to avoid circular dependency
  const piDetector = require('../utils/pi-detector');
  try {
    // Only attempt to initialize if optimizations are enabled
    if (config.PI_OPTIMIZATIONS.ENABLED) {
      const optimizedSettings = await piDetector.initPiOptimizations();
      
      // Update the configuration with optimized settings
      config.PI_OPTIMIZATIONS = {
        ...config.PI_OPTIMIZATIONS,
        ...optimizedSettings
      };
      
      // Store Pi information for reference
      config.PI_INFO = optimizedSettings.PI_INFO;
    }
    return config;
  } catch (error) {
    console.error('Failed to initialize Pi optimizations:', error);
    return config;
  }
}

// Export the config and initialization function
module.exports = config;
module.exports.initializePiOptimizations = initializePiOptimizations;
