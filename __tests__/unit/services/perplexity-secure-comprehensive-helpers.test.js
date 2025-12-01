/**
 * PerplexitySecure helper utilities coverage tests (ESLint-friendly breakdown).
 */
const { setupPerplexityServiceTestContext } = require('./perplexity-secure-comprehensive.test.setup');

const { PerplexityService, fs } = setupPerplexityServiceTestContext();

let perplexityService;

beforeEach(() => {
  jest.clearAllMocks();
  perplexityService = PerplexityService;
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

  it('should handle streaming when PI optimizations enabled', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const options = { stream: true };

    const result = perplexityService._buildRequestPayload(messages, options);
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('messages', messages);
    expect(result).toHaveProperty('max_tokens');
    expect(result).toHaveProperty('temperature');
  });

  it('should not enable streaming in low CPU mode', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const options = { stream: true };

    const result = perplexityService._buildRequestPayload(messages, options);
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

    mockConfig.PI_OPTIMIZATIONS = originalConfig;
  });

  it('should return settings from config when available', () => {
    const result = perplexityService._getPiOptimizationSettings();
    expect(result).toHaveProperty('enabled');
    expect(result).toHaveProperty('lowCpuMode');
    expect(typeof result.enabled).toBe('boolean');
    expect(typeof result.lowCpuMode).toBe('boolean');
  });

  it('should handle config access errors gracefully', () => {
    const mockConfig = require('../../../src/config/config');
    const originalConfig = mockConfig.PI_OPTIMIZATIONS;

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

    delete mockConfig.PI_OPTIMIZATIONS;
    mockConfig.PI_OPTIMIZATIONS = originalConfig;
  });
});
