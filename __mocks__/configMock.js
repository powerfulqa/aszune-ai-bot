// Mock configuration for tests

module.exports = {
  DISCORD_BOT_TOKEN: 'test-token',
  PERPLEXITY_API_KEY: 'test-perplexity-key',
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai'
    }
  },
  LOGGING: {
    LEVEL: 'info',
    FILE_ENABLED: false
  }
};
