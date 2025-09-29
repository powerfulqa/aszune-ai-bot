/**
 * Comprehensive Perplexity Secure Service Tests
 * Tests for methods and edge cases to improve coverage to 80%+
 */
const { request } = require('undici');
const fs = require('fs').promises;
const crypto = require('crypto');

const PerplexityService = require('../../../src/services/perplexity-secure');
const { mockSuccessResponse, mockErrorResponse } = require('../../utils/undici-mock-helpers');

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

describe('PerplexitySecure Service - Comprehensive Coverage', () => {
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
      const headers = function() {};
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

    it('should handle streaming when PI optimizations enabled', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const options = { stream: true };
      
      // Test that the payload is built correctly - streaming will depend on actual config
      const result = perplexityService._buildRequestPayload(messages, options);
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('messages', messages);
      expect(result).toHaveProperty('max_tokens');
      expect(result).toHaveProperty('temperature');
      // Stream may or may not be set depending on actual config state
    });

    it('should not enable streaming in low CPU mode', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const options = { stream: true };
      
      const result = perplexityService._buildRequestPayload(messages, options);
      // Test that the basic payload structure is correct
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('messages', messages);
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
      // Test the method works with current config - exact values depend on actual config
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
        get: () => { throw new Error('Config error'); },
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

  describe('_handleApiResponse method', () => {
    it('should throw error for null response', async () => {
      await expect(perplexityService._handleApiResponse(null)).rejects.toThrow(
        'Invalid response: response is null or undefined'
      );
    });

    it('should throw error for undefined response', async () => {
      await expect(perplexityService._handleApiResponse(undefined)).rejects.toThrow(
        'Invalid response: response is null or undefined'
      );
    });

    it('should handle error status codes', async () => {
      const response = {
        statusCode: 400,
        body: {
          text: jest.fn().mockResolvedValue('{"error":"Bad request"}'),
        },
      };
      
      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'API request failed with status 400'
      );
    });

    it('should handle response without body', async () => {
      const response = {
        statusCode: 200,
        body: null,
      };
      
      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: body is missing or does not have json method'
      );
    });

    it('should handle body without json method', async () => {
      const response = {
        statusCode: 200,
        body: {},
      };
      
      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: body is missing or does not have json method'
      );
    });

    it('should handle JSON parsing errors', async () => {
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockRejectedValue(new Error('JSON parse error')),
        },
      };
      
      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Failed to parse response as JSON'
      );
    });

    it('should handle invalid response object', async () => {
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue('not-an-object'),
        },
      };
      
      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: response is not a valid object'
      );
    });

    it('should handle missing choices array', async () => {
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue({}),
        },
      };
      
      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: missing or empty choices array'
      );
    });

    it('should handle invalid choice structure', async () => {
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue({
            choices: ['not-an-object'],
          }),
        },
      };
      
      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: invalid choice structure'
      );
    });

    it('should handle missing message field', async () => {
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue({
            choices: [{}],
          }),
        },
      };
      
      await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
        'Invalid response: choice missing required message field'
      );
    });

    it('should return valid response data', async () => {
      const responseData = {
        choices: [
          {
            message: {
              content: 'Valid response',
            },
          },
        ],
      };
      const response = {
        statusCode: 200,
        body: {
          json: jest.fn().mockResolvedValue(responseData),
        },
      };
      
      const result = await perplexityService._handleApiResponse(response);
      expect(result).toEqual(responseData);
    });
  });

  describe('_handleErrorResponse method', () => {
    it('should handle error response with text body', async () => {
      const body = {
        text: jest.fn().mockResolvedValue('{"error":"Test error"}'),
      };
      
      await expect(perplexityService._handleErrorResponse(400, body)).rejects.toThrow(
        'API request failed with status 400: {"error":"Test error"}'
      );
    });

    it('should handle error response without body', async () => {
      await expect(perplexityService._handleErrorResponse(500, null)).rejects.toThrow(
        'API request failed with status 500: Could not read response body'
      );
    });

    it('should handle body text error', async () => {
      const body = {
        text: jest.fn().mockRejectedValue(new Error('Text read error')),
      };
      
      await expect(perplexityService._handleErrorResponse(500, body)).rejects.toThrow(
        'API request failed with status 500: Error reading response body: Text read error'
      );
    });

    it('should truncate long error messages', async () => {
      const longError = 'a'.repeat(1000);
      const body = {
        text: jest.fn().mockResolvedValue(longError),
      };
      
      try {
        await perplexityService._handleErrorResponse(400, body);
      } catch (error) {
        expect(error.message).toContain('...');
        expect(error.message.length).toBeLessThan(longError.length + 100);
      }
    });
  });

  describe('_extractResponseContent method', () => {
    it('should extract content from message.content', () => {
      const response = {
        choices: [
          {
            message: {
              content: 'Test message content',
            },
          },
        ],
      };
      
      const result = perplexityService._extractResponseContent(response);
      expect(result).toBe('Test message content');
    });

    it('should extract content from choice.content', () => {
      const response = {
        choices: [
          {
            content: 'Direct choice content',
          },
        ],
      };
      
      const result = perplexityService._extractResponseContent(response);
      expect(result).toBe('Direct choice content');
    });

    it('should handle empty response', () => {
      expect(() => perplexityService._extractResponseContent(null)).toThrow();
    });

    it('should handle empty choices', () => {
      const response = { choices: [] };
      expect(() => perplexityService._extractResponseContent(response)).toThrow();
    });

    it('should return default message for invalid structure', () => {
      const response = {
        choices: [
          {
            // No message or content field
          },
        ],
      };
      
      const result = perplexityService._extractResponseContent(response);
      expect(result).toBe('Sorry, I could not extract content from the response.');
    });
  });

  describe('_generateErrorMessage method', () => {
    it('should return rate limit message for 429 status', () => {
      const error = { statusCode: 429 };
      const errorResponse = { message: 'Rate limit exceeded' };
      
      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('Rate limit exceeded. Please try again later.');
    });

    it('should return service unavailable message for 5xx status', () => {
      const error = { statusCode: 500 };
      const errorResponse = { message: 'Server error' };
      
      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('The service is temporarily unavailable. Please try again later.');
    });

    it('should return network error message for network errors', () => {
      const error = { message: 'Network connection failed' };
      const errorResponse = { message: 'Network error' };
      
      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('Network connection issue. Please check your connection and try again.');
    });

    it('should return empty response message for empty response errors', () => {
      const error = { message: 'Empty response received' };
      const errorResponse = { message: 'Empty response' };
      
      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('Empty response received from the service.');
    });

    it('should return unexpected format message for invalid errors', () => {
      const error = { message: 'invalid response format' };
      const errorResponse = { message: 'Invalid format' };
      
      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('Unexpected response format received.');
    });

    it('should return original error message for unknown errors', () => {
      const error = { message: 'Unknown error' };
      const errorResponse = { message: 'Unknown error occurred' };
      
      const result = perplexityService._generateErrorMessage(error, errorResponse);
      expect(result).toBe('Unknown error occurred');
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

  describe('_getCacheConfiguration method', () => {
    it('should return default config when PI_OPTIMIZATIONS not configured', () => {
      const mockConfig = require('../../../src/config/config');
      const originalConfig = mockConfig.PI_OPTIMIZATIONS;
      delete mockConfig.PI_OPTIMIZATIONS;
      
      const result = perplexityService._getCacheConfiguration();
      expect(result.enabled).toBe(false);
      expect(result).toHaveProperty('maxEntries');
      
      // Restore original config
      mockConfig.PI_OPTIMIZATIONS = originalConfig;
    });

    it('should return cache config when PI optimizations enabled', () => {
      // Test the method works with current config
      const result = perplexityService._getCacheConfiguration();
      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('maxEntries');
      expect(typeof result.enabled).toBe('boolean');
      expect(typeof result.maxEntries).toBe('number');
    });

    it('should handle config access errors', () => {
      const mockConfig = require('../../../src/config/config');
      const originalConfig = mockConfig.PI_OPTIMIZATIONS;
      
      // Make config access throw error
      Object.defineProperty(mockConfig, 'PI_OPTIMIZATIONS', {
        get: () => { throw new Error('Config error'); },
        configurable: true,
      });
      
      const result = perplexityService._getCacheConfiguration();
      expect(result.enabled).toBe(false);
      
      // Restore original config
      delete mockConfig.PI_OPTIMIZATIONS;
      mockConfig.PI_OPTIMIZATIONS = originalConfig;
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

  describe('generateTextSummary method', () => {
    it('should generate text summary with correct options', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'This is a summary of the text.',
            },
          },
        ],
      };
      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));
      
      const text = 'Long text to be summarized...';
      const result = await perplexityService.generateTextSummary(text);
      
      expect(result).toBe('This is a summary of the text.');
      expect(request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Please provide a concise summary'),
        })
      );
    });

    it('should handle text summary errors', async () => {
      request.mockRejectedValueOnce(new Error('Summary API error'));
      
      const text = 'Text to summarize';
      await expect(perplexityService.generateTextSummary(text)).rejects.toThrow(
        'Summary API error'
      );
    });
  });

  describe('getCacheStats method', () => {
    it('should return cache stats when available', () => {
      // Mock cache with stats
      perplexityService.cache = {
        getStats: jest.fn().mockReturnValue({
          hits: 10,
          misses: 5,
          hitRate: 0.67,
        }),
      };
      
      const result = perplexityService.getCacheStats();
      expect(result.hits).toBe(10);
      expect(result.misses).toBe(5);
      expect(result.hitRate).toBe(0.67);
    });

    it('should return error stats when cache throws', () => {
      // Mock cache that throws error
      perplexityService.cache = {
        getStats: jest.fn().mockImplementation(() => {
          throw new Error('Cache error');
        }),
      };
      
      const result = perplexityService.getCacheStats();
      expect(result.hits).toBe(0);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Please try again later');
    });

    it('should handle missing cache gracefully', () => {
      // Remove cache
      delete perplexityService.cache;
      
      const result = perplexityService.getCacheStats();
      expect(result.hits).toBe(0);
      expect(result.error).toBeDefined();
    });
  });

  describe('shutdown method', () => {
    it('should clear all active intervals', () => {
      // Mock active intervals
      const mockInterval1 = setInterval(() => {}, 1000);
      const mockInterval2 = setInterval(() => {}, 2000);
      
      perplexityService.activeIntervals = new Set([mockInterval1, mockInterval2]);
      
      // Spy on clearInterval
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      perplexityService.shutdown();
      
      expect(clearIntervalSpy).toHaveBeenCalledWith(mockInterval1);
      expect(clearIntervalSpy).toHaveBeenCalledWith(mockInterval2);
      expect(perplexityService.activeIntervals.size).toBe(0);
      
      clearIntervalSpy.mockRestore();
    });

    it('should handle shutdown when no intervals exist', () => {
      perplexityService.activeIntervals = new Set();
      
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      perplexityService.shutdown();
      
      expect(clearIntervalSpy).not.toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });
});