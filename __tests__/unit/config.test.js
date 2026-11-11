/**
 * Tests for config module
 */

describe('Config', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    process.env.DISCORD_BOT_TOKEN = 'test-discord-token';

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
      expect(config.API.PERPLEXITY.ENDPOINTS.AGENT).toBe('/v1/agent');
      expect(config.API.PERPLEXITY.ENDPOINTS.CHAT_COMPLETIONS).toBeUndefined();
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
});
