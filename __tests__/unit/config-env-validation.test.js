/**
 * Additional tests for src/config/config.js environment variable validation
 * Part 1: Environment Variable Validation and getIntEnvVar Function
 */

describe('Config - Environment Variable Validation', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.resetModules();
  });

  describe('Required Environment Variables', () => {
    it('should throw error when PERPLEXITY_API_KEY is missing', () => {
      delete process.env.PERPLEXITY_API_KEY;
      process.env.DISCORD_BOT_TOKEN = 'test-token';

      expect(() => {
        require('../../src/config/config');
      }).toThrow('Missing PERPLEXITY_API_KEY in environment variables.');
    });

    it('should throw error when DISCORD_BOT_TOKEN is missing', () => {
      delete process.env.DISCORD_BOT_TOKEN;
      process.env.PERPLEXITY_API_KEY = 'test-key';

      expect(() => {
        require('../../src/config/config');
      }).toThrow('Missing DISCORD_BOT_TOKEN in environment variables.');
    });

    it('should throw error when both required env vars are missing', () => {
      delete process.env.PERPLEXITY_API_KEY;
      delete process.env.DISCORD_BOT_TOKEN;

      expect(() => {
        require('../../src/config/config');
      }).toThrow('Missing PERPLEXITY_API_KEY, DISCORD_BOT_TOKEN in environment variables.');
    });

    it('should handle empty string environment variables', () => {
      process.env.PERPLEXITY_API_KEY = '';
      process.env.DISCORD_BOT_TOKEN = '';

      expect(() => {
        require('../../src/config/config');
      }).toThrow('Missing PERPLEXITY_API_KEY, DISCORD_BOT_TOKEN in environment variables.');
    });
  });

  describe('getIntEnvVar Function Error Branches', () => {
    beforeEach(() => {
      // Set required env vars for these tests
      process.env.PERPLEXITY_API_KEY = 'test-key';
      process.env.DISCORD_BOT_TOKEN = 'test-token';
    });

    it('should return default value for invalid integer strings', () => {
      // Test indirectly through config values that use getIntEnvVar
      process.env.MAX_HISTORY = 'invalid';
      
      // Should use default value when invalid and not throw
      expect(() => require('../../src/config/config')).not.toThrow();
      
      // Should fall back to default value
      const config = require('../../src/config/config');
      expect(typeof config.MAX_HISTORY).toBe('number');
    });

    it('should handle valid integer environment variables', () => {
      process.env.CPU_THRESHOLD_PERCENT = '75';
      process.env.MEMORY_THRESHOLD_PERCENT = '90';
      
      const config = require('../../src/config/config');
      
      expect(config.PERFORMANCE.CPU_THRESHOLD_PERCENT).toBe(75);
      expect(config.PERFORMANCE.MEMORY_THRESHOLD_PERCENT).toBe(90);
    });

    it('should handle zero values correctly', () => {
      process.env.CHECK_INTERVAL_MS = '0';
      
      const config = require('../../src/config/config');
      
      expect(config.PERFORMANCE.CHECK_INTERVAL_MS).toBe(0);
    });

    it('should handle negative integer values', () => {
      process.env.BACKOFF_MIN_MS = '-100';
      
      const config = require('../../src/config/config');
      
      expect(config.PERFORMANCE.BACKOFF_MIN_MS).toBe(-100);
    });

    it('should handle large integer values', () => {
      process.env.BACKOFF_MAX_MS = '999999';
      
      const config = require('../../src/config/config');
      
      expect(config.PERFORMANCE.BACKOFF_MAX_MS).toBe(999999);
    });
  });

  describe('Boolean Environment Variables', () => {
    beforeEach(() => {
      process.env.PERPLEXITY_API_KEY = 'test-key';
      process.env.DISCORD_BOT_TOKEN = 'test-token';
    });

    it('should handle ENABLE_PI_OPTIMIZATIONS=true', () => {
      process.env.ENABLE_PI_OPTIMIZATIONS = 'true';
      
      const config = require('../../src/config/config');
      expect(config.PI_OPTIMIZATIONS.ENABLED).toBe(true);
    });

    it('should handle ENABLE_PI_OPTIMIZATIONS=false', () => {
      process.env.ENABLE_PI_OPTIMIZATIONS = 'false';
      
      const config = require('../../src/config/config');
      expect(config.PI_OPTIMIZATIONS.ENABLED).toBe(false);
    });

    it('should default to false when ENABLE_PI_OPTIMIZATIONS is undefined', () => {
      delete process.env.ENABLE_PI_OPTIMIZATIONS;
      
      const config = require('../../src/config/config');
      expect(config.PI_OPTIMIZATIONS.ENABLED).toBe(false);
    });

    it('should handle malformed boolean environment variables', () => {
      process.env.PI_OPTIMIZATIONS_ENABLED = 'maybe';
      
      const config = require('../../src/config/config');
      // Should default to false for non-true values
      expect(config.PI_OPTIMIZATIONS.ENABLED).toBe(false);
    });
  });
});