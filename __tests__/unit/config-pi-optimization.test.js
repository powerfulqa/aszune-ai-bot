/**
 * Additional tests for src/config/config.js Pi optimization branches
 * Part 2: Pi Optimization Configuration
 */

describe('Config - Pi Optimization Branch Coverage', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.resetModules();
    // Set required env vars for all tests
    process.env.PERPLEXITY_API_KEY = 'test-key';
    process.env.DISCORD_BOT_TOKEN = 'test-token';
  });

  describe('Pi Optimization Environment Variables', () => {
    it('should handle various debounce values', () => {
      process.env.PI_DEBOUNCE_MS = '500';

      const config = require('../../src/config/config');
      expect(config.PI_OPTIMIZATIONS.DEBOUNCE_MS).toBe(500);
    });

    it('should handle various memory limit values', () => {
      process.env.PI_MEMORY_LIMIT = '150';
      process.env.PI_MEMORY_CRITICAL = '200';

      const config = require('../../src/config/config');
      expect(config.PI_OPTIMIZATIONS.MEMORY_LIMITS.RAM_THRESHOLD_MB).toBe(150);
      expect(config.PI_OPTIMIZATIONS.MEMORY_LIMITS.RAM_CRITICAL_MB).toBe(200);
    });

    it('should handle max connections setting', () => {
      process.env.PI_MAX_CONNECTIONS = '1';

      const config = require('../../src/config/config');
      expect(config.PI_OPTIMIZATIONS.MAX_CONNECTIONS).toBe(1);
    });

    it('should use default values when Pi env vars are not set', () => {
      // Clear Pi-related env vars
      delete process.env.PI_DEBOUNCE_MS;
      delete process.env.PI_MEMORY_LIMIT;
      delete process.env.PI_MAX_CONNECTIONS;

      const config = require('../../src/config/config');

      // Should have default values
      expect(config.PI_OPTIMIZATIONS.DEBOUNCE_MS).toBe(300);
      expect(config.PI_OPTIMIZATIONS.MEMORY_LIMITS.RAM_THRESHOLD_MB).toBe(200);
      expect(config.PI_OPTIMIZATIONS.MAX_CONNECTIONS).toBe(2);
    });
  });

  describe('Configuration Structure Edge Cases', () => {
    it('should handle different PI_LOG_LEVEL values', () => {
      process.env.PI_LOG_LEVEL = 'DEBUG';

      const config = require('../../src/config/config');
      expect(config.PI_OPTIMIZATIONS.LOG_LEVEL).toBe('DEBUG');
    });

    it('should handle boolean environment variables correctly', () => {
      process.env.PI_COMPACT_MODE = 'true';
      process.env.PI_LOW_CPU_MODE = 'false';

      const config = require('../../src/config/config');
      expect(config.PI_OPTIMIZATIONS.COMPACT_MODE).toBe(true);
      expect(config.PI_OPTIMIZATIONS.LOW_CPU_MODE).toBe(false);
    });

    it('should handle reaction limit values', () => {
      process.env.PI_REACTION_LIMIT = '5';

      const config = require('../../src/config/config');
      expect(config.PI_OPTIMIZATIONS.REACTION_LIMIT).toBe(5);
    });

    it('should handle stream responses setting', () => {
      process.env.PI_STREAM_RESPONSES = 'false';

      const config = require('../../src/config/config');
      expect(config.PI_OPTIMIZATIONS.STREAM_RESPONSES).toBe(false);
    });

    it('should have all required configuration sections', () => {
      const config = require('../../src/config/config');

      expect(config).toHaveProperty('API');
      expect(config).toHaveProperty('PI_OPTIMIZATIONS');
      expect(config).toHaveProperty('COLORS');
      expect(config).toHaveProperty('MESSAGE_LIMITS');
      expect(config).toHaveProperty('SYSTEM_MESSAGES');
      expect(config).toHaveProperty('REACTIONS');
    });
  });
});
