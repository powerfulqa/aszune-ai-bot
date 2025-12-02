/**
 * CacheManager Service Tests - File Operations & Stats
 * Tests for cache cleanup, file I/O, statistics, and lifecycle management
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Mock fs.promises before any imports
const mockFsPromises = {
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{}'),
  writeFile: jest.fn().mockResolvedValue(undefined),
};

jest.mock('fs', () => ({
  promises: mockFsPromises,
}));

// Mock enhanced-cache
const mockCacheStats = {
  hits: 10,
  misses: 5,
  hitRate: 0.67,
  totalEntries: 15,
  memoryUsage: 1024,
};

const mockEnhancedCache = {
  get: jest.fn(),
  set: jest.fn(),
  getStats: jest.fn().mockReturnValue(mockCacheStats),
  getDetailedInfo: jest.fn().mockReturnValue({ stats: mockCacheStats, entries: [] }),
  invalidateByTag: jest.fn().mockReturnValue(3),
  evictOldest: jest.fn(),
};

jest.mock('../../../src/utils/enhanced-cache', () => ({
  EnhancedCache: jest.fn().mockImplementation(() => mockEnhancedCache),
  EVICTION_STRATEGIES: {
    HYBRID: 'hybrid',
    LRU: 'lru',
    LFU: 'lfu',
  },
}));

// Mock config
jest.mock('../../../src/config/config', () => ({
  CACHE: {
    DEFAULT_MAX_ENTRIES: 100,
    MAX_MEMORY_MB: 50,
    DEFAULT_TTL_MS: 3600000,
    CLEANUP_INTERVAL_MS: 86400000,
  },
  PI_OPTIMIZATIONS: {
    ENABLED: false,
    CACHE_ENABLED: false,
    CACHE_MAX_ENTRIES: 50,
  },
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock error handler
jest.mock('../../../src/utils/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn().mockReturnValue({ message: 'Mock error' }),
  },
}));

// Mock cache-stats-helper
const mockGetCacheStatsErrorResponse = jest.fn().mockReturnValue({ error: 'Cache error' });
jest.mock('../../../src/utils/cache-stats-helper', () => ({
  getCacheStatsErrorResponse: mockGetCacheStatsErrorResponse,
}));

const { CacheManager } = require('../../../src/services/cache-manager');
const logger = require('../../../src/utils/logger');

describe('CacheManager - File Operations & Stats', () => {
  let cacheManager;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    if (cacheManager) {
      cacheManager.shutdown();
    }
  });

  describe('ensureCacheSize', () => {
    it('should evict entries when cache is full', async () => {
      mockEnhancedCache.getStats.mockReturnValue({ totalEntries: 100 });

      await cacheManager.ensureCacheSize(100);
      // Should evict 10% = 10 entries
      expect(mockEnhancedCache.evictOldest).toHaveBeenCalledTimes(10);
    });

    it('should not evict when cache is below limit', async () => {
      mockEnhancedCache.getStats.mockReturnValue({ totalEntries: 50 });

      await cacheManager.ensureCacheSize(100);
      expect(mockEnhancedCache.evictOldest).not.toHaveBeenCalled();
    });
  });

  describe('cleanupCache', () => {
    it('should call cache pruner when available', async () => {
      const mockPruner = { pruneCache: jest.fn().mockResolvedValue(undefined) };
      cacheManager.getCachePruner = jest.fn().mockResolvedValue(mockPruner);

      await cacheManager.cleanupCache();
      expect(mockPruner.pruneCache).toHaveBeenCalled();
    });

    it('should handle missing cache pruner gracefully', async () => {
      cacheManager.getCachePruner = jest.fn().mockResolvedValue(null);

      await expect(cacheManager.cleanupCache()).resolves.not.toThrow();
    });

    it('should handle cleanup errors gracefully', async () => {
      cacheManager.getCachePruner = jest.fn().mockRejectedValue(new Error('Cleanup failed'));

      await cacheManager.cleanupCache();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('getCachePruner', () => {
    it('should return null when cache-pruner module is not available', async () => {
      const result = await cacheManager.getCachePruner();
      expect(result).toBeNull();
    });
  });

  describe('loadCache', () => {
    it('should load cache from file', async () => {
      mockFsPromises.readFile.mockResolvedValue('{"key": "value"}');

      const result = await cacheManager.loadCache();
      expect(result).toEqual({ key: 'value' });
      expect(mockFsPromises.mkdir).toHaveBeenCalled();
    });

    it('should return empty object when file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockFsPromises.readFile.mockRejectedValue(error);

      const result = await cacheManager.loadCache();
      expect(result).toEqual({});
    });

    it('should handle other read errors gracefully', async () => {
      mockFsPromises.readFile.mockRejectedValue(new Error('Read error'));

      const result = await cacheManager.loadCache();
      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('saveCache', () => {
    it('should save cache to file with secure permissions', async () => {
      const cache = { key: 'value' };

      await cacheManager.saveCache(cache);
      expect(mockFsPromises.mkdir).toHaveBeenCalled();
      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('question_cache.json'),
        JSON.stringify(cache, null, 2),
        { mode: 0o600 }
      );
    });

    it('should handle save errors gracefully', async () => {
      mockFsPromises.writeFile.mockRejectedValue(new Error('Write error'));

      await cacheManager.saveCache({ key: 'value' });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      mockEnhancedCache.getStats.mockReturnValue(mockCacheStats);

      const result = cacheManager.getStats();
      expect(result).toEqual(mockCacheStats);
    });

    it('should handle errors and return error response', () => {
      mockEnhancedCache.getStats.mockImplementation(() => {
        throw new Error('Stats error');
      });

      cacheManager.getStats();
      expect(mockGetCacheStatsErrorResponse).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getDetailedInfo', () => {
    it('should return detailed cache information', () => {
      const detailedInfo = { stats: mockCacheStats, entries: ['entry1', 'entry2'] };
      mockEnhancedCache.getDetailedInfo.mockReturnValue(detailedInfo);

      const result = cacheManager.getDetailedInfo();
      expect(result).toEqual(detailedInfo);
    });

    it('should handle errors and return error object', () => {
      mockEnhancedCache.getDetailedInfo.mockImplementation(() => {
        throw new Error('Detailed info error');
      });

      const result = cacheManager.getDetailedInfo();
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('entries');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('invalidateByTag', () => {
    it('should invalidate cache entries by tag', () => {
      mockEnhancedCache.invalidateByTag.mockReturnValue(5);

      const result = cacheManager.invalidateByTag('test-tag');
      expect(result).toBe(5);
      expect(mockEnhancedCache.invalidateByTag).toHaveBeenCalledWith('test-tag');
    });

    it('should handle errors and return 0', () => {
      mockEnhancedCache.invalidateByTag.mockImplementation(() => {
        throw new Error('Invalidation error');
      });

      const result = cacheManager.invalidateByTag('test-tag');
      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should clear cleanup interval when set', () => {
      cacheManager.cacheCleanupInterval = setInterval(() => {}, 1000);

      cacheManager.shutdown();
      expect(cacheManager.cacheCleanupInterval).toBeNull();
    });

    it('should handle shutdown when interval is null', () => {
      cacheManager.cacheCleanupInterval = null;
      expect(() => cacheManager.shutdown()).not.toThrow();
    });
  });
});
