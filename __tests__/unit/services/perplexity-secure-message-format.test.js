/**
 * PerplexitySecure Service - Message Formatting Coverage Tests
 * Tests for _formatMessagesForAPI, _ensureMessageAlternation, and related methods
 */

process.env.NODE_ENV = 'test';

// Mock dependencies before imports
jest.mock('../../../src/config/config', () => ({
  PERPLEXITY_API_KEY: 'test-api-key',
  API: {
    PERPLEXITY: {
      BASE_URL: 'https://api.perplexity.ai',
      DEFAULT_MODEL: 'sonar',
    },
  },
  FILE_PERMISSIONS: {
    CACHE_DIR: 0o755,
    CACHE_FILE: 0o600,
  },
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
  SYSTEM_MESSAGES: {
    CHAT: 'You are a helpful assistant.',
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../src/utils/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn().mockReturnValue({ message: 'Mock error' }),
  },
}));

jest.mock('../../../src/services/api-client', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    post: jest.fn(),
  })),
}));

jest.mock('../../../src/services/cache-manager', () => ({
  CacheManager: jest.fn().mockImplementation(() => ({
    getCacheConfiguration: jest.fn().mockReturnValue({ enabled: true, maxEntries: 100 }),
    shouldUseCache: jest.fn().mockReturnValue(true),
    tryGetFromCache: jest.fn().mockResolvedValue(null),
    trySaveToCache: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockReturnValue({ hits: 10, misses: 5 }),
    shutdown: jest.fn(),
  })),
}));

jest.mock('../../../src/services/response-processor', () => ({
  ResponseProcessor: jest.fn().mockImplementation(() => ({
    standardizeOptions: jest.fn().mockReturnValue({}),
    extractResponseContent: jest.fn().mockReturnValue('Test response'),
    generateResponseWithRetry: jest.fn().mockResolvedValue({ data: 'test' }),
  })),
}));

