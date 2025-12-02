/**
 * CacheManager Service Tests - Core Operations
 * Tests for constructor, configuration, cache key generation, and basic cache operations
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

describe('CacheManager - Core Operations', () => {
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
      expect(cacheManager.cache).toBeDefined();
      expect(cacheManager.cacheCleanupInterval).toBeNull();
    });

    it('should initialize cacheCleanupInterval as null in test environment', () => {
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

      config.PI_OPTIMIZATIONS.ENABLED = false;
    });

    it('should handle invalid CACHE_MAX_ENTRIES gracefully', () => {
      config.PI_OPTIMIZATIONS.ENABLED = true;
      config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES = 'invalid';

      const result = cacheManager.getCacheConfiguration();
      expect(result.maxEntries).toBe(config.CACHE.DEFAULT_MAX_ENTRIES);

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
      expect(key1).toHaveLength(64);
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
});
