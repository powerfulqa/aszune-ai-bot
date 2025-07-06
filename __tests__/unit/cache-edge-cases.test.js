/**
 * Tests for edge cases in cache service
 */
const { CacheService } = require('../../src/services/cache');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs', () => ({
  accessSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  renameSync: jest.fn(),
  promises: {
    access: jest.fn(),
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{}'),
    copyFile: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    rename: jest.fn().mockResolvedValue(undefined)
  }
}));
jest.mock('path');

let cacheService;

describe('Cache Service Edge Cases', () => {
  const mockCachePath = '/mock/path/question_cache.json';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    cacheService = new CacheService();
    // Reset the service state
    // cacheService.cache = {}; // This is handled by the constructor
    // cacheService.initialized = false; // This is handled by the constructor
    
    // Mock path.join to return our mock cache path
    path.join.mockReturnValue(mockCachePath);
    
    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue('/mock/path');
    
    // Default mock for fs.accessSync (success)
    fs.accessSync.mockImplementation(() => {});
    
    // Default mock for fs.readFileSync
    fs.readFileSync.mockReturnValue(JSON.stringify({
      'abcd1234': {
        questionHash: 'abcd1234',
        question: 'What is the meaning of life?',
        answer: '42',
        timestamp: Date.now() - 1000, // 1 second ago
        accessCount: 1,
        lastAccessed: Date.now() - 1000
      }
    }));
  });
  
  describe('Memory Cache', () => {
    it('uses memory cache for subsequent lookups', () => {
      cacheService.initSync();
      cacheService.generateHash = jest.fn().mockReturnValue('memtest');
      
      // Add to cache
      cacheService.addToCache('Memory test', 'Memory answer');
      
      // First lookup should hit the main cache
      const result1 = cacheService.findInCache('Memory test');
      expect(result1).toBeTruthy();
      expect(result1.answer).toBe('Memory answer');
      
      // Second lookup should hit memory cache
      const result2 = cacheService.findInCache('Memory test');
      expect(result2).toBeTruthy();
      expect(result2.answer).toBe('Memory answer');
      
      // Verify memoryCache.get was called for the second lookup
      // This is hard to test directly since it's an internal implementation detail
      // But we can verify the metrics show a memory hit
      expect(cacheService.metrics.memoryHits).toBe(1);
    });
  });

  describe('saveIfDirtyAsync', () => {
    it('saves the cache if it is dirty', async () => {
      cacheService.initSync();
      cacheService.isDirty = true;
      
      await cacheService.saveIfDirtyAsync();
      
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(cacheService.isDirty).toBe(false);
    });
    
    it('does not save the cache if it is not dirty', async () => {
      cacheService.initSync();
      cacheService.isDirty = false;
      
      await cacheService.saveIfDirtyAsync();
      
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
      expect(cacheService.isDirty).toBe(false);
    });
  });
  
  describe('saveIfDirty', () => {
    it('saves the cache if it is dirty', () => {
      cacheService.initSync();
      cacheService.isDirty = true;
      
      cacheService.saveIfDirty();
      
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(cacheService.isDirty).toBe(false);
    });
    
    it('does not save the cache if it is not dirty', () => {
      // First, clear any previous calls to writeFileSync
      fs.writeFileSync.mockClear();
      
      // Mock the implementation of saveCache to do nothing
      jest.spyOn(cacheService, 'saveCache').mockImplementation(() => {});
      
      cacheService.initSync();
      cacheService.isDirty = false;
      
      cacheService.saveIfDirty();
      
      // Now we're checking that saveCache wasn't called
      expect(cacheService.saveCache).not.toHaveBeenCalled();
      expect(cacheService.isDirty).toBe(false);
    });
  });
  
  describe('getHitRateStats', () => {
    it('returns correct hit rate statistics', () => {
      cacheService.initSync();
      
      // Setup metrics
      cacheService.metrics.hits = 75;
      cacheService.metrics.misses = 25;
      cacheService.metrics.exactMatches = 50;
      cacheService.metrics.similarityMatches = 25;
      cacheService.metrics.errors = 5;
      cacheService.metrics.lastReset = Date.now() - 86400000; // 1 day ago
      
      const stats = cacheService.getHitRateStats();
      
      expect(stats.totalLookups).toBe(100);
      expect(stats.hitRate).toBe(0.75);
      expect(stats.exactMatchRate).toBe(2/3);
      expect(stats.uptimeDays).toBeDefined();
      expect(parseFloat(stats.uptimeDays)).toBeCloseTo(1.0, 1); // About 1 day with some precision
    });
  });
  
  describe('resetMetrics', () => {
    it('resets all metrics to zero', () => {
      cacheService.initSync();
      
      // Setup metrics
      cacheService.metrics.hits = 10;
      cacheService.metrics.misses = 10;
      
      cacheService.resetMetrics();
      
      expect(cacheService.metrics.hits).toBe(0);
      expect(cacheService.metrics.misses).toBe(0);
      expect(cacheService.metrics.exactMatches).toBe(0);
      expect(cacheService.metrics.similarityMatches).toBe(0);
      expect(cacheService.metrics.errors).toBe(0);
      expect(cacheService.metrics.lastReset).toBeLessThanOrEqual(Date.now());
    });
  });
  
  describe('maintain', () => {
    it('calls saveIfDirty when maintenance runs', () => {
      cacheService.initSync();
      cacheService.saveIfDirty = jest.fn();
      cacheService.evictLRU = jest.fn();
      
      cacheService.maintain();
      
      expect(cacheService.saveIfDirty).toHaveBeenCalled();
    });
    
    it('evicts LRU entries when cache exceeds threshold', () => {
      cacheService.initSync();
      cacheService.saveIfDirty = jest.fn();
      cacheService.evictLRU = jest.fn();
      
      // Create mock cache that exceeds threshold
      const mockCache = {};
      for (let i = 0; i < 10000; i++) {
        mockCache[`key${i}`] = { foo: 'bar' };
      }
      cacheService.cache = mockCache;
      
      cacheService.maintain();
      
      expect(cacheService.evictLRU).toHaveBeenCalled();
    });
  });
});