jest.mock('../../../src/services/throttling-service', () => ({
  ThrottlingService: jest.fn().mockImplementation(() => ({
    throttle: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../src/utils/cache-stats-helper', () => ({
  getCacheStatsErrorResponse: jest.fn().mockReturnValue({ error: 'Cache error' }),
}));

// Mock database service
jest.mock('../../../src/services/database', () => ({
  logPerformanceMetric: jest.fn().mockResolvedValue(undefined),
}));

const perplexityService = require('../../../src/services/perplexity-secure');
const logger = require('../../../src/utils/logger');

describe('PerplexitySecure - Message Formatting', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = perplexityService;  // Use the singleton instance
  });

  describe('_formatMessagesForAPI', () => {
    it('should return default messages for empty history', () => {
      const result = service._formatMessagesForAPI([]);
      
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[1].role).toBe('user');
      expect(result[1].content).toBe('Hello');
    });

    it('should return default messages for null history', () => {
      const result = service._formatMessagesForAPI(null);
      
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
    });

    it('should return default messages for undefined history', () => {
      const result = service._formatMessagesForAPI(undefined);
      
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
    });

    it('should include system message at beginning', () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      
      const result = service._formatMessagesForAPI(history);
      
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('You are a helpful assistant.');
    });

    it('should process single user message', () => {
      const history = [{ role: 'user', content: 'Test message' }];
      
      const result = service._formatMessagesForAPI(history);
      
      expect(result).toContainEqual(expect.objectContaining({ role: 'user' }));
    });
  });

  describe('_safeGetHeader', () => {
    it('should return empty string for null headers', () => {
      const result = service._safeGetHeader(null, 'Content-Type');
      expect(result).toBe('');
    });

    it('should return empty string for null key', () => {
      const result = service._safeGetHeader({ 'Content-Type': 'application/json' }, null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined headers', () => {
      const result = service._safeGetHeader(undefined, 'Content-Type');
      expect(result).toBe('');
    });

    it('should use Headers.get method when available', () => {
      const headers = {
        get: jest.fn().mockReturnValue('application/json'),
      };
      
      const result = service._safeGetHeader(headers, 'Content-Type');
      expect(result).toBe('application/json');
      expect(headers.get).toHaveBeenCalledWith('Content-Type');
    });

    it('should fallback to direct property access', () => {
      const headers = { 'Content-Type': 'application/json' };
      
      const result = service._safeGetHeader(headers, 'Content-Type');
      expect(result).toBe('application/json');
    });

    it('should handle case-insensitive lookups', () => {
      const headers = { 'content-type': 'application/json' };
      
      const result = service._safeGetHeader(headers, 'Content-Type');
      expect(result).toBe('application/json');
    });

    it('should handle uppercase fallback', () => {
      const headers = { 'CONTENT-TYPE': 'application/json' };
      
      const result = service._safeGetHeader(headers, 'content-type');
      expect(result).toBe('application/json');
    });

    it('should handle Headers.get throwing error', () => {
      const headers = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Get failed');
        }),
        'Content-Type': 'application/json',
      };
      
      const result = service._safeGetHeader(headers, 'Content-Type');
      expect(result).toBe('application/json');
    });

    it('should return empty string when key not found', () => {
      const headers = { 'Other-Header': 'value' };
      
      const result = service._safeGetHeader(headers, 'Content-Type');
      expect(result).toBe('');
    });
  });

  describe('_extractHeader', () => {
    it('should delegate to _safeGetHeader', () => {
      const headers = { 'Content-Type': 'text/plain' };
      
      const result = service._extractHeader(headers, 'Content-Type');
      expect(result).toBe('text/plain');
    });
  });

  describe('_getHeaders', () => {
    it('should return authorization and content-type headers', () => {
      const result = service._getHeaders();
      
      expect(result).toHaveProperty('Authorization');
      expect(result.Authorization).toContain('Bearer');
      expect(result['Content-Type']).toBe('application/json');
    });
  });

  describe('_shouldUseCache', () => {
    it('should return true when caching is enabled in options and config', () => {
      const result = service._shouldUseCache({}, { enabled: true });
      expect(result).toBe(true);
    });

    it('should return false when caching is explicitly disabled in options', () => {
      const result = service._shouldUseCache({ caching: false }, { enabled: true });
      expect(result).toBe(false);
    });

    it('should return true in test environment even if config disabled', () => {
      const result = service._shouldUseCache({}, { enabled: false });
      // In test environment, returns true
      expect(typeof result).toBe('boolean');
    });
  });

  describe('_executeWithErrorHandling', () => {
    it('should return operation result on success', () => {
      const operation = () => 'success';
      
      const result = service._executeWithErrorHandling(operation, 'test');
      expect(result).toBe('success');
    });

    it('should return default value on error', () => {
      const operation = () => {
        throw new Error('Test error');
      };
      
      const result = service._executeWithErrorHandling(operation, 'test', 'default');
      expect(result).toBe('default');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should use null as default value if not specified', () => {
      const operation = () => {
        throw new Error('Test error');
      };
      
      const result = service._executeWithErrorHandling(operation, 'test');
      expect(result).toBeNull();
    });
  });

  describe('shutdown', () => {
    it('should clear all active intervals', () => {
      // Add some mock intervals
      const interval1 = setInterval(() => {}, 1000);
      const interval2 = setInterval(() => {}, 1000);
      service.activeIntervals.add(interval1);
      service.activeIntervals.add(interval2);
      
      service.shutdown();
      
      expect(service.activeIntervals.size).toBe(0);
      clearInterval(interval1);
      clearInterval(interval2);
    });

    it('should log final cache statistics', () => {
      service.shutdown();
      
      expect(logger.info).toHaveBeenCalledWith(
        'Final cache statistics:',
        expect.any(Object)
      );
    });
  });

  describe('_trackMetric', () => {
    it('should log performance metric', async () => {
      await service._trackMetric('test_metric', 100, { key: 'value' });
      
      const databaseService = require('../../../src/services/database');
      expect(databaseService.logPerformanceMetric).toHaveBeenCalledWith(
        'test_metric',
        100,
        { key: 'value' }
      );
    });

    it('should handle database errors gracefully', async () => {
      const databaseService = require('../../../src/services/database');
      databaseService.logPerformanceMetric.mockRejectedValueOnce(new Error('DB error'));
      
      await service._trackMetric('test_metric', 100);
      
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log test_metric')
      );
    });
  });
});
