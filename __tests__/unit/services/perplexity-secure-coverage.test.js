/**
 * Perplexity Secure Service - Additional Private Methods
 * Tests for private methods to improve coverage for QLTY compliance
 */

// Mock config BEFORE importing PerplexityService
jest.mock('../../../src/config/config', () => ({
  PERPLEXITY_API_KEY: 'test-key',
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai',
    },
  },
  FILE_PERMISSIONS: {
    FILE: 0o644,
    DIRECTORY: 0o755,
  },
  CACHE: {
    MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
    CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

const fs = require('fs').promises;

// Mock cache pruner lazy loader
const mockCachePruner = {
  pruneCache: jest.fn().mockResolvedValue(undefined),
};
const mockGetCachePruner = jest.fn().mockReturnValue(mockCachePruner);

// Mock the cache-pruner module directly
jest.mock('../../../src/utils/cache-pruner', () => mockCachePruner);

// Mock the lazy-loader to control getCachePruner behavior
jest.mock('../../../src/utils/lazy-loader', () => ({
  lazyLoadModule: jest.fn((modulePath) => {
    if (modulePath === '../utils/cache-pruner') {
      return mockGetCachePruner;
    }
    // For other modules, return a function that returns the actual module
    return () => require(modulePath);
  }),
}));

const PerplexityService = require('../../../src/services/perplexity-secure');

// Modify config directly for testing
const config = require('../../../src/config/config');
config.CACHE.MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

jest.mock('undici', () => ({
  request: jest.fn(),
}));

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    chmod: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('No access')),
    stat: jest.fn().mockResolvedValue({
      isDirectory: jest.fn().mockReturnValue(true),
    }),
  },
}));

jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash-123'),
  }),
}));

