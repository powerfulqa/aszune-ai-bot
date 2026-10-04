/**
 * Configuration for the Discord bot with auto-detection for Raspberry Pi models
 */
require('dotenv').config({ quiet: true });

// Environment validation
const requiredEnvVars = ['PERPLEXITY_API_KEY', 'DISCORD_BOT_TOKEN'];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing ${missingEnvVars.join(', ')} in environment variables.`);
}

// Export the basic config first - Pi optimizations will be initialized later dynamically
/**
 * Helper function to parse integer environment variables with fallback
 * Safely parses environment variables as integers, returning a default value
 * if the environment variable is not set, empty, or contains invalid data.
 *
 * @param {string} envVar - The name of the environment variable to parse
 * @param {number} defaultValue - The default value to return if parsing fails
 * @returns {number} The parsed integer value or the default value
 *
 * @example
 * // Parse PORT environment variable with default 3000
 * const port = getIntEnvVar('PORT', 3000);
 *
 * @example
 * // Parse CPU_THRESHOLD with default 80 (used in config object)
 * CPU_THRESHOLD_PERCENT: getIntEnvVar('CPU_THRESHOLD_PERCENT', 80),
 */
function getIntEnvVar(envVar, defaultValue) {
  if (typeof envVar !== 'string') {
    throw new TypeError(`getIntEnvVar: envVar must be a string, got ${typeof envVar}`);
  }
  if (!Number.isInteger(defaultValue)) {
    throw new TypeError(`getIntEnvVar: defaultValue must be a valid integer, got ${defaultValue}`);
  }

  const parsed = parseInt(process.env[envVar], 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a comma-separated environment variable into a trimmed string array.
 * Returns defaultValue when the variable is unset or empty.
 *
 * @param {string} envVar - Name of the environment variable
 * @param {string[]} defaultValue - Fallback when unset/empty
 * @returns {string[]} Parsed list
 */
function getListEnvVar(envVar, defaultValue = []) {
  const raw = process.env[envVar];
  if (typeof raw !== 'string' || raw.trim() === '') {
    return defaultValue;
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const config = {
  // API Keys and Tokens
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,

  // Database Configuration
  DB_PATH: process.env.DB_PATH || './data/bot.db',

  // Bot Configuration
  MAX_HISTORY: 30, // Messages (user + assistant) replayed to the model each turn
  RATE_LIMIT_WINDOW: 5000, // 5 seconds
  CONVERSATION_MAX_LENGTH: 50, // Max messages per conversation history

  // Database Configuration - should match runtime limits
  DATABASE_CONVERSATION_LIMIT: 30, // Match MAX_HISTORY for consistency

  // Conversation Context Management
  // Small-group, back-and-forth use: a conversation survives a couple of hours
  // pause before the bot treats the next message as a fresh topic.
  CONVERSATION_INACTIVITY_TIMEOUT_MS: 2 * 60 * 60 * 1000, // 2 hours - auto-clear context
  SESSION_TIMEOUT_MS: 2 * 60 * 60 * 1000, // 2 hours - reload persisted history after a restart within this window
  CONVERSATION_CONTEXT_WARNING_THRESHOLD: 10, // Warn user approaching limit
  STATS_SAVE_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes - flush user stats to disk

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
    MAX_MEMORY_MB: 50, // In-memory response cache memory cap
    DEFAULT_TTL_MS: 60 * 60 * 1000, // 1 hour default entry TTL
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
    API_TIMEOUT_MS: 120000, // Agent runs with search + page fetches take 10-60s
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
        AGENT: '/v1/agent',
      },
      // Agent API preset: supplies the model, reasoning effort, step budget and
      // default tools. 'medium' suits multi-turn conversation; 'fast' and 'low'
      // trade answer quality for latency/cost, 'high'/'xhigh' go deeper.
      AGENT_PRESET: process.env.AGENT_PRESET || 'medium',
      // Optional overrides on top of the preset, e.g.
      //   AGENT_MODEL=anthropic/claude-sonnet-5-5  AGENT_REASONING_EFFORT=low
      // Leave unset to follow whatever model Perplexity puts behind the preset.
      AGENT_MODEL: process.env.AGENT_MODEL || '',
      AGENT_REASONING_EFFORT: process.env.AGENT_REASONING_EFFORT || '',
      // Let the agent read links people paste into the conversation.
      FETCH_URL: process.env.AGENT_FETCH_URL !== 'false',
      // Output budgets. Reasoning models spend part of this on thinking, so
      // keep headroom; the system prompt asks for Discord-length answers.
      MAX_TOKENS: {
        CHAT: 4096,
        SUMMARY: 1024,
      },
      // Perplexity search_domain_filter is an ALLOWLIST: when non-empty, search
      // is restricted to ONLY these domains. That improves answer quality for
      // gaming questions but would starve general/long-tail queries, so the
      // default stays empty (unrestricted). Operators can opt in via the
      // SEARCH_DOMAIN_FILTER env var, e.g.:
      //   SEARCH_DOMAIN_FILTER=wowhead.com,icy-veins.com,fextralife.com,ign.com,pcgamer.com
      // Sent as web_search tool filters on the Agent API.
      SEARCH_DOMAIN_FILTER: getListEnvVar('SEARCH_DOMAIN_FILTER', []),
      SEARCH_RECENCY_KEYWORDS: ['latest', 'recent', 'new', 'current', 'today', 'patch', 'update'],
    },
  },

  // Discord Embed Colors
  COLORS: {
    PRIMARY: parseInt('0099ff', 16),
    SUCCESS: parseInt('57f287', 16), // green
    WARNING: parseInt('fee75c', 16), // yellow
    ERROR: parseInt('ed4245', 16), // red
  },
  // System Messages
  SYSTEM_MESSAGES: {
    CHAT: [
      'You are Aszai, a Discord bot for a small group of friends. You specialise in gaming lore, game logic, guides, and advice, but happily help with other questions too.',
      'Conversations are back-and-forth: use the earlier turns for context, and only search the web when the answer depends on facts you need to look up or check.',
      'If someone pastes a link, read it before answering questions about it.',
      'Keep answers conversational and Discord-sized: usually under 1500 characters, using short paragraphs or bullet points and Discord markdown. Go longer only when asked for detail.',
      'Use UK English.',
      'When you use web results, cite them inline as [1], [2] matching the source numbers.',
      'If you do not know the answer, clearly say "I don\'t know" rather than making one up.',
    ].join(' '),
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

  // Feature Flags (for development and gradual rollout)
  FEATURES: {
    // Development mode detection (enables all features for testing)
    DEVELOPMENT_MODE: process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true',
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
    // Silently continue without Pi optimizations if initialization fails
    // Logger may not be available during config init phase
    return config;
  }
}

// Export the config and initialization function
module.exports = config;
module.exports.initializePiOptimizations = initializePiOptimizations;
