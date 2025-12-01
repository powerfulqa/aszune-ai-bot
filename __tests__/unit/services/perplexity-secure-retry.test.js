/**
 * Tests for perplexity-secure.js edge cases
 * Targets: getCacheStats, shutdown, and configuration handling
 */

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('PerplexityService - Edge Cases', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = require('../../../src/services/perplexity-secure');
  });

  describe('getCacheStats', () => {
    it('should return cache stats object with all required fields', () => {
      const stats = service.getCacheStats();

      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
      // Should have standard cache stat fields
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
    });
  });

  describe('getDetailedCacheInfo', () => {
    it('should return detailed cache information', () => {
      const info = service.getDetailedCacheInfo();

      expect(info).toBeDefined();
      expect(typeof info).toBe('object');
    });
  });

  describe('invalidateCacheByTag', () => {
    it('should handle tag invalidation', () => {
      const result = service.invalidateCacheByTag('test-tag');

      expect(typeof result).toBe('number');
    });
  });

  describe('shutdown', () => {
    it('should handle shutdown gracefully', () => {
      expect(() => service.shutdown()).not.toThrow();
    });

    it('should handle multiple shutdown calls', () => {
      service.shutdown();
      expect(() => service.shutdown()).not.toThrow();
    });
  });
});
