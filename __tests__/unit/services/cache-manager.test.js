/**
 * CacheManager Service Tests
 * Comprehensive coverage for cache-manager.js (64.2% -> target 85%+)
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
jest.mock('../../../src/utils/cache-stats-helper', () => ({
  getCacheStatsErrorResponse: jest.fn().mockReturnValue({ error: 'Cache error' }),
}));

const { CacheManager } = require('../../../src/services/cache-manager');
const config = require('../../../src/config/config');
const logger = require('../../../src/utils/logger');
const { ErrorHandler } = require('../../../src/utils/error-handler');
const { getCacheStatsErrorResponse } = require('../../../src/utils/cache-stats-helper');

describe('CacheManager', () => {
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

  describe('constructor', () => {
    it('should create cache instance with correct properties', () => {
      // Verify the cache manager has the expected properties
      expect(cacheManager.cache).toBeDefined();
      expect(cacheManager.cacheCleanupInterval).toBeNull(); // null in test env
    });

    it('should initialize cacheCleanupInterval as null in test environment', () => {
      // In test environment, setupCacheCleanup returns early
      expect(cacheManager.cacheCleanupInterval).toBeNull();
    });
  });

  describe('getCacheConfiguration', () => {
    it('should return default config when PI_OPTIMIZATIONS is disabled', () => {
      const result = cacheManager.getCacheConfiguration();
      expect(result).toEqual({
        enabled: false,
        maxEntries: config.CACHE.DEFAULT_MAX_ENTRIES,
      });
    });

    it('should return PI_OPTIMIZATIONS config when enabled', () => {
      config.PI_OPTIMIZATIONS.ENABLED = true;
      config.PI_OPTIMIZATIONS.CACHE_ENABLED = true;
      config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES = 200;

      const result = cacheManager.getCacheConfiguration();
      expect(result).toEqual({
        enabled: true,
        maxEntries: 200,
      });

      // Reset
      config.PI_OPTIMIZATIONS.ENABLED = false;
    });

    it('should handle invalid CACHE_MAX_ENTRIES gracefully', () => {
      config.PI_OPTIMIZATIONS.ENABLED = true;
      config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES = 'invalid';

      const result = cacheManager.getCacheConfiguration();
      expect(result.maxEntries).toBe(config.CACHE.DEFAULT_MAX_ENTRIES);

      // Reset
      config.PI_OPTIMIZATIONS.ENABLED = false;
    });

    it('should handle config access errors gracefully', () => {
      const originalConfig = config.PI_OPTIMIZATIONS;
      Object.defineProperty(config, 'PI_OPTIMIZATIONS', {
        get: () => {
          throw new Error('Config access error');
        },
        configurable: true,
      });

      const result = cacheManager.getCacheConfiguration();
      expect(result).toEqual({
        enabled: false,
        maxEntries: config.CACHE.DEFAULT_MAX_ENTRIES,
      });
      expect(ErrorHandler.handleError).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();

      // Restore
      Object.defineProperty(config, 'PI_OPTIMIZATIONS', {
        value: originalConfig,
        configurable: true,
        writable: true,
      });
    });
  });

  describe('shouldUseCache', () => {
    it('should return true when caching is enabled and not disabled in options', () => {
      const result = cacheManager.shouldUseCache({}, { enabled: true });
      expect(result).toBe(true);
    });

    it('should return false when caching is disabled in options', () => {
      const result = cacheManager.shouldUseCache({ caching: false }, { enabled: true });
      expect(result).toBe(false);
    });

    it('should return false when cacheConfig is disabled', () => {
      const result = cacheManager.shouldUseCache({}, { enabled: false });
      expect(result).toBe(false);
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent hash for same history', () => {
      const history = [{ role: 'user', content: 'Hello' }];
      const key1 = cacheManager.generateCacheKey(history);
      const key2 = cacheManager.generateCacheKey(history);
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex string
    });

    it('should generate different hashes for different history', () => {
      const history1 = [{ role: 'user', content: 'Hello' }];
      const history2 = [{ role: 'user', content: 'World' }];
      const key1 = cacheManager.generateCacheKey(history1);
      const key2 = cacheManager.generateCacheKey(history2);
      expect(key1).not.toBe(key2);
    });

    it('should return empty string for null/undefined history', () => {
      expect(cacheManager.generateCacheKey(null)).toBe('');
      expect(cacheManager.generateCacheKey(undefined)).toBe('');
    });

    it('should return empty string for non-array history', () => {
      expect(cacheManager.generateCacheKey('not an array')).toBe('');
      expect(cacheManager.generateCacheKey(123)).toBe('');
      expect(cacheManager.generateCacheKey({})).toBe('');
    });
  });

  describe('tryGetFromCache', () => {
    it('should return cached response when found', async () => {
      const history = [{ role: 'user', content: 'Test' }];
      mockEnhancedCache.get.mockReturnValue('cached response');

      const result = await cacheManager.tryGetFromCache(history);
      expect(result).toBe('cached response');
      expect(mockEnhancedCache.get).toHaveBeenCalled();
    });

    it('should return null when not in cache', async () => {
      mockEnhancedCache.get.mockReturnValue(null);

      const result = await cacheManager.tryGetFromCache([{ role: 'user', content: 'Test' }]);
      expect(result).toBeNull();
    });

    it('should return null for invalid history', async () => {
      const result = await cacheManager.tryGetFromCache(null);
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockEnhancedCache.get.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const result = await cacheManager.tryGetFromCache([{ role: 'user', content: 'Test' }]);
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('trySaveToCache', () => {
    it('should save content to cache', async () => {
      const history = [{ role: 'user', content: 'Test' }];
      const content = 'Response content';

      await cacheManager.trySaveToCache(history, content, 100);
      expect(mockEnhancedCache.set).toHaveBeenCalled();
    });

    it('should not save when history generates empty key', async () => {
      await cacheManager.trySaveToCache(null, 'content', 100);
      expect(mockEnhancedCache.set).not.toHaveBeenCalled();
    });

    it('should not save when content is empty', async () => {
      await cacheManager.trySaveToCache([{ role: 'user', content: 'Test' }], '', 100);
      expect(mockEnhancedCache.set).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockEnhancedCache.set.mockImplementation(() => {
        throw new Error('Save error');
      });

      await cacheManager.trySaveToCache([{ role: 'user', content: 'Test' }], 'content', 100);
      expect(logger.warn).toHaveBeenCalled();
    });
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
      // Mock successful cache pruner
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
      // The mock doesn't provide CachePruner, so it should return null
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
      expect(getCacheStatsErrorResponse).toHaveBeenCalled();
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
