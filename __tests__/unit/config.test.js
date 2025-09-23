/**
 * Tests for config module
 */
jest.mock('../../src/utils/pi-detector', () => ({
  initPiOptimizations: jest.fn().mockResolvedValue({
    ENABLED: true,
    COMPACT_MODE: true,
    MAX_CONNECTIONS: 2,
  }),
}));

describe('Config', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };

    // Setup minimal environment for testing
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    process.env.DISCORD_BOT_TOKEN = 'test-discord-token';

    // Reset mocks
    const piDetector = require('../../src/utils/pi-detector');
    piDetector.initPiOptimizations.mockClear();
    piDetector.initPiOptimizations.mockResolvedValue({
      ENABLED: true,
      COMPACT_MODE: true,
      MAX_CONNECTIONS: 2,
    });

    // Clear module cache for fresh config initialization
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('exports required configuration settings', () => {
    const config = require('../../src/config/config');

    // Test basic structure
    expect(config).toHaveProperty('PERPLEXITY_API_KEY');
    expect(config).toHaveProperty('DISCORD_BOT_TOKEN');
    expect(config).toHaveProperty('MAX_HISTORY');
    expect(config).toHaveProperty('RATE_LIMIT_WINDOW');

    // Test nested structure
    expect(config).toHaveProperty('API.PERPLEXITY.BASE_URL');
    expect(config).toHaveProperty('API.PERPLEXITY.ENDPOINTS.CHAT_COMPLETIONS');
    expect(config).toHaveProperty('COLORS.PRIMARY');
    expect(config).toHaveProperty('SYSTEM_MESSAGES.CHAT');
    expect(config).toHaveProperty('SYSTEM_MESSAGES.SUMMARY');

    // Test emoji reactions
    expect(config).toHaveProperty('REACTIONS');
    expect(config.REACTIONS).toHaveProperty('hello', '👋');
    expect(config.REACTIONS).toHaveProperty('happy', '😊');
  });

  it('should have required environment variables available', () => {
    const config = require('../../src/config/config');
    // In test environment, we use mock values
    expect(config.PERPLEXITY_API_KEY).toBeDefined();
    expect(config.DISCORD_BOT_TOKEN).toBeDefined();
  });

  it('should have default API configuration', () => {
    const config = require('../../src/config/config');
    expect(config.API).toBeDefined();
    expect(config.API.PERPLEXITY).toBeDefined();
    expect(config.API.PERPLEXITY.BASE_URL).toBeDefined();
  });

  it('should have system messages defined', () => {
    const config = require('../../src/config/config');
    expect(config.SYSTEM_MESSAGES).toBeDefined();
    expect(config.SYSTEM_MESSAGES.CHAT).toBeDefined();
    expect(config.SYSTEM_MESSAGES.SUMMARY).toBeDefined();
  });

  describe('initializePiOptimizations', () => {
    it('should have initializePiOptimizations function available', () => {
      const config = require('../../src/config/config');
      expect(typeof config.initializePiOptimizations).toBe('function');
    });

    it('should return a promise when initializePiOptimizations is called', async () => {
      const config = require('../../src/config/config');
      const result = await config.initializePiOptimizations();
      expect(result).toBeDefined();
    });
  });
});
