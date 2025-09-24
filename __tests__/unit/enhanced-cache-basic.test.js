/**
 * Enhanced Cache Basic Operations Tests
 * Tests for basic cache operations (set, get, delete, clear)
 */
const { EnhancedCache } = require('../../src/utils/enhanced-cache');

describe('EnhancedCache - Basic Operations', () => {
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
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('should handle different value types', () => {
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('boolean', true);
      cache.set('object', { key: 'value' });
      cache.set('array', [1, 2, 3]);

      expect(cache.get('string')).toBe('hello');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('boolean')).toBe(true);
      expect(cache.get('object')).toEqual({ key: 'value' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
    });

    it('should update existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });
});
