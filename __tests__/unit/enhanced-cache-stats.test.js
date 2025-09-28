/**
 * Enhanced Cache Statistics Tests
 * Tests for statistics, metrics, and error handling
 */
const { EnhancedCache } = require('../../src/utils/enhanced-cache');

describe('EnhancedCache - Statistics', () => {
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

  describe('Statistics and Metrics', () => {
    it('should track hit and miss statistics', () => {
      cache.set('key1', 'value1');

      // Hit
      cache.get('key1');

      // Miss
      cache.get('nonexistent');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should track memory usage', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.totalMemory).toBeGreaterThan(0);
      expect(stats.entryCount).toBe(2);
    });

    it('should track eviction count', () => {
      // Fill cache to max entries
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Add one more entry to trigger eviction
      cache.set('key10', 'value10');

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it('should provide detailed cache information', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const detailedInfo = cache.getDetailedInfo();
      expect(detailedInfo).toHaveProperty('stats');
      expect(detailedInfo).toHaveProperty('entries');
      expect(detailedInfo.entries).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid keys gracefully', () => {
      expect(() => cache.set(null, 'value')).not.toThrow();
      expect(() => cache.get(null)).not.toThrow();
      expect(() => cache.delete(null)).not.toThrow();
    });

    it('should handle invalid values gracefully', () => {
      expect(() => cache.set('key', null)).not.toThrow();
      expect(() => cache.set('key', undefined)).not.toThrow();
    });

    it('should handle cache operations during shutdown', () => {
      cache.clear();
      expect(() => cache.get('key')).not.toThrow();
      expect(() => cache.set('key', 'value')).not.toThrow();
    });
  });

  describe('Cache Entry', () => {
    it('should create cache entries with correct properties', () => {
      cache.set('key1', 'value1');
      const detailedInfo = cache.getDetailedInfo();
      const entry = detailedInfo.entries.find((e) => e.key === 'key1');

      expect(entry).toBeDefined();
      expect(entry.value).toBe('value1');
      expect(entry.age).toBeDefined();
      expect(entry.lastAccessed).toBeDefined();
      expect(entry.accessCount).toBeGreaterThanOrEqual(0);
    });

    it('should track access count correctly', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      const detailedInfo = cache.getDetailedInfo();
      const entry = detailedInfo.entries.find((e) => e.key === 'key1');
      expect(entry.accessCount).toBe(3);
    });

    it('should update last accessed time on get', (done) => {
      cache.set('key1', 'value1');
      const detailedInfo1 = cache.getDetailedInfo();
      const entry1 = detailedInfo1.entries.find((e) => e.key === 'key1');
      const initialAccessTime = entry1.lastAccessed;

      // Wait a bit and access again
      setTimeout(() => {
        cache.get('key1');
        const detailedInfo2 = cache.getDetailedInfo();
        const entry2 = detailedInfo2.entries.find((e) => e.key === 'key1');
        expect(entry2.lastAccessed).toBeGreaterThan(initialAccessTime);
        done();
      }, 10);
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      const customCache = new EnhancedCache({
        maxSize: 2000,
        maxEntries: 20,
        evictionStrategy: 'lfu',
        defaultTtl: 30000,
      });

      expect(customCache.getStats().maxSize).toBe(2000);
      expect(customCache.getStats().maxEntries).toBe(20);
    });

    it('should use default configuration when none provided', () => {
      const defaultCache = new EnhancedCache();
      const stats = defaultCache.getStats();

      expect(stats.maxSize).toBeDefined();
      expect(stats.maxEntries).toBeDefined();
    });

    it('should handle invalid configuration gracefully', () => {
      expect(
        () =>
          new EnhancedCache({
            maxSize: -1,
            maxEntries: -1,
            evictionStrategy: 'invalid',
          })
      ).not.toThrow();
    });
  });
});
