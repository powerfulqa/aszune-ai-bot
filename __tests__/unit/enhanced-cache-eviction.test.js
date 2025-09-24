/**
 * Enhanced Cache Eviction Tests
 * Tests for eviction strategies and size management
 */
const { EnhancedCache } = require('../../src/utils/enhanced-cache');

describe('EnhancedCache - Eviction', () => {
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
    }
  });

  describe('Size Management', () => {
    it('should enforce max entries limit', () => {
      // Fill cache to max entries
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Add one more entry
      cache.set('key10', 'value10');

      // First entry should be evicted (LRU)
      expect(cache.get('key0')).toBeNull();
      expect(cache.get('key10')).toBe('value10');
    });

    it('should enforce max size limit', () => {
      // Create a large value that exceeds max size
      const largeValue = 'x'.repeat(2000);
      cache.set('large', largeValue);

      // Should not be stored due to size limit
      expect(cache.get('large')).toBeNull();
    });

    it('should calculate entry size correctly', () => {
      const smallValue = 'small';
      const largeValue = 'x'.repeat(1000);

      cache.set('small', smallValue);
      cache.set('large', largeValue);

      expect(cache.get('small')).toBe(smallValue);
      expect(cache.get('large')).toBe(largeValue);
    });
  });

  describe('Eviction Strategies', () => {
    it('should use LRU eviction strategy', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it recently used
      cache.get('key1');

      // Add more entries to trigger eviction
      for (let i = 4; i <= 12; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // key2 should be evicted (least recently used)
      expect(cache.get('key1')).toBe('value1'); // Should still be there
      expect(cache.get('key2')).toBeNull(); // Should be evicted
    });

    it('should use LFU eviction strategy', () => {
      const lfuCache = new EnhancedCache({
        maxSize: 1000,
        maxEntries: 5,
        evictionStrategy: 'lfu',
        defaultTtl: 60000,
      });

      lfuCache.set('key1', 'value1');
      lfuCache.set('key2', 'value2');
      lfuCache.set('key3', 'value3');

      // Access key1 multiple times to increase frequency
      lfuCache.get('key1');
      lfuCache.get('key1');
      lfuCache.get('key1');

      // Add more entries to trigger eviction
      lfuCache.set('key4', 'value4');
      lfuCache.set('key5', 'value5');
      lfuCache.set('key6', 'value6');

      // key2 should be evicted (least frequently used)
      expect(lfuCache.get('key1')).toBe('value1'); // Should still be there
      expect(lfuCache.get('key2')).toBeNull(); // Should be evicted
    });

    it('should use TTL eviction strategy', () => {
      const ttlCache = new EnhancedCache({
        maxSize: 1000,
        maxEntries: 10,
        evictionStrategy: 'ttl',
        defaultTtl: 1000, // 1 second
      });

      ttlCache.set('key1', 'value1');
      ttlCache.set('key2', 'value2', { ttl: 2000 }); // 2 seconds

      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 1500); // 1.5 seconds later

      expect(ttlCache.get('key1')).toBeNull(); // Should be expired
      expect(ttlCache.get('key2')).toBe('value2'); // Should still be valid

      Date.now = originalNow;
    });
  });
});
