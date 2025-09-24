/**
 * Configuration for the Discord bot with auto-detection for Raspberry Pi models
 */
require('dotenv').config();

// Environment validation
const requiredEnvVars = ['PERPLEXITY_API_KEY', 'DISCORD_BOT_TOKEN'];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing ${missingEnvVars.join(', ')} in environment variables.`);
}

// Export the basic config first - Pi optimizations will be initialized later dynamically
/**
 * Helper function to parse integer environment variables with fallback
 * @param {string} envVar - Environment variable name
 * @param {number} defaultValue - Default value if env var is not set or invalid
 * @returns {number} Parsed integer value or default
 */
function getIntEnvVar(envVar, defaultValue) {
  const parsed = parseInt(process.env[envVar], 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

const config = {
  // API Keys and Tokens
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,

  // Bot Configuration
  MAX_HISTORY: 20,
  RATE_LIMIT_WINDOW: 5000, // 5 seconds
  CONVERSATION_MAX_LENGTH: 50, // Max messages per conversation history

  // Message and UI Limits
  MESSAGE_LIMITS: {
    DISCORD_MAX_LENGTH: 2000,
    EMBED_MAX_LENGTH: 1400,
    SAFE_CHUNK_OVERHEAD: 50,
    MAX_PARAGRAPH_LENGTH: 300,
    EMBED_DESCRIPTION_MAX_LENGTH: 1400,
    ERROR_MESSAGE_MAX_LENGTH: 200,
    CHUNK_DELAY_MS: 800,
  },

  // Cache Configuration
  CACHE: {
    DEFAULT_MAX_ENTRIES: 100,
    CLEANUP_PERCENTAGE: 0.2,
    MAX_AGE_DAYS: 7,
    MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
    CLEANUP_INTERVAL_DAYS: 1,
    CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000,
  },

  // Rate Limiting and Retry
  RATE_LIMITS: {
    DEFAULT_WINDOW_MS: 5000,
    RETRY_DELAY_MS: 1000,
    MAX_RETRIES: 1,
    API_TIMEOUT_MS: 30000,
  },

  // File Permissions
  FILE_PERMISSIONS: {
    FILE: 0o644, // Owner can read/write, group/others can read only
    DIRECTORY: 0o755, // Owner can read/write/execute, group/others can read/execute
  },

  // Memory and Performance
  MEMORY: {
    DEFAULT_LIMIT_MB: 200,
    DEFAULT_CRITICAL_MB: 250,
    GC_COOLDOWN_MS: 30000,
    CHECK_INTERVAL_MS: 60000,
    PRESSURE_TEST_SIZE: 1000000,
  },

  // Performance Monitoring
  PERFORMANCE: {
    MIN_VALID_INTERVAL_MS: getIntEnvVar('MIN_VALID_INTERVAL_MS', 250),
    BACKOFF_MAX_MS: getIntEnvVar('BACKOFF_MAX_MS', 10000),
    BACKOFF_MIN_MS: getIntEnvVar('BACKOFF_MIN_MS', 500),
    CHECK_INTERVAL_MS: getIntEnvVar('CHECK_INTERVAL_MS', 5000),
    // Set via CPU_THRESHOLD_PERCENT env var, default 80
    CPU_THRESHOLD_PERCENT: getIntEnvVar('CPU_THRESHOLD_PERCENT', 80),
    // Set via MEMORY_THRESHOLD_PERCENT env var, default 85
    MEMORY_THRESHOLD_PERCENT: getIntEnvVar('MEMORY_THRESHOLD_PERCENT', 85),
  },

  // Logging
  LOGGING: {
    DEFAULT_MAX_SIZE_MB: 5,
    MAX_LOG_FILES: 5,
    ROTATION_CHECK_INTERVAL_MS: 60000,
  },

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
      RAM_CRITICAL_MB: parseInt(process.env.PI_MEMORY_CRITICAL || '250', 10),
    },
    COMPACT_MODE: process.env.PI_COMPACT_MODE === 'true',
    REACTION_LIMIT: parseInt(process.env.PI_REACTION_LIMIT || '3', 10),
    LOW_CPU_MODE: process.env.PI_LOW_CPU_MODE === 'true',
    STREAM_RESPONSES: process.env.PI_STREAM_RESPONSES !== 'false',
  },

  // API Configuration
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai',
      ENDPOINTS: {
        CHAT_COMPLETIONS: '/chat/completions',
      },
      DEFAULT_MODEL: 'sonar',
      DEFAULT_TEMPERATURE: 0.0,
      MAX_TOKENS: {
        CHAT: 1024,
        SUMMARY: 256,
      },
    },
  },

  // Discord Embed Colors
  COLORS: {
    PRIMARY: parseInt('0099ff', 16),
  },
  // System Messages
  SYSTEM_MESSAGES: {
    CHAT: 'Aszai is a bot that specialises in gaming lore, game logic, guides, and advice. If you do not know the answer to a question, clearly say "I don\'t know" rather than attempting to make up an answer.',
    SUMMARY:
      'Summarise the following conversation between a user and an AI assistant in a concise paragraph, using UK English.',
    TEXT_SUMMARY: 'Summarise the following text in a concise paragraph, using UK English.',
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
    welcome: '👋',
  },
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
        ...optimizedSettings,
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
