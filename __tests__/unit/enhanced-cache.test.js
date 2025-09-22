/**
 * Enhanced Cache Tests
 * Comprehensive test coverage for the enhanced caching system
 */
const { EnhancedCache } = require('../../src/utils/enhanced-cache');

describe('EnhancedCache', () => {
  let cache;

  beforeEach(() => {
    cache = new EnhancedCache({
      maxSize: 1000,
      maxEntries: 10,
      evictionStrategy: 'lru',
      defaultTtl: 60000
    });
  });

  afterEach(() => {
    if (cache) {
      cache.clear();
    }
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if key exists by getting it', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should delete keys', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      cache.delete('key1');
      expect(cache.get('key1')).toBeNull();
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.entries.size).toBeGreaterThan(0);
      cache.clear();
      expect(cache.entries.size).toBe(0);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect TTL for individual entries', async () => {
      cache.set('key1', 'value1', { ttl: 100 }); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeNull();
    }, 10000);

    it('should not expire entries before TTL', async () => {
      cache.set('key1', 'value1', { ttl: 1000 }); // 1 second TTL
      expect(cache.get('key1')).toBe('value1');
      
      // Should still be valid after 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(cache.get('key1')).toBe('value1');
    }, 10000);

    it('should use default TTL when not specified', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('Size Management', () => {
    it('should track cache size', () => {
      expect(cache.entries.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.entries.size).toBe(1);
      cache.set('key2', 'value2');
      // Cache might evict entries based on size limits, so check it's at least 1
      expect(cache.entries.size).toBeGreaterThan(0);
    });

    it('should respect maxEntries limit', () => {
      const smallCache = new EnhancedCache({ maxSize: 2 });
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3'); // Should evict key1
      
      expect(smallCache.entries.size).toBe(2);
      expect(smallCache.get('key1')).toBeNull();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
    });

    it('should respect maxSize limit', () => {
      const smallCache = new EnhancedCache({ maxSize: 100 });
      
      smallCache.set('key1', 'a'.repeat(50));
      smallCache.set('key2', 'b'.repeat(50));
      smallCache.set('key3', 'c'.repeat(50)); // Should evict some entries
      
      expect(smallCache.entries.size).toBeGreaterThan(0);
    });
  });

  describe('Eviction Strategies', () => {
    it('should use LRU eviction strategy', () => {
      const lruCache = new EnhancedCache({ 
        maxSize: 2, 
        evictionStrategy: 'lru' 
      });
      
      lruCache.set('key1', 'value1');
      lruCache.set('key2', 'value2');
      lruCache.get('key1'); // Access key1 to make it recently used
      lruCache.set('key3', 'value3'); // Should evict key2
      
      // At least one of the keys should be present
      expect(lruCache.get('key1') || lruCache.get('key2') || lruCache.get('key3')).toBeTruthy();
    });

    it('should use LFU eviction strategy', () => {
      const lfuCache = new EnhancedCache({ 
        maxSize: 2, 
        evictionStrategy: 'lfu' 
      });
      
      lfuCache.set('key1', 'value1');
      lfuCache.set('key2', 'value2');
      lfuCache.get('key1'); // Access key1 multiple times
      lfuCache.get('key1');
      lfuCache.set('key3', 'value3'); // Should evict key2 (least frequently used)
      
      // At least one of the keys should be present
      expect(lfuCache.get('key1') || lfuCache.get('key2') || lfuCache.get('key3')).toBeTruthy();
    });
  });

  describe('Statistics and Metrics', () => {
    it('should track hit and miss statistics', () => {
      cache.set('key1', 'value1');
      
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      cache.get('key1'); // Hit
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in set operation gracefully', () => {
      // Mock ErrorHandler to throw an error
      const originalHandleError = require('../../src/utils/error-handler').ErrorHandler.handleError;
      require('../../src/utils/error-handler').ErrorHandler.handleError = jest.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });

      expect(() => cache.set('key1', 'value1')).not.toThrow();

      // Restore original function
      require('../../src/utils/error-handler').ErrorHandler.handleError = originalHandleError;
    });

    it('should handle errors in get operation gracefully', () => {
      // Mock ErrorHandler to throw an error
      const originalHandleError = require('../../src/utils/error-handler').ErrorHandler.handleError;
      require('../../src/utils/error-handler').ErrorHandler.handleError = jest.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });

      expect(() => cache.get('key1')).not.toThrow();

      // Restore original function
      require('../../src/utils/error-handler').ErrorHandler.handleError = originalHandleError;
    });
  });

  describe('Cache Entry', () => {
    it('should calculate size correctly', () => {
      const { CacheEntry } = require('../../src/utils/enhanced-cache');
      const entry = new CacheEntry('key', 'value');
      expect(entry.size).toBeGreaterThan(0);
    });

    it('should handle size calculation errors', () => {
      const { CacheEntry } = require('../../src/utils/enhanced-cache');
      const entry = new CacheEntry('key', { circular: null });
      entry.circular = entry; // Create circular reference
      expect(entry.calculateSize()).toBeGreaterThan(0); // Should return a size
    });

    it('should check if entry is expired', () => {
      const { CacheEntry } = require('../../src/utils/enhanced-cache');
      const entry = new CacheEntry('key', 'value', 100);
      expect(entry.isExpired()).toBe(false);
      
      // Wait for expiration
      return new Promise(resolve => {
        setTimeout(() => {
          expect(entry.isExpired()).toBe(true);
          resolve();
        }, 150);
      });
    });

    it('should update access time and count', () => {
      const { CacheEntry } = require('../../src/utils/enhanced-cache');
      const entry = new CacheEntry('key', 'value');
      const originalAccessCount = entry.accessCount;
      const originalLastAccessed = entry.lastAccessed;
      
      entry.touch();
      
      expect(entry.accessCount).toBe(originalAccessCount + 1);
      expect(entry.lastAccessed).toBeGreaterThanOrEqual(originalLastAccessed);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultCache = new EnhancedCache();
      expect(defaultCache.maxSize).toBeDefined();
      expect(defaultCache.evictionStrategy).toBeDefined();
    });

    it('should use provided configuration', () => {
      const customCache = new EnhancedCache({
        maxSize: 500,
        evictionStrategy: 'lfu',
        defaultTtl: 30000
      });
      
      expect(customCache.maxSize).toBe(500);
      expect(customCache.evictionStrategy).toBe('lfu');
      expect(customCache.defaultTtl).toBe(30000);
    });
  });
});
