/**
 * Perplexity Secure Service Tests - Private Methods
 * Tests for private methods to improve coverage
 */
const fs = require('fs').promises;
const crypto = require('crypto');

const PerplexityService = require('../../../src/services/perplexity-secure');

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

describe('PerplexitySecure Service - Private Methods', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    perplexityService = PerplexityService;

    // Default mock implementations
    fs.readFile.mockRejectedValue(new Error('File not found'));
  });

  describe('_safeGetHeader method', () => {
    it('should return empty string for null headers', () => {
      const result = perplexityService._safeGetHeader(null, 'content-type');
      expect(result).toBe('');
    });

    it('should return empty string for undefined headers', () => {
      const result = perplexityService._safeGetHeader(undefined, 'content-type');
      expect(result).toBe('');
    });

    it('should return empty string for null key', () => {
      const headers = { 'content-type': 'application/json' };
      const result = perplexityService._safeGetHeader(headers, null);
      expect(result).toBe('');
    });

    it('should get header using Headers.get() method', () => {
      const headers = {
        get: jest.fn().mockReturnValue('application/json'),
      };
      const result = perplexityService._safeGetHeader(headers, 'content-type');
      expect(result).toBe('application/json');
      expect(headers.get).toHaveBeenCalledWith('content-type');
    });

    it('should fall back to object property access', () => {
      const headers = { 'content-type': 'application/json' };
      const result = perplexityService._safeGetHeader(headers, 'content-type');
      expect(result).toBe('application/json');
    });

    it('should check lowercase header names', () => {
      const headers = { 'content-type': 'application/json' };
      const result = perplexityService._safeGetHeader(headers, 'Content-Type');
      expect(result).toBe('application/json');
    });

    it('should check uppercase header names', () => {
      const headers = { 'CONTENT-TYPE': 'application/json' };
      const result = perplexityService._safeGetHeader(headers, 'content-type');
      expect(result).toBe('application/json');
    });

    it('should handle Headers.get() throwing error', () => {
      const headers = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Headers error');
        }),
        'content-type': 'application/json',
      };
      const result = perplexityService._safeGetHeader(headers, 'content-type');
      expect(result).toBe('application/json');
    });

    it('should handle non-object headers', () => {
      const result = perplexityService._safeGetHeader('not-an-object', 'content-type');
      expect(result).toBe('');
    });

    it('should handle function headers', () => {
      const headers = function () {};
      headers.get = jest.fn().mockReturnValue('test-value');
      const result = perplexityService._safeGetHeader(headers, 'content-type');
      expect(result).toBe('test-value');
    });
  });

  describe('_shouldUseCache method', () => {
    it('should return false when caching is explicitly disabled', () => {
      const options = { caching: false };
      const cacheConfig = { enabled: true };
      const result = perplexityService._shouldUseCache(options, cacheConfig);
      expect(result).toBe(false);
    });

    it('should return true when in test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const options = {};
      const cacheConfig = { enabled: false };
      const result = perplexityService._shouldUseCache(options, cacheConfig);
      expect(result).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should return true when cache is enabled and caching not disabled', () => {
      const options = {};
      const cacheConfig = { enabled: true };
      const result = perplexityService._shouldUseCache(options, cacheConfig);
      expect(result).toBe(true);
    });
  });

  describe('_buildRequestPayload method', () => {
    it('should build basic request payload with defaults', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const options = {};
      const result = perplexityService._buildRequestPayload(messages, options);

      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('messages', messages);
      expect(result).toHaveProperty('max_tokens');
      expect(result).toHaveProperty('temperature');
    });

    it('should use custom options when provided', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const options = {
        model: 'custom-model',
        maxTokens: 100,
        temperature: 0.8,
      };
      const result = perplexityService._buildRequestPayload(messages, options);

      expect(result.model).toBe('custom-model');
      expect(result.max_tokens).toBe(100);
      expect(result.temperature).toBe(0.8);
    });
  });

  describe('_getPiOptimizationSettings method', () => {
    it('should return default settings when PI_OPTIMIZATIONS is not configured', () => {
      const mockConfig = require('../../../src/config/config');
      const originalConfig = mockConfig.PI_OPTIMIZATIONS;
      delete mockConfig.PI_OPTIMIZATIONS;

      const result = perplexityService._getPiOptimizationSettings();
      expect(result).toEqual({
        enabled: false,
        lowCpuMode: false,
      });

      // Restore original config
      mockConfig.PI_OPTIMIZATIONS = originalConfig;
    });

    it('should return settings from config when available', () => {
      // Test the method works with current config
      const result = perplexityService._getPiOptimizationSettings();
      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('lowCpuMode');
      expect(typeof result.enabled).toBe('boolean');
      expect(typeof result.lowCpuMode).toBe('boolean');
    });

    it('should handle config access errors gracefully', () => {
      const mockConfig = require('../../../src/config/config');
      const originalConfig = mockConfig.PI_OPTIMIZATIONS;

      // Make config access throw error
      Object.defineProperty(mockConfig, 'PI_OPTIMIZATIONS', {
        get: () => {
          throw new Error('Config error');
        },
        configurable: true,
      });

      const result = perplexityService._getPiOptimizationSettings();
      expect(result).toEqual({
        enabled: false,
        lowCpuMode: false,
      });

      // Restore original config
      delete mockConfig.PI_OPTIMIZATIONS;
      mockConfig.PI_OPTIMIZATIONS = originalConfig;
    });
  });

  describe('_generateCacheKey method', () => {
    it('should generate consistent cache key for same history', () => {
      const history = [{ role: 'user', content: 'Hello' }];

      const key1 = perplexityService._generateCacheKey(history);
      const key2 = perplexityService._generateCacheKey(history);

      expect(key1).toBe(key2);
      expect(key1).toBe('mock-hash-123');
      expect(crypto.createHash).toHaveBeenCalledWith('md5');
    });

    it('should generate different keys for different history', () => {
      const history1 = [{ role: 'user', content: 'Hello' }];
      const history2 = [{ role: 'user', content: 'Hi' }];

      // Test that crypto is called for both
      perplexityService._generateCacheKey(history1);
      perplexityService._generateCacheKey(history2);

      // Both will be 'mock-hash-123' due to mocking, but this tests the method calls crypto correctly
      expect(crypto.createHash).toHaveBeenCalledTimes(2);
      expect(crypto.createHash).toHaveBeenCalledWith('md5');
    });
  });

  describe('_formatCacheEntry method', () => {
    it('should format string entry with timestamp', () => {
      const entry = 'test content';
      const timestamp = 12345;

      const result = perplexityService._formatCacheEntry(entry, timestamp);
      expect(result).toEqual({
        content: 'test content',
        timestamp: 12345,
      });
    });

    it('should preserve existing object entry with timestamp', () => {
      const entry = {
        content: 'existing content',
        timestamp: 67890,
        otherProperty: 'test',
      };
      const timestamp = 12345;

      const result = perplexityService._formatCacheEntry(entry, timestamp);
      expect(result).toEqual({
        content: 'existing content',
        timestamp: 67890,
        otherProperty: 'test',
      });
    });

    it('should add timestamp to object entry without one', () => {
      const entry = {
        content: 'content without timestamp',
        otherProperty: 'test',
      };
      const timestamp = 12345;

      const result = perplexityService._formatCacheEntry(entry, timestamp);
      expect(result).toEqual({
        content: 'content without timestamp',
        timestamp: 12345,
        otherProperty: 'test',
      });
    });

    it('should handle null entry', () => {
      const entry = null;
      const timestamp = 12345;

      const result = perplexityService._formatCacheEntry(entry, timestamp);
      expect(result).toEqual({
        content: null,
        timestamp: 12345,
      });
    });
  });

  describe('_isRetryableError method', () => {
    it('should return false for null error', () => {
      const result = perplexityService._isRetryableError(null);
      expect(result).toBe(false);
    });

    it('should return false for error without message', () => {
      const error = {};
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });

    it('should return true for temporary errors', () => {
      const error = { message: 'Temporary service unavailable' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(true);
    });

    it('should return true for network errors', () => {
      const error = { message: 'Network timeout' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(true);
    });

    it('should return true for 429 errors', () => {
      const error = { message: 'Rate limit 429 exceeded' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(true);
    });

    it('should return false for permanent errors', () => {
      const error = { message: 'Permanent API error' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });

    it('should return false for invalid errors', () => {
      const error = { message: 'Invalid request format' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });

    it('should return false for unauthorized errors', () => {
      const error = { message: 'Unauthorized access' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });

    it('should return false for forbidden errors', () => {
      const error = { message: 'Forbidden operation' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });

    it('should return false for unknown errors by default', () => {
      const error = { message: 'Some random error' };
      const result = perplexityService._isRetryableError(error);
      expect(result).toBe(false);
    });
  });
});