// Mock database service for performance tracking tests
const mockDatabaseService = {
  logPerformanceMetric: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../../src/services/database', () => mockDatabaseService);

describe('PerplexitySecure Service - Additional Private Methods', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    perplexityService = PerplexityService;

    // Default mock implementations
    fs.readFile.mockRejectedValue(new Error('File not found'));
  });

  describe('_setupCacheCleanup method', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should set up cache cleanup interval when not in test environment', () => {
      process.env.NODE_ENV = 'production';

      // Mock setInterval
      const mockInterval = 'mock-interval-id';
      jest.spyOn(global, 'setInterval').mockReturnValue(mockInterval);

      perplexityService._setupCacheCleanup();

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
      expect(perplexityService.activeIntervals.has(mockInterval)).toBe(true);

      // Cleanup
      global.setInterval.mockRestore();
    });

    it('should not set up cache cleanup interval in test environment', () => {
      process.env.NODE_ENV = 'test';

      const mockSetInterval = jest.spyOn(global, 'setInterval');

      perplexityService._setupCacheCleanup();

      expect(mockSetInterval).not.toHaveBeenCalled();

      // Cleanup
      mockSetInterval.mockRestore();
    });
  });

  describe('shutdown method', () => {
    it('should clear all active intervals and log final stats', () => {
      // Mock active intervals
      const mockInterval1 = 'interval-1';
      const mockInterval2 = 'interval-2';
      perplexityService.activeIntervals.add(mockInterval1);
      perplexityService.activeIntervals.add(mockInterval2);

      // Mock clearInterval
      const mockClearInterval = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});

      // Mock getCacheStats to return stats
      const mockStats = { hits: 10, misses: 5 };
      jest.spyOn(perplexityService, 'getCacheStats').mockReturnValue(mockStats);

      perplexityService.shutdown();

      expect(mockClearInterval).toHaveBeenCalledWith(mockInterval1);
      expect(mockClearInterval).toHaveBeenCalledWith(mockInterval2);
      expect(perplexityService.activeIntervals.size).toBe(0);

      // Cleanup
      mockClearInterval.mockRestore();
    });
  });

  describe('Performance tracking methods', () => {
    beforeEach(() => {
      mockDatabaseService.logPerformanceMetric.mockClear();
    });

    describe('_trackApiPerformance method', () => {
      it('should log performance metric successfully', async () => {
        await perplexityService._trackApiPerformance('test_metric', 100, { key: 'value' });

        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledWith('test_metric', 100, {
          key: 'value',
        });
      });

      it('should handle database errors gracefully', async () => {
        mockDatabaseService.logPerformanceMetric.mockRejectedValue(new Error('DB error'));

        // Should not throw
        await expect(
          perplexityService._trackApiPerformance('test_metric', 100)
        ).resolves.not.toThrow();
      });
    });

    describe('_trackCacheHitPerformance method', () => {
      it('should track cache hit performance metrics', async () => {
        await perplexityService._trackCacheHitPerformance(150, 1024, 5, true);

        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledTimes(2);
        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledWith(
          'api_cache_hit_time',
          150,
          {
            historyLength: 5,
            cacheEnabled: true,
            operation: 'cache_hit',
          }
        );
        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledWith(
          'memory_usage_delta',
          1024,
          {
            operation: 'cache_hit',
          }
        );
      });
    });

    describe('_trackApiCallPerformance method', () => {
      it('should track API call performance metrics', async () => {
        await perplexityService._trackApiCallPerformance(200, 2048, 1048576, 3, false, 150);

        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledTimes(3);
        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledWith(
          'api_response_time',
          200,
          {
            historyLength: 3,
            cacheEnabled: false,
            cacheHit: false,
            contentLength: 150,
            operation: 'api_call',
          }
        );
        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledWith(
          'memory_usage_delta',
          2048,
          {
            operation: 'api_call',
          }
        );
        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledWith(
          'memory_usage_current',
          1048576,
          {
            operation: 'api_call_end',
          }
        );
      });
    });

    describe('_trackApiErrorPerformance method', () => {
      it('should track API error performance metrics', async () => {
        await perplexityService._trackApiErrorPerformance(50, 512, 2, 'Network timeout');

        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledTimes(2);
        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledWith(
          'api_error_time',
          50,
          {
            historyLength: 2,
            error: 'Network timeout',
            operation: 'api_error',
          }
        );
        expect(mockDatabaseService.logPerformanceMetric).toHaveBeenCalledWith(
          'memory_usage_delta',
          512,
          {
            operation: 'api_error',
          }
        );
      });
    });
  });

  describe('_cleanupCache method', () => {
    beforeEach(() => {
      mockGetCachePruner.mockClear();
    });

    it('should use cache pruner when available', async () => {
      mockGetCachePruner.mockReturnValue(mockCachePruner);

      await perplexityService._cleanupCache();

      expect(mockCachePruner.pruneCache).toHaveBeenCalled();
    });

    it('should fall back to manual cache cleanup when pruner is not available', async () => {
      // Temporarily mock cache-pruner to return undefined
      jest.doMock('../../../src/utils/cache-pruner', () => undefined);

      // Force re-require of the service to pick up the new mock
      jest.resetModules();
      const FreshPerplexityService = require('../../../src/services/perplexity-secure');

      // Mock _loadCache to return cache with old entries
      const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000; // Definitely older than any MAX_AGE_MS
      const recentTime = Date.now() - 1000; // Recent
      const mockCache = {
        key1: { content: 'content1', timestamp: oneYearAgo }, // Old - should be removed
        key2: { content: 'content2', timestamp: recentTime }, // Recent - should be kept
      };

      // Mock the methods directly
      const loadCacheMock = jest
        .spyOn(FreshPerplexityService, '_loadCache')
        .mockResolvedValue(mockCache);
      const saveCacheMock = jest
        .spyOn(FreshPerplexityService, '_saveCache')
        .mockResolvedValue(undefined);

      await FreshPerplexityService._cleanupCache();

      // Verify _loadCache was called
      expect(loadCacheMock).toHaveBeenCalled();

      // Verify _saveCache was called with the modified cache
      expect(saveCacheMock).toHaveBeenCalledWith({
        key2: { content: 'content2', timestamp: expect.any(Number) },
      });
    });

    it('should handle cache loading errors gracefully', async () => {
      mockGetCachePruner.mockReturnValue(undefined);
      jest.spyOn(perplexityService, '_loadCache').mockRejectedValue(new Error('Load error'));

      // Should not throw
      await expect(perplexityService._cleanupCache()).resolves.not.toThrow();
    });

    it('should handle empty cache gracefully', async () => {
      mockGetCachePruner.mockReturnValue(undefined);
      jest.spyOn(perplexityService, '_loadCache').mockResolvedValue(null);
      const saveCacheSpy = jest.spyOn(perplexityService, '_saveCache').mockResolvedValue(undefined);

      await perplexityService._cleanupCache();

      // Should not call _saveCache for empty cache
      expect(saveCacheSpy).not.toHaveBeenCalled();
    });
  });
});
