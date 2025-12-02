/**
 * PerplexitySecure cache helpers split tests (QLTY-friendly).
 */
const {
  setupPerplexityServiceTestContext,
} = require('./perplexity-secure-comprehensive.test.setup');

const { PerplexityService, fs, crypto } = setupPerplexityServiceTestContext();

let perplexityService;

beforeEach(() => {
  jest.clearAllMocks();
  perplexityService = PerplexityService;
  fs.readFile.mockRejectedValue(new Error('File not found'));
});

describe('_getCacheConfiguration method', () => {
  it('should return default config when PI_OPTIMIZATIONS not configured', () => {
    const mockConfig = require('../../../src/config/config');
    const originalConfig = mockConfig.PI_OPTIMIZATIONS;
    delete mockConfig.PI_OPTIMIZATIONS;

    const result = perplexityService._getCacheConfiguration();
    expect(result.enabled).toBe(false);
    expect(result).toHaveProperty('maxEntries');

    mockConfig.PI_OPTIMIZATIONS = originalConfig;
  });

  it('should return cache config when PI optimizations enabled', () => {
    const result = perplexityService._getCacheConfiguration();
    expect(result).toHaveProperty('enabled');
    expect(result).toHaveProperty('maxEntries');
    expect(typeof result.enabled).toBe('boolean');
    expect(typeof result.maxEntries).toBe('number');
  });

  it('should handle config access errors', () => {
    const mockConfig = require('../../../src/config/config');
    const originalConfig = mockConfig.PI_OPTIMIZATIONS;

    Object.defineProperty(mockConfig, 'PI_OPTIMIZATIONS', {
      get: () => {
        throw new Error('Config error');
      },
      configurable: true,
    });

    const result = perplexityService._getCacheConfiguration();
    expect(result.enabled).toBe(false);

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

    perplexityService._generateCacheKey(history1);
    perplexityService._generateCacheKey(history2);

    expect(crypto.createHash).toHaveBeenCalledTimes(2);
    expect(crypto.createHash).toHaveBeenCalledWith('md5');
  });
});

describe('getCacheStats method', () => {
  it('should return cache stats when available', () => {
    perplexityService.cacheManager = {
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
    perplexityService.cacheManager = {
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
    delete perplexityService.cacheManager;

    const result = perplexityService.getCacheStats();
    expect(result.hits).toBe(0);
    expect(result.error).toBeDefined();
  });
});
