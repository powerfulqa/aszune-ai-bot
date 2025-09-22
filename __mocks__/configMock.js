// Mock configuration for tests

module.exports = {
  DISCORD_BOT_TOKEN: 'test-token',
  PERPLEXITY_API_KEY: 'test-perplexity-key',
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai',
      ENDPOINTS: {
        CHAT_COMPLETIONS: '/chat/completions'
      },
      MAX_TOKENS: {
        SUMMARY: 1000,
        CHAT: 2000
      },
      DEFAULT_MODEL: 'llama-3.1-sonar-small-128k-online',
      DEFAULT_TEMPERATURE: 0.7
    }
  },
  LOGGING: {
    LEVEL: 'info',
    FILE_ENABLED: false,
    DEFAULT_MAX_SIZE_MB: 10,
    MAX_LOG_FILES: 5
  },
  MESSAGE_LIMITS: {
    DISCORD_MAX_LENGTH: 2000,
    EMBED_MAX_LENGTH: 4096,
    EMBED_DESCRIPTION_MAX_LENGTH: 2048,
    MAX_PARAGRAPH_LENGTH: 1000,
    SAFE_CHUNK_OVERHEAD: 100,
    CHUNK_DELAY_MS: 1000,
    ERROR_MESSAGE_MAX_LENGTH: 500
  },
  CACHE: {
    DEFAULT_MAX_ENTRIES: 1000,
    MAX_MEMORY_MB: 50,
    DEFAULT_TTL_MS: 300000,
    CLEANUP_INTERVAL_MS: 60000,
    MAX_AGE_MS: 86400000,
    CLEANUP_PERCENTAGE: 0.2
  },
  FILE_PERMISSIONS: {
    READ: 0o644,
    WRITE: 0o644,
    DIRECTORY: 0o755
  },
  RATE_LIMITS: {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    BACKOFF_MULTIPLIER: 2
  },
  MEMORY: {
    DEFAULT_LIMIT_MB: 100,
    DEFAULT_CRITICAL_MB: 150,
    CHECK_INTERVAL_MS: 30000,
    GC_COOLDOWN_MS: 5000,
    PRESSURE_TEST_SIZE: 1024
  },
  PERFORMANCE: {
    MIN_VALID_INTERVAL_MS: 100,
    BACKOFF_MAX_MS: 30000,
    BACKOFF_MIN_MS: 1000,
    CHECK_INTERVAL_MS: 5000
  },
  PI_OPTIMIZATIONS: {
    ENABLED: false,
    COMPACT_MODE: false,
    LOW_CPU_MODE: false
  },
  EMOJI_REACTIONS: {
    'hello': '👋',
    'welcome': '👋',
    'thanks': '🙏',
    'love': '❤️',
    'happy': '😊',
    'sad': '😢'
  }
};
