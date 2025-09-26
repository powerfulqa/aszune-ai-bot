/**
 * Enhanced Cache TTL Tests
 * Tests for Time To Live functionality
 */
const { EnhancedCache } = require('../../src/utils/enhanced-cache');

describe('EnhancedCache - TTL', () => {
  let cache;

  beforeEach(() => {
    cache = new EnhancedCache({
      maxSize: 1000,
      maxEntries: 10,
      evictionStrategy: 'lru',
      defaultTtl: 60000,
    });
  });

  afterEach(() => {
    if (cache) {
      cache.clear();
      cache.stopCleanup();
    }
  });

  describe('TTL (Time To Live)', () => {
    it('should respect default TTL', async () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 70000); // 70 seconds later

      expect(cache.get('key1')).toBeNull();

      Date.now = originalNow;
    });

    it('should respect custom TTL', async () => {
      cache.set('key1', 'value1', { ttl: 1000 }); // 1 second
      expect(cache.get('key1')).toBe('value1');

      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 2000); // 2 seconds later

      expect(cache.get('key1')).toBeNull();

      Date.now = originalNow;
    });

    it('should not expire before TTL', async () => {
      cache.set('key1', 'value1', { ttl: 10000 }); // 10 seconds
      expect(cache.get('key1')).toBe('value1');

      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 5000); // 5 seconds later

      expect(cache.get('key1')).toBe('value1');

      Date.now = originalNow;
    });

    it('should handle zero TTL (immediate expiration)', () => {
      cache.set('key1', 'value1', { ttl: 0 });
      expect(cache.get('key1')).toBeNull();
    });
  });
});
