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
    originalEnv = { ...process.env };
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    process.env.DISCORD_BOT_TOKEN = 'test-discord-token';

    const piDetector = require('../../src/utils/pi-detector');
    piDetector.initPiOptimizations.mockClear();
    piDetector.initPiOptimizations.mockResolvedValue({
      ENABLED: true,
      COMPACT_MODE: true,
      MAX_CONNECTIONS: 2,
    });

    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('basic configuration', () => {
    it('exports required configuration settings', () => {
      const config = require('../../src/config/config');

      expect(config).toHaveProperty('PERPLEXITY_API_KEY');
      expect(config).toHaveProperty('DISCORD_BOT_TOKEN');
      expect(config).toHaveProperty('MAX_HISTORY');
      expect(config).toHaveProperty('RATE_LIMIT_WINDOW');
    });

    it('should have required environment variables available', () => {
      const config = require('../../src/config/config');
      expect(config.PERPLEXITY_API_KEY).toBeDefined();
      expect(config.DISCORD_BOT_TOKEN).toBeDefined();
    });
  });

  describe('nested configuration', () => {
    it('should have API configuration', () => {
      const config = require('../../src/config/config');
      expect(config.API).toBeDefined();
      expect(config.API.PERPLEXITY).toBeDefined();
      expect(config.API.PERPLEXITY.BASE_URL).toBeDefined();
      expect(config.API.PERPLEXITY.ENDPOINTS.CHAT_COMPLETIONS).toBeDefined();
    });

    it('should have system messages defined', () => {
      const config = require('../../src/config/config');
      expect(config.SYSTEM_MESSAGES).toBeDefined();
      expect(config.SYSTEM_MESSAGES.CHAT).toBeDefined();
      expect(config.SYSTEM_MESSAGES.SUMMARY).toBeDefined();
    });

    it('should have emoji reactions defined', () => {
      const config = require('../../src/config/config');
      expect(config.REACTIONS).toBeDefined();
      expect(config.REACTIONS).toHaveProperty('hello', '👋');
      expect(config.REACTIONS).toHaveProperty('happy', '😊');
    });
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
